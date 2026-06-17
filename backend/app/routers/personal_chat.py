"""Chat do personal com o aluno — mesma thread compartilhada do WhatsApp e do app do
aluno. Mensagem do personal vai DIRETO pro aluno (sem passar pela IA), igual ao caminho
já usado pelo aluno em /v1/aluno/chat/personal."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_current_personal_id
from app.models.enums import Ator, CanalOrigem
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
    enviado = agent_service.log_direct(personal_id, aluno_id, body.text, Ator.PERSONAL, CanalOrigem.PORTAL)
    return {"ok": 1, "whatsapp_enviado": enviado}
