"""Posts globais do personal — visíveis para todos os alunos vinculados."""
import logging
from concurrent.futures import ThreadPoolExecutor

from app.repositories import dynamo_repo as repo, keys
from app.services import media_service, pontos_service
from app.utils import new_id, now_iso

logger = logging.getLogger(__name__)


def criar_post_global(personal_id: str, tipo: str, texto: str, midias: list[dict]) -> dict:
    post_id = new_id()
    ts = now_iso()
    sk = keys.sk_feed_global(ts, post_id)
    item = {
        "post_id": post_id,
        "personal_id": personal_id,
        "tipo": tipo,
        "texto": texto,
        "midias": midias,
        "total_curtidas": 0,
        "data_hora": ts,
    }
    repo.put_item(keys.pk_personal(personal_id), sk, item)
    _broadcast_anotif(personal_id, texto[:80])
    return {**item, "post_sk": sk}


def _broadcast_anotif(personal_id: str, corpo: str) -> None:
    """Cria anotif NOVO_POST_FEED para cada aluno do personal em paralelo (push segue
    automaticamente via anotif_service.criar). ThreadPoolExecutor(10) evita timeout."""
    from app.services import anotif_service   # import tardio — evita ciclo

    ptrs = repo.query_pk(keys.pk_personal(personal_id), sk_prefix="ALUNO#")
    if not ptrs:
        return

    def _one(ptr: dict) -> None:
        aluno_id = ptr["SK"].split("#", 1)[1]
        try:
            anotif_service.criar(aluno_id, "NOVO_POST_FEED",
                                 "Novo post do seu personal", corpo)
        except Exception as exc:
            logger.warning("[feed_global] anotif falhou para aluno %s: %s", aluno_id, exc)

    with ThreadPoolExecutor(max_workers=10) as ex:
        list(ex.map(_one, ptrs))


def _enrich(raw: dict) -> dict:
    item = repo.clean(raw) or {}
    for m in item.get("midias") or []:
        if m.get("s3_key") and not m.get("url"):
            m["url"] = media_service.gerar_presigned_view_url(m["s3_key"])
    item["post_sk"] = raw.get("SK", "")
    return item


def listar_posts_global(
    personal_id: str, aluno_id: str | None = None, limit: int = 20, cursor: str | None = None
) -> tuple[list[dict], str | None]:
    items, next_cursor = repo.query_pk_page(
        keys.pk_personal(personal_id), keys.FEED_GLOBAL_PREFIX,
        limit=limit, cursor=cursor, forward=False,
    )
    result = []
    for raw in items:
        enriched = _enrich(raw)
        if aluno_id and raw.get("post_id"):
            curtida = repo.get_item(keys.pk_aluno(aluno_id), keys.sk_curtida_feed(raw["post_id"]))
            enriched["curtido_por_mim"] = bool(curtida)
        else:
            enriched["curtido_por_mim"] = False
        result.append(enriched)
    return result, next_cursor


def toggle_curtida(aluno_id: str, personal_id: str, post_id: str, post_sk: str) -> dict:
    """Curte ou descurte (idempotente). Retorna {curtido}."""
    pk_al = keys.pk_aluno(aluno_id)
    sk_curtida = keys.sk_curtida_feed(post_id)
    existing = repo.get_item(pk_al, sk_curtida)
    pk_pt = keys.pk_personal(personal_id)
    if existing:
        repo.delete_item(pk_al, sk_curtida)
        repo.increment_counter(pk_pt, post_sk, "total_curtidas", amount=-1)
        return {"curtido": False}
    repo.put_item(pk_al, sk_curtida, {"post_id": post_id, "personal_id": personal_id, "data_hora": now_iso()})
    repo.increment_counter(pk_pt, post_sk, "total_curtidas", amount=1)
    pontos_service.award(aluno_id, "CURTIDA", personal_id)
    return {"curtido": True}


def deletar_post(personal_id: str, post_sk: str) -> bool:
    """Deleta direto pelo SK (post_sk = "FEED#{ts}#{post_id}", já conhecido pelo cliente —
    mesmo padrão de toggle_curtida). Sem varrer a partição. Retorna False se não encontrado."""
    return repo.delete_item_if_exists(keys.pk_personal(personal_id), post_sk)
