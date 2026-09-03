"""Sessão de treino + registros (ESPEC §3 / §6 da spec antiga).

Sessão ativa = 1 item denormalizado `SESSION#ACTIVE` que embute a sequência de exercícios
(snapshots) + o exercício atual → o agente lê tudo em 1 GetItem. Registro = 1 item por
(sessão, exercício) com séries acumuladas via list_append (1 write). Usado pelo portal e
pelo agente."""
import logging
import math
import time
import unicodedata
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException

from app.models.enums import Ator, CanalOrigem, Classificacao, SessaoStatus, normalizar_tipo_exercicio
from app.models.grupos_musculares import grupos_do_item, normalizar_grupo, separar_grupos
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import badge_service, ferias_service, locale_service, media_service, pontos_service
from app.utils import epoch_ms, new_id, now_iso, treino_vigente, treinos_validos

logger = logging.getLogger(__name__)

# Prazos da sessão aberta. A regra de negócio é do scheduler (app/sessao_scheduler.py), NÃO
# do TTL: uma sessão esquecida é finalizada com o que já foi registrado, em vez de o DynamoDB
# apagá-la junto com os REG. Os TTLs abaixo viraram só rede de segurança (garbage collection)
# e por isso são bem maiores que o prazo — se o scheduler falhar por horas, nada se perde.
SESSAO_AVISO_S = 4 * 3600      # push "ainda está treinando?" (= 2h antes do fechamento)
SESSAO_LIMITE_S = 6 * 3600     # finalização automática da sessão aberta
SESSION_TTL_S = 24 * 3600      # GC do SESSION#ACTIVE
REG_TTL_S = 48 * 3600          # GC do REG# — precisa sobreviver com folga ao fechamento
SCHED_TTL_S = 7 * 24 * 3600    # GC das entradas do scheduler


def _isoweek(tz: str) -> str:
    """Semana ISO corrente no fuso do ALUNO. O `tz` é obrigatório de propósito: com default
    o parâmetro seria esquecido em alguma chamada e aquele balde ficaria em UTC — que é
    exatamente o bug que isto corrige (docs/TIMEZONE.md §2)."""
    return locale_service.semana_iso_agora(tz)


def _semana_anterior(semana: str) -> str:
    """Retorna a semana ISO anterior. Ex: '2026-W25' → '2026-W24' (lida com virada de ano)."""
    year, week = int(semana.split("-W")[0]), int(semana.split("-W")[1])
    monday = date.fromisocalendar(year, week, 1)
    prev = (monday - timedelta(weeks=1)).isocalendar()
    return f"{prev[0]}-W{prev[1]:02d}"


def _serie_valida(s: dict) -> bool:
    """Série que conta para PR/volume/pontos — exclui séries de aquecimento (ramp-up) e
    anotações de contexto dentro de bloco de WOD (o resultado oficial do metcon é o score
    do bloco), ambas materializadas na gravação (spec CROSSFIT §3.2/§3.4)."""
    return not s.get("aquecimento") and not s.get("contexto")


