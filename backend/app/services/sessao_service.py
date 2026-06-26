"""Sessão de treino + registros (ESPEC §3 / §6 da spec antiga).

Sessão ativa = 1 item denormalizado `SESSION#ACTIVE` que embute a sequência de exercícios
(snapshots) + o exercício atual → o agente lê tudo em 1 GetItem. Registro = 1 item por
(sessão, exercício) com séries acumuladas via list_append (1 write). Usado pelo portal e
pelo agente."""
import time
import unicodedata
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException

from app.models.enums import Ator, CanalOrigem, Classificacao, SessaoStatus
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import badge_service, pontos_service
from app.utils import epoch_ms, new_id, now_iso, treino_vigente

SESSION_TTL_S = 6 * 3600  # sessão abandonada cai sozinha (ESPEC §3)


def _isoweek() -> str:
    y, w, _ = datetime.now(timezone.utc).isocalendar()
    return f"{y}-W{w:02d}"


def _semana_anterior(semana: str) -> str:
    """Retorna a semana ISO anterior. Ex: '2026-W25' → '2026-W24' (lida com virada de ano)."""
    year, week = int(semana.split("-W")[0]), int(semana.split("-W")[1])
    monday = date.fromisocalendar(year, week, 1)
    prev = (monday - timedelta(weeks=1)).isocalendar()
    return f"{prev[0]}-W{prev[1]:02d}"


def _snapshot(ex: dict) -> dict:
    return {
        "exercicio_id": ex["exercicio_id"],
        "nome": ex.get("nome"),
        "grupo": ex.get("grupo"),
        "tipo_exercicio": ex.get("tipo_exercicio"),
        "series": ex.get("series"),
        "reps_prescritas": ex.get("reps_prescritas"),
        "carga_prescrita": ex.get("carga_prescrita"),
        "series_prescritas": ex.get("series_prescritas"),
        "intervalo_s": ex.get("intervalo_s"),
        "video_url": ex.get("video_url"),
        "observacoes": ex.get("observacoes"),
        "unidade_carga": ex.get("unidade_carga"),
        "unidade_reps": ex.get("unidade_reps"),
        "links_uteis": ex.get("links_uteis") or [],
        "links_uteis_excluidos": ex.get("links_uteis_excluidos") or [],
        "substitutos": ex.get("substitutos") or [],
        "substitutos_excluidos": ex.get("substitutos_excluidos") or [],
    }


def get_active(aluno_id: str, consistent: bool = False) -> dict | None:
    return repo.get_item(keys.pk_aluno(aluno_id), keys.SK_SESSION_ACTIVE, consistent=consistent)


def _touch_atividade(personal_id: str, aluno_id: str, *, status: str, treino_nome: str | None,
                     exercicio_atual: str | None, ordem_atual: int | None, total_ex: int | None) -> None:
    """Denormaliza 'última atividade' na partição do personal (1 item por aluno, upsert
    direto) para o dashboard listar os últimos alunos que treinaram/estão treinando sem
    varrer N partições de aluno — via GSI1 (ESPEC §4.1, mesmo índice já usado p/ registros)."""
    repo.update_item(keys.pk_personal(personal_id), keys.sk_atividade(aluno_id), {
        "aluno_id": aluno_id,
        "status": status,
        "treino_nome": treino_nome,
        "exercicio_atual": exercicio_atual,
        "ordem_atual": ordem_atual,
        "total_ex": total_ex,
        "atualizado_em": now_iso(),
        "GSI1PK": keys.gsi1_atividade(personal_id),
        "GSI1SK": epoch_ms(),
    })


