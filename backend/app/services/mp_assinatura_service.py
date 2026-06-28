"""Integração Mercado Pago — Pix da ASSINATURA DA PLATAFORMA (cobra o personal, não o
aluno). Mirror de `mp_service.py`, mas com uma diferença essencial: o Access Token é o
da PRÓPRIA PLATAFORMA (`settings.ml_access_token`, env var da Lambda), não o token que
cada personal configura em `PT#{personal_id}/CONFIG#MERCADOPAGO` para cobrar seus
alunos — são contas Mercado Pago diferentes, por isso o lock de idempotência usa um
prefixo separado (`MP_LOCK_ASSINATURA#`, ver `keys.py`).

Fluxo idêntico ao descrito em MERCADOPAGO_PIX.md: cria o Pix via REST (sem SDK),
salva routing pra o webhook resolver o personal_id, e ao aprovar reconsulta o
pagamento real (nunca confia no payload do webhook) antes de aplicar o efeito.
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
from app.services import assinatura_service
from app.utils import now_iso

logger = logging.getLogger(__name__)

_MP_BASE = "https://api.mercadopago.com"
_LOCK_TTL_S = 60 * 24 * 3600    # 60 dias — idempotência webhook
_ROUTING_TTL_S = 25 * 3600      # 25 horas — lookup payment_id -> personal_id
_PIX_DIAS_CONCEDIDOS = 30
_PIX_DIAS_ANUAL = 365


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


# ── Criar Pix ──────────────────────────────────────────────────────────────────

def criar_pix(personal_id: str, payer_email: str | None = None, periodo: str = "mensal") -> dict:
    """Cria pagamento Pix da assinatura. Retorna {payment_id, qr_code, qr_code_base64, expires_at}.
    periodo: "mensal" (30 dias, R$39,90) ou "anual" (365 dias, R$399,00)."""
    token = settings.ml_access_token
    if not token:
        raise ValueError("ML_ACCESS_TOKEN não configurado na plataforma.")

    catalogo = assinatura_service.get_catalogo()
    plano = catalogo.get(assinatura_service.PLANO_GESTAO_PRO, assinatura_service.DEFAULT_CATALOGO[assinatura_service.PLANO_GESTAO_PRO])

    if periodo == "anual":
        preco = float(plano.get("preco_anual", assinatura_service.DEFAULT_CATALOGO[assinatura_service.PLANO_GESTAO_PRO]["preco_anual"]))
        external_reference = f"ASSINATURA_ANUAL|{personal_id}"
        description = f"{plano.get('nome', 'Gestão Pro')} - 1 ano"
    else:
        preco = float(plano["preco"])
        external_reference = f"ASSINATURA|{personal_id}"
        description = f"{plano.get('nome', 'Gestão Pro')} - 1 mês"

    idempotency_key = f"assinatura-{personal_id}-{int(time.time())}"
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=30)).strftime(
        "%Y-%m-%dT%H:%M:%S.000+00:00"
    )

    payload = {
        "transaction_amount": preco,
        "payment_method_id": "pix",
        "payer": {
            "email": payer_email or f"personal_{personal_id[:8]}@coachpilot.com.br",
            "first_name": "Personal",
            "last_name": "CoachPilot",
        },
        "description": description,
        "external_reference": external_reference,
        "date_of_expiration": expires_at,
    }
    # Sem isso o MP não tem pra onde notificar (causa raiz de pagamento aprovado e nunca
    # aplicado — o polling do frontend só reflete o status no MP, não credita a assinatura).
    if settings.webhook_base_url:
        payload["notification_url"] = f"{settings.webhook_base_url}/v1/public/assinatura/webhook"
    try:
        resp = _mp_request("POST", "/v1/payments", token, payload, idempotency_key=idempotency_key)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="ignore")
        logger.error("MP assinatura criar_pix HTTP %s: %s", exc.code, body)
        raise ValueError(f"Erro Mercado Pago: {exc.code}")

    payment_id = str(resp["id"])
    pix_data = resp.get("point_of_interaction", {}).get("transaction_data", {})

    repo.put_item(keys.pk_mp_lock_assinatura(payment_id), "routing", {
        "personal_id": personal_id,
        "ttl": int(time.time()) + _ROUTING_TTL_S,
    })

    return {
        "payment_id": payment_id,
        "qr_code": pix_data.get("qr_code"),
        "qr_code_base64": pix_data.get("qr_code_base64"),
        "expires_at": expires_at,
    }


# ── Status do pagamento (polling do frontend) ──────────────────────────────────

def get_payment_status(payment_id: str) -> dict:
    token = settings.ml_access_token
    if not token:
        raise ValueError("ML_ACCESS_TOKEN não configurado na plataforma.")
    try:
        resp = _mp_request("GET", f"/v1/payments/{payment_id}", token)
    except urllib.error.HTTPError as exc:
        logger.error("MP assinatura get_status HTTP %s payment_id=%s", exc.code, payment_id)
        raise ValueError(f"Erro Mercado Pago: {exc.code}")
    return {"payment_id": payment_id, "status": resp.get("status")}


# ── Processar webhook ───────────────────────────────────────────────────────────

def processar_webhook(body: dict) -> None:
    action = body.get("action", "")
    if action not in ("payment.created", "payment.updated"):
        return

    payment_id = str(body.get("data", {}).get("id", ""))
    if not payment_id:
        return

    lock_pk = keys.pk_mp_lock_assinatura(payment_id)

    if repo.get_item(lock_pk, "lock"):
        logger.info("MP assinatura webhook duplicado payment_id=%s — ignorado", payment_id)
        return

    routing = repo.get_item(lock_pk, "routing")
    if not routing:
        logger.warning("MP assinatura webhook sem routing payment_id=%s — descartado", payment_id)
        return
    personal_id = routing.get("personal_id")
    if not personal_id:
        return

    token = settings.ml_access_token
    if not token:
        return

    try:
        resp = _mp_request("GET", f"/v1/payments/{payment_id}", token)
    except Exception as exc:
        logger.error("MP assinatura re-query falhou payment_id=%s: %s", payment_id, exc)
        return

    if resp.get("status") != "approved":
        return

    ext_ref = resp.get("external_reference", "")
    parts = ext_ref.split("|")
    if len(parts) != 2 or parts[0] not in ("ASSINATURA", "ASSINATURA_ANUAL") or parts[1] != personal_id:
        logger.warning("MP assinatura external_reference inválido: %s (routing personal=%s)", ext_ref, personal_id)
        return

    dias = _PIX_DIAS_ANUAL if parts[0] == "ASSINATURA_ANUAL" else _PIX_DIAS_CONCEDIDOS

    # Grava lock ANTES de processar (evita race-condition em reinvocações)
    repo.put_item(lock_pk, "lock", {
        "payment_id": payment_id,
        "processado_em": now_iso(),
        "ttl": int(time.time()) + _LOCK_TTL_S,
    })

    assinatura_service.aplicar_pagamento(
        personal_id, dias=dias,
        payment_id=payment_id, valor=resp.get("transaction_amount"), origem="PIX",
    )

    from app.services import notif_service
    notif_service.criar(
        personal_id, "ASSINATURA_PAGA", "Assinatura renovada",
        f"Pagamento confirmado via Pix. Seu plano Gestão Pro foi renovado por mais {dias} dias.",
    )

    # Recompensa de indicação: se este personal veio de um código de indicação, o
    # indicador ganha 30 dias agora (1º pagamento = conversão). Best-effort — nunca
    # pode derrubar o webhook de assinatura.
    try:
        from app.services import cupom_service
        cupom_service.processar_recompensa_indicador(personal_id)
    except Exception as exc:
        logger.warning("Falha ao processar recompensa de indicação para %s: %s", personal_id, exc)

    logger.info("MP assinatura webhook processado payment_id=%s personal_id=%s", payment_id, personal_id)
