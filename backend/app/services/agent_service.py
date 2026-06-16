"""Ferramentas do agente (ESPEC §4) — mesma lógica do portal, mas com payload COMPACTO
(chaves curtas, sem nulos) porque o resultado entra no contexto da LLM (tokens).
O `{personal_id, aluno_id}` já vem resolvido pelo webhook — a LLM nunca informa identidade.
"""
import time

from app.models.enums import Ator, CanalOrigem, Classificacao
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import alerta_service, sessao_service

CHAT_TTL_S = 2 * 3600   # janela de conversa: 2h sem mensagem zera o contexto
CHAT_MAX_TURNS = 8      # últimas N mensagens mantidas


def get_chat(aluno_id: str) -> list[dict]:
    item = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_CHAT, consistent=True)
    return (item or {}).get("turns", [])


def save_chat(aluno_id: str, turns: list[dict]) -> None:
    repo.put_item(keys.pk_aluno(aluno_id), keys.SK_CHAT,
                  {"turns": turns[-CHAT_MAX_TURNS:], "ttl": int(time.time()) + CHAT_TTL_S})


def _ult(aluno_id: str, exercicio_id: str | None) -> dict | None:
    if not exercicio_id:
        return None
    last = repo.query_gsi1_last(keys.gsi1_registro(aluno_id, exercicio_id), 1)
    if not last:
        return None
    return {"series": repo.clean(last[0]).get("series_exec")}


def montar_contexto(aluno_id: str, nome: str | None = None) -> dict:
    """Estado do turno em 1 GetItem (sessão ativa) + último registro do exercício atual."""
    s = sessao_service.get_active(aluno_id, consistent=True)
    if not s:
        return {"al": aluno_id, "nome": nome, "sessao": None}
    ex = s.get("ex_atual") or {}
    out = {
        "al": aluno_id, "nome": nome, "sid": s.get("sessao_id"), "t": s.get("treino_nome"),
        "ex": {"id": ex.get("exercicio_id"), "n": ex.get("nome"),
               "s": ex.get("series"), "rp": ex.get("reps_prescritas"), "cg": ex.get("carga_prescrita")},
        "ord": s.get("ordem_atual"), "tot": s.get("total_ex"),
    }
    ult = _ult(aluno_id, ex.get("exercicio_id"))
    if ult:
        out["ult"] = ult
    return out


def registrar(aluno_id: str, series: list, exercicio_id: str | None = None) -> dict:
    r, pr = sessao_service.record(aluno_id, series, exercicio_id=exercicio_id,
                                  canal=CanalOrigem.WHATSAPP, classificacao=Classificacao.AUTO, ator=Ator.ALUNO)
    out = {"ok": 1, "ex": r.get("exercicio_nome")}
    if pr:
        out["pr"] = pr   # novo recorde de carga — o agente pode comemorar
    return out


def consultar_historico(aluno_id: str, exercicio_id: str) -> dict:
    last = repo.query_gsi1_last(keys.gsi1_registro(aluno_id, exercicio_id), 1)
    if not last:
        return {"vazio": 1}
    le = repo.clean(last[0])
    return {"ex": le.get("exercicio_nome"), "series": le.get("series_exec")}


def buscar_exercicio(aluno_id: str, nome: str) -> dict:
    """Acha exercícios do aluno por nome (p/ vídeo, histórico ou registrar fora do atual)."""
    nl = (nome or "").lower()
    exs = sessao_service.list_exercicios_aluno(aluno_id)
    matches = [e for e in exs if nl in (e.get("nome", "").lower())] if nl else exs
    return {"ex": [{"id": e["exercicio_id"], "n": e.get("nome"),
                    "video": e.get("video_url"), "cg": e.get("carga_prescrita")}
                   for e in matches[:5]]}


def avancar(aluno_id: str) -> dict:
    s = sessao_service.advance(aluno_id)
    ex = s.get("ex_atual") or {}
    return {"ok": 1, "ex": ex.get("nome"), "fim": s.get("status") != "EM_ANDAMENTO"}


def treino_de_hoje(aluno_id: str) -> dict:
    """Treino(s) agendado(s) para o dia da semana atual (agenda)."""
    from datetime import datetime, timezone
    hoje = datetime.now(timezone.utc).weekday()   # 0=seg .. 6=dom
    treinos = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.SK_TREINO_PREFIX)
    matches = [t for t in treinos if hoje in (t.get("dias_semana") or [])]
    return {"treinos": [{"id": t["treino_id"], "nome": t.get("nome")} for t in matches]}


def iniciar_sessao(personal_id: str, aluno_id: str, treino_id: str) -> dict:
    s = sessao_service.start_session(personal_id, aluno_id, treino_id)
    ex = s.get("ex_atual") or {}
    return {"ok": 1, "ex": ex.get("nome")}


def finalizar(aluno_id: str) -> dict:
    sessao_service.finish(aluno_id)
    return {"ok": 1, "fim": 1}


def registrar_dor(personal_id: str, aluno_id: str, descricao: str) -> dict:
    """Registra dor no exercício atual (se houver) e gera alerta ao personal (RF009)."""
    s = sessao_service.get_active(aluno_id, consistent=True)
    ex = (s or {}).get("ex_atual") or {}
    alerta_service.registrar_dor(personal_id, aluno_id, descricao,
                                 exercicio_id=ex.get("exercicio_id"), exercicio_nome=ex.get("nome"))
    return {"ok": 1, "avisado": 1}
