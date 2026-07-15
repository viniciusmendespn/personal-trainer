"""Monta o `contexto_aluno` do export do programa (fluxo "Atualizar treino com IA").

Agrega tudo que existe do aluno na partição AL#{aluno_id} num payload único e legível
por LLM: perfil, anamnese, avaliações, metas, estatísticas/frequência, últimas sessões,
evolução de carga, dores/dúvidas, postagens, notas do personal, chat e gamificação.

Regras:
- Só Query/GetItem por PK+SK (mesma partição; ~17 leituras pequenas, sem GSI extra).
- Nunca gerar presigned URL nem incluir S3 keys/IDs internos — o arquivo vai para
  serviços de terceiros (por isso NÃO reusa feed_exercicio/list_chat_msgs).
- Cada seção é best-effort: erro numa seção vira seção vazia + log, nunca derruba
  o export do programa."""
import logging
from datetime import date, datetime, timedelta, timezone

from app.models.contexto_export import (
    AnamneseContexto,
    AvaliacaoContexto,
    ContextoAluno,
    EstatisticasTreino,
    EvolucaoExercicioContexto,
    ExercicioSessaoContexto,
    GamificacaoContexto,
    MensagemChatContexto,
    MetaContexto,
    NotaContexto,
    PerfilContexto,
    PostagemContexto,
    RelatoContexto,
    RespostaAnamnese,
    SemanaContexto,
    SessaoContexto,
)
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import meta_service, nota_service, sessao_service
from app.services.sessao_service import chave_exercicio
from app.utils import now_iso

logger = logging.getLogger(__name__)

MAX_SESSOES = 20
MAX_RELATOS_RESPONDIDOS = 10
MAX_POSTAGENS = 15
MAX_NOTAS = 20
MAX_CHAT_MSGS = 50
CHAT_JANELA_DIAS = 60
CHAT_TRUNCAR_EM = 300


def _num(v) -> float | None:
    """Carga pode vir como número, Decimal ou texto ("20kg", "60%") — extrai o valor."""
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        pass
    digitos = "".join(c for c in str(v).replace(",", ".") if c.isdigit() or c == ".")
    try:
        return float(digitos) if digitos else None
    except ValueError:
        return None


def _idade(data_nascimento: str | None) -> int | None:
    if not data_nascimento:
        return None
    try:
        nasc = date.fromisoformat(data_nascimento[:10])
        hoje = date.today()
        return hoje.year - nasc.year - ((hoje.month, hoje.day) < (nasc.month, nasc.day))
    except ValueError:
        return None


def _secao(nome: str, fn, default):
    """Executa uma seção best-effort — erro loga e devolve o default vazio."""
    try:
        return fn()
    except Exception:
        logger.exception("[contexto_aluno] falha ao montar seção %s", nome)
        return default


# ── Seções ───────────────────────────────────────────────────────────────────
def _perfil(pk: str) -> PerfilContexto:
    p = repo.clean(repo.get_item(pk, keys.SK_PROFILE)) or {}
    return PerfilContexto(
        nome=p.get("nome"),
        idade=_idade(p.get("data_nascimento")),
        objetivos=p.get("objetivos") or [],
        descricao=p.get("descricao"),
        observacoes_do_personal=p.get("observacoes"),
    )


def _anamnese(pk: str, personal_id: str) -> AnamneseContexto | None:
    resp = repo.clean(repo.get_item(pk, keys.SK_ANAMNESE_ALUNO))
    if not resp or not resp.get("respostas"):
        return None
    template = repo.clean(repo.get_item(keys.pk_personal(personal_id), keys.SK_ANAMNESE_TEMPLATE)) or {}
    labels = {q.get("key"): q.get("label") for q in template.get("perguntas") or []}
    return AnamneseContexto(
        preenchido_em=(resp.get("preenchido_em") or "")[:10] or None,
        respostas=[
            RespostaAnamnese(pergunta=labels.get(k) or k, resposta=str(v))
            for k, v in resp["respostas"].items()
            if v not in (None, "")
        ],
    )


