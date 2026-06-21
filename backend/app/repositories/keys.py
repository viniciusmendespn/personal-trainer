"""Construtores de chave do single-table (ESPEC §2). Centralizar aqui evita
strings mágicas espalhadas e mantém os prefixos curtos consistentes.

Famílias de partição:
  PT#{personal_id}  -> dados/visões do personal (leve, baixo volume de escrita)
  AL#{aluno_id}     -> tudo do aluno (alto volume, distribuído por partição)
Lookups globais:
  WAPI#{instance_id}        -> roteia o webhook para o personal
  PHONE#{personal_id}#{e164} -> resolve telefone -> aluno (escopo por personal)
"""


# ── Partições ────────────────────────────────────────────────────────────────
def pk_personal(personal_id: str) -> str:
    return f"PT#{personal_id}"


def pk_aluno(aluno_id: str) -> str:
    return f"AL#{aluno_id}"


def pk_wapi(instance_id: str) -> str:
    return f"WAPI#{instance_id}"


def pk_phone(personal_id: str, e164: str) -> str:
    return f"PHONE#{personal_id}#{e164}"


# ── SKs do personal (partição PT#) ───────────────────────────────────────────
SK_PROFILE = "PROFILE"
SK_WAPI_CONFIG = "WAPI#CONFIG"
SK_CUSTOM_FIELDS = "CONFIG#CUSTOMFIELDS"   # definições de atributos custom (ESPEC §2.4)
EXLIB_PREFIX = "EXLIB#"                     # biblioteca de exercícios do personal


def sk_exlib(exlib_id: str) -> str:
    return f"EXLIB#{exlib_id}"


def sk_aluno_pointer(aluno_id: str) -> str:
    return f"ALUNO#{aluno_id}"


SK_STATS_ALUNOS = "STATS#ALUNOS"   # contador agregado: total/ativos (ARCHITECTURE §5.5 Nível A)


def sk_atividade(aluno_id: str) -> str:
    return f"ATIVIDADE#{aluno_id}"


def gsi1_atividade(personal_id: str) -> str:
    return f"PT#{personal_id}#ATIVIDADE"


def sk_alerta(ts: str, alerta_id: str) -> str:
    return f"ALERT#{ts}#{alerta_id}"


NOTIF_PREFIX = "NOTIF#"
SK_STATS_NOTIF = "STATS#NOTIF"   # contador agregado de não-lidas (ARCHITECTURE §5.5 Nível A)


def sk_notif(ts: str, notif_id: str) -> str:
    return f"NOTIF#{ts}#{notif_id}"


def sk_dedup_msgdireto(aluno_id: str) -> str:
    return f"DEDUP#MSGDIRETO#{aluno_id}"


def sk_quota_agente(minuto: str) -> str:
    return f"QUOTA#AGENTE#{minuto}"


# ── Agenda do personal (compromissos com alunos, partição PT#) ──────────────
AGENDA_PREFIX = "AGENDA#"


def sk_agenda(data_hora_inicio: str, agendamento_id: str) -> str:
    return f"AGENDA#{data_hora_inicio}#{agendamento_id}"


# ── Templates de treino reutilizáveis (partição PT#) ─────────────────────────
TEMPLATE_PREFIX = "TEMPLATE#"


def sk_template(template_id: str) -> str:
    return f"TEMPLATE#{template_id}"


# ── Agenda de vencimentos (scheduler diário) — 1 partição por dia de vencimento,
# evita hot-partition global (1 só PK pra todo o sistema, ESPEC §2.1 risco identificado).
DUE_PREFIX = "DUE#"


def pk_sched(data_fim: str) -> str:
    return f"SCHED#{data_fim}"   # data_fim = YYYY-MM-DD (1 partição por dia)


def sk_due(treino_id: str) -> str:
    return f"DUE#{treino_id}"


# ── SKs do aluno (partição AL#) ──────────────────────────────────────────────
SK_SESSION_ACTIVE = "SESSION#ACTIVE"
SK_CHAT = "CHAT"   # memória conversacional do agente (com TTL) — só p/ prompt da LLM

CHAT_MSG_PREFIX = "CMSG#"   # histórico durável do chat (sem TTL) — só p/ exibição na UI


def sk_chat_msg(ts: str, msg_id: str) -> str:
    return f"CMSG#{ts}#{msg_id}"


SK_TREINO_PREFIX = "TREINO#"


def sk_treino(treino_id: str) -> str:
    return f"TREINO#{treino_id}"


def sk_exercicio(treino_id: str, exercicio_id: str) -> str:
    return f"EX#{treino_id}#{exercicio_id}"


def sk_exercicio_prefix(treino_id: str) -> str:
    return f"EX#{treino_id}#"


def sk_sessao_hist(ts: str, sessao_id: str) -> str:
    return f"SESSION#{ts}#{sessao_id}"


def sk_sessao_idx(sessao_id: str) -> str:
    return f"SESSAO_IDX#{sessao_id}"


def sk_registro(sessao_id: str, exercicio_id: str) -> str:
    return f"REG#{sessao_id}#{exercicio_id}"


def sk_dor(exercicio_id: str, ts: str, dor_id: str) -> str:
    return f"DOR#{exercicio_id}#{ts}#{dor_id}"


NOTA_PREFIX = "NOTA#"


def sk_nota(ts: str, nota_id: str) -> str:
    return f"NOTA#{ts}#{nota_id}"


AVAL_PREFIX = "AVAL#"


def sk_avaliacao(ts: str, avaliacao_id: str) -> str:
    return f"AVAL#{ts}#{avaliacao_id}"


def sk_msg(message_id: str) -> str:
    return f"MSG#{message_id}"


# ── Agregados (indicadores mantidos na escrita — ESPEC §3.1) ─────────────────
SK_STATS_ALUNO = "STATS#ALUNO"


