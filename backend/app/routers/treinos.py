"""CRUD de treinos e exercícios, aninhados sob o aluno (ESPEC §2). Tudo na partição
AL#{aluno}. `ordem` é atributo (ordenação em app); SK por id facilita o CRUD."""
from fastapi import APIRouter, Depends, HTTPException

from pydantic import BaseModel

from app.dependencies import get_current_personal_id
from app.models.exercicio import Exercicio, ExercicioCreate
from app.models.treino import Treino, TreinoCreate
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import authz
from app.utils import new_id, now_iso

router = APIRouter(prefix="/v1/alunos/{aluno_id}/treinos", tags=["treinos"])


class CopiarBody(BaseModel):
    from_aluno_id: str
    treino_id: str


def _aluno_nome(personal_id: str, aluno_id: str) -> str | None:
    ptr = repo.get_item(keys.pk_personal(personal_id), keys.sk_aluno_pointer(aluno_id))
    return (ptr or {}).get("nome")


def _sync_due(personal_id: str, aluno_id: str, treino_id: str, treino_nome: str,
              data_fim: str | None, old_data_fim: str | None = None) -> None:
    """Mantém a agenda global de vencimento do treino (o scheduler diário lê e notifica)."""
    if old_data_fim and old_data_fim != data_fim:
        repo.delete_item(keys.PK_SCHED, keys.sk_due(old_data_fim, treino_id))
    if data_fim:
        repo.put_item(keys.PK_SCHED, keys.sk_due(data_fim, treino_id), {
            "personal_id": personal_id, "aluno_id": aluno_id, "treino_id": treino_id,
            "treino_nome": treino_nome, "aluno_nome": _aluno_nome(personal_id, aluno_id),
            "data_fim": data_fim, "tipo": "TREINO_FIM",
        })


def _guard(personal_id: str, aluno_id: str) -> None:
    authz.authorize_aluno(personal_id, aluno_id)


# ── Treinos ──────────────────────────────────────────────────────────────────
@router.get("")
def list_treinos(aluno_id: str, personal_id: str = Depends(get_current_personal_id)):
    _guard(personal_id, aluno_id)
    items = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.SK_TREINO_PREFIX)
    items.sort(key=lambda t: t.get("ordem", 0))
    return repo.clean_all(items)


@router.post("", response_model=Treino, status_code=201)
def create_treino(aluno_id: str, body: TreinoCreate, personal_id: str = Depends(get_current_personal_id)):
    _guard(personal_id, aluno_id)
    treino_id = new_id()
    now = now_iso()
    treino = Treino(treino_id=treino_id, aluno_id=aluno_id, created_at=now, updated_at=now, **body.model_dump())
    repo.put_item(keys.pk_aluno(aluno_id), keys.sk_treino(treino_id), treino.model_dump())
    if body.data_fim:
        _sync_due(personal_id, aluno_id, treino_id, body.nome, body.data_fim)
    return treino


@router.post("/copiar", status_code=201)
def copiar_treino(aluno_id: str, body: CopiarBody, personal_id: str = Depends(get_current_personal_id)):
    """Copia um treino (e seus exercícios) de outro aluno para este — templates."""
    _guard(personal_id, aluno_id)
    _guard(personal_id, body.from_aluno_id)
    src = repo.get_item(keys.pk_aluno(body.from_aluno_id), keys.sk_treino(body.treino_id))
    if not src:
        raise HTTPException(404, "Treino de origem não encontrado")
    exs = repo.query_pk(keys.pk_aluno(body.from_aluno_id), sk_prefix=keys.sk_exercicio_prefix(body.treino_id))
    now = now_iso()
    new_tid = new_id()
    dest_pk = keys.pk_aluno(aluno_id)
    t = repo.clean(src)
    t.update({"treino_id": new_tid, "aluno_id": aluno_id, "created_at": now, "updated_at": now})
    puts = [{"PK": dest_pk, "SK": keys.sk_treino(new_tid), **t}]
    for e in exs:
        ne = repo.clean(e)
        new_eid = new_id()
        ne.update({"exercicio_id": new_eid, "treino_id": new_tid, "aluno_id": aluno_id})
        puts.append({"PK": dest_pk, "SK": keys.sk_exercicio(new_tid, new_eid), **ne})
    repo.batch_write(puts=puts)
    return {"treino_id": new_tid, "exercicios": len(exs)}


