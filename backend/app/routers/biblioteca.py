"""Biblioteca de exercícios do personal (catálogo reutilizável com vídeo) — partição PT#."""
from fastapi import APIRouter, Depends

from app.dependencies import get_current_personal_id
from app.models.biblioteca import ExLib, ExLibCreate
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.utils import new_id

router = APIRouter(prefix="/v1/biblioteca/exercicios", tags=["biblioteca"])


@router.get("")
def list_exlib(personal_id: str = Depends(get_current_personal_id)):
    items = repo.query_pk(keys.pk_personal(personal_id), sk_prefix=keys.EXLIB_PREFIX)
    items.sort(key=lambda e: e.get("nome", ""))
    return repo.clean_all(items)


@router.post("", response_model=ExLib, status_code=201)
def create_exlib(body: ExLibCreate, personal_id: str = Depends(get_current_personal_id)):
    ex = ExLib(exlib_id=new_id(), **body.model_dump())
    repo.put_item(keys.pk_personal(personal_id), keys.sk_exlib(ex.exlib_id), ex.model_dump())
    return ex


@router.delete("/{exlib_id}", status_code=204)
def delete_exlib(exlib_id: str, personal_id: str = Depends(get_current_personal_id)):
    repo.delete_item(keys.pk_personal(personal_id), keys.sk_exlib(exlib_id))
