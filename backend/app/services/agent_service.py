"""Ferramentas do agente (ESPEC §4) — mesma lógica do portal, mas com payload COMPACTO
(chaves curtas, sem nulos) porque o resultado entra no contexto da LLM (tokens).
O `{personal_id, aluno_id}` já vem resolvido pelo webhook — a LLM nunca informa identidade.
"""
from app.models.enums import Ator, CanalOrigem, Classificacao
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import sessao_service


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
    r = sessao_service.record(aluno_id, series, exercicio_id=exercicio_id,
                              canal=CanalOrigem.WHATSAPP, classificacao=Classificacao.AUTO, ator=Ator.ALUNO)
    return {"ok": 1, "ex": r.get("exercicio_nome")}


def consultar_historico(aluno_id: str, exercicio_id: str) -> dict:
    last = repo.query_gsi1_last(keys.gsi1_registro(aluno_id, exercicio_id), 1)
    if not last:
        return {"vazio": 1}
    le = repo.clean(last[0])
    return {"ex": le.get("exercicio_nome"), "series": le.get("series_exec")}


def avancar(aluno_id: str) -> dict:
    s = sessao_service.advance(aluno_id)
    ex = s.get("ex_atual") or {}
    return {"ok": 1, "ex": ex.get("nome"), "fim": s.get("status") != "EM_ANDAMENTO"}