def start_session(personal_id: str, aluno_id: str, treino_id: str, iniciado_pelo_aluno: bool = False) -> dict:
    treino = repo.get_item(keys.pk_aluno(aluno_id), keys.sk_treino(treino_id))
    if not treino:
        raise HTTPException(404, "Treino não encontrado")
    exs = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.sk_exercicio_prefix(treino_id))
    if not exs:
        raise HTTPException(400, "Este treino não tem exercícios")
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
    _touch_atividade(
        personal_id, aluno_id, status=SessaoStatus.EM_ANDAMENTO.value, treino_nome=treino.get("nome"),
        exercicio_atual=snaps[0]["nome"] if snaps else None, ordem_atual=0, total_ex=len(snaps),
    )
    if iniciado_pelo_aluno:
        st_aluno = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_STATS_ALUNO) or {}
        if not st_aluno.get("usou_app"):
            repo.add_and_set(keys.pk_aluno(aluno_id), keys.SK_STATS_ALUNO, set_={"usou_app": True})
            repo.add_and_set(keys.pk_personal(personal_id), keys.SK_STATS_ALUNOS, add={"alunos_app": 1})
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
    personal_id = s.get("personal_id")
    if personal_id:
        _touch_atividade(
            personal_id, aluno_id, status=SessaoStatus.EM_ANDAMENTO.value, treino_nome=s.get("treino_nome"),
            exercicio_atual=snaps[nxt].get("nome"), ordem_atual=nxt, total_ex=len(snaps),
        )
    return s


def finish(aluno_id: str) -> dict:
    s = get_active(aluno_id, consistent=True)
    if not s:
        raise HTTPException(404, "Sem sessão ativa")
    s["status"] = SessaoStatus.FINALIZADA.value
    fim_iso = now_iso()
    s["data_hora_fim"] = fim_iso
    try:
        inicio_dt = datetime.fromisoformat(s["data_hora_inicio"].replace("Z", "+00:00"))
        fim_dt = datetime.fromisoformat(fim_iso.replace("Z", "+00:00"))
        s["duracao_segundos"] = int((fim_dt - inicio_dt).total_seconds())
    except Exception:
        pass
    # Denormaliza registros na sessão histórica (1 query extra, evita N+1 na timeline)
    sessao_id = s["sessao_id"]
    regs = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=f"REG#{sessao_id}#")
    snap_by_ex = {e["exercicio_id"]: e for e in s.get("exercicios", [])}
    s["exercicios_exec"] = [
        {
            "exercicio_id": r.get("exercicio_id"),
            "exercicio_nome": r.get("exercicio_nome"),
            "series_exec": r.get("series_exec", []),
            "tipo_exercicio": snap_by_ex.get(r.get("exercicio_id", ""), {}).get("tipo_exercicio"),
            "series_prescritas": snap_by_ex.get(r.get("exercicio_id", ""), {}).get("series_prescritas"),
            "series": snap_by_ex.get(r.get("exercicio_id", ""), {}).get("series"),
            "reps_prescritas": snap_by_ex.get(r.get("exercicio_id", ""), {}).get("reps_prescritas"),
            "carga_prescrita": snap_by_ex.get(r.get("exercicio_id", ""), {}).get("carga_prescrita"),
            "substituto_nome": r.get("substituto_nome"),
        }
        for r in regs
    ]
    snap = {k: v for k, v in s.items() if k not in ("PK", "SK", "ttl")}
    ts = epoch_ms()
    sk_hist = keys.sk_sessao_hist(ts, sessao_id)
    repo.put_item(keys.pk_aluno(aluno_id), sk_hist, snap)
    # Ponteiro por sessao_id para busca direta no detalhe
    repo.put_item(keys.pk_aluno(aluno_id), keys.sk_sessao_idx(sessao_id), {"sk": sk_hist})
    # Commita os registros da sessão concluída: remove o TTL para que sirvam de fonte
    # permanente da evolução de carga (GSI1). Sessões abandonadas não passam por aqui
    # e expiram naturalmente em 6h.
    for r in regs:
        repo.update_item(keys.pk_aluno(aluno_id), r["SK"], {"ttl": None})
    repo.delete_item(keys.pk_aluno(aluno_id), keys.SK_SESSION_ACTIVE)
    # Agregação na escrita: conta a sessão (aluno + semana) — ESPEC §3.1
    pk = keys.pk_aluno(aluno_id)
    # Lê stats antes do update para calcular streak (1 GetItem extra, inevitável)
    st_atual = repo.clean(repo.get_item(pk, keys.SK_STATS_ALUNO, consistent=True)) or {}
    total_sessoes_novo = int(st_atual.get("total_sessoes", 0)) + 1
    # Cálculo do streak de semanas consecutivas
    wk = _isoweek()
    ultima_semana = st_atual.get("streak_ultima_semana", "")
    if ultima_semana == wk:
        novo_streak = int(st_atual.get("streak_atual", 1))
    elif ultima_semana == _semana_anterior(wk):
        novo_streak = int(st_atual.get("streak_atual", 0)) + 1
    else:
        novo_streak = 1
    novo_streak_maximo = max(novo_streak, int(st_atual.get("streak_maximo", 0)))
    repo.add_and_set(pk, keys.SK_STATS_ALUNO, add={"total_sessoes": 1}, set_={
        "ultimo_treino": fim_iso,
        "streak_atual": novo_streak,
        "streak_maximo": novo_streak_maximo,
        "streak_ultima_semana": wk,
    })
    repo.add_and_set(pk, keys.sk_stats_week(wk), add={"sessoes": 1}, set_={"semana": wk})
    # Agregado diário por personal (para gráfico do dashboard)
    personal_id = s.get("personal_id")
    if personal_id:
        hoje = fim_iso[:10]
        repo.add_and_set(keys.pk_personal(personal_id), f"STATS#D#{hoje}",
                         add={"sessoes": 1}, set_={"data": hoje})
        repo.add_to_set(keys.pk_personal(personal_id), f"STATS#D#{hoje}",
                        "alunos_set", {aluno_id})
        # Gamificação: pontos por sessão finalizada (com multiplicador de streak)
        total_ex = len(s.get("exercicios", []))
        feitos_ex = len(snap.get("exercicios_exec", []))
        completo = total_ex > 0 and feitos_ex >= total_ex
        desc = "Sessão 100% completa" if completo else "Sessão finalizada"
        pts = pontos_service.PONTOS["SESSAO"] + (pontos_service.PONTOS["SESSAO_COMPLETA_BONUS"] if completo else 0)
        pontos_service.award(aluno_id, "SESSAO", personal_id, pts=pts, descricao=desc, streak=novo_streak)
        # Badges: verifica conquistas de sessão e streak
        badge_service.verificar_e_conceder(aluno_id, personal_id,
                                           total_sessoes=total_sessoes_novo, streak_atual=novo_streak)
        _touch_atividade(
            personal_id, aluno_id, status=SessaoStatus.FINALIZADA.value, treino_nome=s.get("treino_nome"),
            exercicio_atual=None, ordem_atual=None, total_ex=s.get("total_ex"),
        )
    return snap