def _avaliacoes(pk: str) -> list[AvaliacaoContexto]:
    items = repo.clean_all(repo.query_pk(pk, sk_prefix=keys.AVAL_PREFIX))
    items.sort(key=lambda a: a.get("data") or a.get("created_at") or "")
    return [
        AvaliacaoContexto(
            data=(a.get("data") or a.get("created_at") or "")[:10] or None,
            peso_kg=a.get("peso"),
            altura_cm=a.get("altura_cm"),
            percentual_gordura=a.get("percentual_gordura"),
            medidas_cm=a.get("medidas") or {},
            metricas_customizadas=[
                {"nome": m.get("nome"), "unidade": m.get("unidade"), "valor": m.get("valor")}
                for m in a.get("metricas") or []
            ],
            observacoes=a.get("observacoes"),
        )
        for a in items
    ]


def _metas(aluno_id: str) -> list[MetaContexto]:
    return [
        MetaContexto(
            titulo=m.get("titulo") or "",
            tipo=m.get("tipo") or "LIVRE",
            status=m.get("status") or "",
            valor_alvo=m.get("valor_alvo"),
            unidade=m.get("unidade"),
            exercicio=m.get("exercicio_nome"),
            data_limite=m.get("data_limite"),
            descricao=m.get("descricao"),
        )
        for m in meta_service.listar(aluno_id)
        if m.get("status") in ("APROVADA", "PENDENTE")
    ]


def _estatisticas(resumo: dict) -> EstatisticasTreino:
    return EstatisticasTreino(
        total_sessoes=resumo.get("total_sessoes", 0),
        media_sessoes_por_semana=resumo.get("media_sessoes_semana", 0),
        sessoes_semana_atual=resumo.get("sessoes_semana", 0),
        streak_semanas_consecutivas=resumo.get("streak_atual", 0),
        streak_maximo_semanas=resumo.get("streak_maximo", 0),
        ultimo_treino_em=(resumo.get("ultimo_treino") or "")[:10] or None,
        volume_total_kg=round(resumo.get("total_volume") or 0, 1),
        volume_por_grupo_muscular=[
            {"grupo": g.get("grupo"), "volume": round(g.get("volume") or 0, 1)}
            for g in resumo.get("volume_por_grupo") or []
        ],
        ultimas_semanas=[
            SemanaContexto(semana=w.get("semana") or "", sessoes=w.get("sessoes", 0),
                           volume_kg=round(w.get("volume") or 0, 1))
            for w in resumo.get("semanas") or []
        ],
    )


def _fmt_serie(s: dict, unidade_carga: str | None, unidade_reps: str | None) -> str:
    carga, reps, rpe = s.get("carga"), s.get("reps"), s.get("rpe")
    if carga not in (None, ""):
        u = unidade_carga if unidade_carga and not str(carga).strip().endswith(unidade_carga) else ""
        txt = f"{carga}{u} x {reps}"
    else:
        txt = f"{reps}{unidade_reps or ' reps'}" if unidade_reps else f"{reps} reps"
    if rpe not in (None, ""):
        txt += f" @RPE{rpe}"
    return txt


def _compactar_sessao(s: dict) -> SessaoContexto:
    duracao = s.get("duracao_segundos")
    return SessaoContexto(
        data=(s.get("data_hora_fim") or s.get("data_hora_inicio") or "")[:10] or None,
        treino=s.get("treino_nome"),
        duracao_min=round(duracao / 60) if duracao else None,
        total_series=s.get("total_series"),
        volume_kg=round(s.get("volume_total") or 0, 1) or None,
        novos_recordes=[
            f"{p.get('exercicio_nome')}: {p.get('carga')}{p.get('unidade') or ''}"
            for p in s.get("novos_prs") or []
        ],
        exercicios=[
            ExercicioSessaoContexto(
                nome=e.get("exercicio_nome"),
                series_realizadas=" | ".join(
                    _fmt_serie(x, e.get("unidade_carga"), e.get("unidade_reps"))
                    for x in e.get("series_exec") or []
                    if not x.get("aquecimento")   # séries de warmup não entram na análise
                ),
                substituto_executado=e.get("substituto_nome"),
                pse=_num(e.get("pse")),
            )
            for e in s.get("exercicios_exec") or []
            if not e.get("aquecimento")           # exercícios de warmup não entram na análise
        ],
    )


