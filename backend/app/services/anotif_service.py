"""Notificações para o aluno — partição AL#{aluno_id} com SK ANOTIF#{ts}#{id}.
Espelho de notif_service.py, mas no lado do aluno (não do personal)."""
import logging
import time

from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.utils import epoch_ms, new_id, now_iso

logger = logging.getLogger(__name__)

ANOTIF_TTL_S = 30 * 24 * 3600

# Tipos: DOR_RESPONDIDA, DUVIDA_RESPONDIDA, MSG_PERSONAL, CORRECAO_EXERCICIO, NOVO_POST_FEED,
#         COBRANCA_VENCER, COBRANCA_VENCIDA

_URL_MAP: dict[str, str] = {
    "MSG_PERSONAL":    "/aluno/chat",
    "NOVO_POST_FEED":  "/aluno/feed",
    "COBRANCA_VENCER": "/aluno/financeiro",
    "COBRANCA_VENCIDA": "/aluno/financeiro",
}


def criar(aluno_id: str, tipo: str, titulo: str, mensagem: str,
          ref_extra: dict | None = None) -> str:
    nid = new_id()
    item = {
        "notif_id": nid, "tipo": tipo, "titulo": titulo, "mensagem": mensagem,
        "lida": False, "data_hora": now_iso(),
        "ttl": int(time.time()) + ANOTIF_TTL_S,
        **(ref_extra or {}),
    }
    repo.put_item(keys.pk_aluno(aluno_id), keys.sk_anotif(epoch_ms(), nid), item)
    repo.increment_counter(keys.pk_aluno(aluno_id), keys.SK_STATS_ANOTIF, "nao_lidas", 1)
    _disparar_push(aluno_id, titulo, mensagem, tipo)
    return nid


def _disparar_push(aluno_id: str, titulo: str, mensagem: str, tipo: str) -> None:
    try:
        from app.services import push_service   # import tardio — evita ciclo
        url = _URL_MAP.get(tipo, "/aluno/notificacoes")
        push_service.send_push(aluno_id, titulo, mensagem, url=url)
    except Exception as exc:
        logger.warning("[anotif] push falhou para aluno %s: %s", aluno_id, exc)


def listar(aluno_id: str, limit: int = 30,
           cursor: str | None = None) -> tuple[list[dict], str | None]:
    items, next_cursor = repo.query_pk_page(
        keys.pk_aluno(aluno_id), keys.ANOTIF_PREFIX, limit, cursor, forward=False
    )
    return [{**repo.clean(i), "ref": i["SK"]} for i in items], next_cursor


def nao_lidas(aluno_id: str) -> int:
    pk = keys.pk_aluno(aluno_id)
    stats = repo.get_item(pk, keys.SK_STATS_ANOTIF)
    if stats is not None:
        return int(stats.get("nao_lidas", 0))
    items = repo.query_pk(pk, sk_prefix=keys.ANOTIF_PREFIX)
    valor = sum(1 for i in items if not i.get("lida"))
    repo.update_item(pk, keys.SK_STATS_ANOTIF, {"nao_lidas": valor})
    return valor


def marcar_lida(aluno_id: str, ref: str) -> None:
    pk = keys.pk_aluno(aluno_id)
    atual = repo.get_item(pk, ref)
    if atual is None or atual.get("lida"):
        return
    repo.update_item_if_exists(
        pk, ref,
        {"lida": True, "ttl": int(time.time()) + ANOTIF_TTL_S},
    )
    repo.increment_counter(pk, keys.SK_STATS_ANOTIF, "nao_lidas", -1)
