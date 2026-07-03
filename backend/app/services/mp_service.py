"""Integração Mercado Pago — PIX QR Code e processamento de webhook.

Sem SDK; chamadas via urllib.request. Access Token armazenado em DynamoDB,
nunca logado, nunca retornado ao frontend.

Fluxo criar_pix:
  1. Lê token do DynamoDB (PT#{personal_id}/CONFIG#MERCADOPAGO)
  2. Chama POST /v1/payments com payment_method_id=pix
  3. Salva routing (MP_LOCK#{payment_id}/routing) para que o webhook resolva personal_id
  4. Retorna {payment_id, qr_code, qr_code_base64, expires_at}

Fluxo processar_webhook:
  1. Idempotência: busca MP_LOCK#{payment_id}/lock — aborta se já processado
  2. Busca MP_LOCK#{payment_id}/routing para obter personal_id/aluno_id/cobranca_id
  3. Re-consulta pagamento real no MP (nunca confiar no payload do webhook)
  4. Confirma status=approved + valida external_reference
  5. Grava lock com TTL 60 dias
  6. Chama financeiro_service.registrar_pagamento + atualiza campos MP + notifica aluno
"""
import json
import logging
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

from app.config import settings
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.utils import now_iso

logger = logging.getLogger(__name__)

_MP_BASE = "https://api.mercadopago.com"
_LOCK_TTL_S = 60 * 24 * 3600    # 60 dias — idempotência webhook
_ROUTING_TTL_S = 25 * 3600      # 25 horas — lookup payment_id → personal_id


# ── Config ─────────────────────────────────────────────────────────────────────

def is_configured(personal_id: str) -> bool:
    item = repo.get_item(keys.pk_personal(personal_id), keys.SK_CONFIG_MP)
    return bool(item and item.get("access_token"))


def _get_token(personal_id: str) -> str | None:
    item = repo.get_item(keys.pk_personal(personal_id), keys.SK_CONFIG_MP)
    return item.get("access_token") if item else None


# ── HTTP helpers ───────────────────────────────────────────────────────────────

def _mp_request(method: str, path: str, token: str,
                payload: dict | None = None,
                idempotency_key: str | None = None) -> dict:
    data = json.dumps(payload).encode() if payload else None
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    if idempotency_key:
        headers["X-Idempotency-Key"] = idempotency_key
    req = urllib.request.Request(
        f"{_MP_BASE}{path}", data=data, headers=headers, method=method,
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


# ── Criar PIX ──────────────────────────────────────────────────────────────────

def criar_pix(personal_id: str, aluno: dict, cobranca: dict) -> dict:
    """Cria pagamento PIX e retorna {payment_id, qr_code, qr_code_base64, expires_at}."""
    token = _get_token(personal_id)
    if not token:
        raise ValueError("Mercado Pago não configurado para este personal.")

    cobranca_id = cobranca["cobranca_id"]
    aluno_id = cobranca["aluno_id"]
    external_reference = f"COBRANCA|{personal_id}|{aluno_id}|{cobranca_id}"

    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).strftime(
        "%Y-%m-%dT%H:%M:%S.000+00:00"
    )
    nome_partes = (aluno.get("nome") or "Aluno Cliente").split()
    first_name = nome_partes[0]
    last_name = " ".join(nome_partes[1:]) if len(nome_partes) > 1 else "Cliente"

    payload = {
        "transaction_amount": float(cobranca["valor"]),
        "payment_method_id": "pix",
        "payer": {
            "email": aluno.get("email") or f"aluno_{aluno_id[:8]}@personal.app",
            "first_name": first_name,
            "last_name": last_name,
        },
        "description": "Mensalidade Personal Trainer",
        "external_reference": external_reference,
        "date_of_expiration": expires_at,
    }
    if settings.webhook_base_url:
        payload["notification_url"] = f"{settings.webhook_base_url}/v1/public/mp/webhook"
    try:
        resp = _mp_request("POST", "/v1/payments", token, payload,
                           idempotency_key=cobranca_id)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="ignore")
        logger.error("MP criar_pix HTTP %s: %s", exc.code, body)
        raise ValueError(f"Erro Mercado Pago: {exc.code}")

    payment_id = str(resp["id"])
    pix_data = resp.get("point_of_interaction", {}).get("transaction_data", {})

    # Salva routing payment_id → personal/aluno/cobrança (para o webhook resolver)
    lock_pk = keys.pk_mp_lock(payment_id)
    repo.put_item(lock_pk, "routing", {
        "personal_id": personal_id,
        "aluno_id": aluno_id,
        "cobranca_id": cobranca_id,
        "ttl": int(time.time()) + _ROUTING_TTL_S,
    })

    # Salva mp_payment_id na cobrança para exibição futura
    idx = repo.get_item(keys.pk_aluno(aluno_id), keys.sk_cobranca_idx(cobranca_id))
    if idx and idx.get("sk"):
        repo.update_item_if_exists(keys.pk_aluno(aluno_id), idx["sk"], {
            "mp_payment_id": payment_id,
            "atualizado_em": now_iso(),
        })

    return {
        "payment_id": payment_id,
        "qr_code": pix_data.get("qr_code"),
        "qr_code_base64": pix_data.get("qr_code_base64"),
        "expires_at": expires_at,
    }