def _snapshot(ex: dict, blocos_by_id: dict | None = None) -> dict:
    bloco = (blocos_by_id or {}).get(ex.get("bloco_id")) or {}
    return {
        "exercicio_id": ex["exercicio_id"],
        "nome": ex.get("nome"),
        # `grupos` é a verdade; `grupo` fica no snapshot para os leitores legados e para o
        # histórico de exercícios cadastrados antes do campo múltiplo existir.
        "grupos": ex.get("grupos"),
        "grupo": ex.get("grupo"),
        "bloco_id": ex.get("bloco_id"),
        # Resolvido aqui (único ponto): exercício herda warmup do bloco (spec CROSSFIT §3.4)
        "aquecimento": bool(ex.get("aquecimento") or bloco.get("aquecimento")),
        # Bloco pontuável (For Time/AMRAP/EMOM): registro por série vira anotação de contexto
        "bloco_pontuavel": bool(
            (bloco.get("formato") or "LIVRE") != "LIVRE" and not bloco.get("aquecimento")
        ),
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
        "metrica_direcao": ex.get("metrica_direcao") or "MAIOR",
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


def _agendar_sessao(item: dict) -> list[dict]:
    """Cria as entradas do scheduler (aviso + fechamento) na partição SCHED# do dia em que
    cada uma dispara, e devolve as refs para guardar no próprio item da sessão — cancelar
    depois vira delete direto, sem recalcular prazo (molde: agenda_notif_service.registrar)."""
    inicio = datetime.fromisoformat(item["data_hora_inicio"].replace("Z", "+00:00"))
    refs: list[dict] = []
    for acao, offset in (("AVISO", SESSAO_AVISO_S), ("FECHAR", SESSAO_LIMITE_S)):
        fire = inicio + timedelta(seconds=offset)
        fire_iso = fire.strftime("%Y-%m-%dT%H:%M:%SZ")
        pk = keys.pk_sched(fire_iso[:10])
        sk = keys.sk_sessao_sched(fire_iso, acao, item["aluno_id"])
        repo.put_item(pk, sk, {
            "acao": acao,
            "aluno_id": item["aluno_id"],
            "personal_id": item.get("personal_id"),
            "sessao_id": item["sessao_id"],
            "data_hora_inicio": item["data_hora_inicio"],
            "ttl": int(fire.timestamp()) + SCHED_TTL_S,
        })
        refs.append({"pk": pk, "sk": sk})
    return refs


def _limpar_sched(s: dict) -> None:
    """Remove as entradas do scheduler de uma sessão que terminou (finalizada ou cancelada).
    Best-effort: o scheduler revalida a sessão antes de agir, então uma sobra é inofensiva."""
    for ref in s.get("sched_refs") or []:
        try:
            repo.delete_item_if_exists(ref["pk"], ref["sk"])
        except Exception:
            logger.warning("[sessao] falha ao limpar agendamento %s", ref, exc_info=True)


def _fmt_duracao(segundos: int | None) -> str | None:
    if not segundos or segundos < 60:
        return None
    h, m = divmod(int(segundos) // 60, 60)
    return f"{h}h{m:02d}min" if h else f"{m}min"


def _notificar_treino_concluido(personal_id: str, aluno_id: str, snap: dict,
                                feitos_ex: int, total_ex: int) -> None:
    """Avisa o personal que o aluno concluiu um treino pelo app. Só é chamada quando a
    sessão foi iniciada pelo próprio aluno — sessão conduzida pelo personal no portal ou
    pelo agente do WhatsApp não notifica. Best-effort: nunca quebra o finish."""
    try:
        from app.services import notif_service   # import tardio — evita ciclo
        perfil = repo.get_item(keys.pk_personal(personal_id), keys.SK_PROFILE) or {}
        if perfil.get("notif_treino_concluido") is False:   # ausente = ligado
            return
        ptr = repo.get_item(keys.pk_personal(personal_id), keys.sk_aluno_pointer(aluno_id)) or {}
        nome = ptr.get("nome") or "Seu aluno"
        partes = [snap.get("treino_nome") or "Treino"]
        if total_ex:
            partes.append(f"{feitos_ex}/{total_ex} exercícios")
        dur = _fmt_duracao(snap.get("duracao_segundos"))
        if dur:
            partes.append(dur)
        prs = len(snap.get("novos_prs") or [])
        if prs:
            partes.append(f"{prs} novo{'s' if prs > 1 else ''} recorde{'s' if prs > 1 else ''}")
        if snap.get("encerrada_automaticamente"):
            partes.append("finalizado automaticamente")
        mensagem = " · ".join(partes)
        # O comentário do aluno é a razão de o personal abrir a notificação — vai no corpo,
        # truncado, e o texto inteiro fica no detalhe da sessão (o botão leva direto lá).
        obs = (snap.get("observacao") or "").strip()
        if obs:
            trecho = obs if len(obs) <= 80 else obs[:79].rstrip() + "…"
            mensagem += f' · 💬 "{trecho}"'
        notif_service.criar(
            personal_id, "TREINO_CONCLUIDO", f"{nome} concluiu um treino",
            mensagem, aluno_id=aluno_id,
            ref_extra={"sessao_id": snap.get("sessao_id")},
        )
    except Exception:
        logger.warning("[sessao] notificação TREINO_CONCLUIDO falhou p/ personal %s", personal_id,
                       exc_info=True)


def start_session(personal_id: str, aluno_id: str, treino_id: str, iniciado_pelo_aluno: bool = False) -> dict:
    treino = repo.get_item(keys.pk_aluno(aluno_id), keys.sk_treino(treino_id))
    if not treino:
        raise HTTPException(404, "Treino não encontrado")
    exs = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.sk_exercicio_prefix(treino_id))
    if not exs:
        raise HTTPException(400, "Este treino não tem exercícios")
    exs.sort(key=lambda e: e.get("ordem", 0))
    blocos = treino.get("blocos") or []
    blocos_by_id = {b.get("id"): b for b in blocos}
    snaps = [_snapshot(e, blocos_by_id) for e in exs]
    # Fuso dos dois lados congelado no item da sessão. Motivo: o `finish()` bucketiza streak,
    # frequência e o STATS#D# do dashboard, e é o caminho mais quente do app do aluno —
    # resolver o fuso lá custaria duas leituras por treino finalizado. Aqui, ao iniciar o
    # treino, custa uma vez só. Guarda a ZONA, nunca o dia derivado (docs/TIMEZONE.md §3).
    tz_aluno, tz_personal = locale_service.tzs_da_dupla(aluno_id, personal_id)
    item = {
        "sessao_id": new_id(),
        "aluno_id": aluno_id,
        "personal_id": personal_id,
        "treino_id": treino_id,
        "treino_nome": treino.get("nome"),
        "status": SessaoStatus.EM_ANDAMENTO.value,
        "blocos": blocos,
        "exercicios": snaps,
        "ex_atual": snaps[0] if snaps else None,
        "ordem_atual": 0,
        "total_ex": len(snaps),
        "data_hora_inicio": now_iso(),
        "tz_aluno": tz_aluno,
        "tz_personal": tz_personal,
        # Persistido para o finish() saber quem conduziu a sessão: só sessão do aluno
        # gera a notificação TREINO_CONCLUIDO para o personal.
        "iniciado_pelo_aluno": iniciado_pelo_aluno,
        "ttl": int(time.time()) + SESSION_TTL_S,
    }
    item["sched_refs"] = _agendar_sessao(item)
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


# Unidade da métrica de score por formato de WOD (exibição + EXCAT do WOD)
_WOD_UNIDADE = {"FOR_TIME": "s", "AMRAP": "rounds", "EMOM": "min"}


def _processar_scores_wod(aluno_id: str, s: dict, scores_blocos: list, fim_iso: str) -> list[dict]:
    """Valida os scores contra os blocos da sessão, calcula o score ordenável e grava
    PR (STATS#PR#wod#...), item de evolução (REG shape, GSI1) e EXCAT do WOD — reusando o
    motor de PR/evolução existente pelo caminho PERFORMANCE (spec CROSSFIT §3.2/§6).
    Retorna a lista enriquecida (persistida em `s["scores_blocos"]`); PRs novos também são
    appendados em memória a `s["novos_prs"]`."""
    blocos = s.get("blocos") or []
    blocos_by_id = {b.get("id"): b for b in blocos}
    pontuaveis = [b for b in blocos
                  if (b.get("formato") or "LIVRE") != "LIVRE" and not b.get("aquecimento")]
    treino_nome = s.get("treino_nome") or ""
    pk = keys.pk_aluno(aluno_id)
    out: list[dict] = []
    for sc in scores_blocos:
        bloco = blocos_by_id.get(sc.bloco_id)
        if not bloco or bloco.get("aquecimento"):
            continue
        formato = bloco.get("formato") or "LIVRE"
        if formato == "LIVRE" or sc.formato != formato:
            continue
        params = bloco.get("params") or {}
        if formato == "FOR_TIME":
            direcao = "MENOR"
            if sc.cap_estourado:
                # Capado é sempre pior que qualquer tempo dentro do cap; mais reps
                # restantes = pior — mantém o score monotônico na mesma escala (s).
                cap = int(params.get("time_cap_s") or sc.tempo_s or 0)
                if cap <= 0:
                    continue
                score_valor = float(cap + (sc.reps_restantes or 0))
            elif sc.tempo_s and sc.tempo_s > 0:
                score_valor = float(sc.tempo_s)
            else:
                continue
        elif formato == "AMRAP":
            direcao = "MAIOR"
            if sc.rounds is None and sc.reps_extras is None:
                continue
            score_valor = float((sc.rounds or 0) * 1000 + (sc.reps_extras or 0))
        else:  # EMOM
            direcao = "MAIOR"
            if sc.minutos_completos is None:
                continue
            score_valor = float(sc.minutos_completos)
        # Chave do WOD: treino com 1 bloco pontuável = nome do treino (benchmarks tipo
        # "Fran" compartilham histórico entre origens); vários = treino + bloco.
        nome_wod = treino_nome if len(pontuaveis) <= 1 else f"{treino_nome} — {bloco.get('nome') or ''}".strip(" —")
        chave_wod = f"wod#{chave_exercicio(nome_wod)}"
        unidade = _WOD_UNIDADE.get(formato)
        entry = {
            **sc.model_dump(),
            "bloco_nome": bloco.get("nome"),
            "nome": nome_wod,
            "chave": chave_wod,
            "score_valor": score_valor,
            "direcao": direcao,
            "unidade": unidade,
        }
        out.append(entry)
        # PR do WOD — mesmo motor dos exercícios, namespace "wod#" no SK de STATS#PR#
        extra_pr = {"exercicio_nome": nome_wod, "data": fim_iso, "direcao": direcao,
                    "formato": formato, "wod": True, "unidade": unidade, "rx": sc.rx}
        upd = repo.update_if_less if direcao == "MENOR" else repo.update_if_greater
        if upd(pk, keys.sk_stats_pr(chave_wod), "carga", score_valor, extra=extra_pr):
            entry["pr_novo"] = True
            s.setdefault("novos_prs", []).append({
                "exercicio_nome": nome_wod, "carga": score_valor, "tipo": "WOD",
                "unidade": unidade, "formato": formato, "rx": sc.rx,
            })
        # Item de evolução (shape REG, permanente): _evolucao_serie lê `series_exec[].reps`
        # pelo caminho PERFORMANCE — evolução do WOD sem mudar o motor.
        repo.put_item(pk, keys.sk_registro(s["sessao_id"], f"wod#{sc.bloco_id}"), {
            "sessao_id": s["sessao_id"],
            "exercicio_id": f"wod#{sc.bloco_id}",
            "exercicio_nome": nome_wod,
            "aluno_id": aluno_id,
            "data_hora": fim_iso,
            "series_exec": [{"reps": score_valor}],
            "wod": True, "formato": formato, "rx": sc.rx,
            "GSI1PK": keys.gsi1_registro(aluno_id, chave_wod),
            "GSI1SK": keys.gsi1sk_registro(epoch_ms()),
            # sem ttl — fonte permanente da evolução
        })
        upsert_excat(aluno_id, nome_wod, {
            "tipo_exercicio": "PERFORMANCE", "metrica_direcao": direcao,
            "unidade_reps": unidade, "wod": True, "formato": formato,
        }, chave=chave_wod)
    return out


def finish(aluno_id: str, body=None, auto: bool = False) -> dict:
    """Finaliza a sessão ativa. `body` (FinishBody) é opcional — ausente = fluxo clássico
    (musculação), inclusive para o agente WhatsApp, que chama sem payload.

    `auto=True`: fechamento pelo scheduler, para uma sessão que o aluno esqueceu de finalizar.
    Muda só a marca do fim — o fim vira o horário do último registro, não a hora do
    fechamento, senão as 6h de sessão esquecida entrariam em `soma_duracao_segundos` e
    estragariam "tempo médio de treino" do aluno e do treino. Todo o resto do fluxo
    (histórico, commit dos REG, streak, pontos, badges) é idêntico ao finish manual."""
    s = get_active(aluno_id, consistent=True)
    if not s:
        raise HTTPException(404, "Sem sessão ativa")
    s["status"] = SessaoStatus.FINALIZADA.value
    # Denormaliza registros na sessão histórica (1 query extra, evita N+1 na timeline)
    sessao_id = s["sessao_id"]
    regs = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=f"REG#{sessao_id}#")
    fim_iso = now_iso()
    if auto:
        # `atualizado_em` é reescrito a cada gravação de série; `data_hora` só existe desde a
        # criação do REG (registros antigos) e serve de fallback.
        marcas = [r.get("atualizado_em") or r.get("data_hora") for r in regs]
        fim_iso = max([m for m in marcas if m] or [s["data_hora_inicio"]])
        s["encerrada_automaticamente"] = True
        s["data_hora_encerramento"] = now_iso()
    s["data_hora_fim"] = fim_iso
    try:
        inicio_dt = datetime.fromisoformat(s["data_hora_inicio"].replace("Z", "+00:00"))
        fim_dt = datetime.fromisoformat(fim_iso.replace("Z", "+00:00"))
        s["duracao_segundos"] = int((fim_dt - inicio_dt).total_seconds())
    except Exception:
        pass
    snap_by_ex = {e["exercicio_id"]: e for e in s.get("exercicios", [])}
    # A query vem ordenada por SK (REG#{sessao}#{exercicio_id}, alfabético). Reordena pela
    # ordem prescrita do treino (s["exercicios"] já está ordenado por `ordem` em start_session);
    # registros sem correspondência (ex.: substitutos) vão para o fim, estável.
    ordem_by_ex = {e["exercicio_id"]: i for i, e in enumerate(s.get("exercicios", []))}
    regs.sort(key=lambda r: ordem_by_ex.get(r.get("exercicio_id"), len(ordem_by_ex)))
    s["exercicios_exec"] = [
        {
            "exercicio_id": r.get("exercicio_id"),
            "exercicio_nome": r.get("exercicio_nome"),
            "series_exec": r.get("series_exec", []),
            "pse": r.get("pse"),
            "tipo_exercicio": snap_by_ex.get(r.get("exercicio_id", ""), {}).get("tipo_exercicio"),
            "unidade_carga": snap_by_ex.get(r.get("exercicio_id", ""), {}).get("unidade_carga"),
            "unidade_reps": snap_by_ex.get(r.get("exercicio_id", ""), {}).get("unidade_reps"),
            "series_prescritas": snap_by_ex.get(r.get("exercicio_id", ""), {}).get("series_prescritas"),
            "series": snap_by_ex.get(r.get("exercicio_id", ""), {}).get("series"),
            "reps_prescritas": snap_by_ex.get(r.get("exercicio_id", ""), {}).get("reps_prescritas"),
            "carga_prescrita": snap_by_ex.get(r.get("exercicio_id", ""), {}).get("carga_prescrita"),
            "bloco_id": snap_by_ex.get(r.get("exercicio_id", ""), {}).get("bloco_id"),
            "aquecimento": snap_by_ex.get(r.get("exercicio_id", ""), {}).get("aquecimento"),
            "substituto_nome": r.get("substituto_nome"),
        }
        for r in regs
    ]
    # Catálogo permanente de exercícios (seletor de evolução): 1 upsert por exercício
    # executado nesta sessão — garante que ele siga listável mesmo após o programa mudar.
    excat_vistos: set[str] = set()
    for r in regs:
        ch = chave_exercicio(r.get("exercicio_nome"))
        if ch and ch not in excat_vistos:
            excat_vistos.add(ch)
            upsert_excat(aluno_id, r.get("exercicio_nome"),
                         snap_by_ex.get(r.get("exercicio_id", ""), {}))
    # Destaques da sessão (alimentam o calendário do mês, o story e a retrospectiva anual).
    # `novos_prs` já vem acumulado no item ativo via _registrar_pr_sessao() durante os registros.
    s["volume_total"] = sum(_volume(r.get("series_exec")) for r in regs)
    s["total_series"] = sum(len(r.get("series_exec") or []) for r in regs)
    # Score de WOD por bloco — spec CROSSFIT §3.2
    ids_validos = {e.get("exercicio_id") for e in s.get("exercicios", [])}
    if body and getattr(body, "scores_blocos", None):
        s["scores_blocos"] = _processar_scores_wod(aluno_id, s, body.scores_blocos, fim_iso)
    # Comentário do aluno no fecho do treino. Vai no item da sessão, sem write extra: o `snap`
    # abaixo copia tudo, então o campo já sai no detalhe da sessão e na timeline dos dois lados.
    observacao = (getattr(body, "observacao", None) or "").strip() if body else ""
    if observacao:
        s["observacao"] = observacao
    snap = {k: v for k, v in s.items() if k not in ("PK", "SK", "ttl", "sched_refs")}
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
    _limpar_sched(s)
    # Contador de execuções + tempo médio no próprio item do treino (informativo para o personal:
    # quanto aquele treino específico leva pra executar). Mesmas somas dos stats do aluno, mas por
    # treino — `sessoes_com_metrica` é o denominador (conta só execuções a partir desta mudança).
    # `ultima_execucao` no mesmo write (custo zero): o app do aluno usa pra marcar, na lista de
    # treinos, quais já foram feitos na semana corrente — o recorte da semana é do cliente (fuso).
    treino_id = s.get("treino_id")
    if treino_id:
        add_treino: dict = {"total_execucoes": 1}
        dur = s.get("duracao_segundos")
        if isinstance(dur, int) and dur > 0:
            add_treino["soma_duracao_segundos"] = dur
            add_treino["soma_total_series"] = int(s.get("total_series") or 0)
            add_treino["sessoes_com_metrica"] = 1
        # `if_exists`: o personal pode ter apagado/substituído o treino enquanto a sessão
        # estava aberta (a sessão sobrevive, ela carrega o próprio snapshot dos exercícios).
        # Sem a condição, este ADD recriaria o TREINO# apagado como casca só de contadores —
        # um treino sem `nome`/`treino_id` que reaparece na lista do aluno e do portal.
        repo.add_and_set(
            keys.pk_aluno(aluno_id), keys.sk_treino(treino_id),
            add=add_treino, set_={"ultima_execucao": fim_iso}, if_exists=True,
        )
    # Agregação na escrita: conta a sessão (aluno + semana) — ESPEC §3.1
    pk = keys.pk_aluno(aluno_id)
    # Lê stats antes do update para calcular streak (1 GetItem extra, inevitável)
    st_atual = repo.clean(repo.get_item(pk, keys.SK_STATS_ALUNO, consistent=True)) or {}
    total_sessoes_novo = int(st_atual.get("total_sessoes", 0)) + 1
    # Cálculo do streak de semanas consecutivas
    # Semana do INSTANTE em que a sessão terminou, não de "agora": o fechamento automático
    # (sessao_scheduler) roda até 6h depois do treino e podia jogar a sessão na semana seguinte.
    wk = locale_service.semana_iso(fim_iso, _tz_da_sessao(s)) or _isoweek(_tz_da_sessao(s))
    ultima_semana = st_atual.get("streak_ultima_semana", "")
    if ultima_semana == wk:
        novo_streak = int(st_atual.get("streak_atual", 1))
    elif ultima_semana == _semana_anterior(wk):
        novo_streak = int(st_atual.get("streak_atual", 0)) + 1
    else:
        novo_streak = 1
    novo_streak_maximo = max(novo_streak, int(st_atual.get("streak_maximo", 0)))
    # Agregados de tempo/frequência para os indicadores do personal (aba Frequência do aluno).
    # `sessoes_com_metrica` é o denominador próprio das médias — conta só sessões a partir desta
    # mudança, sem diluir a média com histórico antigo que não somou duração.
    add_stats: dict = {"total_sessoes": 1}
    dur = s.get("duracao_segundos")
    if isinstance(dur, int) and dur > 0:
        add_stats["soma_duracao_segundos"] = dur
        add_stats["soma_total_series"] = int(s.get("total_series") or 0)
        add_stats["sessoes_com_metrica"] = 1
        # Dia da semana (0=segunda) do início do treino, no fuso do ALUNO — é o padrão dele.
        # Em UTC, quem treina depois das 21h (BRT) era contado no dia seguinte, e à noite é
        # justamente quando a maior parte dos alunos treina.
        dow = locale_service.dow(s.get("data_hora_inicio"), _tz_da_sessao(s))
        if dow is not None:
            add_stats[f"dow_{dow}"] = 1
    repo.add_and_set(pk, keys.SK_STATS_ALUNO, add=add_stats, set_={
        "ultimo_treino": fim_iso,
        "streak_atual": novo_streak,
        "streak_maximo": novo_streak_maximo,
        "streak_ultima_semana": wk,
    })
    repo.add_and_set(pk, keys.sk_stats_week(wk), add={"sessoes": 1}, set_={"semana": wk})
    # Agregado diário por personal (para gráfico do dashboard)
    personal_id = s.get("personal_id")
    if personal_id:
        # Dia no fuso do PERSONAL, não do aluno: este agregado mora na partição dele e alimenta
        # o gráfico do dashboard dele. Com alunos em fusos diferentes, usar o dia de cada aluno
        # deixaria a "terça" do gráfico misturando três terças distintas (docs/TIMEZONE.md §2).
        hoje = locale_service.dia(fim_iso, _tz_do_personal_da_sessao(s)) or fim_iso[:10]
        repo.add_and_set(keys.pk_personal(personal_id), f"STATS#D#{hoje}",
                         add={"sessoes": 1}, set_={"data": hoje})
        repo.add_to_set(keys.pk_personal(personal_id), f"STATS#D#{hoje}",
                        "alunos_set", {aluno_id})
        # Última sessão finalizada no ponteiro do aluno — a listagem do portal precisa da
        # pendência "sem treinar há N dias" sem ler STATS#ALUNO de cada aluno (N+1).
        # Só `ultimo_treino_em`: `updated_at` do ponteiro significa "cadastro atualizado".
        repo.update_item_if_exists(keys.pk_personal(personal_id), keys.sk_aluno_pointer(aluno_id),
                                   {"ultimo_treino_em": fim_iso})
        # Gamificação: pontos por sessão finalizada (com multiplicador de streak).
        # "Feito" = tem registro OU pertence a bloco de WOD com score informado
        # (spec CROSSFIT §3.2, decisão ii — aquecimento é registrado normalmente).
        total_ex = len(s.get("exercicios", []))
        feitos_ids = {e.get("exercicio_id") for e in snap.get("exercicios_exec", [])}
        blocos_com_score = {sc.get("bloco_id") for sc in s.get("scores_blocos") or []}
        if blocos_com_score:
            feitos_ids |= {e.get("exercicio_id") for e in s.get("exercicios", [])
                           if e.get("bloco_id") in blocos_com_score}
        feitos_ex = len(feitos_ids & ids_validos)
        completo = total_ex > 0 and feitos_ex >= total_ex
        desc = "Sessão 100% completa" if completo else "Sessão finalizada"
        pts = pontos_service.PONTOS["SESSAO"] + (pontos_service.PONTOS["SESSAO_COMPLETA_BONUS"] if completo else 0)
        pontos_service.award(aluno_id, "SESSAO", personal_id, pts=pts, descricao=desc, streak=novo_streak)
        # PRs de WOD: pontos + verificação de metas (por chave "wod#...", direção-aware)
        for sc in s.get("scores_blocos") or []:
            if not sc.get("pr_novo"):
                continue
            pontos_service.award(aluno_id, "PR", personal_id,
                                 descricao=f"Novo recorde: {sc.get('nome')}", streak=novo_streak)
            from app.services import meta_service as _ms
            _ms.verificar_metas_carga(aluno_id, personal_id, "", float(sc["score_valor"]),
                                      chave=sc.get("chave"))
        # Badges: verifica conquistas de sessão e streak
        badge_service.verificar_e_conceder(aluno_id, personal_id,
                                           total_sessoes=total_sessoes_novo, streak_atual=novo_streak)
        _touch_atividade(
            personal_id, aluno_id, status=SessaoStatus.FINALIZADA.value, treino_nome=s.get("treino_nome"),
            exercicio_atual=None, ordem_atual=None, total_ex=s.get("total_ex"),
        )
        if s.get("iniciado_pelo_aluno"):
            _notificar_treino_concluido(personal_id, aluno_id, snap, feitos_ex, total_ex)
    if auto:
        _notificar_autofinalizacao(aluno_id, snap)
    return snap