def sk_stats_week(week: str) -> str:
    return f"STATS#W#{week}"


def sk_stats_pr(exercicio_id: str) -> str:
    return f"STATS#PR#{exercicio_id}"


# ── Dúvidas do aluno (partição AL#) ─────────────────────────────────────────
DUVIDA_PREFIX = "DUVIDA#"


def sk_duvida(exercicio_id: str, ts: str, duvida_id: str) -> str:
    return f"DUVIDA#{exercicio_id}#{ts}#{duvida_id}"


# ── Correções do personal (post rico: texto + mídias) ────────────────────────
CORRECAO_PREFIX = "CORRECAO#"


def sk_correcao_ex(exercicio_id: str, ts: str, correcao_id: str) -> str:
    return f"CORRECAO#{exercicio_id}#{ts}#{correcao_id}"


# ── Postagens unificadas (aluno + personal) — texto + mídias + tipo ──────────
POST_PREFIX = "POST#"


def sk_post(exercicio_id: str, ts: str, post_id: str) -> str:
    return f"POST#{exercicio_id}#{ts}#{post_id}"


# ── Notificações para o aluno (partição AL#, espelho do NOTIF# do personal) ──
ANOTIF_PREFIX = "ANOTIF#"


def sk_anotif(ts: str, notif_id: str) -> str:
    return f"ANOTIF#{ts}#{notif_id}"


SK_STATS_ANOTIF = "STATS#ANOTIF"   # contador agregado de não-lidas do aluno


# ── Feed global do personal (partição PT#) ──────────────────────────────────
FEED_GLOBAL_PREFIX = "FEED#"


def sk_feed_global(ts: str, post_id: str) -> str:
    return f"FEED#{ts}#{post_id}"


def sk_curtida_feed(post_id: str) -> str:
    return f"CURTIDA#FEED#{post_id}"


# ── Pontos e ranking de alunos ───────────────────────────────────────────────
SK_PONTOS = "PONTOS#"
PONTO_LOG_PREFIX = "PONTO_LOG#"
RANKING_PREFIX = "RANKING#"


def sk_ponto_log(ts: str) -> str:
    return f"PONTO_LOG#{ts}"


def sk_ranking_aluno(aluno_id: str) -> str:
    return f"RANKING#{aluno_id}"


# ── Badges / conquistas do aluno (partição AL#) ──────────────────────────────
BADGE_PREFIX = "BADGE#"


def sk_badge(tipo: str) -> str:
    return f"BADGE#{tipo}"


# ── Metas / objetivos do aluno (partição AL#) ────────────────────────────────
META_PREFIX = "META#"


def sk_meta(ts: str, meta_id: str) -> str:
    return f"META#{ts}#{meta_id}"


# ── Anamnese (ficha de saúde) ─────────────────────────────────────────────────
SK_ANAMNESE_TEMPLATE = "CONFIG#ANAMNESE"   # PT#{personal_id}
SK_ANAMNESE_ALUNO = "ANAMNESE#"            # AL#{aluno_id}


# ── Base de conhecimento para IA (arquivos do personal, partição PT#) ────────
KB_PREFIX = "KB#"
SK_KB_BUNDLE = "KB_BUNDLE"   # metadado do zip cacheado: s3_key, built_at, file_count, total_size


def sk_kb(arquivo_id: str) -> str:
    return f"KB#{arquivo_id}"


# ── Push subscriptions do aluno (partição AL#) ──────────────────────────────
PUSH_PREFIX = "PUSH#"


def sk_push(sub_id: str) -> str:
    return f"PUSH#{sub_id}"


# ── GSI1: "registros por exercício no tempo" (ESPEC §4.1) ────────────────────
def gsi1_registro(aluno_id: str, exercicio_id: str) -> str:
    return f"AL#{aluno_id}#EX#{exercicio_id}"


def gsi1sk_registro(ts: str) -> str:
    return f"R#{ts}"


# ── Financeiro: config e cobranças por aluno (partição AL#) ──────────────────
SK_COBRANCA_CFG = "COBRANCA_CONFIG"   # underscore evita colisão com begins_with("COBRANCA#")
COBRANCA_PREFIX = "COBRANCA#"
COBRANCA_IDX_PREFIX = "COBRANCA_IDX#"


def sk_cobranca(ano_mes: str, cobranca_id: str) -> str:
    return f"COBRANCA#{ano_mes}#{cobranca_id}"


def sk_cobranca_idx(cobranca_id: str) -> str:
    return f"COBRANCA_IDX#{cobranca_id}"


# ── Financeiro: ponteiro de alunos com cobrança ativa (partição PT#) ─────────
COBRANCA_ALUNO_PREFIX = "COBRANCA_ALUNO#"


def sk_cobranca_aluno(aluno_id: str) -> str:
    return f"COBRANCA_ALUNO#{aluno_id}"


# ── Financeiro: config Mercado Pago (partição PT#) ───────────────────────────
SK_CONFIG_MP = "CONFIG#MERCADOPAGO"


# ── Financeiro: entradas do scheduler (partição SCHED#) ─────────────────────
BILLING_GERAR_PREFIX = "BILLING_GERAR#"
BILLING_VENCER_PREFIX = "BILLING_VENCER#"


def sk_sched_billing_gerar(aluno_id: str) -> str:
    return f"BILLING_GERAR#{aluno_id}"


def sk_sched_billing_vencer(aluno_id: str, cobranca_id: str) -> str:
    return f"BILLING_VENCER#{aluno_id}#{cobranca_id}"


# ── Mercado Pago: idempotência de webhook ────────────────────────────────────
def pk_mp_lock(payment_id: str) -> str:
    return f"MP_LOCK#{payment_id}"
