"""Gamificação: pontos por atividades e ranking entre alunos do mesmo personal."""
import logging

from app.repositories import dynamo_repo as repo, keys
from app.utils import new_id, now_iso

logger = logging.getLogger(__name__)

PONTOS = {
    "SESSAO": 8,
    "SESSAO_COMPLETA_BONUS": 7,   # bônus ao finalizar 100% dos exercícios
    "SERIE": 1,
    "PR": 10,
    "POST": 3,
    "CURTIDA": 1,
    "COMENTARIO": 2,
}


def award(aluno_id: str, tipo: str, personal_id: str, pts: int | None = None, descricao: str = "") -> int:
    """Registra pontos para o aluno e atualiza o ranking do personal.
    Retorna os pontos concedidos."""
    try:
        pts = pts if pts is not None else PONTOS.get(tipo, 0)
        if pts <= 0:
            return 0
        ts = now_iso()
        pk_al = keys.pk_aluno(aluno_id)
        # Atualiza contador total do aluno
        repo.add_and_set(pk_al, keys.SK_PONTOS, add={"total": pts, "semana_atual": pts})
        # Log do evento
        repo.put_item(pk_al, keys.sk_ponto_log(ts), {
            "tipo": tipo, "pts": pts, "descricao": descricao, "data_hora": ts,
        })
        # Atualiza ranking no personal
        perfil = repo.get_item(pk_al, "PROFILE") or {}
        nome = perfil.get("nome", "Aluno")
        repo.add_and_set(
            keys.pk_personal(personal_id),
            keys.sk_ranking_aluno(aluno_id),
            add={"total_pontos": pts},
            set_={"aluno_id": aluno_id, "nome": nome, "atualizado_em": ts},
        )
        return pts
    except Exception:
        logger.exception("[pontos] award falhou: aluno=%s tipo=%s", aluno_id, tipo)
        return 0


def get_pontos(aluno_id: str) -> dict:
    item = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_PONTOS) or {}
    cleaned = repo.clean(item) or {}
    log_items = repo.query_pk_last_n(keys.pk_aluno(aluno_id), keys.PONTO_LOG_PREFIX, limit=10)
    cleaned["log_recente"] = repo.clean_all(log_items)
    return cleaned


def get_ranking(personal_id: str) -> list[dict]:
    items = repo.query_pk(keys.pk_personal(personal_id), sk_prefix=keys.RANKING_PREFIX)
    ranking = repo.clean_all(items)
    ranking.sort(key=lambda x: x.get("total_pontos", 0), reverse=True)
    for i, r in enumerate(ranking):
        r["posicao"] = i + 1
    return ranking
