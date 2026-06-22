"""Chat do personal com o aluno — mesma thread compartilhada do WhatsApp e do app do
aluno. Mensagem do personal vai DIRETO pro aluno (sem passar pela IA), igual ao caminho
já usado pelo aluno em /v1/aluno/chat/personal."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_current_personal_id
from app.models.enums import Ator, CanalOrigem
from app.services import agent_service, assinatura_service, authz

router = APIRouter(prefix="/v1/alunos/{aluno_id}/chat", tags=["chat"])


class ChatBody(BaseModel):
    text: str


class AgenteBody(BaseModel):
    habilitado: bool


@router.get("")
def chat_history(
    aluno_id: str, limit: int = 50, cursor: str | None = None,
    personal_id: str = Depends(get_current_personal_id),
):
    authz.authorize_aluno(personal_id, aluno_id)
    items, next_cursor = agent_service.list_chat_msgs(aluno_id, limit, cursor)
    return {
        "items": items,
        "next_cursor": next_cursor,
        "agente_habilitado": agent_service.is_agente_habilitado(aluno_id),
    }


@router.post("")
def chat_send(aluno_id: str, body: ChatBody, personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    agent_service.log_direct(personal_id, aluno_id, body.text, Ator.PERSONAL, CanalOrigem.PORTAL)
    return {"ok": 1}


@router.patch("/agente")
def toggle_agente(aluno_id: str, body: AgenteBody, personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    if body.habilitado:
        assinatura_service.require_addon(personal_id, "ia")
    agent_service.set_agente_habilitado(aluno_id, body.habilitado)
    return {"ok": 1, "agente_habilitado": body.habilitado}
