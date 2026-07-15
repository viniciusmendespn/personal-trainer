"""Funil de captação (portal do personal) — listar leads, mudar status e converter em aluno.

Leads vivem em PT#{personal_id}/LEAD#... (ver lead_service). A conversão reaproveita
`criar_aluno_core` (alunos.py) — mesmo caminho da criação avulsa, respeitando limite do
plano e telefone único."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_personal_id
from app.models.aluno import AlunoCreate
from app.models.enums import LeadStatus
from app.repositories import dynamo_repo as repo
from app.routers.alunos import criar_aluno_core
from app.services import lead_service

router = APIRouter(prefix="/v1/leads", tags=["leads"])


class StatusBody(BaseModel):
    ref: str
    status: LeadStatus


class ConverterBody(BaseModel):
    ref: str


@router.get("")
def list_leads(status: str | None = None, personal_id: str = Depends(get_current_personal_id)):
    return lead_service.listar(personal_id, status)


@router.patch("/status")
def set_status(body: StatusBody, personal_id: str = Depends(get_current_personal_id)):
    updated = lead_service.atualizar_status(personal_id, body.ref, body.status.value)
    if updated is None:
        raise HTTPException(404, "Lead não encontrado")
    return {"status": body.status.value}


@router.post("/converter", status_code=201)
def converter(body: ConverterBody, personal_id: str = Depends(get_current_personal_id)):
    """Cria o aluno a partir do lead e marca o lead como CONVERTIDO. Se o telefone já for de
    um aluno, marca convertido sem duplicar e devolve o aluno existente."""
    lead = lead_service.get(personal_id, body.ref)
    if not lead:
        raise HTTPException(404, "Lead não encontrado")

    novo = AlunoCreate(
        nome=lead["nome"],
        telefone=lead["telefone"],
        objetivos=lead.get("objetivos") or [],
        observacoes=lead.get("mensagem") or None,
    )
    try:
        aluno = criar_aluno_core(personal_id, novo)
        aluno_id, ja_existia = aluno.aluno_id, False
    except HTTPException as e:
        detail = e.detail if isinstance(e.detail, dict) else {}
        if detail.get("code") != "PHONE_ALREADY_REGISTERED":
            raise
        existente = detail.get("aluno_existente") or {}
        aluno_id, ja_existia = existente.get("aluno_id"), True

    lead_service.atualizar_status(personal_id, body.ref, LeadStatus.CONVERTIDO.value)
    return {"aluno_id": aluno_id, "ja_existia": ja_existia}