# ── Status do pagamento ────────────────────────────────────────────────────────

def get_payment_status(personal_id: str, payment_id: str) -> dict:
    """Re-consulta status real no MP. Retorna {payment_id, status, valor_liquido, taxa}."""
    token = _get_token(personal_id)
    if not token:
        raise ValueError("Mercado Pago não configurado.")
    try:
        resp = _mp_request("GET", f"/v1/payments/{payment_id}", token)
    except urllib.error.HTTPError as exc:
        logger.error("MP get_status HTTP %s payment_id=%s", exc.code, payment_id)
        raise ValueError(f"Erro Mercado Pago: {exc.code}")

    valor_total = float(resp.get("transaction_amount", 0))
    valor_liquido = float(resp.get("net_received_amount") or valor_total)
    taxa = round(valor_total - valor_liquido, 4)
    return {
        "payment_id": payment_id,
        "status": resp.get("status"),   # approved | pending | rejected | cancelled
        "valor_liquido": valor_liquido,
        "taxa": taxa,
        "external_reference": resp.get("external_reference"),
    }


# ── Loja (marketplace de pacotes) ─────────────────────────────────────────────

def criar_pix_loja(vendedor_id: str, comprador_id: str, comprador_nome: str,
                   pedido: dict) -> dict:
    """PIX de venda de pacote na loja — pagamento cai na conta MP do VENDEDOR.
    external_reference LOJA|... roteia o webhook para loja_service."""
    token = _get_token(vendedor_id)
    if not token:
        raise ValueError("Mercado Pago não configurado para este vendedor.")

    pedido_id = pedido["pedido_id"]
    external_reference = f"LOJA|{vendedor_id}|{comprador_id}|{pedido_id}"
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=30)).strftime(
        "%Y-%m-%dT%H:%M:%S.000+00:00"
    )
    nome_partes = (comprador_nome or "Personal Comprador").split()
    payload = {
        "transaction_amount": round(pedido["preco_centavos"] / 100, 2),
        "payment_method_id": "pix",
        "payer": {
            "email": f"comprador_{comprador_id[:8]}@coachpilot.app",
            "first_name": nome_partes[0],
            "last_name": " ".join(nome_partes[1:]) or "Comprador",
        },
        "description": f"CoachPilot Loja — {pedido['titulo']}"[:250],
        "external_reference": external_reference,
        "date_of_expiration": expires_at,
    }
    if settings.webhook_base_url:
        payload["notification_url"] = f"{settings.webhook_base_url}/v1/public/mp/webhook"
    try:
        resp = _mp_request("POST", "/v1/payments", token, payload,
                           idempotency_key=pedido_id)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="ignore")
        logger.error("MP criar_pix_loja HTTP %s: %s", exc.code, body)
        raise ValueError(f"Erro Mercado Pago: {exc.code}")

    payment_id = str(resp["id"])
    pix_data = resp.get("point_of_interaction", {}).get("transaction_data", {})

    # Routing payment_id → pedido da loja (o webhook resolve por aqui; tipo=LOJA despacha)
    repo.put_item(keys.pk_mp_lock(payment_id), "routing", {
        "tipo": "LOJA",
        "vendedor_id": vendedor_id,
        "comprador_id": comprador_id,
        "pedido_id": pedido_id,
        "ttl": int(time.time()) + _ROUTING_TTL_S,
    })

    return {
        "payment_id": payment_id,
        "qr_code": pix_data.get("qr_code"),
        "qr_code_base64": pix_data.get("qr_code_base64"),
        "expires_at": expires_at,
    }


