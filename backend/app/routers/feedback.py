"""Canal de feedback/sugestões do personal (fire-and-forget). Só o admin lê o que chega —
ver routers/admin.py para o painel e a bonificação."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_current_personal_id
from app.services import feedback_service

router = APIRouter(prefix="/v1/feedback", tags=["feedback"])


class FeedbackBody(BaseModel):
    mensagem: str


@router.post("", status_code=201)
def enviar_feedback(body: FeedbackBody, personal_id: str = Depends(get_current_personal_id)):
    return feedback_service.criar(personal_id, body.mensagem)
