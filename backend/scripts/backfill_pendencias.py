"""Backfill único: semeia os insumos denormalizados que alimentam as pendências na listagem
de alunos do portal (app.services.pendencia_service).

Três campos, todos na partição PT#{personal} (a listagem lê tudo de lá, sem fan-out):
  • ALUNO#{aluno}.vigencias        <- janelas {i,f} dos treinos ativos do aluno
  • ALUNO#{aluno}.ultimo_treino_em <- AL#{aluno}/STATS#ALUNO.ultimo_treino
  • COBRANCA_ALUNO#{aluno}.vencidas <- nº de COBRANCA# com status VENCIDA

Sem este backfill, `vigencias` fica ausente nos alunos legados — e a regra "sem treino vigente"
deliberadamente NÃO dispara quando o campo é desconhecido (melhor silêncio que alarme falso),
então a pendência só apareceria quando o personal editasse algum treino daquele aluno.

O Scan aqui é aceitável: script administrativo, roda uma vez, fora do caminho de request.

Uso:
  # Dry-run (mostra o que mudaria, não escreve nada):
  python scripts/backfill_pendencias.py --profile pessoal-hotmail

  # Executa o backfill:
  python scripts/backfill_pendencias.py --profile pessoal-hotmail --execute
"""
import argparse

import boto3
from boto3.dynamodb.conditions import Attr, Key

TABLE_DEFAULT = "personal-trainer-prod"
REGION = "us-east-1"


def scan_ponteiros(table) -> list[dict]:
    """Ponteiros PT#{personal}/ALUNO#{aluno} — um por aluno, com o personal na PK."""
    items: list[dict] = []
    kwargs = {
        "FilterExpression": Attr("SK").begins_with("ALUNO#") & Attr("PK").begins_with("PT#"),
        "ProjectionExpression": "PK, SK, aluno_id, vigencias, ultimo_treino_em",
    }
    while True:
        resp = table.scan(**kwargs)
        items.extend(resp.get("Items", []))
        last = resp.get("LastEvaluatedKey")
        if not last:
            break
        kwargs["ExclusiveStartKey"] = last
    return items


def _query(table, pk: str, sk_prefix: str, projection: str) -> list[dict]:
    items: list[dict] = []
    kwargs = {
        "KeyConditionExpression": Key("PK").eq(pk) & Key("SK").begins_with(sk_prefix),
        "ProjectionExpression": projection,
    }
    while True:
        resp = table.query(**kwargs)
        items.extend(resp.get("Items", []))
        last = resp.get("LastEvaluatedKey")
        if not last:
            break
        kwargs["ExclusiveStartKey"] = last
    return items


def _cobrancas_vencidas(table, aluno_id: str) -> int:
    """Nº de cobranças VENCIDA do aluno. begins_with("COBRANCA#") pega só cobranças reais
    (CONFIG/IDX usam underscore); `status` é palavra reservada, daí o alias de nome."""
    items: list[dict] = []
    kwargs = {
        "KeyConditionExpression": Key("PK").eq(f"AL#{aluno_id}") & Key("SK").begins_with("COBRANCA#"),
        "ProjectionExpression": "#st",
        "ExpressionAttributeNames": {"#st": "status"},
    }
    while True:
        resp = table.query(**kwargs)
        items.extend(resp.get("Items", []))
        last = resp.get("LastEvaluatedKey")
        if not last:
            break
        kwargs["ExclusiveStartKey"] = last
    return sum(1 for c in items if c.get("status") == "VENCIDA")


def run(table_name: str, profile: str, execute: bool) -> None:
    session = boto3.Session(profile_name=profile, region_name=REGION)
    table = session.resource("dynamodb").Table(table_name)

    ponteiros = scan_ponteiros(table)
    print(f"{len(ponteiros)} ponteiro(s) de aluno encontrado(s)")

    planejado: list[tuple[dict, list[dict], str | None, int]] = []
    for p in ponteiros:
        aluno_id = p.get("aluno_id")
        if not aluno_id:
            continue
        pk = p["PK"]
        treinos = _query(table, f"AL#{aluno_id}", "TREINO#", "ativo, data_inicio, data_fim")
        vigencias = [
            {k: v for k, v in (("i", t.get("data_inicio")), ("f", t.get("data_fim"))) if v}
            for t in treinos if t.get("ativo", True)
        ]
        stats = table.get_item(
            Key={"PK": f"AL#{aluno_id}", "SK": "STATS#ALUNO"}, ProjectionExpression="ultimo_treino"
        ).get("Item") or {}
        vencidas = _cobrancas_vencidas(table, aluno_id)
        planejado.append((p, vigencias, stats.get("ultimo_treino"), vencidas))
        if not execute and len(planejado) % 50 == 0:
            print(f"  ... {len(planejado)} alunos lidos")

    if not execute:
        sem_vigente = sum(1 for _, v, _, _ in planejado if not v)
        com_atraso = sum(1 for _, _, _, n in planejado if n)
        sem_treinar = sum(1 for _, _, u, _ in planejado if not u)
        print(f"\n== {len(planejado)} aluno(s) a atualizar ==")
        print(f"  {sem_vigente} sem nenhum treino ativo")
        print(f"  {sem_treinar} sem nenhuma sessão finalizada registrada")
        print(f"  {com_atraso} com cobrança vencida")
        for p, vig, ult, venc in planejado[:15]:
            print(f"  {p['PK']} / {p['SK']}: vigencias={len(vig)} "
                  f"ultimo_treino_em={ult or '(vazio)'} vencidas={venc}")
        if len(planejado) > 15:
            print(f"  ... e mais {len(planejado) - 15}")
        print("\nRode com --execute para aplicar as mudanças.")
        return

    ponteiros_ok = cobrancas_ok = 0
    for p, vigencias, ultimo, vencidas in planejado:
        fields = {"vigencias": vigencias}
        if ultimo:
            fields["ultimo_treino_em"] = ultimo
        expr = "SET " + ", ".join(f"#{k} = :{k}" for k in fields)
        table.update_item(
            Key={"PK": p["PK"], "SK": p["SK"]},
            UpdateExpression=expr,
            # Não recria ponteiro de aluno já apagado.
            ConditionExpression="attribute_exists(PK)",
            ExpressionAttributeNames={f"#{k}": k for k in fields},
            ExpressionAttributeValues={f":{k}": v for k, v in fields.items()},
        )
        ponteiros_ok += 1
        aluno_id = p["aluno_id"]
        cob_key = {"PK": p["PK"], "SK": f"COBRANCA_ALUNO#{aluno_id}"}
        if vencidas:
            table.update_item(
                Key=cob_key,
                UpdateExpression="SET aluno_id = :a, vencidas = :v",
                ExpressionAttributeValues={":a": aluno_id, ":v": vencidas},
            )
            cobrancas_ok += 1
        else:
            # Zera contador porventura defasado, sem criar ponteiro para aluno sem cobrança.
            try:
                table.update_item(
                    Key=cob_key,
                    UpdateExpression="SET vencidas = :z",
                    ConditionExpression="attribute_exists(PK)",
                    ExpressionAttributeValues={":z": 0},
                )
            except table.meta.client.exceptions.ConditionalCheckFailedException:
                pass
    print(f"{ponteiros_ok} ponteiro(s) atualizado(s), "
          f"{cobrancas_ok} contador(es) de cobrança vencida semeado(s).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", default="pessoal-hotmail")
    parser.add_argument("--table", default=TABLE_DEFAULT)
    parser.add_argument("--execute", action="store_true", help="Aplica o backfill (default: dry-run)")
    args = parser.parse_args()
    run(args.table, args.profile, args.execute)
