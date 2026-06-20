"""Biblioteca de exercícios do personal (catálogo reutilizável com vídeo) — partição PT#."""
from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_personal_id
from app.models.biblioteca import ExLib, ExLibCreate, ImportarExerciciosBody, ImportarResult
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


@router.get("/{exlib_id}", response_model=ExLib)
def get_exlib(exlib_id: str, personal_id: str = Depends(get_current_personal_id)):
    item = repo.get_item(keys.pk_personal(personal_id), keys.sk_exlib(exlib_id))
    if not item:
        raise HTTPException(404, "Exercício não encontrado")
    return ExLib(**repo.clean(item))


@router.put("/{exlib_id}", response_model=ExLib)
def update_exlib(exlib_id: str, body: ExLibCreate, personal_id: str = Depends(get_current_personal_id)):
    updated = repo.update_item_if_exists(keys.pk_personal(personal_id), keys.sk_exlib(exlib_id), body.model_dump())
    if updated is None:
        raise HTTPException(404, "Exercício não encontrado")
    return ExLib(**repo.clean(updated))


@router.delete("/{exlib_id}", status_code=204)
def delete_exlib(exlib_id: str, personal_id: str = Depends(get_current_personal_id)):
    repo.delete_item(keys.pk_personal(personal_id), keys.sk_exlib(exlib_id))


@router.post("/importar", response_model=ImportarResult, status_code=200)
def importar_exlib(body: ImportarExerciciosBody, personal_id: str = Depends(get_current_personal_id)):
    pk = keys.pk_personal(personal_id)
    existentes = repo.query_pk(pk, sk_prefix=keys.EXLIB_PREFIX)
    nomes_existentes = {e.get("nome", "").strip().lower() for e in existentes}

    puts = []
    pulados = 0
    erros: list[str] = []

    for item in body.exercicios:
        nome = item.nome.strip()
        if not nome:
            erros.append("Exercício sem nome ignorado")
            continue
        if nome.lower() in nomes_existentes:
            pulados += 1
            continue
        ex = ExLib(exlib_id=new_id(), **item.model_dump())
        puts.append({"PK": pk, "SK": keys.sk_exlib(ex.exlib_id), **ex.model_dump()})
        nomes_existentes.add(nome.lower())

    if puts:
        repo.batch_write(puts=puts)

    return ImportarResult(importados=len(puts), pulados=pulados, erros=erros)
