"""Endpoints de gerenciamento de push subscriptions — aluno e personal (Web Push / VAPID)."""
import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_current_aluno, get_current_personal_id
from app.services import push_service

router = APIRouter(tags=["push"])
logger = logging.getLogger(__name__)


class SubscribeBody(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


class UnsubscribeBody(BaseModel):
    endpoint: str


# ── Aluno ─────────────────────────────────────────────────────────────────────

@router.get("/v1/aluno/push/vapid-key")
def vapid_key_aluno(_ctx=Depends(get_current_aluno)):
    return {"public_key": push_service.get_public_key()}


@router.post("/v1/aluno/push/subscribe", status_code=204)
def subscribe_aluno(body: SubscribeBody, ctx=Depends(get_current_aluno)):
    logger.info("[push] subscribe aluno=%s endpoint=%.60s", ctx["aluno_id"], body.endpoint)
    push_service.save_subscription(ctx["aluno_id"], body.endpoint, body.p256dh, body.auth)


@router.delete("/v1/aluno/push/subscribe", status_code=204)
def unsubscribe_aluno(body: UnsubscribeBody, ctx=Depends(get_current_aluno)):
    push_service.delete_subscription(ctx["aluno_id"], body.endpoint)


# ── Personal ──────────────────────────────────────────────────────────────────

@router.get("/v1/personal/push/vapid-key")
def vapid_key_personal(personal_id: str = Depends(get_current_personal_id)):
    return {"public_key": push_service.get_public_key()}


@router.post("/v1/personal/push/subscribe", status_code=204)
def subscribe_personal(body: SubscribeBody, personal_id: str = Depends(get_current_personal_id)):
    push_service.save_subscription_personal(personal_id, body.endpoint, body.p256dh, body.auth)


@router.delete("/v1/personal/push/subscribe", status_code=204)
def unsubscribe_personal(body: UnsubscribeBody, personal_id: str = Depends(get_current_personal_id)):
    push_service.delete_subscription_personal(personal_id, body.endpoint)
