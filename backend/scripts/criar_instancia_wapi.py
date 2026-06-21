"""Cria uma instância W-API configurada (webhook) e gera o link de pagamento PIX.

Leitura automática e rejeição de ligações são desabilitadas intencionalmente —
o personal pode configurar isso no painel W-API conforme sua preferência.

Uso:
    cd backend
    python scripts/criar_instancia_wapi.py \\
        --api-key  SEU_WAPI_API_KEY \\
        --name     "coach-joao" \\
        --email    "joao@academia.com"

    # Ou via variáveis de ambiente:
    WAPI_API_KEY=... python scripts/criar_instancia_wapi.py --name "coach-joao" --email "..."

Onde encontrar o WAPI_API_KEY:
    Painel W-API → Configurações → API Key (chave do dono da conta, não o token da instância)

O webhook será configurado automaticamente com a Lambda Function URL do personal-trainer-prod.
"""
import argparse
import json
import os
import sys

import httpx

# ── Constantes do ambiente ───────────────────────────────────────────────────
WAPI_BASE_URL = "https://api.w-api.app"

# Lambda Function URL do deploy atual (sem custo de API Gateway)
LAMBDA_FUNCTION_URL = os.getenv(
    "WAPI_WEBHOOK_FUNCTION_URL",
    "https://qyslbab5j5vsdev5uccgodn4h40odwoh.lambda-url.us-east-1.on.aws"
)

WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "")


def _headers(api_key: str) -> dict:
    return {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}


def criar_instancia(api_key: str, instance_name: str, webhook_received_url: str) -> dict:
    """Cria a instância na W-API com todos os webhooks e opções configurados."""
    body = {
        "apiKey": api_key,
        "instanceName": instance_name,
        "lite": True,
        "webhookReceivedUrl": webhook_received_url,
        # Demais webhooks deixados vazios por ora (não usados pela nossa lógica)
        "webhookConnectedUrl": "",
        "webhookDeliveryUrl": "",
        "webhookDisconnectedUrl": "",
        "webhookStatusUrl": "",
        "webhookPresenceUrl": "",
        "automaticReading": False,
        "rejectCalls": False,
    }
    with httpx.Client(timeout=30) as c:
        r = c.post(
            f"{WAPI_BASE_URL}/v1/client/create-instance",
            headers=_headers(api_key),
            json=body,
        )
        if not r.is_success:
            print(f"\n[ERRO] create-instance HTTP {r.status_code}: {r.text}")
            sys.exit(1)
        return r.json()


def criar_cobranca_pix(api_key: str, instance_id: str, payer_email: str) -> dict:
    """Gera cobrança PIX para a instância recém-criada."""
    body = {"payerEmail": payer_email, "webhookPaymentUrl": ""}
    with httpx.Client(timeout=30) as c:
        r = c.post(
            f"{WAPI_BASE_URL}/v1/payment/pix/create",
            headers=_headers(api_key),
            params={"instanceId": instance_id},
            json=body,
        )
        if not r.is_success:
            print(f"\n[AVISO] pix/create HTTP {r.status_code}: {r.text}")
            return {}
        return r.json()


def main():
    # Lê WEBHOOK_SECRET do .env.local se existir
    global WEBHOOK_SECRET
    env_local = os.path.join(os.path.dirname(__file__), "..", ".env.local")
    if os.path.exists(env_local) and not WEBHOOK_SECRET:
        for line in open(env_local):
            line = line.strip()
            if line.startswith("WEBHOOK_SECRET="):
                WEBHOOK_SECRET = line.split("=", 1)[1]

    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--api-key", default=os.getenv("WAPI_API_KEY", ""),
                        help="API Key da conta W-API (dono). Também pode vir de WAPI_API_KEY.")
    parser.add_argument("--name", required=True,
                        help="Nome da instância, ex: 'coach-joao'")
    parser.add_argument("--email", required=True,
                        help="E-mail do personal para a cobrança PIX")
    parser.add_argument("--webhook-secret", default=WEBHOOK_SECRET,
                        help="Webhook secret (padrão: lido do .env.local)")
    args = parser.parse_args()

    if not args.api_key:
        print("[ERRO] Informe --api-key ou defina a variável WAPI_API_KEY.")
        sys.exit(1)

    if not args.webhook_secret:
        print("[AVISO] WEBHOOK_SECRET não encontrado. O webhook será configurado sem secret.")
        webhook_url = f"{LAMBDA_FUNCTION_URL}/v1/public/wapi/webhook/SEM_SECRET"
    else:
        webhook_url = f"{LAMBDA_FUNCTION_URL}/v1/public/wapi/webhook/{args.webhook_secret}"

    print("\n" + "=" * 60)
    print("  CRIANDO INSTÂNCIA W-API")
    print("=" * 60)
    print(f"  Nome:        {args.name}")
    print(f"  E-mail PIX:  {args.email}")
    print(f"  Webhook URL: {webhook_url}")
    print("=" * 60)

    # 1. Criar instância
    print("\n[1/2] Criando instância...")
    resp = criar_instancia(args.api_key, args.name, webhook_url)
    print(f"      Resposta: {json.dumps(resp, indent=2, ensure_ascii=False)}")

    instance_id = resp.get("instanceId") or resp.get("instance_id") or resp.get("id")
    token       = resp.get("token") or resp.get("apiToken") or resp.get("Bearer")

    if not instance_id or not token:
        print("\n[ERRO] Não foi possível extrair instanceId/token da resposta.")
        print("Resposta completa:", json.dumps(resp, indent=2, ensure_ascii=False))
        sys.exit(1)

    # 2. Gerar PIX
    print("\n[2/2] Gerando cobrança PIX...")
    pix = criar_cobranca_pix(args.api_key, instance_id, args.email)
    if pix:
        print(f"      Resposta: {json.dumps(pix, indent=2, ensure_ascii=False)}")

    pix_link = (pix.get("paymentLink") or pix.get("linkPagamento") or
                pix.get("link")        or pix.get("url") or
                pix.get("initPoint")   or pix.get("init_point") or "— verifique a resposta acima —")

    print("\n" + "=" * 60)
    print("  RESULTADO")
    print("=" * 60)
    print(f"  Instance ID : {instance_id}")
    print(f"  Token       : {token}")
    print(f"  Webhook     : {webhook_url}")
    print(f"  Link PIX    : {pix_link}")
    print("=" * 60)

    print("\n📋 PRÓXIMOS PASSOS:")
    print("\n  1. Envie o link PIX acima para o personal pagar.")
    print("\n  2. Após confirmar o pagamento, descubra o UserId (Cognito sub) do personal:")
    print("     aws cognito-idp list-users --user-pool-id <pool-id> --region us-east-1 --profile pessoal-hotmail")
    print("\n  3. Registre a instância no DynamoDB com o script admin:")
    print(f"     .\\set-wapi-creds.ps1 -UserId \"<cognito-sub>\" -InstanceId \"{instance_id}\" -Token \"{token}\"")
    print("\n  4. O personal escaneia o QR Code no portal (Configurações → WhatsApp).")
    print("\n  5. O webhook já está configurado. Teste enviando uma mensagem de um")
    print("     número cadastrado como aluno.\n")


if __name__ == "__main__":
    main()
