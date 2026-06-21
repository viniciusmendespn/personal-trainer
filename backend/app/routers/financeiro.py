"""Gestão financeira de alunos — cobrancas e faturamento."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import get_current_personal_id
from app.models.financeiro import CobrancaConfigIn, NovaCobrancaIn, RegistrarPagamentoIn
from app.services import authz, financeiro_service

router = APIRouter(prefix="/v1/alunos/{aluno_id}/financeiro", tags=["financeiro"])


def _aluno_do_personal(aluno_id: str, personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    return personal_id


@router.get("/config")
def get_config(aluno_id: str, personal_id: str = Depends(_aluno_do_personal)):
    cfg = financeiro_service.get_config(personal_id, aluno_id)
    return cfg or {}


@router.put("/config")
def set_config(aluno_id: str, body: CobrancaConfigIn,
               personal_id: str = Depends(_aluno_do_personal)):
    return financeiro_service.set_config(personal_id, aluno_id, body.model_dump())


@router.get("/cobrancas")
def listar_cobrancas(
    aluno_id: str,
    limit: int = Query(default=50, ge=1, le=100),
    cursor: Optional[str] = None,
    status: Optional[str] = Query(default=None, pattern="^(PENDENTE|PAGA|VENCIDA)$"),
    personal_id: str = Depends(_aluno_do_personal),
):
    items, next_cursor = financeiro_service.listar_cobranças(
        personal_id, aluno_id, limit=limit, cursor=cursor, status=status)
    return {"items": items, "next_cursor": next_cursor}


@router.post("/cobrancas", status_code=201)
def criar_cobranca(aluno_id: str, body: NovaCobrancaIn,
                   personal_id: str = Depends(_aluno_do_personal)):
    return financeiro_service.criar_cobranca_manual(personal_id, aluno_id, body.model_dump())


@router.patch("/cobrancas/{cobranca_id}/pagar")
def registrar_pagamento(aluno_id: str, cobranca_id: str,
                         body: RegistrarPagamentoIn,
                         personal_id: str = Depends(_aluno_do_personal)):
    result = financeiro_service.registrar_pagamento(
        personal_id, aluno_id, cobranca_id, body.model_dump())
    if result is None:
        raise HTTPException(404, "Cobrança não encontrada")
    return result


@router.delete("/cobrancas/{cobranca_id}", status_code=204)
def cancelar_cobranca(aluno_id: str, cobranca_id: str,
                       personal_id: str = Depends(_aluno_do_personal)):
    ok = financeiro_service.cancelar_cobranca(personal_id, aluno_id, cobranca_id)
    if not ok:
        raise HTTPException(404, "Cobrança não encontrada ou já paga")
