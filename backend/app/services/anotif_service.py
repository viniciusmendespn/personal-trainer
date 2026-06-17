"""Notificações para o aluno — partição AL#{aluno_id} com SK ANOTIF#{ts}#{id}.
Espelho de notif_service.py, mas no lado do aluno (não do personal)."""
import time

from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.utils import epoch_ms, new_id, now_iso

ANOTIF_TTL_S = 30 * 24 * 3600

# Tipos: DOR_RESPONDIDA, DUVIDA_RESPONDIDA, MSG_PERSONAL, CORRECAO_EXERCICIO


def criar(aluno_id: str, tipo: str, titulo: str, mensagem: str,
          ref_extra: dict | None = None) -> str:
    nid = new_id()
    item = {
        "notif_id": nid, "tipo": tipo, "titulo": titulo, "mensagem": mensagem,
        "lida": False, "data_hora": now_iso(),
        **(ref_extra or {}),
    }
    repo.put_item(keys.pk_aluno(aluno_id), keys.sk_anotif(epoch_ms(), nid), item)
    return nid


def listar(aluno_id: str, limit: int = 30,
           cursor: str | None = None) -> tuple[list[dict], str | None]:
    items, next_cursor = repo.query_pk_page(
        keys.pk_aluno(aluno_id), keys.ANOTIF_PREFIX, limit, cursor, forward=False
    )
    return [{**repo.clean(i), "ref": i["SK"]} for i in items], next_cursor


def nao_lidas(aluno_id: str) -> int:
    items = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.ANOTIF_PREFIX)
    return sum(1 for i in items if not i.get("lida"))


def marcar_lida(aluno_id: str, ref: str) -> None:
    repo.update_item_if_exists(
        keys.pk_aluno(aluno_id), ref,
        {"lida": True, "ttl": int(time.time()) + ANOTIF_TTL_S},
    )