@router.put("/{treino_id}")
def update_treino(aluno_id: str, treino_id: str, body: TreinoCreate, personal_id: str = Depends(get_current_personal_id)):
    _guard(personal_id, aluno_id)
    old = repo.get_item(keys.pk_aluno(aluno_id), keys.sk_treino(treino_id))
    if not old:
        raise HTTPException(404, "Treino não encontrado")
    fields = {**body.model_dump(), "updated_at": now_iso()}
    updated = repo.update_item(keys.pk_aluno(aluno_id), keys.sk_treino(treino_id), fields, return_values=True)
    _sync_due(personal_id, aluno_id, treino_id, body.nome, body.data_fim, old.get("data_fim"))
    return repo.clean(updated)


@router.delete("/{treino_id}", status_code=204)
def delete_treino(aluno_id: str, treino_id: str, personal_id: str = Depends(get_current_personal_id)):
    _guard(personal_id, aluno_id)
    # remove o treino + seus exercícios (+ agenda de vencimento) em lote
    treino = repo.get_item(keys.pk_aluno(aluno_id), keys.sk_treino(treino_id))
    exs = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.sk_exercicio_prefix(treino_id))
    deletes = [(keys.pk_aluno(aluno_id), keys.sk_treino(treino_id))]
    deletes += [(keys.pk_aluno(aluno_id), e["SK"]) for e in exs]
    if treino and treino.get("data_fim"):
        deletes.append((keys.PK_SCHED, keys.sk_due(treino["data_fim"], treino_id)))
    repo.batch_write(deletes=deletes)


# ── Exercícios (do treino) ───────────────────────────────────────────────────
@router.get("/{treino_id}/exercicios")
def list_exercicios(aluno_id: str, treino_id: str, personal_id: str = Depends(get_current_personal_id)):
    _guard(personal_id, aluno_id)
    items = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.sk_exercicio_prefix(treino_id))
    items.sort(key=lambda e: e.get("ordem", 0))
    return repo.clean_all(items)


@router.post("/{treino_id}/exercicios", response_model=Exercicio, status_code=201)
def create_exercicio(aluno_id: str, treino_id: str, body: ExercicioCreate,
                     personal_id: str = Depends(get_current_personal_id)):
    _guard(personal_id, aluno_id)
    exercicio_id = new_id()
    ex = Exercicio(exercicio_id=exercicio_id, treino_id=treino_id, aluno_id=aluno_id, **body.model_dump())
    repo.put_item(keys.pk_aluno(aluno_id), keys.sk_exercicio(treino_id, exercicio_id), ex.model_dump())
    return ex


@router.put("/{treino_id}/exercicios/{exercicio_id}")
def update_exercicio(aluno_id: str, treino_id: str, exercicio_id: str, body: ExercicioCreate,
                     personal_id: str = Depends(get_current_personal_id)):
    _guard(personal_id, aluno_id)
    updated = repo.update_item_if_exists(
        keys.pk_aluno(aluno_id), keys.sk_exercicio(treino_id, exercicio_id), body.model_dump()
    )
    if updated is None:
        raise HTTPException(404, "Exercício não encontrado")
    return repo.clean(updated)


@router.delete("/{treino_id}/exercicios/{exercicio_id}", status_code=204)
def delete_exercicio(aluno_id: str, treino_id: str, exercicio_id: str,
                     personal_id: str = Depends(get_current_personal_id)):
    _guard(personal_id, aluno_id)
    repo.delete_item(keys.pk_aluno(aluno_id), keys.sk_exercicio(treino_id, exercicio_id))
