"""Gamificação: pontos por atividades e ranking entre alunos do mesmo personal."""
import logging
from datetime import date

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


def _semana_key() -> str:
    d = date.today()
    iso = d.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def _mes_key() -> str:
    d = date.today()
    return f"{d.year}-{d.month:02d}"


def award(aluno_id: str, tipo: str, personal_id: str, pts: int | None = None, descricao: str = "") -> int:
    """Registra pontos para o aluno e atualiza o ranking do personal.
    Retorna os pontos concedidos."""
    try:
        pts = pts if pts is not None else PONTOS.get(tipo, 0)
        if pts <= 0:
            return 0
        ts = now_iso()
        pk_al = keys.pk_aluno(aluno_id)
        semana_key = _semana_key()
        mes_key = _mes_key()

        # Lê contadores atuais para fazer reset lazy de semana/mês
        current = repo.get_item(pk_al, keys.SK_PONTOS) or {}
        semana_atual = (
            int(current.get("semana_atual", 0)) + pts
            if current.get("semana_semana") == semana_key
            else pts
        )
        mes_atual = (
            int(current.get("mes_atual", 0)) + pts
            if current.get("mes_mes") == mes_key
            else pts
        )

        # Atualiza contadores do aluno (total atômico; semana/mês por set após reset)
        repo.add_and_set(pk_al, keys.SK_PONTOS,
            add={"total": pts},
            set_={
                "semana_semana": semana_key, "semana_atual": semana_atual,
                "mes_mes": mes_key, "mes_atual": mes_atual,
            },
        )
        # Log do evento
        repo.put_item(pk_al, keys.sk_ponto_log(ts), {
            "tipo": tipo, "pts": pts, "descricao": descricao, "data_hora": ts,
        })
        # Atualiza ranking no personal (denormaliza semana, mês e foto p/ evitar queries extras)
        perfil = repo.get_item(pk_al, "PROFILE") or {}
        nome = perfil.get("nome", "Aluno")
        foto_s3_key = perfil.get("foto_s3_key")
        repo.add_and_set(
            keys.pk_personal(personal_id),
            keys.sk_ranking_aluno(aluno_id),
            add={"total_pontos": pts},
            set_={
                "aluno_id": aluno_id, "nome": nome, "foto_s3_key": foto_s3_key, "atualizado_em": ts,
                "semana_semana": semana_key, "semana_atual": semana_atual,
                "mes_mes": mes_key, "mes_atual": mes_atual,
            },
        )
        return pts
    except Exception:
        logger.exception("[pontos] award falhou: aluno=%s tipo=%s", aluno_id, tipo)
        return 0


def get_pontos(aluno_id: str) -> dict:
    item = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_PONTOS) or {}
    cleaned = repo.clean(item) or {}
    # Reset lazy na leitura (aluno sem atividade na semana/mês corrente)
    if cleaned.get("semana_semana") != _semana_key():
        cleaned["semana_atual"] = 0
    if cleaned.get("mes_mes") != _mes_key():
        cleaned["mes_atual"] = 0
    log_items = repo.query_pk_last_n(keys.pk_aluno(aluno_id), keys.PONTO_LOG_PREFIX, limit=10)
    cleaned["log_recente"] = repo.clean_all(log_items)
    return cleaned


def get_ranking(personal_id: str) -> list[dict]:
    items = repo.query_pk(keys.pk_personal(personal_id), sk_prefix=keys.RANKING_PREFIX)
    ranking = repo.clean_all(items)
    semana_key = _semana_key()
    mes_key = _mes_key()
    # Aplica reset lazy nas entradas do ranking
    for r in ranking:
        if r.get("semana_semana") != semana_key:
            r["semana_atual"] = 0
        if r.get("mes_mes") != mes_key:
            r["mes_atual"] = 0
    ranking.sort(key=lambda x: x.get("total_pontos", 0), reverse=True)
    for i, r in enumerate(ranking):
        r["posicao"] = i + 1
    return ranking
