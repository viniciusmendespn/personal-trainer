#!/usr/bin/env python3
"""Backfill da flag origem_licenciada nos itens de pacotes licenciados já instalados.

Necessário porque o bloqueio de redistribuição passou a depender do campo
`origem_licenciada` (em vez do lookup pacote_id→licenciado). Itens importados antes
dessa mudança não têm a flag e ficariam liberados para export — este script corrige.

Para cada meta PACOTE# com licenciado=True, seta origem_licenciada=True na meta e em
todos os seus exlib_ids / template_ids / rotina_ids (só se o item existir — sem phantoms).

Uso:
  python scripts/backfill_origem_licenciada.py            # dry-run (apenas lista)
  python scripts/backfill_origem_licenciada.py --apply    # aplica as alterações
"""
import argparse
import sys


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill origem_licenciada em itens licenciados")
    parser.add_argument("--apply", action="store_true", help="Aplica (sem isso, é dry-run)")
    parser.add_argument("--table", default="personal-trainer-prod")
    parser.add_argument("--profile", default="pessoal-hotmail")
    parser.add_argument("--region", default="us-east-1")
    args = parser.parse_args()

    try:
        import boto3
        from boto3.dynamodb.conditions import Attr
        from botocore.exceptions import ClientError
    except ImportError:
        print("Erro: boto3 não instalado.", file=sys.stderr)
        sys.exit(1)

    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    table = session.resource("dynamodb").Table(args.table)

    # Scan por metas de pacote licenciado
    metas = []
    kwargs = {"FilterExpression": Attr("SK").begins_with("PACOTE#") & Attr("licenciado").eq(True)}
    while True:
        resp = table.scan(**kwargs)
        metas.extend(resp.get("Items", []))
        if "LastEvaluatedKey" not in resp:
            break
        kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]

    print(f"Pacotes licenciados encontrados: {len(metas)}")

    def mark(pk: str, sk: str) -> bool:
        if not args.apply:
            return True
        try:
            table.update_item(
                Key={"PK": pk, "SK": sk},
                UpdateExpression="SET origem_licenciada = :t",
                ConditionExpression="attribute_exists(PK)",
                ExpressionAttributeValues={":t": True},
            )
            return True
        except ClientError as e:
            if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
                return False  # item não existe — ignora
            raise

    total = 0
    for meta in metas:
        pk = meta["PK"]
        sks = [meta["SK"]]
        sks += [f"EXLIB#{i}" for i in (meta.get("exlib_ids") or [])]
        sks += [f"TEMPLATE#{i}" for i in (meta.get("template_ids") or [])]
        sks += [f"ROTINA#{i}" for i in (meta.get("rotina_ids") or [])]
        for sk in sks:
            ok = mark(pk, sk)
            if ok:
                total += 1
        print(f"  {pk} {meta['SK']} → {len(sks)} itens")

    verbo = "marcados" if args.apply else "seriam marcados (dry-run)"
    print(f"\n{total} itens {verbo}.")
    if not args.apply:
        print("Rode com --apply para efetivar.")


if __name__ == "__main__":
    main()