def cancelar(aluno_id: str) -> None:
    """Desfaz a sessão ativa (ex.: aluno selecionou o treino errado) — sem gravar histórico
    nem tocar nos agregados, como se nunca tivesse começado."""
    s = get_active(aluno_id, consistent=True)
    if not s:
        raise HTTPException(404, "Sem sessão ativa")
    repo.delete_item(keys.pk_aluno(aluno_id), keys.SK_SESSION_ACTIVE)
    personal_id = s.get("personal_id")
    if personal_id:
        repo.delete_item(keys.pk_personal(personal_id), keys.sk_atividade(aluno_id))


def record(aluno_id: str, series: list, exercicio_id: str | None = None,
           exercicio_nome: str | None = None, canal: CanalOrigem = CanalOrigem.PORTAL,
           classificacao: Classificacao = Classificacao.MANUAL, ator: Ator = Ator.PERSONAL) -> tuple[dict, float | None]:
    """Registra séries no exercício atual (ou no informado) — 1 write (append) + agregados.
    Retorna (registro, nova_carga_de_PR | None). ESPEC §3.2/§3.1."""
    s = get_active(aluno_id, consistent=True)
    if not s:
        raise HTTPException(409, "Sem sessão ativa para registrar")
    ex = s.get("ex_atual") or {}
    snaps = s.get("exercicios", [])
    ex_id = exercicio_id or ex.get("exercicio_id")
    ex_nome = exercicio_nome or ex.get("nome")
    ex_grupo = next((e.get("grupo") for e in snaps if e.get("exercicio_id") == ex_id), ex.get("grupo")) or "Sem grupo"
    if not ex_id:
        raise HTTPException(400, "Exercício não identificado")
    chave = chave_exercicio(ex_nome)
    pk = keys.pk_aluno(aluno_id)
    on_insert = {
        "sessao_id": s["sessao_id"], "exercicio_id": ex_id, "exercicio_nome": ex_nome,
        "aluno_id": aluno_id, "data_hora": now_iso(),
        "canal_origem": canal.value, "classificacao": classificacao.value, "ator": ator.value,
        "GSI1PK": keys.gsi1_registro(aluno_id, chave), "GSI1SK": keys.gsi1sk_registro(epoch_ms()),
        "ttl": int(time.time()) + SESSION_TTL_S,   # expira junto com a sessão se abandonada
    }
    updated = repo.append_series(pk, keys.sk_registro(s["sessao_id"], ex_id), series, on_insert)

    # Agregação na escrita (ESPEC §3.1): volume desta gravação + recorde de carga.
    ex_tipo = next((e.get("tipo_exercicio") for e in snaps if e.get("exercicio_id") == ex_id), ex.get("tipo_exercicio")) or "FORCA"
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
        repo.add_and_set(pk, keys.sk_stats_week_grupo(wk, ex_grupo), add={"volume": volume}, set_={"semana": wk, "grupo": ex_grupo})
        repo.add_and_set(pk, keys.sk_stats_grupo(ex_grupo), add={"volume": volume}, set_={"grupo": ex_grupo})
    pr_novo = _calcular_pr(pk, chave, series, ex_tipo, ex_nome)
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
               ator: Ator = Ator.ALUNO, substituto_nome: str | None = None) -> tuple[dict, float | None]:
    """Substitui as séries de um exercício na sessão (permite editar após registrar).
    Ajusta os agregados pela diferença de volume. Retorna (registro, novo_PR | None).
    `substituto_nome`: se o aluno executou um substituto em vez do exercício prescrito —
    o registro continua sob o mesmo `exercicio_id`, mas o PR não é atualizado (carga de um
    exercício diferente não é comparável ao recorde do original)."""
    s = get_active(aluno_id, consistent=True)
    if not s:
        raise HTTPException(409, "Sem sessão ativa")
    snaps = s.get("exercicios", [])
    ex_atual = s.get("ex_atual") or {}
    ex_id = exercicio_id or ex_atual.get("exercicio_id")
    if not ex_id:
        raise HTTPException(400, "Exercício não identificado")
    ex_nome = next((e.get("nome") for e in snaps if e.get("exercicio_id") == ex_id), ex_atual.get("nome"))
    ex_grupo = next((e.get("grupo") for e in snaps if e.get("exercicio_id") == ex_id), ex_atual.get("grupo")) or "Sem grupo"
    ex_tipo = next((e.get("tipo_exercicio") for e in snaps if e.get("exercicio_id") == ex_id), ex_atual.get("tipo_exercicio")) or "FORCA"
    chave = chave_exercicio(ex_nome)
    pk = keys.pk_aluno(aluno_id)
    sk = keys.sk_registro(s["sessao_id"], ex_id)
    old = repo.get_item(pk, sk)
    old_vol = _volume(old.get("series_exec") if old else None)
    on_insert = {
        "sessao_id": s["sessao_id"], "exercicio_id": ex_id, "exercicio_nome": ex_nome,
        "aluno_id": aluno_id, "data_hora": now_iso(),
        "canal_origem": canal.value, "classificacao": classificacao.value, "ator": ator.value,
        "GSI1PK": keys.gsi1_registro(aluno_id, chave), "GSI1SK": keys.gsi1sk_registro(epoch_ms()),
        "ttl": int(time.time()) + SESSION_TTL_S,   # expira junto com a sessão se abandonada
    }
    updated = repo.put_series(pk, sk, series, on_insert, set_always={"substituto_nome": substituto_nome})
    delta = _volume(series) - old_vol
    if delta:
        wk = _isoweek()
        repo.add_and_set(pk, keys.SK_STATS_ALUNO, add={"total_volume": delta}, set_={"ultimo_treino": now_iso()})
        repo.add_and_set(pk, keys.sk_stats_week(wk), add={"volume": delta}, set_={"semana": wk})
        repo.add_and_set(pk, keys.sk_stats_week_grupo(wk, ex_grupo), add={"volume": delta}, set_={"semana": wk, "grupo": ex_grupo})
        repo.add_and_set(pk, keys.sk_stats_grupo(ex_grupo), add={"volume": delta}, set_={"grupo": ex_grupo})
    pr_novo = None
    if not substituto_nome:
        pr_novo = _calcular_pr(pk, chave, series, ex_tipo, ex_nome)
    return updated, pr_novo


