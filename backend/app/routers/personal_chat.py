"""Chat do personal com o aluno via agente — mesma thread compartilhada do WhatsApp e
do app do aluno (ESPEC §1.3 'personal atuando como aluno')."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_current_personal_id
from app.models.enums import Ator
from app.services import agent_service, authz

router = APIRouter(prefix="/v1/alunos/{aluno_id}/chat", tags=["chat"])


class ChatBody(BaseModel):
    text: str


@router.get("")
def chat_history(
    aluno_id: str, limit: int = 50, cursor: str | None = None,
    personal_id: str = Depends(get_current_personal_id),
):
    authz.authorize_aluno(personal_id, aluno_id)
    items, next_cursor = agent_service.list_chat_msgs(aluno_id, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.post("")
def chat_send(aluno_id: str, body: ChatBody, personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    reply = agent_service.handle_chat_turn(personal_id, aluno_id, body.text, Ator.PERSONAL)
    return {"reply": reply}