def _notificar_autofinalizacao(aluno_id: str, snap: dict) -> None:
    """Avisa o aluno que o treino esquecido foi salvo sozinho — sem isso ele só descobre
    abrindo o histórico, e o sumiço da sessão da tela vira o mesmo susto de antes."""
    try:
        from app.services import anotif_service   # import tardio — evita ciclo
        n = len(snap.get("exercicios_exec") or [])
        anotif_service.criar(
            aluno_id, "SESSAO_AUTOFINALIZADA", "Treino salvo automaticamente",
            f"Você não finalizou '{snap.get('treino_nome') or 'seu treino'}'. "
            f"Salvamos {n} exercício{'s' if n != 1 else ''} que você registrou.",
            ref_extra={"sessao_id": snap.get("sessao_id")},
        )
    except Exception:
        logger.warning("[sessao] notificação SESSAO_AUTOFINALIZADA falhou p/ aluno %s",
                       aluno_id, exc_info=True)


def cancelar(aluno_id: str) -> None:
    """Desfaz a sessão ativa (ex.: aluno selecionou o treino errado) — sem gravar histórico
    nem tocar nos agregados, como se nunca tivesse começado."""
    s = get_active(aluno_id, consistent=True)
    if not s:
        raise HTTPException(404, "Sem sessão ativa")
    pk = keys.pk_aluno(aluno_id)
    repo.delete_item(pk, keys.SK_SESSION_ACTIVE)
    _limpar_sched(s)
    # Registros da sessão descartada: expirariam pelo TTL, mas ele agora é longo (rede de
    # segurança do fechamento automático) — apagar aqui evita lixo na partição do aluno.
    regs = repo.query_pk(pk, sk_prefix=f"REG#{s['sessao_id']}#")
    if regs:
        repo.batch_write(deletes=[(pk, r["SK"]) for r in regs])
    personal_id = s.get("personal_id")
    if personal_id:
        repo.delete_item(keys.pk_personal(personal_id), keys.sk_atividade(aluno_id))