def consultar_pix(personal_id: str, payment_id: str) -> dict:
    """Re-obtém os dados do PIX (QR) de um pagamento existente — o checkout não
    persiste o QR no Dynamo (item pequeno); ao reabrir, busca no MP."""
    token = _get_token(personal_id)
    if not token:
        raise ValueError("Mercado Pago não configurado.")
    try:
        resp = _mp_request("GET", f"/v1/payments/{payment_id}", token)
    except urllib.error.HTTPError as exc:
        logger.error("MP consultar_pix HTTP %s payment_id=%s", exc.code, payment_id)
        raise ValueError(f"Erro Mercado Pago: {exc.code}")
    pix_data = resp.get("point_of_interaction", {}).get("transaction_data", {})
    return {
        "payment_id": payment_id,
        "status": resp.get("status"),
        "qr_code": pix_data.get("qr_code"),
        "qr_code_base64": pix_data.get("qr_code_base64"),
        "expires_at": resp.get("date_of_expiration"),
    }


# ── Processar webhook ─────────────────────────────────────────────────────────

def processar_webhook(body: dict) -> None:
    """Processa notificação do MP com idempotência via MP_LOCK#/{lock,routing}."""
    action = body.get("action", "")
    if action not in ("payment.created", "payment.updated"):
        return

    payment_id = str(body.get("data", {}).get("id", ""))
    if not payment_id:
        return

    lock_pk = keys.pk_mp_lock(payment_id)

    # ── Idempotência ──────────────────────────────────────────────────────────
    if repo.get_item(lock_pk, "lock"):
        logger.info("MP webhook duplicado payment_id=%s — ignorado", payment_id)
        return

    # ── Routing: resolve personal_id/aluno_id/cobranca_id ────────────────────
    routing = repo.get_item(lock_pk, "routing")
    if not routing:
        logger.warning("MP webhook sem routing payment_id=%s — descartado", payment_id)
        return

    # Ramo LOJA (marketplace de pacotes): routing próprio, entrega delegada.
    if routing.get("tipo") == "LOJA":
        from app.services import loja_service   # import tardio — evita ciclo
        loja_service.processar_pagamento_loja(payment_id, routing)
        return

    personal_id = routing.get("personal_id")
    aluno_id = routing.get("aluno_id")
    cobranca_id = routing.get("cobranca_id")
    if not all([personal_id, aluno_id, cobranca_id]):
        return

    token = _get_token(personal_id)
    if not token:
        return

    # ── Re-consulta real (nunca confiar no payload do webhook) ────────────────
    try:
        resp = _mp_request("GET", f"/v1/payments/{payment_id}", token)
    except Exception as exc:
        logger.error("MP re-query falhou payment_id=%s: %s", payment_id, exc)
        return

    if resp.get("status") != "approved":
        return   # aguarda próximo webhook quando status mudar

    # ── Valida external_reference ─────────────────────────────────────────────
    ext_ref = resp.get("external_reference", "")
    parts = ext_ref.split("|")
    if len(parts) != 4 or parts[0] != "COBRANCA":
        logger.warning("MP external_reference inválido: %s", ext_ref)
        return
    _, ref_personal_id, ref_aluno_id, ref_cobranca_id = parts
    if ref_personal_id != personal_id or ref_aluno_id != aluno_id or ref_cobranca_id != cobranca_id:
        logger.warning("MP mismatch ext_ref=%s routing=%s/%s/%s",
                       ext_ref, personal_id, aluno_id, cobranca_id)
        return

    # ── Grava lock ANTES de processar (evita race-condition em reinvocações) ──
    repo.put_item(lock_pk, "lock", {
        "payment_id": payment_id,
        "processado_em": now_iso(),
        "ttl": int(time.time()) + _LOCK_TTL_S,
    })

    valor_total = float(resp.get("transaction_amount", 0))
    valor_liquido = float(resp.get("net_received_amount") or valor_total)
    taxa = round(valor_total - valor_liquido, 4)

    # ── Registra pagamento (valor líquido/taxa entram no agregado do painel) ──
    from app.services import financeiro_service
    result = financeiro_service.registrar_pagamento(
        personal_id, aluno_id, cobranca_id,
        {"data_pagamento": now_iso()[:10], "forma_pagamento": "PIX_MP", "notas": None,
         "mp_valor_liquido": valor_liquido, "mp_taxa": taxa},
    )

    if result:
        # mp_payment_id não trafega pelo body do registrar_pagamento — grava aqui.
        idx = repo.get_item(keys.pk_aluno(aluno_id), keys.sk_cobranca_idx(cobranca_id))
        if idx and idx.get("sk"):
            repo.update_item_if_exists(keys.pk_aluno(aluno_id), idx["sk"], {
                "mp_payment_id": payment_id,
            })
        # Notifica aluno
        from app.services import anotif_service
        anotif_service.criar(
            aluno_id, "COBRANCA_PAGA",
            "Pagamento confirmado",
            f"Seu pagamento de R$ {valor_total:.2f} foi confirmado via Pix.",
        )

    logger.info("MP webhook processado payment_id=%s cobranca_id=%s", payment_id, cobranca_id)
