"""Sessão de treino + registros (ESPEC §3 / §6 da spec antiga).

Sessão ativa = 1 item denormalizado `SESSION#ACTIVE` que embute a sequência de exercícios
(snapshots) + o exercício atual → o agente lê tudo em 1 GetItem. Registro = 1 item por
(sessão, exercício) com séries acumuladas via list_append (1 write). Usado pelo portal e
pelo agente."""
import time
from datetime import datetime, timezone

from fastapi import HTTPException

from app.models.enums import Ator, CanalOrigem, Classificacao, SessaoStatus
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.utils import epoch_ms, new_id, now_iso

SESSION_TTL_S = 6 * 3600  # sessão abandonada cai sozinha (ESPEC §3)


def _isoweek() -> str:
    y, w, _ = datetime.now(timezone.utc).isocalendar()
    return f"{y}-W{w:02d}"


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


def start_session(personal_id: str, aluno_id: str, treino_id: str, dia: int | None = None) -> dict:
    treino = repo.get_item(keys.pk_aluno(aluno_id), keys.sk_treino(treino_id))
    if not treino:
        raise HTTPException(404, "Treino não encontrado")
    exs = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.sk_exercicio_prefix(treino_id))
    # Split intra-treino por dia da semana: se o treino tem exercícios marcados por dia,
    # carrega só os de hoje (+ os "todo dia"); senão, carrega todos.
    if dia is None:
        dia = datetime.now(timezone.utc).weekday()
    if any(e.get("dia_semana") is not None for e in exs):
        exs = [e for e in exs if e.get("dia_semana") in (None, dia)]
        if not exs:
            raise HTTPException(400, "Nenhum exercício para hoje neste treino")
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
    # Agregação na escrita: conta a sessão (aluno + semana) — ESPEC §3.1
    pk = keys.pk_aluno(aluno_id)
    repo.add_and_set(pk, keys.SK_STATS_ALUNO, add={"total_sessoes": 1}, set_={"ultimo_treino": s["data_hora_fim"]})
    wk = _isoweek()
    repo.add_and_set(pk, keys.sk_stats_week(wk), add={"sessoes": 1}, set_={"semana": wk})
    return snap


def record(aluno_id: str, series: list, exercicio_id: str | None = None,
           exercicio_nome: str | None = None, canal: CanalOrigem = CanalOrigem.PORTAL,
           classificacao: Classificacao = Classificacao.MANUAL, ator: Ator = Ator.PERSONAL) -> tuple[dict, float | None]:
    """Registra séries no exercício atual (ou no informado) — 1 write (append) + agregados.
    Retorna (registro, nova_carga_de_PR | None). ESPEC §3.2/§3.1."""
    s = get_active(aluno_id, consistent=True)
    if not s:
        raise HTTPException(409, "Sem sessão ativa para registrar")
    ex = s.get("ex_atual") or {}
    ex_id = exercicio_id or ex.get("exercicio_id")
    ex_nome = exercicio_nome or ex.get("nome")
    if not ex_id:
        raise HTTPException(400, "Exercício não identificado")
    pk = keys.pk_aluno(aluno_id)
    on_insert = {
        "sessao_id": s["sessao_id"], "exercicio_id": ex_id, "exercicio_nome": ex_nome,
        "aluno_id": aluno_id, "data_hora": now_iso(),
        "canal_origem": canal.value, "classificacao": classificacao.value, "ator": ator.value,
        "GSI1PK": keys.gsi1_registro(aluno_id, ex_id), "GSI1SK": keys.gsi1sk_registro(epoch_ms()),
    }
    updated = repo.append_series(pk, keys.sk_registro(s["sessao_id"], ex_id), series, on_insert)

    # Agregação na escrita (ESPEC §3.1): volume desta gravação + recorde de carga.
    cargas, volume = [], 0.0
    for it in series:
        cg = _num(it.get("carga"))
        if cg is not None:
            cargas.append(cg)
            volume += cg * (it.get("reps") or 0)
    if volume > 0:
        wk = _isoweek()
        repo.add_and_set(pk, keys.SK_STATS_ALUNO, add={"total_volume": volume}, set_={"ultimo_treino": now_iso()})
        repo.add_and_set(pk, keys.sk_stats_week(wk), add={"volume": volume}, set_={"semana": wk})
    pr_novo = None
    if cargas:
        carga_max = max(cargas)
        if repo.update_if_greater(pk, keys.sk_stats_pr(ex_id), "carga", carga_max,
                                  extra={"exercicio_nome": ex_nome, "data": now_iso()}):
            pr_novo = carga_max
    return updated, pr_novo


def _volume(series: list | None) -> float:
    v = 0.0
    for s in series or []:
        cg = _num(s.get("carga"))
        if cg is not None:
            v += cg * float(s.get("reps") or 0)   # reps pode vir como Decimal do DynamoDB
    return v