def _ultimas_sessoes_raw(pk: str) -> list[dict]:
    """Últimas sessões FINALIZADAS, mais recente primeiro. Busca 25+ para compensar o
    filtro (SESSION#ACTIVE ordena depois dos dígitos e vem no topo do scan reverso)."""
    items = repo.query_pk_last_n(pk, "SESSION#", MAX_SESSOES + 5)
    return [
        repo.clean(s) for s in items
        if s.get("SK") != keys.SK_SESSION_ACTIVE and s.get("status") == "FINALIZADA"
    ][:MAX_SESSOES]


def _evolucao_do_programa(sessoes: list[dict], prs: list[dict],
                          exercicios_programa: list[str]) -> list[EvolucaoExercicioContexto]:
    """Tendência de carga por exercício do programa atual, derivada das sessões já lidas
    (zero queries extras). `sessoes` vem mais recente primeiro."""
    pr_por_chave = {chave_exercicio(p.get("exercicio")): p for p in prs if p.get("exercicio")}
    # chave canônica -> lista de cargas máximas por sessão, da mais ANTIGA para a mais recente
    cargas_por_chave: dict[str, list[float]] = {}
    for s in reversed(sessoes):
        for e in s.get("exercicios_exec") or []:
            ch = chave_exercicio(e.get("exercicio_nome"))
            if not ch or e.get("substituto_nome") or e.get("aquecimento"):
                continue
            cargas = [c for c in (_num(x.get("carga")) for x in e.get("series_exec") or []
                                  if not x.get("aquecimento") and not x.get("contexto")) if c is not None]
            if cargas:
                cargas_por_chave.setdefault(ch, []).append(max(cargas))
    out: list[EvolucaoExercicioContexto] = []
    vistos: set[str] = set()
    for nome in exercicios_programa:
        ch = chave_exercicio(nome)
        if not ch or ch in vistos:
            continue
        vistos.add(ch)
        cargas = cargas_por_chave.get(ch) or []
        pr = pr_por_chave.get(ch) or {}
        if len(cargas) >= 2:
            primeira, ultima = cargas[0], cargas[-1]
            if primeira > 0 and abs(ultima - primeira) / primeira <= 0.05:
                tendencia = "ESTAVEL"
            else:
                tendencia = "SUBINDO" if ultima > primeira else "CAINDO"
        else:
            primeira = ultima = cargas[0] if cargas else None
            tendencia = "SEM_DADOS"
        out.append(EvolucaoExercicioContexto(
            exercicio=nome,
            recorde_carga=pr.get("carga"),
            recorde_em=(pr.get("data") or "")[:10] or None,
            sessoes_no_periodo=len(cargas),
            carga_max_primeira_sessao=primeira,
            carga_max_ultima_sessao=ultima,
            tendencia=tendencia,
        ))
    return out


def _relato(item: dict, tipo: str) -> RelatoContexto:
    return RelatoContexto(
        tipo=tipo,
        data=(item.get("data_hora") or "")[:10] or None,
        exercicio=item.get("exercicio_nome"),
        descricao=item.get("descricao") or "",
        respondido=bool(item.get("respondido")),
        resposta_do_personal=item.get("resposta_texto"),
    )


def _dores_e_duvidas(pk: str) -> list[RelatoContexto]:
    """Todas as não respondidas + as N respondidas mais recentes."""
    relatos = [_relato(repo.clean(i), "DOR") for i in repo.query_pk(pk, sk_prefix="DOR#")]
    relatos += [_relato(repo.clean(i), "DUVIDA") for i in repo.query_pk(pk, sk_prefix=keys.DUVIDA_PREFIX)]
    relatos.sort(key=lambda r: r.data or "", reverse=True)
    abertas = [r for r in relatos if not r.respondido]
    respondidas = [r for r in relatos if r.respondido][:MAX_RELATOS_RESPONDIDOS]
    return abertas + respondidas


def _postagens(pk: str) -> list[PostagemContexto]:
    posts = [
        PostagemContexto(
            data=(p.get("data_hora") or "")[:10] or None,
            autor=p.get("ator") or "ALUNO",
            exercicio=p.get("exercicio_nome"),
            texto=p.get("descricao") or p.get("texto"),
            tinha_midia=bool(p.get("midias")),
        )
        for p in repo.clean_all(repo.query_pk(pk, sk_prefix=keys.POST_PREFIX))
    ]
    posts += [
        PostagemContexto(
            data=(c.get("data_hora") or "")[:10] or None,
            autor="PERSONAL",
            exercicio=c.get("exercicio_nome"),
            texto=c.get("texto"),
            tinha_midia=bool(c.get("midias")),
        )
        for c in repo.clean_all(repo.query_pk(pk, sk_prefix=keys.CORRECAO_PREFIX))
    ]
    posts.sort(key=lambda p: p.data or "", reverse=True)
    return posts[:MAX_POSTAGENS]


