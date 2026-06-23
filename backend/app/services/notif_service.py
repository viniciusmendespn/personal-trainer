"""Sistema de notificações do portal (ESPEC §2.2) — feed do personal na partição PT#.
Informa situações: relato de dor, treino vencendo/vencido, etc. Bell + lista no portal."""
import logging
import time

from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.utils import epoch_ms, new_id, now_iso

logger = logging.getLogger(__name__)

NOTIF_TTL_S = 30 * 24 * 3600   # notificação lida vira histórico e expira em 30 dias

_URL_MAP_PERSONAL: dict[str, str] = {
    "MSG_ALUNO": "/notificacoes",
}


def criar(personal_id: str, tipo: str, titulo: str, mensagem: str,
          aluno_id: str | None = None, ref_extra: dict | None = None) -> str:
    nid = new_id()
    item = {
        "notif_id": nid, "tipo": tipo, "titulo": titulo, "mensagem": mensagem,
        "aluno_id": aluno_id, "lida": False, "data_hora": now_iso(),
        "ttl": int(time.time()) + NOTIF_TTL_S,
        **(ref_extra or {}),
    }
    repo.put_item(keys.pk_personal(personal_id), keys.sk_notif(epoch_ms(), nid), item)
    repo.increment_counter(keys.pk_personal(personal_id), keys.SK_STATS_NOTIF, "nao_lidas", 1)
    _disparar_push_personal(personal_id, titulo, mensagem, tipo)
    return nid


def _disparar_push_personal(personal_id: str, titulo: str, mensagem: str, tipo: str) -> None:
    try:
        from app.services import push_service   # import tardio — evita ciclo
        url = _URL_MAP_PERSONAL.get(tipo, "/dashboard")
        push_service.send_push_personal(personal_id, titulo, mensagem, url=url, tag=tipo)
    except Exception as exc:
        logger.warning("[notif] push falhou para personal %s: %s", personal_id, exc)


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
    pk = keys.pk_personal(personal_id)
    stats = repo.get_item(pk, keys.SK_STATS_NOTIF)
    if stats is not None:
        return int(stats.get("nao_lidas", 0))
    # Lazy init: personal existente, contador ainda não criado — calcula 1x e aquece o agregado.
    items = repo.query_pk(pk, sk_prefix=keys.NOTIF_PREFIX)
    valor = sum(1 for i in items if not i.get("lida"))
    repo.update_item(pk, keys.SK_STATS_NOTIF, {"nao_lidas": valor})
    return valor


def marcar_lida(personal_id: str, ref: str) -> None:
    pk = keys.pk_personal(personal_id)
    atual = repo.get_item(pk, ref)
    if atual is None or atual.get("lida"):
        return
    repo.update_item_if_exists(
        pk, ref,
        {"lida": True, "ttl": int(time.time()) + NOTIF_TTL_S},
    )
    repo.increment_counter(pk, keys.SK_STATS_NOTIF, "nao_lidas", -1)


def deve_notificar_msg_direta(personal_id: str, aluno_id: str, janela_s: int = 3600) -> bool:
    """True na 1ª chamada dentro da janela (dedup de flood); False nas seguintes.
    Chave dedicada com TTL — substitui a varredura de NOTIF# que existia antes."""
    sk = keys.sk_dedup_msgdireto(aluno_id)
    return repo.put_item_if_absent(
        keys.pk_personal(personal_id), sk, {"ttl": int(time.time()) + janela_s}
    )


def marcar_todas(personal_id: str) -> int:
    pk = keys.pk_personal(personal_id)
    items = repo.query_pk(pk, sk_prefix=keys.NOTIF_PREFIX)
    ttl = int(time.time()) + NOTIF_TTL_S
    n = 0
    for i in items:
        if not i.get("lida"):
            repo.update_item(pk, i["SK"], {"lida": True, "ttl": ttl})
            n += 1
    repo.update_item(pk, keys.SK_STATS_NOTIF, {"nao_lidas": 0})
    return n