def sessao_exercicios(aluno_id: str) -> dict | None:
    """Sessão ativa com TODOS os exercícios + o que já foi registrado em cada um."""
    s = get_active(aluno_id, consistent=True)
    if not s:
        return None
    regs = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=f"REG#{s['sessao_id']}#")
    regs_by_ex = {r.get("exercicio_id"): repo.clean(r) for r in regs}
    return {
        "sessao_id": s["sessao_id"], "treino_nome": s.get("treino_nome"),
        "exercicios": [
            {
                **e,
                "registrado": regs_by_ex.get(e.get("exercicio_id"), {}).get("series_exec"),
                "substituto_executado": regs_by_ex.get(e.get("exercicio_id"), {}).get("substituto_nome"),
            }
            for e in s.get("exercicios", [])
        ],
    }


def historico_exercicio(aluno_id: str, exercicio_id: str, limit: int = 1) -> list[dict]:
    """Último(s) registro(s) do exercício via GSI1 — sem varrer histórico (ESPEC §4.1)."""
    chave = chave_exercicio(nome_por_exercicio_id(aluno_id, exercicio_id))
    return repo.clean_all(repo.query_gsi1_last(keys.gsi1_registro(aluno_id, chave), limit))


def _num(v) -> float | None:
    if v is None:
        return None
    try:
        return float(str(v).replace(",", ".").strip())
    except ValueError:
        return None