def _sessao_do_agendamento(sched: dict, consistent: bool = False) -> dict | None:
    """A entrada do scheduler é só um gatilho — a verdade está no SESSION#ACTIVE. Devolve a
    sessão só se ela ainda for a mesma: já finalizada, cancelada ou substituída por outra
    (aluno começou um treino novo), o disparo não vale mais."""
    s = get_active(sched["aluno_id"], consistent=consistent)
    if not s or s.get("sessao_id") != sched.get("sessao_id"):
        return None
    return s


def avisar_sessao_aberta(sched: dict) -> str:
    """Disparo de SESSAO_SCHED#...#AVISO: lembra que a sessão segue aberta e vai fechar em
    breve. Vai para quem conduz o treino — o aluno (push no app) quando foi ele que iniciou,
    senão o personal, que está com o portal aberto conduzindo."""
    s = _sessao_do_agendamento(sched)
    if not s:
        return "ignorada"
    from app.services import anotif_service, notif_service   # import tardio — evita ciclo
    treino = s.get("treino_nome") or "seu treino"
    hora = locale_service.hora(s.get("data_hora_inicio"), _tz_da_sessao(s))
    restante = int((SESSAO_LIMITE_S - SESSAO_AVISO_S) / 3600)
    if s.get("iniciado_pelo_aluno"):
        anotif_service.criar(
            sched["aluno_id"], "SESSAO_ABERTA", "Treino ainda aberto",
            f"Você começou '{treino}' às {hora} e ainda não finalizou. Finalize para salvar "
            f"seus registros — em {restante}h ele será finalizado automaticamente.",
            ref_extra={"sessao_id": s.get("sessao_id")},
        )
    elif sched.get("personal_id"):
        notif_service.criar(
            sched["personal_id"], "SESSAO_ABERTA", "Sessão ainda aberta",
            f"'{treino}', iniciado às {hora}, não foi finalizado. "
            f"Em {restante}h ele será finalizado automaticamente com o que já foi registrado.",
            aluno_id=sched["aluno_id"], ref_extra={"sessao_id": s.get("sessao_id")},
        )
    return "avisada"


def encerrar_sessao_aberta(sched: dict) -> str:
    """Disparo de SESSAO_SCHED#...#FECHAR. Sessão com registro é finalizada de verdade (vira
    histórico, evolução e pontos); sessão sem nenhum registro é descartada — treino que não
    aconteceu não pode virar sessão vazia com streak e pontos."""
    s = _sessao_do_agendamento(sched, consistent=True)
    if not s:
        return "ignorada"
    regs = repo.query_pk(keys.pk_aluno(sched["aluno_id"]), sk_prefix=f"REG#{s['sessao_id']}#")
    if not any(r.get("series_exec") for r in regs):
        cancelar(sched["aluno_id"])
        return "descartada"
    finish(sched["aluno_id"], auto=True)
    return "finalizada"


def _tz_da_sessao(s: dict) -> str:
    """Fuso do ALUNO vigente quando a sessão rodou.

    `start_session` grava `tz_aluno` no item, então o caminho quente (`finish`) não paga
    leitura nenhuma. Sessão anterior a essa mudança não tem o campo e cai na resolução pelo
    perfil — degradação limpa, sem migração (docs/TIMEZONE.md §3)."""
    return s.get("tz_aluno") or locale_service.tz_do_aluno(s.get("aluno_id"), s.get("personal_id"))


