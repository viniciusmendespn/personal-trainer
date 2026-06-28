#!/usr/bin/env python3
"""Insere um token de pacote no DynamoDB para permitir a importação de um .cpkg licenciado.

Uso:
  python scripts/seed_token.py \
    --token-uuid <uuid4-do-token> \
    --pacote-id <id-do-pacote> \
    --table personal-trainer-prod \
    --profile pessoal-hotmail \
    [--max-usos 1]

  # Ou passando o JSON diretamente (saída de gerar_pacote_teste.py --seed-token):
  python scripts/seed_token.py --item '{"PK":"PKTOKEN#...","SK":"META",...}' --table personal-trainer-prod
"""
import argparse
import json
import sys


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed de token de pacote no DynamoDB")
    parser.add_argument("--token-uuid", help="UUID4 do token (sem o prefixo tok_)")
    parser.add_argument("--pacote-id", help="ID do pacote (campo pacote.id no .cpkg)")
    parser.add_argument("--max-usos", type=int, default=1, help="Máximo de usos (padrão: 1)")
    parser.add_argument("--item", help="JSON completo do item DynamoDB (alternativa aos campos individuais)")
    parser.add_argument("--table", default="personal-trainer-prod", help="Nome da tabela DynamoDB")
    parser.add_argument("--profile", default="pessoal-hotmail", help="AWS profile (padrão: pessoal-hotmail)")
    parser.add_argument("--region", default="us-east-1", help="AWS region (padrão: us-east-1)")
    args = parser.parse_args()

    try:
        import boto3
    except ImportError:
        print("Erro: boto3 não instalado. Execute: pip install boto3", file=sys.stderr)
        sys.exit(1)

    if args.item:
        try:
            item = json.loads(args.item)
        except json.JSONDecodeError as e:
            print(f"Erro ao parsear --item: {e}", file=sys.stderr)
            sys.exit(1)
    elif args.token_uuid and args.pacote_id:
        item = {
            "PK": f"PKTOKEN#{args.token_uuid}",
            "SK": "META",
            "token": f"tok_{args.token_uuid}",
            "pacote_id": args.pacote_id,
            "max_usos": args.max_usos,
            "usos_count": 0,
            "usado_por": [],
            "criado_em": "2026-01-01T00:00:00+00:00",
        }
    else:
        print("Erro: forneça --item ou --token-uuid + --pacote-id", file=sys.stderr)
        sys.exit(1)

    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    dynamodb = session.resource("dynamodb")
    table = dynamodb.Table(args.table)

    # Converte int para Decimal para DynamoDB
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

    table.put_item(Item=to_dynamo(item))

    pk = item.get("PK", "")
    token = item.get("token", "")
    max_usos = item.get("max_usos", 1)
    print(f"Token inserido com sucesso!")
    print(f"  PK: {pk}")
    print(f"  Token: {token}")
    print(f"  Max usos: {max_usos}")
    print(f"  Tabela: {args.table}")


if __name__ == "__main__":
    main()