def _calcular_pr(pk: str, chave: str, series: list, tipo: str, ex_nome: str) -> float | None:
    """Calcula e grava o PR de acordo com o tipo de exercício. Retorna o valor do PR se for novo.
    Para carga negativa (contrapeso/graviton), max() ainda é o PR correto: -10 > -30, ou seja
    menos contrapeso (menos negativo) = mais difícil = melhor desempenho."""
    if tipo == "PESO_CORPORAL":
        reps_vals = [it.get("reps") for it in series if it.get("reps")]
        if not reps_vals:
            return None
        pr_val = float(max(reps_vals))
        if repo.update_if_greater(pk, keys.sk_stats_pr(chave), "carga", pr_val,
                                   extra={"exercicio_nome": ex_nome, "data": now_iso()}):
            return pr_val
    elif tipo == "CARDIO":
        duracao = sum(it.get("reps") or 0 for it in series)
        if not duracao:
            return None
        if repo.update_if_greater(pk, keys.sk_stats_pr(chave), "carga", float(duracao),
                                   extra={"exercicio_nome": ex_nome, "data": now_iso()}):
            return float(duracao)
    else:  # FORCA (default) — max() funciona para positivo e negativo
        cargas = [c for c in (_num(it.get("carga")) for it in series) if c is not None]
        if not cargas:
            return None
        carga_pr = max(cargas)
        if repo.update_if_greater(pk, keys.sk_stats_pr(chave), "carga", carga_pr,
                                   extra={"exercicio_nome": ex_nome, "data": now_iso()}):
            return carga_pr
    return None