def _tz_do_personal_da_sessao(s: dict) -> str:
    """Idem, para o fuso do PERSONAL — é o dono da partição onde mora o `STATS#D#`."""
    return s.get("tz_personal") or locale_service.tz_do_personal(s.get("personal_id"))


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
    if not ex_id:
        raise HTTPException(400, "Exercício não identificado")
    chave = chave_exercicio(ex_nome)
    pk = keys.pk_aluno(aluno_id)
    on_insert = {
        "sessao_id": s["sessao_id"], "exercicio_id": ex_id, "exercicio_nome": ex_nome,
        "aluno_id": aluno_id, "data_hora": now_iso(),
        "canal_origem": canal.value, "classificacao": classificacao.value, "ator": ator.value,
        "GSI1PK": keys.gsi1_registro(aluno_id, chave), "GSI1SK": keys.gsi1sk_registro(epoch_ms()),
        "ttl": int(time.time()) + REG_TTL_S,   # só GC: o finish (manual ou automático) remove
    }
    updated = repo.append_series(pk, keys.sk_registro(s["sessao_id"], ex_id), series, on_insert,
                                 set_always={"atualizado_em": now_iso()})

    # Agregação na escrita (ESPEC §3.1): volume desta gravação + recorde de carga.
    ex_snap = next((e for e in snaps if e.get("exercicio_id") == ex_id), None) or ex
    ex_tipo = normalizar_tipo_exercicio(ex_snap.get("tipo_exercicio"))
    ex_direcao = ex_snap.get("metrica_direcao") or "MAIOR"
    _marcar_aquecimento(series, ex_snap)
    cargas, volume = [], 0.0
    for it in series:
        if not _serie_valida(it):
            continue
        cg = _num(it.get("carga"))
        if cg is not None:
            cargas.append(cg)
            volume += cg * (it.get("reps") or 0)
    if volume > 0:
        wk = _isoweek(_tz_da_sessao(s))
        repo.add_and_set(pk, keys.SK_STATS_ALUNO, add={"total_volume": volume}, set_={"ultimo_treino": now_iso()})
        repo.add_and_set(pk, keys.sk_stats_week(wk), add={"volume": volume}, set_={"semana": wk})
        _creditar_volume_grupos(pk, wk, ex_snap, volume)
    pr_novo = _calcular_pr(pk, chave, series, ex_tipo, ex_nome, ex_direcao)
    if pr_novo is not None:
        ex_unidade = ex_snap.get("unidade_reps") if ex_tipo == "PERFORMANCE" else ex_snap.get("unidade_carga")
        _registrar_pr_sessao(aluno_id, ex_nome, pr_novo, ex_tipo, ex_unidade)
    return updated, pr_novo


def _creditar_volume_grupos(pk: str, wk: str, ex_snap: dict, volume: float) -> None:
    """Soma `volume` nos agregados de CADA grupo muscular do exercício (semanal + all-time).

    Um exercício atinge mais de um grupo, então o volume é creditado integralmente a todos —
    a soma das barras do gráfico deixa de bater com o volume total, o que é o comportamento
    correto para "volume por grupo muscular". Exercício de 2 grupos = 2 pares de writes de
    agregado, itens minúsculos numa tabela PAY_PER_REQUEST."""
    for grupo in grupos_do_item(ex_snap):
        chave = normalizar_grupo(grupo)
        repo.add_and_set(pk, keys.sk_stats_week_grupo(wk, chave),
                         add={"volume": volume}, set_={"semana": wk, "grupo": grupo})
        repo.add_and_set(pk, keys.sk_stats_grupo(chave),
                         add={"volume": volume}, set_={"grupo": grupo})


def _volume(series: list | None) -> float:
    v = 0.0
    for s in series or []:
        if not _serie_valida(s):
            continue
        cg = _num(s.get("carga"))
        if cg is not None:
            v += cg * float(s.get("reps") or 0)   # reps pode vir como Decimal do DynamoDB
    return v


def _marcar_aquecimento(series: list, ex_snap: dict) -> None:
    """Materializa as flags nas séries que serão gravadas: exercício de warmup (direto ou
    herdado do bloco, já resolvido no snapshot) marca todas como `aquecimento`; exercício
    de bloco pontuável (For Time/AMRAP/EMOM) marca todas como `contexto` — anotação (ex.:
    carga usada no metcon), pois o resultado oficial é o score do bloco. Séries individuais
    podem chegar flagadas do app (série de aproximação). Único ponto de escrita — todos os
    cálculos filtram por `_serie_valida`."""
    if ex_snap.get("aquecimento"):
        for it in series:
            it["aquecimento"] = True
    elif ex_snap.get("bloco_pontuavel"):
        for it in series:
            it["contexto"] = True


def _registrar_pr_sessao(aluno_id: str, ex_nome: str | None, carga: float, tipo: str | None,
                         unidade: str | None = None) -> None:
    """Acumula um novo PR no item da sessão ativa — vira destaque do dia no histórico/story e
    fonte da retrospectiva anual. 1 update barato; silencioso se a sessão já não existir."""
    repo.list_append_item(keys.pk_aluno(aluno_id), keys.SK_SESSION_ACTIVE, "novos_prs", {
        "exercicio_nome": ex_nome, "carga": carga, "tipo": tipo, "unidade": unidade,
    })


def set_series(aluno_id: str, exercicio_id: str | None, series: list,
               canal: CanalOrigem = CanalOrigem.PORTAL, classificacao: Classificacao = Classificacao.AUTO,
               ator: Ator = Ator.ALUNO, substituto_nome: str | None = None,
               pse: float | None = None) -> tuple[dict, float | None]:
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
    ex_snap = next((e for e in snaps if e.get("exercicio_id") == ex_id), None) or ex_atual
    ex_tipo = normalizar_tipo_exercicio(ex_snap.get("tipo_exercicio"))
    ex_direcao = ex_snap.get("metrica_direcao") or "MAIOR"
    _marcar_aquecimento(series, ex_snap)
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
        "ttl": int(time.time()) + REG_TTL_S,   # só GC: o finish (manual ou automático) remove
    }
    # `atualizado_em` marca a última gravação (data_hora só existe desde a criação do REG):
    # é dele que o fechamento automático tira a hora real do fim do treino.
    updated = repo.put_series(pk, sk, series, on_insert,
                              set_always={"substituto_nome": substituto_nome, "pse": pse,
                                          "atualizado_em": now_iso()})
    delta = _volume(series) - old_vol
    if delta:
        wk = _isoweek(_tz_da_sessao(s))
        repo.add_and_set(pk, keys.SK_STATS_ALUNO, add={"total_volume": delta}, set_={"ultimo_treino": now_iso()})
        repo.add_and_set(pk, keys.sk_stats_week(wk), add={"volume": delta}, set_={"semana": wk})
        _creditar_volume_grupos(pk, wk, ex_snap, delta)
    pr_novo = None
    if not substituto_nome:
        pr_novo = _calcular_pr(pk, chave, series, ex_tipo, ex_nome, ex_direcao)
    if pr_novo is not None:
        ex_unidade = ex_snap.get("unidade_reps") if ex_tipo == "PERFORMANCE" else ex_snap.get("unidade_carga")
        _registrar_pr_sessao(aluno_id, ex_nome, pr_novo, ex_tipo, ex_unidade)
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
        "blocos": s.get("blocos") or [],
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


def _calcular_pr(pk: str, chave: str, series: list, tipo: str, ex_nome: str,
                 direcao: str = "MAIOR") -> float | None:
    """Calcula e grava o PR de acordo com o tipo de exercício. Retorna o valor do PR se for novo.
    Para carga negativa (contrapeso/graviton), max() ainda é o PR correto: -10 > -30, ou seja
    menos contrapeso (menos negativo) = mais difícil = melhor desempenho."""
    series = [it for it in series if _serie_valida(it)]
    if tipo == "PERFORMANCE":
        # Métrica numérica livre no campo `reps`. A melhor série é o máx (maior é melhor)
        # ou o mín (menor é melhor — ex.: tempo nos 5 km). PR = melhor entre as sessões.
        vals = [_num(it.get("reps")) for it in series]
        vals = [v for v in vals if v is not None]
        if not vals:
            return None
        if direcao == "MENOR":
            pr_val = min(vals)
            if repo.update_if_less(pk, keys.sk_stats_pr(chave), "carga", pr_val,
                                   extra={"exercicio_nome": ex_nome, "data": now_iso()}):
                return pr_val
        else:
            pr_val = max(vals)
            if repo.update_if_greater(pk, keys.sk_stats_pr(chave), "carga", pr_val,
                                      extra={"exercicio_nome": ex_nome, "data": now_iso()}):
                return pr_val
    else:  # FORCA (default) — max() funciona para positivo e negativo
        cargas = [c for c in (_num(it.get("carga")) for it in series) if c is not None]
        if not cargas:
            return None
        carga_pr = max(cargas)
        if repo.update_if_greater(pk, keys.sk_stats_pr(chave), "carga", carga_pr,
                                   extra={"exercicio_nome": ex_nome, "data": now_iso()}):
            return carga_pr
    return None


