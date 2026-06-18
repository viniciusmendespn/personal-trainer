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


def listar(personal_id: str, limit: int = 50, cursor: str | None = None,
           tipo: str | None = None) -> tuple[list[dict], str | None]:
    items, next_cursor = repo.query_pk_page(
        keys.pk_personal(personal_id), keys.NOTIF_PREFIX, limit, cursor, forward=False
    )
    result = [{**repo.clean(i), "ref": i["SK"]} for i in items]
    if tipo:
        result = [r for r in result if r.get("tipo") == tipo]
    return result, next_cursor


def nao_lidas(personal_id: str) -> int:
    items = repo.query_pk(keys.pk_personal(personal_id), sk_prefix=keys.NOTIF_PREFIX)
    return sum(1 for i in items if not i.get("lida"))


def marcar_lida(personal_id: str, ref: str) -> None:
    repo.update_item_if_exists(
        keys.pk_personal(personal_id), ref,
        {"lida": True, "ttl": int(time.time()) + NOTIF_TTL_S},
    )


def listar_recentes(personal_id: str, tipo: str, aluno_id: str | None = None,
                    max_age_s: int = 3600) -> list[dict]:
    """Notificações de um tipo específico criadas nos últimos `max_age_s` segundos.
    Usado para dedup (evitar flood de notificações do mesmo tipo/aluno)."""
    cutoff = int(time.time()) - max_age_s
    items = repo.query_pk(keys.pk_personal(personal_id), sk_prefix=keys.NOTIF_PREFIX)
    result = []
    for i in items:
        c = repo.clean(i)
        if c.get("tipo") != tipo:
            continue
        if aluno_id and c.get("aluno_id") != aluno_id:
            continue
        # SK = NOTIF#{epoch_ms}#{id} — extrai o timestamp em segundos
        sk = i.get("SK", "")
        parts = sk.split("#")
        if len(parts) >= 2:
            try:
                ts_s = int(parts[1]) // 1000
                if ts_s < cutoff:
                    continue
            except ValueError:
                pass
        result.append({**c, "ref": sk})
    return result


def marcar_todas(personal_id: str) -> int:
    items = repo.query_pk(keys.pk_personal(personal_id), sk_prefix=keys.NOTIF_PREFIX)
    ttl = int(time.time()) + NOTIF_TTL_S
    n = 0
    for i in items:
        if not i.get("lida"):
            repo.update_item(keys.pk_personal(personal_id), i["SK"], {"lida": True, "ttl": ttl})
            n += 1
    return n