def chave_exercicio(nome: str | None) -> str:
    """Chave canônica do nome do exercício (sem acento/caixa/espaços extras) — usada para
    agrupar métricas (evolução/PR) de exercícios homônimos cadastrados em treinos diferentes,
    já que cada `Exercicio` ganha um `exercicio_id` próprio mesmo quando repete o nome."""
    if not nome:
        return ""
    sem_acento = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode()
    return " ".join(sem_acento.lower().split())


def nome_por_exercicio_id(aluno_id: str, exercicio_id: str) -> str | None:
    """Resolve o nome atual de um exercício do aluno a partir do `exercicio_id` (mesma query
    de `list_exercicios_aluno`, sem scan — ESPEC §4.1)."""
    items = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix="EX#")
    return next((i.get("nome") for i in items if i.get("exercicio_id") == exercicio_id), None)


def _ex_info(aluno_id: str, exercicio_id: str) -> dict:
    """Retorna {nome, tipo_exercicio, grupo} para um exercicio_id do aluno."""
    items = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix="EX#")
    for i in items:
        if i.get("exercicio_id") == exercicio_id:
            return {
                "nome": i.get("nome"),
                "tipo_exercicio": i.get("tipo_exercicio") or "FORCA",
                "grupo": i.get("grupo"),
                "rm_kg": i.get("rm_kg"),
            }
    return {"nome": None, "tipo_exercicio": "FORCA", "grupo": None, "rm_kg": None}


def evolucao_exercicio(aluno_id: str, exercicio_id: str, limit: int = 100) -> dict:
    """Série temporal + PR de um exercício, adaptando métricas por tipo (FORCA/CARDIO/PESO_CORPORAL).
    Agrupa por nome canônico: exercícios homônimos em treinos diferentes compartilham a mesma evolução."""
    info = _ex_info(aluno_id, exercicio_id)
    tipo = info.get("tipo_exercicio") or "FORCA"
    nome = info.get("nome") or nome_por_exercicio_id(aluno_id, exercicio_id)
    chave = chave_exercicio(nome)
    items = repo.query_gsi1_last(keys.gsi1_registro(aluno_id, chave), limit)
    items.sort(key=lambda i: i.get("GSI1SK", ""))  # ascendente por tempo
    serie: list[dict] = []
    pr: dict | None = None
    for it in items:
        c = repo.clean(it)
        series_exec = c.get("series_exec") or []
        ponto: dict = {"data": c.get("data_hora")}

        if tipo == "PESO_CORPORAL":
            reps_vals = [s.get("reps") for s in series_exec if s.get("reps")]
            reps_max = max(reps_vals) if reps_vals else None
            total_reps = sum(s.get("reps") or 0 for s in series_exec)
            ponto.update({"reps_max": reps_max, "total_reps": total_reps, "carga_max": None, "volume": None})
            if reps_max is not None and (pr is None or reps_max > pr["carga"]):
                pr = {"carga": reps_max, "data": c.get("data_hora")}
        elif tipo == "CARDIO":
            duracao_total = sum(s.get("reps") or 0 for s in series_exec)
            ponto.update({"duracao_total_s": duracao_total, "carga_max": None, "volume": None})
            if duracao_total and (pr is None or duracao_total > pr["carga"]):
                pr = {"carga": duracao_total, "data": c.get("data_hora")}
        else:  # FORCA
            cargas, volume = [], 0.0
            soma_int, reps_total_irm = 0.0, 0
            rm_kg = float(info.get("rm_kg")) if info.get("rm_kg") else None
            for s in series_exec:
                cg = _num(s.get("carga"))
                reps = s.get("reps") or 0
                if cg is not None:
                    cargas.append(cg)
                    volume += abs(cg) * reps  # abs p/ volume de contrapeso (graviton) ser positivo
                    if rm_kg and rm_kg > 0 and reps and cg > 0:
                        soma_int += (cg / rm_kg * 100) * reps
                        reps_total_irm += reps
            carga_max = max(cargas) if cargas else None  # max funciona para pos e neg (-10 > -30)
            irm = round(soma_int / reps_total_irm, 2) if reps_total_irm > 0 else None
            ponto.update({
                "carga_max": carga_max,
                "volume": round(volume, 1) if volume else None,
                "reps": "/".join(str(s["reps"]) for s in series_exec if s.get("reps")),
                "irm": irm,
            })
            if carga_max is not None and (pr is None or carga_max > pr["carga"]):
                pr = {"carga": carga_max, "data": c.get("data_hora")}

        serie.append(ponto)
    return {"tipo": tipo, "serie": serie, "pr": pr, "total_sessoes": len(serie)}