# ── PR: leitura, correção manual e exclusão ──────────────────────────────────
# O item STATS#PR# é monotônico por construção (update_if_greater/_less) — foi feito para nunca
# cair, e por isso um "600" digitado no lugar de "60" trava o recorde do exercício para sempre.
# A edição é a porta de correção, e NÃO concede ponto, meta, badge nem notificação: não é um
# recorde novo, é o conserto de um número.
_PR_MIN, _PR_MAX = -10_000.0, 1_000_000.0


def _chave_pr(chave: str | None) -> str:
    # chave_exercicio é idempotente sobre chave já canônica e preserva o namespace "wod#".
    canonica = chave_exercicio(chave)
    if not canonica:
        raise HTTPException(400, "Informe a chave do exercício.")
    return canonica


def get_pr(aluno_id: str, chave: str) -> dict | None:
    """Recorde de um exercício pela chave canônica (aceita `wod#…`) — 1 GetItem."""
    item = repo.get_item(keys.pk_aluno(aluno_id), keys.sk_stats_pr(_chave_pr(chave)))
    return repo.clean(item) if item else None


def editar_pr(aluno_id: str, chave: str, carga, editado_por: str) -> dict:
    """Sobrescreve o valor do recorde. 404 se o recorde não existe — nunca cria PR do nada,
    senão uma chave qualquer inventaria recordes de exercícios jamais executados.

    Só `carga` + a marca de auditoria entram no update: os campos extras do PR de WOD
    (`formato`, `unidade`, `rx`, `direcao`) precisam sobreviver, e um `put_item` os apagaria —
    "8:32" viraria "512" na tela e a meta perderia a direção."""
    chave = _chave_pr(chave)
    valor = _num(carga)
    # NaN atravessa o _num e envenenaria a ConditionExpression do update_if_greater para sempre
    # (toda comparação com NaN é falsa): o exercício nunca mais bateria um recorde.
    if valor is None or not math.isfinite(valor) or not (_PR_MIN <= valor <= _PR_MAX):
        raise HTTPException(400, "Valor de recorde inválido.")

    pk, sk = keys.pk_aluno(aluno_id), keys.sk_stats_pr(chave)
    atual = repo.get_item(pk, sk)
    if not atual:
        raise HTTPException(404, "Recorde não encontrado.")
    # Único read antes da escrita, e só para saber a direção: em métrica "menor é melhor"
    # (tempo de WOD) um valor <= 0 corrompe o ranking e concluiria qualquer meta na hora.
    if atual.get("direcao") == "MENOR" and valor <= 0:
        raise HTTPException(400, "Nesta métrica (menor é melhor) o valor precisa ser positivo.")

    item = repo.update_item_if_exists(pk, sk, {
        "carga": round(valor, 3),
        "editado_em": now_iso(),
        "editado_por": editado_por,
    })
    if item is None:
        raise HTTPException(404, "Recorde não encontrado.")
    return repo.clean(item)


def excluir_pr(aluno_id: str, chave: str) -> None:
    """Apaga o recorde. Saída de emergência para um PR fantasma: sem o item, a evolução volta
    a derivar o PR da série — que pode trazer de volta o valor errado. Corrigir > excluir."""
    if not repo.delete_item_if_exists(keys.pk_aluno(aluno_id), keys.sk_stats_pr(_chave_pr(chave))):
        raise HTTPException(404, "Recorde não encontrado.")


def _pr_editado(aluno_id: str, chave: str) -> dict | None:
    """Recorde corrigido à mão — vira fonte única do `pr` da evolução (ver `_evolucao_serie`).
    +1 GetItem de item < 200 B: ruído perto dos até 100 REG que a evolução já lê."""
    if not chave:
        return None
    item = repo.get_item(keys.pk_aluno(aluno_id), keys.sk_stats_pr(chave))
    if not item or not item.get("editado_em"):
        return None
    valor = _num(item.get("carga"))
    if valor is None:
        return None
    return {"carga": valor, "data": item.get("data"),
            "editado_em": item.get("editado_em"), "editado_por": item.get("editado_por")}


def chave_exercicio(nome: str | None) -> str:
    """Chave canônica do nome do exercício (sem acento/caixa/espaços extras) — usada para
    agrupar métricas (evolução/PR) de exercícios homônimos cadastrados em treinos diferentes,
    já que cada `Exercicio` ganha um `exercicio_id` próprio mesmo quando repete o nome."""
    if not nome:
        return ""
    sem_acento = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode()
    return " ".join(sem_acento.lower().split())


_EXCAT_META_CAMPOS = ("tipo_exercicio", "grupo", "grupos", "unidade_carga", "unidade_reps",
                      "metrica_direcao", "rm_kg", "wod", "formato")


def upsert_excat(aluno_id: str, nome: str | None, meta: dict | None = None,
                 chave: str | None = None) -> None:
    """Registra o exercício no catálogo permanente do aluno (EXCAT#{chave}) — a fonte de
    "todos os exercícios já feitos" do seletor de evolução, imune ao apagamento dos EX#
    quando o programa é recriado. UpdateItem idempotente, 1 write pequeno, sem read prévio.
    `chave` explícita é usada pelos WODs ("wod#{...}" — namespace que nomes de exercício
    nunca produzem, pois a normalização não gera '#')."""
    chave = chave or chave_exercicio(nome)
    if not chave:
        return
    fields: dict = {"nome": nome, "last_seen": now_iso()}
    for k in _EXCAT_META_CAMPOS:
        v = (meta or {}).get(k)
        if v is not None:
            fields[k] = v
    repo.update_item(keys.pk_aluno(aluno_id), keys.sk_excat(chave), fields)


def _partes_do_agregado(grupo: str | None) -> list[str]:
    """Os grupos de um item de agregado (STATS#G# / STATS#WG#), já quebrando os compostos.

    Agregados gravados antes do campo múltiplo carregam chaves como "peito, triceps" — uma
    barra própria no gráfico, separada de "peito". Quebrar aqui, na leitura, corrige o
    histórico inteiro sem reescrever nenhum item. Os agregados novos já vêm por grupo, então
    a quebra é no-op para eles e nada é contado em dobro."""
    return separar_grupos(grupo) or ["Sem grupo"]


def _dedup_grupos(grupos: list[dict]) -> list[dict]:
    """Soma volumes de itens com mesmo grupo (normalizado), quebrando os compostos legados.
    O nome de exibição é grp_key.capitalize() para garantir que bate com as chaves de semanas[].grupos."""
    agg: dict[str, dict] = {}
    for g in grupos:
        for grp_raw in _partes_do_agregado(g.get("grupo")):
            grp_key = normalizar_grupo(grp_raw)
            if grp_key not in agg:
                agg[grp_key] = {"grupo": grp_key.capitalize(), "volume": 0.0}
            agg[grp_key]["volume"] = agg[grp_key]["volume"] + g.get("volume", 0)
    return list(agg.values())


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
                "tipo_exercicio": normalizar_tipo_exercicio(i.get("tipo_exercicio")),
                "grupo": i.get("grupo"),
                "rm_kg": i.get("rm_kg"),
                "metrica_direcao": i.get("metrica_direcao") or "MAIOR",
            }
    return {"nome": None, "tipo_exercicio": "FORCA", "grupo": None, "rm_kg": None, "metrica_direcao": "MAIOR"}


def _ex_info_por_chave(aluno_id: str, chave: str) -> dict:
    """Metadados (tipo/direção/rm) de um exercício pelo nome canônico: prescrição atual
    (EX#) quando existe, senão o catálogo permanente (EXCAT#), senão defaults."""
    items = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix="EX#")
    for i in items:
        if chave_exercicio(i.get("nome") or "") == chave:
            return {
                "nome": i.get("nome"),
                "tipo_exercicio": normalizar_tipo_exercicio(i.get("tipo_exercicio")),
                "grupo": i.get("grupo"),
                "rm_kg": i.get("rm_kg"),
                "metrica_direcao": i.get("metrica_direcao") or "MAIOR",
            }
    cat = repo.get_item(keys.pk_aluno(aluno_id), keys.sk_excat(chave)) or {}
    return {
        "nome": cat.get("nome"),
        "tipo_exercicio": normalizar_tipo_exercicio(cat.get("tipo_exercicio")),
        "grupo": cat.get("grupo"),
        "rm_kg": cat.get("rm_kg"),
        "metrica_direcao": cat.get("metrica_direcao") or "MAIOR",
    }


