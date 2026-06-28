#!/usr/bin/env python3
"""Script all-in-one: busca PACOTE_SECRET da Lambda, gera .cpkg licenciado e insere token no DynamoDB.

Uso:
  python scripts/gerar_teste_licenciado.py
  python scripts/gerar_teste_licenciado.py --output meu-teste.cpkg --max-usos 3

O script busca PACOTE_SECRET do ambiente da função Lambda (personal-trainer-prod-ApiFunction-*).
Não imprime o secret em momento algum.
"""
import argparse
import sys


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera pacote licenciado de teste e insere token no DynamoDB")
    parser.add_argument("--output", default="pacote-teste-licenciado.cpkg", help="Arquivo .cpkg de saída")
    parser.add_argument("--max-usos", type=int, default=1)
    parser.add_argument("--profile", default="pessoal-hotmail")
    parser.add_argument("--region", default="us-east-1")
    parser.add_argument("--table", default="personal-trainer-prod")
    parser.add_argument("--stack", default="personal-trainer-prod", help="Nome da stack SAM")
    args = parser.parse_args()

    try:
        import boto3
    except ImportError:
        print("Erro: boto3 não instalado. Execute: pip install boto3", file=sys.stderr)
        sys.exit(1)

    session = boto3.Session(profile_name=args.profile, region_name=args.region)

    # 1. Descobre o nome da Lambda via CloudFormation outputs
    cf = session.client("cloudformation")
    try:
        resources = cf.list_stack_resources(StackName=args.stack)["StackResourceSummaries"]
        fn_name = next(
            r["PhysicalResourceId"]
            for r in resources
            if r["LogicalResourceId"] == "ApiFunction"
        )
    except (StopIteration, Exception) as e:
        print(f"Erro ao localizar ApiFunction na stack '{args.stack}': {e}", file=sys.stderr)
        sys.exit(1)

    # 2. Busca PACOTE_SECRET do ambiente da Lambda
    lam = session.client("lambda")
    try:
        env_vars = lam.get_function_configuration(FunctionName=fn_name).get("Environment", {}).get("Variables", {})
        secret = env_vars.get("PACOTE_SECRET", "")
    except Exception as e:
        print(f"Erro ao obter configuração da Lambda '{fn_name}': {e}", file=sys.stderr)
        sys.exit(1)

    if not secret:
        print("PACOTE_SECRET não configurado na Lambda. Faça o deploy com --parameter-overrides PacoteSecret=<valor>.", file=sys.stderr)
        sys.exit(1)

    # 3. Gera o pacote (sem imprimir o secret)
    import os
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from gerar_pacote_teste import gerar
    pacote, token, token_uuid = gerar(secret, free=False)
    del secret  # limpa da memória

    import json
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(pacote, f, ensure_ascii=False, indent=2)

    print(f"Pacote gerado: {args.output}")
    print(f"Pacote ID: {pacote['pacote']['id']}")
    print(f"Token:    {token}")

    # 4. Insere token no DynamoDB
    from decimal import Decimal

    def to_dynamo(v):
        if isinstance(v, float):
            return Decimal(str(v))
        if isinstance(v, int):
            return v
        if isinstance(v, dict):
            return {k: to_dynamo(x) for k, x in v.items()}
        if isinstance(v, list):
            return [to_dynamo(x) for x in v]
        return v

    dynamo = session.resource("dynamodb")
    table = dynamo.Table(args.table)
    item = {
        "PK": f"PKTOKEN#{token_uuid}",
        "SK": "META",
        "token": token,
        "pacote_id": pacote["pacote"]["id"],
        "max_usos": args.max_usos,
        "usos_count": 0,
        "usado_por": [],
        "criado_em": "2026-06-27T00:00:00+00:00",
    }
    table.put_item(Item=to_dynamo(item))

    print(f"Token inserido no DynamoDB (tabela: {args.table})")
    print()
    print("PRONTO! Importe o arquivo .cpkg na aba 'Importar' > drag-and-drop do portal.")


if __name__ == "__main__":
    main()
