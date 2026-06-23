"""Limpeza única de registros ATIVIDADE#{aluno_id} presos como EM_ANDAMENTO
sem SESSION#ACTIVE correspondente.

Uso:
  # Dry-run (lista órfãos, não deleta):
  python scripts/cleanup_atividade.py --profile pessoal-hotmail

  # Executa a limpeza:
  python scripts/cleanup_atividade.py --profile pessoal-hotmail --execute
"""
import argparse

import boto3
from boto3.dynamodb.conditions import Attr

TABLE_DEFAULT = "personal-trainer-prod"
REGION = "us-east-1"


def run(table_name: str, profile: str, execute: bool) -> None:
    session = boto3.Session(profile_name=profile, region_name=REGION)
    ddb = session.resource("dynamodb")
    table = ddb.Table(table_name)

    orfaos = []
    kwargs = {
        "FilterExpression": Attr("SK").begins_with("ATIVIDADE#") & Attr("status").eq("EM_ANDAMENTO"),
        "ProjectionExpression": "PK, SK, aluno_id",
    }
    while True:
        resp = table.scan(**kwargs)
        for item in resp.get("Items", []):
            aluno_id = item.get("aluno_id")
            if not aluno_id:
                continue
            session_resp = table.get_item(
                Key={"PK": f"AL#{aluno_id}", "SK": "SESSION#ACTIVE"},
                ProjectionExpression="PK",
            )
            if "Item" not in session_resp:
                orfaos.append({"PK": item["PK"], "SK": item["SK"], "aluno_id": aluno_id})
        last = resp.get("LastEvaluatedKey")
        if not last:
            break
        kwargs["ExclusiveStartKey"] = last

    if not orfaos:
        print("Nenhum registro órfão encontrado.")
        return

    print(f"{'[DRY-RUN]' if not execute else '[EXECUTE]'} {len(orfaos)} registro(s) órfão(s):\n")
    for o in orfaos:
        print(f"  {o['PK']} / {o['SK']}  (aluno_id={o['aluno_id']})")

    if execute:
        print("\nDeletando...")
        for o in orfaos:
            table.delete_item(Key={"PK": o["PK"], "SK": o["SK"]})
            print(f"  Deletado: {o['SK']}")
        print(f"\n{len(orfaos)} registro(s) removido(s).")
    else:
        print("\nRode com --execute para deletar.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", default="pessoal-hotmail")
    parser.add_argument("--table", default=TABLE_DEFAULT)
    parser.add_argument("--execute", action="store_true", help="Executa a limpeza (default: dry-run)")
    args = parser.parse_args()
    run(args.table, args.profile, args.execute)
