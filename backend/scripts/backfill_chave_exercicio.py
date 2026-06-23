"""Migração única: reindexa registros e recordes (PR) para agrupar por NOME do exercício
(`chave_exercicio`) em vez de `exercicio_id`. Necessária porque exercícios homônimos cadastrados
em treinos diferentes ganhavam `exercicio_id`s distintos e apareciam como séries/recordes
separados na evolução — ver `app.services.sessao_service.chave_exercicio`.

Passo 1 — Registro (SK "REG#..."): recalcula o atributo GSI1PK a partir de `exercicio_nome`
(atributo simples, não é chave da tabela — UpdateItem in-place).

Passo 2 — STATS#PR# (recordes): a chave canônica é o sufixo da SK, que É chave da tabela — não
dá pra "renomear" via UpdateItem. Agrupa os PRs de cada aluno por chave_exercicio, mantém o maior
`carga` (empate: mais recente), grava em STATS#PR#{chave} e apaga os itens antigos (PutItem +
DeleteItem).

Uso:
  # Dry-run (lista o que seria alterado, não escreve nada):
  python scripts/backfill_chave_exercicio.py --profile pessoal-hotmail

  # Executa a migração:
  python scripts/backfill_chave_exercicio.py --profile pessoal-hotmail --execute
"""
import argparse
import unicodedata

import boto3
from boto3.dynamodb.conditions import Attr

TABLE_DEFAULT = "personal-trainer-prod"
REGION = "us-east-1"


def chave_exercicio(nome: str | None) -> str:
    """Mesma normalização de app.services.sessao_service.chave_exercicio — duplicada aqui
    para manter o script standalone (sem depender do app FastAPI)."""
    if not nome:
        return ""
    sem_acento = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode()
    return " ".join(sem_acento.lower().split())


def gsi1_registro(aluno_id: str, chave: str) -> str:
    return f"AL#{aluno_id}#EX#{chave}"


def sk_stats_pr(chave: str) -> str:
    return f"STATS#PR#{chave}"


def scan_all(table, sk_prefix: str, projection: str) -> list[dict]:
    items: list[dict] = []
    kwargs = {"FilterExpression": Attr("SK").begins_with(sk_prefix), "ProjectionExpression": projection}
    while True:
        resp = table.scan(**kwargs)
        items.extend(resp.get("Items", []))
        last = resp.get("LastEvaluatedKey")
        if not last:
            break
        kwargs["ExclusiveStartKey"] = last
    return items


def migrar_registros(table, execute: bool) -> None:
    items = scan_all(table, "REG#", "PK, SK, exercicio_nome, GSI1PK")
    a_atualizar = []
    for it in items:
        nova_pk = gsi1_registro(it["PK"].removeprefix("AL#"), chave_exercicio(it.get("exercicio_nome")))
        if it.get("GSI1PK") != nova_pk:
            a_atualizar.append((it["PK"], it["SK"], it.get("GSI1PK"), nova_pk))

    print(f"\n== Registros (REG#) — {len(a_atualizar)} de {len(items)} com GSI1PK desatualizado ==")
    for pk, sk, antiga, nova in a_atualizar[:20]:
        print(f"  {pk} / {sk}: {antiga} -> {nova}")
    if len(a_atualizar) > 20:
        print(f"  ... e mais {len(a_atualizar) - 20}")

    if execute and a_atualizar:
        print("\nAtualizando GSI1PK...")
        for pk, sk, _antiga, nova in a_atualizar:
            table.update_item(
                Key={"PK": pk, "SK": sk},
                UpdateExpression="SET GSI1PK = :v",
                ExpressionAttributeValues={":v": nova},
            )
        print(f"{len(a_atualizar)} registro(s) atualizado(s).")


def migrar_prs(table, execute: bool) -> None:
    items = scan_all_prs(table)

    grupos: dict[tuple[str, str], list[dict]] = {}
    for it in items:
        chave = chave_exercicio(it.get("exercicio_nome"))
        grupos.setdefault((it["PK"], chave), []).append(it)

    a_escrever = []  # (pk, nova_sk, item_vencedor)
    a_apagar = []    # (pk, sk_antiga)
    for (pk, chave), grupo in grupos.items():
        nova_sk = sk_stats_pr(chave)
        vencedor = max(grupo, key=lambda i: (float(i.get("carga") or 0), str(i.get("data") or "")))
        if len(grupo) > 1 or grupo[0]["SK"] != nova_sk:
            a_escrever.append((pk, nova_sk, vencedor))
            for it in grupo:
                if it["SK"] != nova_sk:
                    a_apagar.append((pk, it["SK"]))

    print(f"\n== Recordes (STATS#PR#) — {len(grupos)} chave(s) únicas a partir de {len(items)} item(ns) ==")
    for pk, nova_sk, vencedor in a_escrever[:20]:
        print(f"  {pk} / {nova_sk}: carga={vencedor.get('carga')} exercicio_nome={vencedor.get('exercicio_nome')!r}")
    if len(a_escrever) > 20:
        print(f"  ... e mais {len(a_escrever) - 20}")
    print(f"  ({len(a_apagar)} item(ns) antigo(s) a remover)")

    if execute:
        print("\nGravando PRs unificados e removendo antigos...")
        for pk, nova_sk, vencedor in a_escrever:
            novo_item = dict(vencedor)
            novo_item["SK"] = nova_sk
            table.put_item(Item=novo_item)
        for pk, sk in a_apagar:
            table.delete_item(Key={"PK": pk, "SK": sk})
        print(f"{len(a_escrever)} PR(s) gravado(s), {len(a_apagar)} item(ns) antigo(s) removido(s).")


def scan_all_prs(table) -> list[dict]:
    items: list[dict] = []
    kwargs = {
        "FilterExpression": Attr("SK").begins_with("STATS#PR#"),
        "ProjectionExpression": "PK, SK, carga, exercicio_nome, #d",
        "ExpressionAttributeNames": {"#d": "data"},
    }
    while True:
        resp = table.scan(**kwargs)
        items.extend(resp.get("Items", []))
        last = resp.get("LastEvaluatedKey")
        if not last:
            break
        kwargs["ExclusiveStartKey"] = last
    return items


def run(table_name: str, profile: str, execute: bool) -> None:
    session = boto3.Session(profile_name=profile, region_name=REGION)
    table = session.resource("dynamodb").Table(table_name)

    migrar_registros(table, execute)
    migrar_prs(table, execute)

    if not execute:
        print("\nRode com --execute para aplicar as mudanças.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", default="pessoal-hotmail")
    parser.add_argument("--table", default=TABLE_DEFAULT)
    parser.add_argument("--execute", action="store_true", help="Aplica a migração (default: dry-run)")
    args = parser.parse_args()
    run(args.table, args.profile, args.execute)
