"""Anotações do personal sobre o aluno — timeline de notas datadas (não um campo
único sobrescrito), na partição AL#{aluno_id}."""
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.utils import epoch_ms, new_id, now_iso


def criar(aluno_id: str, texto: str) -> dict:
    nota_id = new_id()
    item = {"nota_id": nota_id, "aluno_id": aluno_id, "texto": texto, "data_hora": now_iso()}
    repo.put_item(keys.pk_aluno(aluno_id), keys.sk_nota(epoch_ms(), nota_id), item)
    return item


def listar(aluno_id: str, limit: int = 50, cursor: str | None = None) -> tuple[list[dict], str | None]:
    items, next_cursor = repo.query_pk_page(
        keys.pk_aluno(aluno_id), keys.NOTA_PREFIX, limit, cursor, forward=False
    )
    return repo.clean_all(items), next_cursor
