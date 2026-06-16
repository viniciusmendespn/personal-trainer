"""Avaliação física do aluno (peso, medidas, % gordura) — partição AL#."""
from fastapi import APIRouter, Depends

from app.dependencies import get_current_personal_id
from app.models.avaliacao import Avaliacao, AvaliacaoCreate
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import authz
from app.utils import epoch_ms, new_id, now_iso

router = APIRouter(prefix="/v1/alunos/{aluno_id}/avaliacoes", tags=["avaliacoes"])


@router.get("")
def list_avaliacoes(aluno_id: str, personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    items = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.AVAL_PREFIX)
    return repo.clean_all(items)


@router.post("", response_model=Avaliacao, status_code=201)
def create_avaliacao(aluno_id: str, body: AvaliacaoCreate, personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    now = now_iso()
    av = Avaliacao(avaliacao_id=new_id(), aluno_id=aluno_id, created_at=now,
                   **{**body.model_dump(), "data": body.data or now})
    repo.put_item(keys.pk_aluno(aluno_id), keys.sk_avaliacao(epoch_ms(), av.avaliacao_id), av.model_dump())
    return av


@router.delete("/{ts_id}", status_code=204)
def delete_avaliacao(aluno_id: str, ts_id: str, personal_id: str = Depends(get_current_personal_id)):
    """ts_id = '{ts}#{avaliacao_id}' (do SK)."""
    authz.authorize_aluno(personal_id, aluno_id)
    repo.delete_item(keys.pk_aluno(aluno_id), f"AVAL#{ts_id}")