def set_series(aluno_id: str, exercicio_id: str | None, series: list,
               canal: CanalOrigem = CanalOrigem.PORTAL, classificacao: Classificacao = Classificacao.AUTO,
               ator: Ator = Ator.ALUNO) -> tuple[dict, float | None]:
    """Substitui as séries de um exercício na sessão (permite editar após registrar).
    Ajusta os agregados pela diferença de volume. Retorna (registro, novo_PR | None)."""
    s = get_active(aluno_id, consistent=True)
    if not s:
        raise HTTPException(409, "Sem sessão ativa")
    snaps = s.get("exercicios", [])
    ex_atual = s.get("ex_atual") or {}
    ex_id = exercicio_id or ex_atual.get("exercicio_id")
    if not ex_id:
        raise HTTPException(400, "Exercício não identificado")
    ex_nome = next((e.get("nome") for e in snaps if e.get("exercicio_id") == ex_id), ex_atual.get("nome"))
    pk = keys.pk_aluno(aluno_id)
    sk = keys.sk_registro(s["sessao_id"], ex_id)
    old = repo.get_item(pk, sk)
    old_vol = _volume(old.get("series_exec") if old else None)
    on_insert = {
        "sessao_id": s["sessao_id"], "exercicio_id": ex_id, "exercicio_nome": ex_nome,
        "aluno_id": aluno_id, "data_hora": now_iso(),
        "canal_origem": canal.value, "classificacao": classificacao.value, "ator": ator.value,
        "GSI1PK": keys.gsi1_registro(aluno_id, ex_id), "GSI1SK": keys.gsi1sk_registro(epoch_ms()),
    }
    updated = repo.put_series(pk, sk, series, on_insert)
    delta = _volume(series) - old_vol
    if delta:
        wk = _isoweek()
        repo.add_and_set(pk, keys.SK_STATS_ALUNO, add={"total_volume": delta}, set_={"ultimo_treino": now_iso()})
        repo.add_and_set(pk, keys.sk_stats_week(wk), add={"volume": delta}, set_={"semana": wk})
    pr_novo = None
    cargas = [c for c in (_num(it.get("carga")) for it in series) if c is not None]
    if cargas and repo.update_if_greater(pk, keys.sk_stats_pr(ex_id), "carga", max(cargas),
                                         extra={"exercicio_nome": ex_nome, "data": now_iso()}):
        pr_novo = max(cargas)
    return updated, pr_novo


def sessao_exercicios(aluno_id: str) -> dict | None:
    """Sessão ativa com TODOS os exercícios + o que já foi registrado em cada um."""
    s = get_active(aluno_id, consistent=True)
    if not s:
        return None
    regs = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=f"REG#{s['sessao_id']}#")
    feito = {r.get("exercicio_id"): repo.clean(r).get("series_exec") for r in regs}
    return {
        "sessao_id": s["sessao_id"], "treino_nome": s.get("treino_nome"),
        "exercicios": [{**e, "registrado": feito.get(e.get("exercicio_id"))} for e in s.get("exercicios", [])],
    }


def historico_exercicio(aluno_id: str, exercicio_id: str, limit: int = 1) -> list[dict]:
    """Último(s) registro(s) do exercício via GSI1 — sem varrer histórico (ESPEC §4.1)."""
    return repo.clean_all(repo.query_gsi1_last(keys.gsi1_registro(aluno_id, exercicio_id), limit))


def _num(v) -> float | None:
    if v is None:
        return None
    try:
        return float(str(v).replace(",", ".").strip())
    except ValueError:
        return None


def evolucao_exercicio(aluno_id: str, exercicio_id: str, limit: int = 100) -> dict:
    """Série temporal (carga máx + tonelagem por sessão) + PR de um exercício, via GSI1
    (query targeted, não scan — ESPEC §4.1). Carga não-numérica é ignorada nos cálculos."""
    items = repo.query_gsi1_last(keys.gsi1_registro(aluno_id, exercicio_id), limit)
    items.sort(key=lambda i: i.get("GSI1SK", ""))  # ascendente por tempo
    serie: list[dict] = []
    pr: dict | None = None
    for it in items:
        c = repo.clean(it)
        cargas, volume = [], 0.0
        for s in c.get("series_exec") or []:
            cg = _num(s.get("carga"))
            if cg is not None:
                cargas.append(cg)
                volume += cg * (s.get("reps") or 0)
        carga_max = max(cargas) if cargas else None
        serie.append({
            "data": c.get("data_hora"),
            "carga_max": carga_max,
            "volume": round(volume, 1) if volume else None,
            "reps": "/".join(str(s["reps"]) for s in (c.get("series_exec") or []) if s.get("reps")),
        })
        if carga_max is not None and (pr is None or carga_max > pr["carga"]):
            pr = {"carga": carga_max, "data": c.get("data_hora")}
    return {"serie": serie, "pr": pr, "total_sessoes": len(serie)}


def list_exercicios_aluno(aluno_id: str) -> list[dict]:
    """Lista plana de todos os exercícios do aluno (todos os treinos) — p/ seletor de evolução."""
    items = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix="EX#")
    items.sort(key=lambda e: e.get("ordem", 0))
    return repo.clean_all(items)


def resumo_aluno(aluno_id: str, semanas: int = 8) -> dict:
    """Resumo de evolução do aluno lido de agregados (1 GetItem + queries curtas, sem scan)."""
    pk = keys.pk_aluno(aluno_id)
    st = repo.clean(repo.get_item(pk, keys.SK_STATS_ALUNO)) or {}
    weeks = [repo.clean(w) for w in repo.query_pk_last_n(pk, "STATS#W#", semanas)]
    weeks.sort(key=lambda w: w.get("semana", ""))
    prs = [repo.clean(p) for p in repo.query_pk(pk, sk_prefix="STATS#PR#")]
    wk_atual = _isoweek()
    return {
        "total_sessoes": st.get("total_sessoes", 0),
        "total_volume": st.get("total_volume", 0),
        "ultimo_treino": st.get("ultimo_treino"),
        "sessoes_semana": next((w.get("sessoes", 0) for w in weeks if w.get("semana") == wk_atual), 0),
        "semanas": [{"semana": w.get("semana"), "volume": w.get("volume", 0), "sessoes": w.get("sessoes", 0)} for w in weeks],
        "prs": sorted(
            [{"exercicio": p.get("exercicio_nome"), "carga": p.get("carga"), "data": p.get("data")} for p in prs],
            key=lambda x: x.get("carga") or 0, reverse=True,
        ),
    }
