"""Posts globais do personal — visíveis para todos os alunos vinculados."""
from app.repositories import dynamo_repo as repo, keys
from app.services import media_service
from app.utils import new_id, now_iso


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
    return {**item, "post_sk": sk}


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
    return {"curtido": True}


def deletar_post(personal_id: str, post_id: str) -> bool:
    """Busca o post pelo post_id e deleta. Retorna False se não encontrado."""
    items = repo.query_pk(keys.pk_personal(personal_id), sk_prefix=keys.FEED_GLOBAL_PREFIX)
    for raw in items:
        if raw.get("post_id") == post_id:
            repo.delete_item(keys.pk_personal(personal_id), raw["SK"])
            return True
    return False
