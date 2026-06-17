"""Sistema de notificações do portal (ESPEC §2.2) — feed do personal na partição PT#.
Informa situações: relato de dor, treino vencendo/vencido, etc. Bell + lista no portal."""
import time

from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.utils import epoch_ms, new_id, now_iso

NOTIF_TTL_S = 30 * 24 * 3600   # notificação lida vira histórico e expira em 30 dias


def criar(personal_id: str, tipo: str, titulo: str, mensagem: str,
          aluno_id: str | None = None, ref_extra: dict | None = None) -> str:
    nid = new_id()
    item = {
        "notif_id": nid, "tipo": tipo, "titulo": titulo, "mensagem": mensagem,
        "aluno_id": aluno_id, "lida": False, "data_hora": now_iso(),
        **(ref_extra or {}),
    }
    repo.put_item(keys.pk_personal(personal_id), keys.sk_notif(epoch_ms(), nid), item)
    return nid


def listar(personal_id: str, limit: int = 50, cursor: str | None = None) -> tuple[list[dict], str | None]:
    items, next_cursor = repo.query_pk_page(
        keys.pk_personal(personal_id), keys.NOTIF_PREFIX, limit, cursor, forward=False
    )
    return [{**repo.clean(i), "ref": i["SK"]} for i in items], next_cursor


def nao_lidas(personal_id: str) -> int:
    items = repo.query_pk(keys.pk_personal(personal_id), sk_prefix=keys.NOTIF_PREFIX)
    return sum(1 for i in items if not i.get("lida"))


def marcar_lida(personal_id: str, ref: str) -> None:
    repo.update_item_if_exists(
        keys.pk_personal(personal_id), ref,
        {"lida": True, "ttl": int(time.time()) + NOTIF_TTL_S},
    )


def marcar_todas(personal_id: str) -> int:
    items = repo.query_pk(keys.pk_personal(personal_id), sk_prefix=keys.NOTIF_PREFIX)
    ttl = int(time.time()) + NOTIF_TTL_S
    n = 0
    for i in items:
        if not i.get("lida"):
            repo.update_item(keys.pk_personal(personal_id), i["SK"], {"lida": True, "ttl": ttl})
            n += 1
    return n
