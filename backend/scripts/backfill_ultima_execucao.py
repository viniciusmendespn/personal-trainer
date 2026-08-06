"""Backfill único: preenche `ultima_execucao` nos itens TREINO# a partir das sessões já
finalizadas. O campo passou a ser gravado no `finish` (app.services.sessao_service), então sem
este backfill um treino executado ANTES do deploy fica sem a marca de "feito nesta semana" na
lista do app do aluno até ser executado de novo.

Só olha as sessões dos últimos N dias (default 30) — o consumidor é o recorte da semana
corrente, execuções mais antigas não mudam nada na tela.

A escrita é condicional: só grava se o item TREINO# existir e o valor atual for menor (ou
ausente), então rodar duas vezes é inofensivo e não sobrescreve execução mais recente.

Uso:
  # Dry-run (lista o que seria alterado, não escreve nada):
  python scripts/backfill_ultima_execucao.py --profile pessoal-hotmail

  # Executa o backfill:
  python scripts/backfill_ultima_execucao.py --profile pessoal-hotmail --execute
"""
import argparse
from datetime import datetime, timedelta, timezone

import boto3
from boto3.dynamodb.conditions import Attr

TABLE_DEFAULT = "personal-trainer-prod"
REGION = "us-east-1"
SK_SESSION_ACTIVE = "SESSION#ACTIVE"


def scan_sessoes(table, cutoff_iso: str) -> list[dict]:
    """Sessões finalizadas com `data_hora_fim` >= cutoff. ISO UTC compara lexicograficamente,
    então o filtro de data roda no próprio DynamoDB."""
    items: list[dict] = []
    kwargs = {
        "FilterExpression": Attr("SK").begins_with("SESSION#") & Attr("data_hora_fim").gte(cutoff_iso),
        "ProjectionExpression": "PK, SK, treino_id, data_hora_fim",
    }
    while True:
        resp = table.scan(**kwargs)
        items.extend(resp.get("Items", []))
        last = resp.get("LastEvaluatedKey")
        if not last:
            break
        kwargs["ExclusiveStartKey"] = last
    return items


def ultimas_por_treino(sessoes: list[dict]) -> dict[tuple[str, str], str]:
    """(PK do aluno, treino_id) -> maior data_hora_fim."""
    ultimas: dict[tuple[str, str], str] = {}
    for s in sessoes:
        if s["SK"] == SK_SESSION_ACTIVE:
            continue
        treino_id, fim = s.get("treino_id"), s.get("data_hora_fim")
        if not treino_id or not fim:
            continue
        chave = (s["PK"], treino_id)
        if fim > ultimas.get(chave, ""):
            ultimas[chave] = fim
    return ultimas


def run(table_name: str, profile: str, dias: int, execute: bool) -> None:
    session = boto3.Session(profile_name=profile, region_name=REGION)
    table = session.resource("dynamodb").Table(table_name)

    cutoff = (datetime.now(timezone.utc) - timedelta(days=dias)).isoformat()
    sessoes = scan_sessoes(table, cutoff)
    ultimas = ultimas_por_treino(sessoes)
    print(f"{len(sessoes)} sessão(ões) nos últimos {dias} dias -> {len(ultimas)} par(es) aluno/treino")

    if not execute:
        pendentes = []
        for (pk, treino_id), fim in sorted(ultimas.items()):
            sk = f"TREINO#{treino_id}"
            item = table.get_item(
                Key={"PK": pk, "SK": sk}, ProjectionExpression="ultima_execucao"
            ).get("Item")
            if item is None:
                continue  # treino apagado — o UpdateItem condicional também vai pular
            atual = item.get("ultima_execucao")
            if not atual or atual < fim:
                pendentes.append((pk, sk, atual, fim))

        print(f"\n== {len(pendentes)} item(ns) TREINO# a atualizar ==")
        for pk, sk, atual, fim in pendentes[:20]:
            print(f"  {pk} / {sk}: {atual or '(vazio)'} -> {fim}")
        if len(pendentes) > 20:
            print(f"  ... e mais {len(pendentes) - 20}")
        print("\nRode com --execute para aplicar as mudanças.")
        return

    atualizados = pulados = 0
    for (pk, treino_id), fim in ultimas.items():
        try:
            table.update_item(
                Key={"PK": pk, "SK": f"TREINO#{treino_id}"},
                UpdateExpression="SET ultima_execucao = :v",
                # attribute_exists(PK) impede criar um TREINO# fantasma para treino já apagado.
                ConditionExpression=(
                    "attribute_exists(PK) AND "
                    "(attribute_not_exists(ultima_execucao) OR ultima_execucao < :v)"
                ),
                ExpressionAttributeValues={":v": fim},
            )
            atualizados += 1
        except table.meta.client.exceptions.ConditionalCheckFailedException:
            pulados += 1
    print(f"{atualizados} item(ns) atualizado(s), {pulados} já em dia (ou treino inexistente).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", default="pessoal-hotmail")
    parser.add_argument("--table", default=TABLE_DEFAULT)
    parser.add_argument("--dias", type=int, default=30, help="Janela de sessões a considerar")
    parser.add_argument("--execute", action="store_true", help="Aplica o backfill (default: dry-run)")
    args = parser.parse_args()
    run(args.table, args.profile, args.dias, args.execute)