def evolucao_por_chave(aluno_id: str, chave: str, limit: int = 100) -> dict:
    """Série temporal + PR pelo nome canônico — funciona mesmo quando o exercício
    já saiu do programa atual (o histórico vive no GSI1, indexado pela chave)."""
    return _evolucao_serie(aluno_id, chave, _ex_info_por_chave(aluno_id, chave), limit)


def evolucao_exercicio(aluno_id: str, exercicio_id: str, limit: int = 100) -> dict:
    """Compat (rota antiga por exercicio_id): resolve o nome via EX# vivo e delega.
    Agrupa por nome canônico: exercícios homônimos em treinos diferentes compartilham a mesma evolução."""
    info = _ex_info(aluno_id, exercicio_id)
    nome = info.get("nome") or nome_por_exercicio_id(aluno_id, exercicio_id)
    return _evolucao_serie(aluno_id, chave_exercicio(nome), info, limit)


def _evolucao_serie(aluno_id: str, chave: str, info: dict, limit: int) -> dict:
    """Série temporal + PR de um exercício, adaptando métricas por tipo (FORCA/PERFORMANCE)."""
    tipo = info.get("tipo_exercicio") or "FORCA"
    direcao = info.get("metrica_direcao") or "MAIOR"
    items = repo.query_gsi1_last(keys.gsi1_registro(aluno_id, chave), limit) if chave else []
    items.sort(key=lambda i: i.get("GSI1SK", ""))  # ascendente por tempo
    serie: list[dict] = []
    pr: dict | None = None
    for it in items:
        c = repo.clean(it)
        series_exec = [s for s in (c.get("series_exec") or []) if _serie_valida(s)]
        if not series_exec:
            continue   # só aquecimento/anotação de contexto — não vira ponto de evolução
        ponto: dict = {"data": c.get("data_hora")}

        if tipo == "PERFORMANCE":
            # Métrica livre no campo `reps`. Ponto da sessão = melhor série (máx ou mín conforme direção).
            vals = [v for v in (_num(s.get("reps")) for s in series_exec) if v is not None]
            metrica_max = (min(vals) if direcao == "MENOR" else max(vals)) if vals else None
            ponto.update({"metrica_max": metrica_max, "carga_max": None, "volume": None})
            if metrica_max is not None and (
                pr is None or (metrica_max < pr["carga"] if direcao == "MENOR" else metrica_max > pr["carga"])
            ):
                pr = {"carga": metrica_max, "data": c.get("data_hora")}
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

    # Recorde corrigido à mão vira FONTE ÚNICA: o REG que gerou o PR errado continua no
    # histórico (a série é real e o gráfico mostra os pontos reais), mas o rótulo do recorde
    # passa a ser o corrigido. Sem edição, segue o derivado — compat com todo o legado.
    pr = _pr_editado(aluno_id, chave) or pr

    return {"tipo": tipo, "direcao": direcao, "serie": serie, "pr": pr,
            "total_sessoes": len(serie), "nome": info.get("nome"), "chave": chave}


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

    hoje_str = locale_service.hoje(locale_service.tz_do_aluno(aluno_id))
    treinos = treinos_validos(repo.clean_all(repo.query_pk(pk, sk_prefix=keys.SK_TREINO_PREFIX)))
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
    out = repo.clean_all(items)
    # Flag leve p/ a lista oferecer "enviar foto depois" sem presign na listagem.
    for i, raw in zip(out, items):
        i["tem_checkin"] = bool(raw.get("checkin_s3_key"))
    return out, next_cursor


def ordenar_exec_por_prescricao(s: dict) -> None:
    """Reordena `exercicios_exec` in-place pela ordem prescrita (`s["exercicios"]`).
    Backfill lazy na leitura: corrige a exibição de sessões antigas gravadas fora de ordem,
    sem exigir migração. Exercícios sem correspondência na prescrição vão para o fim (estável)."""
    execs = s.get("exercicios_exec")
    if not execs:
        return
    ordem_by_ex = {e["exercicio_id"]: i for i, e in enumerate(s.get("exercicios", []))}
    execs.sort(key=lambda ex: ordem_by_ex.get(ex.get("exercicio_id"), len(ordem_by_ex)))


def set_checkin(aluno_id: str, sessao_id: str, s3_key: str) -> dict:
    """Vincula a foto de check-in (já enviada via presigned URL) ao item histórico da sessão.
    Resolve o SK arquivado pelo ponteiro SESSAO_IDX (mesmo caminho do detalhe da sessão)."""
    pk = keys.pk_aluno(aluno_id)
    idx = repo.get_item(pk, keys.sk_sessao_idx(sessao_id))
    if not idx or not idx.get("sk"):
        raise HTTPException(404, "Sessão não encontrada")
    if repo.update_item_if_exists(pk, idx["sk"], {"checkin_s3_key": s3_key}) is None:
        raise HTTPException(404, "Sessão não encontrada")
    return {"ok": 1}


