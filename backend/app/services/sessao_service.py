"""Sessão de treino + registros (ESPEC §3 / §6 da spec antiga).

Sessão ativa = 1 item denormalizado `SESSION#ACTIVE` que embute a sequência de exercícios
(snapshots) + o exercício atual → o agente lê tudo em 1 GetItem. Registro = 1 item por
(sessão, exercício) com séries acumuladas via list_append (1 write). Usado pelo portal e
pelo agente."""
import time

from fastapi import HTTPException

from app.models.enums import Ator, CanalOrigem, Classificacao, SessaoStatus
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.utils import epoch_ms, new_id, now_iso

SESSION_TTL_S = 6 * 3600  # sessão abandonada cai sozinha (ESPEC §3)


def _snapshot(ex: dict) -> dict:
    return {
        "exercicio_id": ex["exercicio_id"],
        "nome": ex.get("nome"),
        "series": ex.get("series"),
        "reps_prescritas": ex.get("reps_prescritas"),
        "carga_prescrita": ex.get("carga_prescrita"),
        "intervalo_s": ex.get("intervalo_s"),
    }


def get_active(aluno_id: str, consistent: bool = False) -> dict | None:
    return repo.get_item(keys.pk_aluno(aluno_id), keys.SK_SESSION_ACTIVE, consistent=consistent)


def start_session(personal_id: str, aluno_id: str, treino_id: str) -> dict:
    treino = repo.get_item(keys.pk_aluno(aluno_id), keys.sk_treino(treino_id))
    if not treino:
        raise HTTPException(404, "Treino não encontrado")
    exs = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.sk_exercicio_prefix(treino_id))
    exs.sort(key=lambda e: e.get("ordem", 0))
    snaps = [_snapshot(e) for e in exs]
    item = {
        "sessao_id": new_id(),
        "aluno_id": aluno_id,
        "personal_id": personal_id,
        "treino_id": treino_id,
        "treino_nome": treino.get("nome"),
        "status": SessaoStatus.EM_ANDAMENTO.value,
        "exercicios": snaps,
        "ex_atual": snaps[0] if snaps else None,
        "ordem_atual": 0,
        "total_ex": len(snaps),
        "data_hora_inicio": now_iso(),
        "ttl": int(time.time()) + SESSION_TTL_S,
    }
    repo.put_item(keys.pk_aluno(aluno_id), keys.SK_SESSION_ACTIVE, item)
    return item


def advance(aluno_id: str) -> dict:
    s = get_active(aluno_id, consistent=True)
    if not s:
        raise HTTPException(404, "Sem sessão ativa")
    snaps = s.get("exercicios", [])
    nxt = int(s.get("ordem_atual", 0)) + 1
    if nxt >= len(snaps):
        return finish(aluno_id)
    repo.update_item(keys.pk_aluno(aluno_id), keys.SK_SESSION_ACTIVE,
                     {"ordem_atual": nxt, "ex_atual": snaps[nxt]})
    s["ordem_atual"], s["ex_atual"] = nxt, snaps[nxt]
    return s


def finish(aluno_id: str) -> dict:
    s = get_active(aluno_id, consistent=True)
    if not s:
        raise HTTPException(404, "Sem sessão ativa")
    s["status"] = SessaoStatus.FINALIZADA.value
    s["data_hora_fim"] = now_iso()
    snap = {k: v for k, v in s.items() if k not in ("PK", "SK", "ttl")}  # snapshot sem ttl
    repo.put_item(keys.pk_aluno(aluno_id), keys.sk_sessao_hist(epoch_ms(), s["sessao_id"]), snap)
    repo.delete_item(keys.pk_aluno(aluno_id), keys.SK_SESSION_ACTIVE)
    return snap


def record(aluno_id: str, series: list, exercicio_id: str | None = None,
           exercicio_nome: str | None = None, canal: CanalOrigem = CanalOrigem.PORTAL,
           classificacao: Classificacao = Classificacao.MANUAL, ator: Ator = Ator.PERSONAL) -> dict:
    """Registra séries no exercício atual (ou no informado) — 1 write (append). ESPEC §3.2."""
    s = get_active(aluno_id, consistent=True)
    if not s:
        raise HTTPException(409, "Sem sessão ativa para registrar")
    ex = s.get("ex_atual") or {}
    ex_id = exercicio_id or ex.get("exercicio_id")
    ex_nome = exercicio_nome or ex.get("nome")
    if not ex_id:
        raise HTTPException(400, "Exercício não identificado")
    on_insert = {
        "sessao_id": s["sessao_id"],
        "exercicio_id": ex_id,
        "exercicio_nome": ex_nome,
        "aluno_id": aluno_id,
        "data_hora": now_iso(),
        "canal_origem": canal.value,
        "classificacao": classificacao.value,
        "ator": ator.value,
        "GSI1PK": keys.gsi1_registro(aluno_id, ex_id),
        "GSI1SK": keys.gsi1sk_registro(epoch_ms()),
    }
    return repo.append_series(keys.pk_aluno(aluno_id), keys.sk_registro(s["sessao_id"], ex_id),
                              series, on_insert)


def historico_exercicio(aluno_id: str, exercicio_id: str, limit: int = 1) -> list[dict]:
    """Último(s) registro(s) do exercício via GSI1 — sem varrer histórico (ESPEC §4.1)."""
    return repo.clean_all(repo.query_gsi1_last(keys.gsi1_registro(aluno_id, exercicio_id), limit))