def _notas(aluno_id: str) -> list[NotaContexto]:
    items, _ = nota_service.listar(aluno_id, limit=MAX_NOTAS)
    return [
        NotaContexto(data=(n.get("data_hora") or "")[:10] or None, texto=n.get("texto") or "")
        for n in items
    ]


def _chat(pk: str) -> list[MensagemChatContexto]:
    corte = (datetime.now(timezone.utc) - timedelta(days=CHAT_JANELA_DIAS)).isoformat()
    msgs = []
    for m in repo.clean_all(repo.query_pk_last_n(pk, keys.CHAT_MSG_PREFIX, MAX_CHAT_MSGS)):
        if (m.get("data_hora") or "") < corte:
            continue
        # Resposta do agente tem role=assistant sem `direto`; mensagem direta carrega o ator real
        if m.get("role") == "assistant" and not m.get("direto"):
            autor = "ASSISTENTE_IA"
        else:
            autor = m.get("ator") or ("PERSONAL" if m.get("role") == "assistant" else "ALUNO")
        texto = (m.get("texto") or "")[:CHAT_TRUNCAR_EM]
        if m.get("midia"):
            texto = (texto + " [mídia]").strip()
        msgs.append(MensagemChatContexto(
            data=(m.get("data_hora") or "")[:10] or None, autor=autor, mensagem=texto,
        ))
    return list(reversed(msgs))   # mais antiga primeiro, como uma conversa


def _gamificacao(pk: str) -> GamificacaoContexto | None:
    pontos = repo.clean(repo.get_item(pk, keys.SK_PONTOS)) or {}
    badges = repo.clean_all(repo.query_pk(pk, sk_prefix=keys.BADGE_PREFIX))
    if not pontos and not badges:
        return None
    return GamificacaoContexto(
        pontos_totais=int(pontos.get("total") or 0),
        conquistas=[f"{b.get('titulo')} ({b.get('descricao')})" for b in badges],
    )


# ── Entrada pública ──────────────────────────────────────────────────────────
def montar_contexto(personal_id: str, aluno_id: str,
                    exercicios_programa: list[str]) -> ContextoAluno:
    """`exercicios_programa`: nomes dos exercícios do programa atual (o router já os
    carregou para o export — evita re-query de EX#). Usados na seção de evolução."""
    pk = keys.pk_aluno(aluno_id)
    resumo = _secao("estatisticas", lambda: sessao_service.resumo_aluno(aluno_id), {})
    sessoes = _secao("sessoes", lambda: _ultimas_sessoes_raw(pk), [])
    return ContextoAluno(
        gerado_em=now_iso()[:10],
        perfil=_secao("perfil", lambda: _perfil(pk), PerfilContexto()),
        anamnese=_secao("anamnese", lambda: _anamnese(pk, personal_id), None),
        avaliacoes_fisicas=_secao("avaliacoes", lambda: _avaliacoes(pk), []),
        metas=_secao("metas", lambda: _metas(aluno_id), []),
        estatisticas_treino=_estatisticas(resumo) if resumo else None,
        ultimas_sessoes=_secao("compactar_sessoes",
                               lambda: [_compactar_sessao(s) for s in sessoes], []),
        evolucao_por_exercicio=_secao("evolucao", lambda: _evolucao_do_programa(
            sessoes, resumo.get("prs") or [], exercicios_programa), []),
        dores_e_duvidas=_secao("dores_duvidas", lambda: _dores_e_duvidas(pk), []),
        postagens_recentes=_secao("postagens", lambda: _postagens(pk), []),
        notas_do_personal=_secao("notas", lambda: _notas(aluno_id), []),
        chat_recente=_secao("chat", lambda: _chat(pk), []),
        gamificacao=_secao("gamificacao", lambda: _gamificacao(pk), None),
    )
