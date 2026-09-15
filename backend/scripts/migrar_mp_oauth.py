"""Migração única: corta as conexões antigas do Mercado Pago (Access Token colado à mão)
e pede que cada personal reconecte pelo OAuth.

Por que reescrever em vez de apagar: `configurado: false` puro não distingue "nunca
configurou" de "precisa reconectar". Mantendo o item em REQUER_RECONEXAO, o banner do
portal tem o que exibir, a notificação faz sentido, e `conectado_em` sobrevive para o
histórico. O `access_token` sai — é credencial que não vamos mais usar.

Efeito colateral aceito: entre esta migração e cada personal clicar em "Reconectar", os
alunos dele não conseguem pagar por Pix. Por isso o script notifica todo mundo.

⚠️ Rodar SÓ DEPOIS de MP_CLIENT_ID/MP_CLIENT_SECRET estarem na stack — senão o personal
recebe o aviso e encontra o botão de conectar desligado.

Uso:
  # Dry-run (lista o que seria alterado, não escreve nada):
  python scripts/migrar_mp_oauth.py --profile pessoal-hotmail

  # Executa:
  python scripts/migrar_mp_oauth.py --profile pessoal-hotmail --execute
"""
import argparse
import sys
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Attr

TABLE_DEFAULT = "personal-trainer-prod"
REGION = "us-east-1"
SK_CONFIG_MP = "CONFIG#MERCADOPAGO"
STATUS_RECONEXAO = "REQUER_RECONEXAO"

TITULO = "Reconecte seu Mercado Pago"
MENSAGEM = (
    "Agora a conexão com o Mercado Pago é feita com um clique, sem precisar criar "
    "aplicação nem copiar Access Token. Reconecte em Configurações → Pagamentos para "
    "seus alunos voltarem a pagar por Pix."
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def scan_conexoes(table) -> list[dict]:
    """Varre a tabela atrás dos itens de config do MP. Scan é aceitável aqui: roda uma
    vez, fora do caminho de request, com projeção mínima."""
    items, kwargs = [], {
        "FilterExpression": Attr("SK").eq(SK_CONFIG_MP),
        "ProjectionExpression": "PK, configurado_em, #st, origem",
        "ExpressionAttributeNames": {"#st": "status"},
    }
    while True:
        resp = table.scan(**kwargs)
        items.extend(resp.get("Items", []))
        last = resp.get("LastEvaluatedKey")
        if not last:
            return items
        kwargs["ExclusiveStartKey"] = last


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--table", default=TABLE_DEFAULT)
    ap.add_argument("--profile", default=None)
    ap.add_argument("--execute", action="store_true", help="sem isto, é dry-run")
    ap.add_argument("--sem-notificacao", action="store_true",
                    help="só corta a credencial, não avisa (para reprocessar)")
    args = ap.parse_args()

    sessao = boto3.Session(profile_name=args.profile, region_name=REGION)
    table = sessao.resource("dynamodb").Table(args.table)

    conexoes = scan_conexoes(table)
    pendentes = [c for c in conexoes if c.get("status") != STATUS_RECONEXAO]

    print(f"Conexões Mercado Pago encontradas: {len(conexoes)}")
    for c in conexoes:
        marca = "já em reconexão" if c.get("status") == STATUS_RECONEXAO else "SERÁ CORTADA"
        print(f"  {c['PK']}  configurado_em={c.get('configurado_em', '?')}  [{marca}]")

    if not pendentes:
        print("\nNada a fazer.")
        return 0
    if not args.execute:
        print(f"\nDry-run: {len(pendentes)} conexão(ões) seriam cortadas. "
              f"Use --execute para valer.")
        return 0

    # Import tardio: só o caminho --execute precisa do app carregado (e das env vars).
    sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[1]))
    from app.services import notif_service

    for c in pendentes:
        pk = c["PK"]
        table.update_item(
            Key={"PK": pk, "SK": SK_CONFIG_MP},
            UpdateExpression=(
                "SET #st = :st, reconexao_motivo = :m, reconexao_em = :agora, origem = :o "
                "REMOVE access_token, refresh_token, GSI1PK, GSI1SK"
            ),
            ExpressionAttributeNames={"#st": "status"},
            ExpressionAttributeValues={
                ":st": STATUS_RECONEXAO, ":m": "migracao_oauth",
                ":agora": now_iso(), ":o": "MANUAL_LEGADO",
            },
        )
        print(f"  cortado: {pk}")
        if not args.sem_notificacao:
            personal_id = pk.removeprefix("PT#")
            try:
                notif_service.criar(personal_id, "MP_RECONECTAR", TITULO, MENSAGEM)
                print(f"  avisado: {pk}")
            except Exception as exc:                       # aviso não bloqueia o corte
                print(f"  AVISO FALHOU para {pk}: {exc}")

    print(f"\nPronto: {len(pendentes)} conexão(ões) cortada(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