def backfill_reg_from_history(aluno_id: str) -> dict:
    """Reconstrói itens REG (fonte da evolução via GSI1) a partir do histórico de sessões
    finalizadas, para alunos cujos REG expiraram pelo bug de TTL (6h). Cada SESSION#{ts}#{id}
    guarda `exercicios_exec` denormalizado e permanente — recria o REG ausente sem TTL."""
    pk = keys.pk_aluno(aluno_id)
    sessoes = [
        repo.clean(s) for s in repo.query_pk(pk, sk_prefix="SESSION#")
        if s.get("status") == SessaoStatus.FINALIZADA.value and s.get("sessao_id")
    ]
    criados = 0
    for s in sessoes:
        sessao_id = s["sessao_id"]
        data_hora = s.get("data_hora_fim") or s.get("data_hora_inicio") or now_iso()
        try:
            dt = datetime.fromisoformat(data_hora.replace("Z", "+00:00"))
            ts_ms = str(int(dt.timestamp() * 1000))
        except Exception:
            ts_ms = epoch_ms()
        for ex in s.get("exercicios_exec", []):
            ex_id = ex.get("exercicio_id")
            series_exec = ex.get("series_exec", [])
            if not ex_id or not series_exec:
                continue
            sk_reg = keys.sk_registro(sessao_id, ex_id)
            if repo.get_item(pk, sk_reg):   # ainda existe (TTL não expirou) — não duplica
                continue
            chave = chave_exercicio(ex.get("exercicio_nome"))
            repo.put_item(pk, sk_reg, {
                "sessao_id": sessao_id,
                "exercicio_id": ex_id,
                "exercicio_nome": ex.get("exercicio_nome"),
                "aluno_id": aluno_id,
                "data_hora": data_hora,
                "series_exec": series_exec,
                "GSI1PK": keys.gsi1_registro(aluno_id, chave),
                "GSI1SK": keys.gsi1sk_registro(ts_ms),
                # sem ttl — item permanente
            })
            criados += 1
    return {"criados": criados, "sessoes_verificadas": len(sessoes)}


def ultimo_e_proximo(aluno_id: str) -> dict:
    """Último treino concluído (nome + data) e o próximo na rotação (ordem dos treinos),
    p/ o app do aluno mostrar 'feito ontem' / 'próximo: Treino B'."""
    pk = keys.pk_aluno(aluno_id)
    # candidatos via prefixo "SESSION#" inclui também "SESSION#ACTIVE" — filtra a ativa.
    candidatos = repo.query_pk_last_n(pk, "SESSION#", 5)
    ultima_raw = next((c for c in candidatos if c.get("status") != SessaoStatus.EM_ANDAMENTO.value), None)
    ultima = repo.clean(ultima_raw) if ultima_raw else None

    hoje_str = date.today().isoformat()
    treinos = repo.clean_all(repo.query_pk(pk, sk_prefix=keys.SK_TREINO_PREFIX))
    treinos = [t for t in treinos if treino_vigente(t, hoje_str)]
    treinos.sort(key=lambda t: t.get("ordem", 0))

    proximo = None
    if treinos:
        if ultima:
            idx = next((i for i, t in enumerate(treinos) if t["treino_id"] == ultima.get("treino_id")), None)
            proximo = treinos[(idx + 1) % len(treinos)] if idx is not None else treinos[0]
        else:
            proximo = treinos[0]

    return {
        "ultimo": {"treino_nome": ultima.get("treino_nome"), "data": ultima.get("data_hora_fim")} if ultima else None,
        "proximo": {"treino_id": proximo["treino_id"], "nome": proximo.get("nome")} if proximo else None,
    }


