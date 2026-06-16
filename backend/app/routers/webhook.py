"""Webhook W-API — ÚNICO endpoint público (sem Cognito). Entrada do agente (ESPEC §7).

Fluxo: valida token da URL -> instanceId resolve personal -> telefone resolve aluno ->
dedup por messageId -> monta contexto -> [orquestra LLM] -> responde via WAPIClient.

Roteado por /v1/public/{proxy+} com Authorizer NONE. Sempre responde 200 rápido.
"""
import logging
import re
import time

from fastapi import APIRouter, Request

from app.dependencies import verify_wapi_webhook
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import llm_agent
from app.services.wapi_service import WAPIClient

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1/public/wapi", tags=["webhook"])

_OK = {"ok": 1}
_TTL_DEDUP = 24 * 3600


def _digits(phone: str | None) -> str | None:
    if not phone:
        return None
    d = re.sub(r"\D", "", phone)   # tira '+', '@c.us', espaços
    return d or None


def _extract_text(payload: dict) -> str | None:
    """Texto da mensagem — formato exato da W-API a confirmar; tenta os campos comuns."""
    for v in (payload.get("text"), payload.get("message"), payload.get("body"),
              payload.get("conversation")):
        if isinstance(v, str) and v.strip():
            return v.strip()
        if isinstance(v, dict):
            inner = v.get("message") or v.get("text") or v.get("conversation")
            if isinstance(inner, str) and inner.strip():
                return inner.strip()
    return None


def _resolve_personal(instance_id: str | None) -> str | None:
    if not instance_id:
        return None
    item = repo.get_item(keys.pk_wapi(instance_id), "WAPI")
    return item.get("personal_id") if item else None


@router.post("/webhook/{secret}")
async def receive(secret: str, request: Request):
    verify_wapi_webhook(secret)   # 404 se inválido
    payload = await request.json()

    # ⚠️ Confirmar nomes exatos dos campos contra a doc da W-API (webhook-received).
    instance_id = payload.get("instanceId") or payload.get("instance_id")
    message_id = payload.get("messageId") or payload.get("id")
    sender = _digits(payload.get("sender") or payload.get("phone") or payload.get("from"))

    personal_id = _resolve_personal(instance_id)
    if not personal_id:
        logger.warning("[webhook] instância desconhecida: %s", instance_id)
        return _OK

    # Dedup idempotente (ESPEC §7): só a 1ª entrega passa.
    if message_id:
        novo = repo.put_item_if_absent(
            keys.pk_personal(personal_id), f"MSGSEEN#{message_id}",
            {"ttl": int(time.time()) + _TTL_DEDUP},
        )
        if not novo:
            return _OK

    # Resolve aluno pelo telefone (escopo por personal).
    phone_item = repo.get_item(keys.pk_phone(personal_id, sender), "PHONE") if sender else None
    if not phone_item:
        # Aluno desconhecido (ESPEC §8 #4) — TODO: boas-vindas / pendência de identificação.
        logger.info("[webhook] telefone não cadastrado: personal=%s phone=%s", personal_id, sender)
        return _OK
    aluno_id = phone_item["aluno_id"]
    text = _extract_text(payload)

    # Orquestra o agente (OpenAI) e responde via W-API.
    reply = llm_agent.run(personal_id, aluno_id, phone_item.get("nome"), text or "")
    if reply:
        cfg = repo.get_item(keys.pk_personal(personal_id), keys.SK_WAPI_CONFIG)
        if cfg:
            try:
                WAPIClient(cfg["instance_id"], cfg["token"]).send_text(sender, reply)
            except Exception as e:
                logger.warning("[webhook] send_text falhou: %s", e)
    return _OK
