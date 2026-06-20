"""Badges / conquistas do aluno. Concedidos automaticamente ao finalizar sessão.
Armazenados em AL#{aluno_id}/BADGE#{tipo} — idempotentes via put_item_if_absent."""
from dataclasses import dataclass

from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import anotif_service
from app.utils import now_iso


@dataclass
class BadgeDef:
    tipo: str
    titulo: str
    descricao: str
    emoji: str
    categoria: str   # "sessoes" | "streak"


BADGES: dict[str, BadgeDef] = {
    "SESS_1":    BadgeDef("SESS_1",    "Primeira Passada",  "Completou a 1ª sessão",       "🥇", "sessoes"),
    "SESS_10":   BadgeDef("SESS_10",   "Dedicação",          "10 sessões completadas",       "💪", "sessoes"),
    "SESS_25":   BadgeDef("SESS_25",   "Consistência",       "25 sessões completadas",       "🔥", "sessoes"),
    "SESS_50":   BadgeDef("SESS_50",   "Meio Centenário",    "50 sessões completadas",       "⭐", "sessoes"),
    "SESS_100":  BadgeDef("SESS_100",  "Centenário",         "100 sessões completadas",      "🏆", "sessoes"),
    "STREAK_3":  BadgeDef("STREAK_3",  "Em Ritmo",           "3 semanas seguidas treinando", "📅", "streak"),
    "STREAK_8":  BadgeDef("STREAK_8",  "Disciplina",         "8 semanas seguidas treinando", "🎯", "streak"),
    "STREAK_12": BadgeDef("STREAK_12", "Imbatível",          "12 semanas seguidas treinando","👑", "streak"),
}

SESSAO_THRESHOLDS = {1, 10, 25, 50, 100}
STREAK_THRESHOLDS = {3, 8, 12}


def _tentar_conceder(aluno_id: str, tipo: str, defn: BadgeDef) -> bool:
    pk = keys.pk_aluno(aluno_id)
    item = {
        "tipo": tipo, "titulo": defn.titulo, "descricao": defn.descricao,
        "emoji": defn.emoji, "categoria": defn.categoria, "unlocked_at": now_iso(),
    }
    return repo.put_item_if_absent(pk, keys.sk_badge(tipo), item)


def verificar_e_conceder(aluno_id: str, personal_id: str,
                          total_sessoes: int, streak_atual: int) -> list[str]:
    """Concede badges ainda não conquistados. Retorna lista de tipos recém-concedidos."""
    novos: list[str] = []
    for t in SESSAO_THRESHOLDS:
        if total_sessoes == t:
            tipo = f"SESS_{t}"
            defn = BADGES[tipo]
            if _tentar_conceder(aluno_id, tipo, defn):
                novos.append(tipo)
                anotif_service.criar(
                    aluno_id, "BADGE_CONQUISTADO", defn.titulo, defn.descricao,
                    ref_extra={"badge_tipo": tipo, "badge_emoji": defn.emoji},
                )
    for t in STREAK_THRESHOLDS:
        if streak_atual == t:
            tipo = f"STREAK_{t}"
            defn = BADGES[tipo]
            if _tentar_conceder(aluno_id, tipo, defn):
                novos.append(tipo)
                anotif_service.criar(
                    aluno_id, "BADGE_CONQUISTADO", defn.titulo, defn.descricao,
                    ref_extra={"badge_tipo": tipo, "badge_emoji": defn.emoji},
                )
    return novos


def listar_badges_aluno(aluno_id: str) -> list[dict]:
    """Retorna todos os badges — desbloqueados (com data) e bloqueados."""
    pk = keys.pk_aluno(aluno_id)
    unlocked_items = repo.clean_all(repo.query_pk(pk, sk_prefix=keys.BADGE_PREFIX))
    unlocked_map = {i.get("tipo"): i for i in unlocked_items}
    result = []
    for tipo, defn in BADGES.items():
        if tipo in unlocked_map:
            result.append({**unlocked_map[tipo], "unlocked": True})
        else:
            result.append({
                "tipo": tipo, "titulo": defn.titulo, "descricao": defn.descricao,
                "emoji": defn.emoji, "categoria": defn.categoria,
                "unlocked": False, "unlocked_at": None,
            })
    return result
