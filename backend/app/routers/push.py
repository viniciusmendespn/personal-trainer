"""Endpoints de gerenciamento de push subscriptions do aluno (Web Push / VAPID)."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_current_aluno
from app.services import push_service

router = APIRouter(prefix="/v1/aluno/push", tags=["push"])


class SubscribeBody(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


class UnsubscribeBody(BaseModel):
    endpoint: str


@router.get("/vapid-key")
def vapid_key(_ctx=Depends(get_current_aluno)):
    return {"public_key": push_service.get_public_key()}


@router.post("/subscribe", status_code=204)
def subscribe(body: SubscribeBody, ctx=Depends(get_current_aluno)):
    push_service.save_subscription(ctx["aluno_id"], body.endpoint, body.p256dh, body.auth)


@router.delete("/subscribe", status_code=204)
def unsubscribe(body: UnsubscribeBody, ctx=Depends(get_current_aluno)):
    push_service.delete_subscription(ctx["aluno_id"], body.endpoint)