def list_sessoes(aluno_id: str, limit: int = 10, cursor: str | None = None) -> tuple[list[dict], str | None]:
    """Sessões históricas paginadas (mais recentes primeiro), sem a sessão ativa."""
    items, next_cursor = repo.query_pk_page(
        keys.pk_aluno(aluno_id), "SESSION#", limit=limit + 1, cursor=cursor, forward=False
    )
    items = [i for i in items if i.get("SK") != keys.SK_SESSION_ACTIVE][:limit]
    return repo.clean_all(items), next_cursor


def list_exercicios_aluno(aluno_id: str) -> list[dict]:
    """Lista plana de todos os exercícios do aluno (todos os treinos) — p/ seletor de evolução.
    Deduplica por nome canônico: exercícios homônimos em treinos diferentes aparecem uma só vez."""
    items = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix="EX#")
    items.sort(key=lambda e: e.get("ordem", 0))
    seen: set[str] = set()
    deduped: list[dict] = []
    for item in items:
        chave = chave_exercicio(item.get("nome") or "")
        if not chave or chave not in seen:
            if chave:
                seen.add(chave)
            deduped.append(item)
    return repo.clean_all(deduped)


def resumo_aluno(aluno_id: str, semanas: int = 16) -> dict:
    """Resumo de evolução do aluno lido de agregados (1 GetItem + queries curtas, sem scan)."""
    from app.services import pontos_service as _ps
    pk = keys.pk_aluno(aluno_id)
    st = repo.clean(repo.get_item(pk, keys.SK_STATS_ALUNO)) or {}
    weeks = [repo.clean(w) for w in repo.query_pk_last_n(pk, "STATS#W#", semanas)]
    weeks.sort(key=lambda w: w.get("semana", ""))
    prs = [repo.clean(p) for p in repo.query_pk(pk, sk_prefix="STATS#PR#")]
    wk_grupos = [repo.clean(w) for w in repo.query_pk(pk, sk_prefix="STATS#WG#")]
    grupos_totais = [repo.clean(g) for g in repo.query_pk(pk, sk_prefix="STATS#G#")]
    semanas_validas = {w.get("semana") for w in weeks}
    volume_por_semana_grupo: dict[str, dict[str, float]] = {}
    for wg in wk_grupos:
        sem, grp = wg.get("semana"), wg.get("grupo")
        if sem in semanas_validas and grp:
            volume_por_semana_grupo.setdefault(sem, {})[grp] = wg.get("volume", 0)
    wk_atual = _isoweek()
    streak_atual = int(st.get("streak_atual", 0))
    total_sessoes = int(st.get("total_sessoes", 0))
    semanas_com_treino = sum(1 for w in weeks if w.get("sessoes", 0) > 0)
    media_semana = round(total_sessoes / semanas_com_treino, 1) if semanas_com_treino > 0 else 0.0
    return {
        "total_sessoes": total_sessoes,
        "total_volume": st.get("total_volume", 0),
        "ultimo_treino": st.get("ultimo_treino"),
        "sessoes_semana": next((w.get("sessoes", 0) for w in weeks if w.get("semana") == wk_atual), 0),
        "streak_atual": streak_atual,
        "streak_maximo": int(st.get("streak_maximo", 0)),
        "multiplicador_atual": _ps.multiplicador_streak(streak_atual),
        "media_sessoes_semana": media_semana,
        "semanas": [
            {
                "semana": w.get("semana"), "volume": w.get("volume", 0), "sessoes": w.get("sessoes", 0),
                "grupos": volume_por_semana_grupo.get(w.get("semana"), {}),
            }
            for w in weeks
        ],
        "prs": sorted(
            [{"exercicio": p.get("exercicio_nome"), "carga": p.get("carga"), "data": p.get("data")} for p in prs],
            key=lambda x: x.get("carga") or 0, reverse=True,
        ),
        "volume_por_grupo": sorted(
            [{"grupo": g.get("grupo"), "volume": g.get("volume", 0)} for g in grupos_totais],
            key=lambda x: x.get("volume") or 0, reverse=True,
        ),
    }
