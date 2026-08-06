"""Endpoints de gerenciamento de push subscriptions — aluno e personal (Web Push / VAPID)."""
import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_current_aluno, get_current_personal_id
from app.services import push_service

router = APIRouter(tags=["push"])
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class SubscribeBody(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


class UnsubscribeBody(BaseModel):
    endpoint: str


class ErrorBody(BaseModel):
    message: str
    detail: str | None = None


# ── Aluno ─────────────────────────────────────────────────────────────────────

@router.get("/v1/aluno/push/vapid-key")
def vapid_key_aluno(ctx=Depends(get_current_aluno)):
    key = push_service.get_public_key()
    logger.info("[push] vapid-key aluno=%s key_prefix=%.20s", ctx["aluno_id"], key)
    return {"public_key": key}


@router.post("/v1/aluno/push/subscribe", status_code=204)
def subscribe_aluno(body: SubscribeBody, ctx=Depends(get_current_aluno)):
    logger.info("[push] subscribe aluno=%s endpoint=%.60s", ctx["aluno_id"], body.endpoint)
    push_service.save_subscription(ctx["aluno_id"], body.endpoint, body.p256dh, body.auth)


@router.post("/v1/aluno/push/error", status_code=204)
def push_error_aluno(body: ErrorBody, ctx=Depends(get_current_aluno)):
    logger.error("[push] erro browser aluno=%s msg=%s detail=%s", ctx["aluno_id"], body.message, body.detail)


@router.delete("/v1/aluno/push/subscribe", status_code=204)
def unsubscribe_aluno(body: UnsubscribeBody, ctx=Depends(get_current_aluno)):
    push_service.delete_subscription(ctx["aluno_id"], body.endpoint)


@router.get("/v1/aluno/push/status")
def status_aluno(ctx=Depends(get_current_aluno)):
    """Verdade do backend: quantos dispositivos estão registrados de fato."""
    return {
        "subs": len(push_service.get_subscriptions(ctx["aluno_id"])),
        "vapid_ok": bool(push_service.get_public_key()),
    }


@router.post("/v1/aluno/push/test")
def test_aluno(ctx=Depends(get_current_aluno)):
    return push_service.send_push(
        ctx["aluno_id"], "Teste do CoachPilot",
        "Se você recebeu isso, as notificações estão funcionando.", tag="TESTE",
    )


# ── Personal ──────────────────────────────────────────────────────────────────

@router.get("/v1/personal/push/vapid-key")
def vapid_key_personal(personal_id: str = Depends(get_current_personal_id)):
    return {"public_key": push_service.get_public_key()}


@router.post("/v1/personal/push/subscribe", status_code=204)
def subscribe_personal(body: SubscribeBody, personal_id: str = Depends(get_current_personal_id)):
    logger.info("[push] subscribe personal=%s endpoint=%.60s", personal_id, body.endpoint)
    push_service.save_subscription_personal(personal_id, body.endpoint, body.p256dh, body.auth)


@router.delete("/v1/personal/push/subscribe", status_code=204)
def unsubscribe_personal(body: UnsubscribeBody, personal_id: str = Depends(get_current_personal_id)):
    push_service.delete_subscription_personal(personal_id, body.endpoint)


@router.post("/v1/personal/push/error", status_code=204)
def push_error_personal(body: ErrorBody, personal_id: str = Depends(get_current_personal_id)):
    logger.error("[push] erro browser personal=%s msg=%s detail=%s", personal_id, body.message, body.detail)


@router.get("/v1/personal/push/status")
def status_personal(personal_id: str = Depends(get_current_personal_id)):
    return {
        "subs": len(push_service.get_subscriptions_personal(personal_id)),
        "vapid_ok": bool(push_service.get_public_key()),
    }


@router.post("/v1/personal/push/test")
def test_personal(personal_id: str = Depends(get_current_personal_id)):
    return push_service.send_push_personal(
        personal_id, "Teste do CoachPilot",
        "Se você recebeu isso, as notificações estão funcionando.", tag="TESTE",
    )
