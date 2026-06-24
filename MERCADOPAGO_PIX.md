# Mercado Pago — PIX (guia de implementação)

Baseado na integração já em produção no `smart-afiliados` (`backend/functions/afiliados-recebedor-pagamento/lambda_function.py`).
Resumo simples para replicar aqui no `personal-trainer`, caso o app venha a cobrar dos alunos (ex: planos, sessões avulsas).

## O que é necessário

Só **um Access Token** (Produção ou Teste) gerado no [painel de credenciais do Mercado Pago](https://www.mercadopago.com.br/developers/panel/app).
Não precisa de SDK oficial, client secret, public key nem certificado — é tudo feito com chamadas REST diretas usando:

```
Authorization: Bearer {MP_ACCESS_TOKEN}
```

Guardar o token como variável de ambiente da Lambda (`MP_ACCESS_TOKEN`), nunca hardcoded.

> Não há validação de assinatura no webhook do Mercado Pago nesse modelo — a segurança vem de
> **sempre reconsultar o pagamento pela API** antes de confiar no conteúdo do webhook (ver passo 2).

## Fluxo

### 1. Criar a cobrança PIX
`POST https://api.mercadopago.com/v1/payments`

```python
import urllib.request, json, uuid
from datetime import datetime, timezone, timedelta

expires_dt = datetime.now(timezone.utc) + timedelta(minutes=30)

payload = json.dumps({
    "transaction_amount": 39.90,
    "description": "Plano Pro - 1 mes",
    "payment_method_id": "pix",
    "date_of_expiration": expires_dt.strftime("%Y-%m-%dT%H:%M:%S.000-03:00"),
    "payer": {
        "email": payer_email,
        "first_name": first_name,
        "last_name": last_name,
    },
    "external_reference": f"PLAN|{user_id}|pro",   # string própria p/ identificar o pedido depois
    "notification_url": "https://api.SEUDOMINIO.com/pagamento/pix-webhook",
}).encode("utf-8")

req = urllib.request.Request(
    "https://api.mercadopago.com/v1/payments",
    data=payload,
    headers={
        "Authorization": f"Bearer {MP_ACCESS_TOKEN}",
        "Content-Type": "application/json",
        "X-Idempotency-Key": str(uuid.uuid4()),   # evita cobrança duplicada em retry
    },
    method="POST",
)
with urllib.request.urlopen(req, timeout=15) as r:
    data = json.loads(r.read().decode("utf-8"))

tx = data["point_of_interaction"]["transaction_data"]
payment_id     = str(data["id"])
qr_code        = tx["qr_code"]          # copia-e-cola
qr_code_base64 = tx["qr_code_base64"]   # imagem do QR (data:image/png;base64,...)
```

Devolver `payment_id`, `qr_code`, `qr_code_base64` e `expires_at` pro frontend mostrar o QR/copia-e-cola.

**Ponto-chave:** o `external_reference` é uma string que você mesmo define (ex: `"PLAN|{user_id}|pro"` ou
`"SESSAO|{user_id}|{sessao_id}"`). É assim que o webhook (que só recebe um `payment_id`) sabe **o que** foi pago e
**para quem** liberar.

### 2. Receber o webhook
`POST /pagamento/pix-webhook` (configurar essa URL como `notification_url` acima, e também cadastrar no painel do MP
em Webhooks, se quiser cobrir reenvios manuais).

Body típico (formato novo):
```json
{ "action": "payment.updated", "data": { "id": "123456789" } }
```
(formato legado/IPN manda `?topic=payment&id=...` como query string — vale tratar os dois).

**Nunca confiar no payload do webhook diretamente.** Sempre buscar o pagamento de verdade:

```python
def mp_get_payment(payment_id: str) -> dict:
    req = urllib.request.Request(
        f"https://api.mercadopago.com/v1/payments/{payment_id}",
        headers={"Authorization": f"Bearer {MP_ACCESS_TOKEN}"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode("utf-8"))
```

Lógica do handler:
1. Extrai `payment_id` do body (ou da query string, no formato legado).
2. Ignora se `action` não for `payment.updated`/`payment.created`.
3. Busca o pagamento via `mp_get_payment`.
4. Só processa se `status == "approved"`.
5. Checa idempotência (ver passo 3) — se já processado, retorna 200 sem fazer nada.
6. Faz o parse do `external_reference` (`split("|")`) pra saber o que liberar (plano, sessão, etc).
7. Aplica o efeito (ex: ativar plano, liberar sessão) e marca como processado.
8. Sempre responde `200` (mesmo em erro de negócio) — só `400` se nem deu pra parsear o body. Isso evita que o MP
   fique reenviando o webhook indefinidamente por erro nosso.

### 3. Idempotência (evitar processar o mesmo pagamento 2x)
O Mercado Pago pode reenviar o mesmo webhook. Antes de aplicar o efeito, gravar um "lock" no banco e checar se já existe:

```python
def is_mp_webhook_duplicate(payment_id: str) -> bool:
    resp = tabela.get_item(Key={"PK": f"MP_LOCK#{payment_id}", "SK": "lock"})
    return "Item" in resp

def mark_mp_webhook_processed(payment_id: str) -> None:
    tabela.put_item(Item={
        "PK": f"MP_LOCK#{payment_id}",
        "SK": "lock",
        "ttl": int((datetime.now(timezone.utc) + timedelta(days=60)).timestamp()),
    })
```

### 4. Consultar status (polling de reforço no frontend)
`GET /pagamento?payment_id=xxx` → chama `mp_get_payment` e devolve só `{payment_id, status}`.

O frontend mostra o QR Code num modal e faz polling a cada ~4s (até ~10min) chamando esse endpoint, além de já
estar escutando o webhook — assim a UI atualiza mesmo se o webhook atrasar ou falhar.

## Resumo do que adaptar para o `personal-trainer`

| Item | smart-afiliados | personal-trainer (sugestão) |
|---|---|---|
| Identificador do usuário | `user_phone` | `user_id` (do JWT, [[regra do projeto]]) |
| Tabela de lock/idempotência | `afiliados-transactions` (PK sintética `MP_{id}`) | mesma tabela single-table, `SK = MP_LOCK#{payment_id}` |
| `external_reference` | `"CREDITS\|{phone}\|{valor}"` / `"PLAN\|{phone}\|{plano}"` | algo como `"SESSAO\|{user_id}\|{sessao_id}"` |
| Efeito ao aprovar | credita saldo / estende plano | liberar sessão, ativar plano, etc |

Variável de ambiente necessária no `template.yaml`: `MP_ACCESS_TOKEN` (Lambda que cria/recebe o PIX).
