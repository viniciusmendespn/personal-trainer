"""Router de pacotes de treino (.cpkg) — importação e gerenciamento."""
from fastapi import APIRouter, Depends

from app.dependencies import get_current_personal_id
from app.models.pacote import (
    ImportarPacoteRequest,
    ImportarPacoteResponse,
    ToggleItemBody,
    TogglePacoteBody,
)
from app.services import pacote_service

router = APIRouter(prefix="/v1/pacotes", tags=["pacotes"])


@router.post("/importar", response_model=ImportarPacoteResponse, status_code=201)
def importar_pacote(
    body: ImportarPacoteRequest,
    personal_id: str = Depends(get_current_personal_id),
):
    return pacote_service.importar_pacote(personal_id, body.conteudo)


@router.post("/importar-rascunho", response_model=ImportarPacoteResponse, status_code=201)
def importar_rascunho(
    body: ImportarPacoteRequest,
    personal_id: str = Depends(get_current_personal_id),
):
    return pacote_service.importar_rascunho(personal_id, body.conteudo)


@router.get("")
def listar_pacotes(personal_id: str = Depends(get_current_personal_id)):
    return pacote_service.listar_pacotes(personal_id)


@router.patch("/{pacote_id}")
def toggle_pacote(
    pacote_id: str,
    body: TogglePacoteBody,
    personal_id: str = Depends(get_current_personal_id),
):
    pacote_service.toggle_pacote(personal_id, pacote_id, body.ativo)
    return {"ok": True}


@router.patch("/{pacote_id}/items/{item_id}")
def toggle_item(
    pacote_id: str,
    item_id: str,
    body: ToggleItemBody,
    personal_id: str = Depends(get_current_personal_id),
):
    pacote_service.toggle_item(personal_id, pacote_id, item_id, body.ativo)
    return {"ok": True}


@router.delete("/{pacote_id}", status_code=204)
def remover_pacote(
    pacote_id: str,
    personal_id: str = Depends(get_current_personal_id),
):
    pacote_service.remover_pacote(personal_id, pacote_id)
