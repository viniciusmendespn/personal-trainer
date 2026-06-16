"""Webhook W-API — ÚNICO endpoint público (sem Cognito). Entrada do agente (ESPEC §7).

Fluxo: valida token da URL -> instanceId resolve personal -> telefone resolve aluno ->
dedup por messageId -> monta contexto -> orquestra LLM -> responde via WAPIClient.

Roteado por /v1/public/{proxy+} com Authorizer NONE no template.
Sempre responde 200 rápido (mesmo descartando) para a W-API não reenfileirar.
"""
import logging

from fastapi import APIRouter, Request

from app.dependencies import verify_wapi_webhook
from app.repositories import dynamo_repo as repo
from app.repositories import keys

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1/public/wapi", tags=["webhook"])

_OK = {"ok": 1}
_TTL_DEDUP = 24 * 3600


def _resolve_personal(instance_id: str | None) -> str | None:
    if not instance_id:
        return None
    item = repo.get_item(keys.pk_wapi(instance_id), "WAPI")
    return item.get("personal_id") if item else None


@router.post("/webhook/{secret}")
async def receive(secret: str, request: Request):
    verify_wapi_webhook(secret)  # 404 se inválido
    payload = await request.json()

    # ⚠️ Confirmar os nomes exatos dos campos contra a doc da W-API (webhook-received).
    instance_id = payload.get("instanceId") or payload.get("instance_id")
    message_id = payload.get("messageId") or payload.get("id")
    sender = payload.get("sender") or payload.get("phone") or payload.get("from")

    personal_id = _resolve_personal(instance_id)
    if not personal_id:
        logger.warning("[webhook] instância desconhecida: %s", instance_id)
        return _OK

    # Dedup idempotente (ESPEC §7): só a 1ª entrega passa.
    import time
    if message_id:
        novo = repo.put_item_if_absent(
            keys.pk_personal(personal_id), f"MSGSEEN#{message_id}",
            {"ttl": int(time.time()) + _TTL_DEDUP},
        )
        if not novo:
            return _OK

    # TODO (próximo incremento, depende de §8):
    #   1. resolver aluno: PHONE#{personal_id}#{e164} -> aluno_id (tratar desconhecido — §8 #4)
    #   2. montar_contexto(): GetItem SESSION#ACTIVE (consistente)
    #   3. orquestrar a LLM com as ferramentas (registrar, consultar_historico, ...)
    #   4. responder: WAPIClient(cfg).send_text(sender, resposta_curta)
    logger.info("[webhook] personal=%s sender=%s msg=%s (orquestração pendente)",
                personal_id, sender, message_id)
    return _OK