def historico_mes(aluno_id: str, ano: int, mes: int, incluir_fotos: bool = True) -> dict:
    """Resumo do mês para o calendário do app do aluno: 1 sessão finalizada = 1 dia treinado,
    com destaques leves (volume, séries, novos PRs) e a foto de check-in (presigned). Lê só as
    sessões do mês via BETWEEN no SK por epoch-ms — sem varrer o histórico inteiro.

    `incluir_fotos=False` (visão do personal): não gera presigned URL da foto de check-in —
    a privacidade do aluno é preservada (nem miniatura) e evita-se o custo do presign.

    O dia é o do calendário do ALUNO — é o histórico dele, mesmo quando quem olha é o personal
    de outro fuso. Agrupamento na LEITURA de propósito: nada é pré-agregado aqui, então trocar
    o fuso do aluno reescreve o passado inteiro corretamente, sem migração. Gravar o dia junto
    da sessão congelaria um fuso configurado errado para sempre (docs/TIMEZONE.md §2)."""
    if not 1 <= mes <= 12:
        raise HTTPException(400, "Mês inválido")
    pk = keys.pk_aluno(aluno_id)
    tz = locale_service.tz_do_aluno(aluno_id)
    # Janela alargada em 1 dia de cada lado: os limites do mês LOCAL caem até 14h fora dos
    # limites do mês UTC, então sem a folga a primeira e a última madrugada do mês sumiriam.
    # O recorte exato é feito abaixo, pelo dia local de cada sessão.
    inicio = datetime(ano, mes, 1, tzinfo=timezone.utc) - timedelta(days=1)
    fim = datetime(ano + (mes // 12), (mes % 12) + 1, 1, tzinfo=timezone.utc) + timedelta(days=1)
    low = keys.sk_sessao_hist(f"{int(inicio.timestamp() * 1000):013d}", "")
    high = keys.sk_sessao_hist(f"{int(fim.timestamp() * 1000):013d}", "")
    prefixo_mes = f"{ano:04d}-{mes:02d}"
    dias: dict[str, list] = {}
    volume_total = 0.0
    prs_total = 0
    for raw in repo.query_between(pk, low, high):
        s = repo.clean(raw)
        dia = locale_service.dia(s.get("data_hora_inicio"), tz)
        # Descarta o que a folga trouxe de fora do mês local.
        if not dia or not dia.startswith(prefixo_mes):
            continue
        novos_prs = s.get("novos_prs") or []
        vol = s.get("volume_total") or 0
        volume_total += vol
        prs_total += len(novos_prs)
        checkin_key = s.get("checkin_s3_key")
        dias.setdefault(dia, []).append({
            "sessao_id": s.get("sessao_id"),
            "treino_nome": s.get("treino_nome"),
            "duracao_segundos": s.get("duracao_segundos"),
            "volume_total": vol,
            "total_series": s.get("total_series"),
            "novos_prs": novos_prs,
            "encerrada_automaticamente": s.get("encerrada_automaticamente") or None,
            "scores_blocos": s.get("scores_blocos") or None,
            "checkin_url": (media_service.gerar_presigned_view_url(checkin_key) if checkin_key else None) if incluir_fotos else None,
        })
    st = repo.clean(repo.get_item(pk, keys.SK_STATS_ALUNO)) or {}
    return {
        "ano": ano,
        "mes": mes,
        "dias": dias,
        "dias_treinados": len(dias),
        "volume_total": volume_total,
        "prs_total": prs_total,
        "streak_atual": st.get("streak_atual", 0),
        "streak_maximo": st.get("streak_maximo", 0),
        "dias_ferias": ferias_service.periodos_no_mes(aluno_id, ano, mes),
    }


SESSOES_INTERVALO_MAX_H = 48
# Folga PARA FRENTE no BETWEEN: o `ts` da SK SESSION# é a hora do finish, não a do início, e o
# autofinish do scheduler fecha até SESSAO_LIMITE_S (6h) depois — um treino das 23h pode estar
# indexado às 5h do dia seguinte. Sem essa folga ele sumiria do dia em que realmente aconteceu.
# Não há folga para trás: o ts do finish é sempre >= data_hora_inicio.
_SESSAO_LAG_S = 12 * 3600
_PROJ_SESSAO_INTERVALO = ["sessao_id", "treino_nome", "data_hora_inicio", "status"]


def _parse_instante(valor: str | None) -> datetime | None:
    """ISO-8601 → datetime aware (UTC quando vier sem fuso). None se ilegível."""
    try:
        dt = datetime.fromisoformat((valor or "").replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def sessoes_no_intervalo(aluno_id: str, de_iso: str, ate_iso: str) -> list[dict]:
    """Sessões FINALIZADAS que COMEÇARAM em [de, ate) — dois instantes UTC. O recorte do dia é
    do cliente (fuso do aparelho do aluno): o backend não assume timezone nenhum, só compara
    instantes. 1 Query BETWEEN com projeção, sem paginação."""
    de, ate = _parse_instante(de_iso), _parse_instante(ate_iso)
    if de is None or ate is None:
        raise HTTPException(400, "Informe `de` e `ate` em ISO-8601.")
    if ate <= de:
        raise HTTPException(400, "Intervalo inválido: `ate` precisa ser maior que `de`.")
    if (ate - de).total_seconds() > SESSOES_INTERVALO_MAX_H * 3600:
        raise HTTPException(400, f"Intervalo máximo de {SESSOES_INTERVALO_MAX_H}h.")

    pk = keys.pk_aluno(aluno_id)
    low = keys.sk_sessao_hist(f"{int(de.timestamp() * 1000):013d}", "")
    high = keys.sk_sessao_hist(f"{int((ate.timestamp() + _SESSAO_LAG_S) * 1000):013d}", "")
    # Filtro em memória (e não FilterExpression): a janela é de um único aluno e de poucas
    # horas — na prática um punhado de itens — e o Dynamo aplica o filtro DEPOIS da leitura,
    # então o RCU seria idêntico. Comparar datetime parseado, nunca string: `data_hora_inicio`
    # termina em "+00:00" e o cliente manda "Z" — lexicograficamente isso quebra na virada.
    out = []
    for raw in repo.query_between(pk, low, high, projection=_PROJ_SESSAO_INTERVALO):
        if raw.get("status") != SessaoStatus.FINALIZADA.value:
            continue
        inicio = _parse_instante(raw.get("data_hora_inicio"))
        if inicio is None or not (de <= inicio < ate):
            continue
        out.append({"sessao_id": raw.get("sessao_id"),
                    "data_hora": raw.get("data_hora_inicio"),
                    "treino_nome": raw.get("treino_nome")})
    out.sort(key=lambda s: s["data_hora"] or "")
    return out


def list_exercicios_aluno(aluno_id: str, incluir_historico: bool = False) -> list[dict]:
    """Lista plana de exercícios do aluno p/ seletores, deduplicada por nome canônico.
    Default: só o programa atual (EX#), na ordem de prescrição — shape original, usado
    pelos seletores de treino do portal. Com `incluir_historico`, une o catálogo permanente
    EXCAT# (tudo que o aluno já fez/postou) num shape por chave, em ordem alfabética."""
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
    if not incluir_historico:
        return repo.clean_all(deduped)

    ids_por_chave: dict[str, list[str]] = {}
    for item in items:
        ch = chave_exercicio(item.get("nome") or "")
        if ch and item.get("exercicio_id"):
            ids_por_chave.setdefault(ch, []).append(item["exercicio_id"])

    def _shape(c: dict, ch: str, atual: bool) -> dict:
        return {
            "chave": ch,
            "nome": c.get("nome"),
            "atual": atual,
            "exercicio_id": c.get("exercicio_id") if atual else None,
            "exercicio_ids": ids_por_chave.get(ch, []) if atual else [],
            "tipo_exercicio": normalizar_tipo_exercicio(c.get("tipo_exercicio")),
            "grupos": grupos_do_item(c),
            "grupo": c.get("grupo"),
            "unidade_carga": c.get("unidade_carga"),
            "unidade_reps": c.get("unidade_reps"),
            "metrica_direcao": c.get("metrica_direcao") or "MAIOR",
            "rm_kg": c.get("rm_kg"),
            "carga_prescrita": c.get("carga_prescrita") if atual else None,
            "wod": c.get("wod") or False,
            "formato": c.get("formato"),
        }

    por_chave: dict[str, dict] = {}
    for item in deduped:
        ch = chave_exercicio(item.get("nome") or "")
        if ch:
            por_chave[ch] = _shape(repo.clean(item), ch, atual=True)
    for cat in repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.EXCAT_PREFIX):
        ch = cat["SK"][len(keys.EXCAT_PREFIX):]
        if ch and ch not in por_chave:
            por_chave[ch] = _shape(repo.clean(cat), ch, atual=False)
    return [por_chave[ch] for ch in sorted(por_chave)]


def resumo_aluno(aluno_id: str, semanas: int = 16) -> dict:
    """Resumo de evolução do aluno lido de agregados (1 GetItem + queries curtas, sem scan)."""
    from app.services import pontos_service as _ps
    pk = keys.pk_aluno(aluno_id)
    st = repo.clean(repo.get_item(pk, keys.SK_STATS_ALUNO)) or {}
    weeks = [repo.clean(w) for w in repo.query_pk_last_n(pk, "STATS#W#", semanas)]
    weeks.sort(key=lambda w: w.get("semana", ""))
    prs = [{**repo.clean(p), "chave": (p.get("SK") or "")[len("STATS#PR#"):]}
           for p in repo.query_pk(pk, sk_prefix="STATS#PR#")]
    wk_grupos = [repo.clean(w) for w in repo.query_pk(pk, sk_prefix="STATS#WG#")]
    grupos_totais = [repo.clean(g) for g in repo.query_pk(pk, sk_prefix="STATS#G#")]
    semanas_validas = {w.get("semana") for w in weeks}
    volume_por_semana_grupo: dict[str, dict[str, float]] = {}
    for wg in wk_grupos:
        sem, grp = wg.get("semana"), wg.get("grupo")
        if sem in semanas_validas and grp:
            cur = volume_por_semana_grupo.setdefault(sem, {})
            # Quebra os agregados compostos legados ("peito, triceps") — mesma regra do
            # `volume_por_grupo`, para as duas séries do gráfico baterem entre si.
            for parte in _partes_do_agregado(grp):
                display = normalizar_grupo(parte).capitalize()
                cur[display] = cur.get(display, 0) + wg.get("volume", 0)
    wk_atual = _isoweek(locale_service.tz_do_aluno(aluno_id))
    streak_atual = int(st.get("streak_atual", 0))
    total_sessoes = int(st.get("total_sessoes", 0))
    semanas_com_treino = sum(1 for w in weeks if w.get("sessoes", 0) > 0)
    media_semana = round(total_sessoes / semanas_com_treino, 1) if semanas_com_treino > 0 else 0.0
    # Indicadores de tempo/frequência (agregados on-write; None quando ainda não há dado).
    n_metrica = int(st.get("sessoes_com_metrica", 0) or 0)
    soma_dur = int(st.get("soma_duracao_segundos", 0) or 0)
    soma_series = int(st.get("soma_total_series", 0) or 0)
    tempo_medio = round(soma_dur / n_metrica) if n_metrica > 0 else None
    tempo_medio_serie = round(soma_dur / soma_series) if soma_series > 0 else None
    dias_semana = [int(st.get(f"dow_{n}", 0) or 0) for n in range(7)]  # [seg..dom]
    return {
        "total_sessoes": total_sessoes,
        "total_volume": st.get("total_volume", 0),
        "ultimo_treino": st.get("ultimo_treino"),
        "tempo_medio_segundos": tempo_medio,
        "tempo_medio_serie_segundos": tempo_medio_serie,
        "dias_semana": dias_semana,
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
            [{"exercicio": p.get("exercicio_nome"), "carga": p.get("carga"), "data": p.get("data"),
              "chave": p.get("chave"), "direcao": p.get("direcao"), "formato": p.get("formato"),
              "wod": p.get("wod") or False, "unidade": p.get("unidade"), "rx": p.get("rx"),
              "editado_em": p.get("editado_em"), "editado_por": p.get("editado_por")}
             for p in prs],
            key=lambda x: x.get("carga") or 0, reverse=True,
        ),
        "volume_por_grupo": sorted(
            _dedup_grupos(grupos_totais),
            key=lambda x: x.get("volume") or 0, reverse=True,
        ),
    }
