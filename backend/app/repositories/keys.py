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


def sk_alerta(ts: str, alerta_id: str) -> str:
    return f"ALERT#{ts}#{alerta_id}"


NOTIF_PREFIX = "NOTIF#"


def sk_notif(ts: str, notif_id: str) -> str:
    return f"NOTIF#{ts}#{notif_id}"


# ── Agenda do personal (compromissos com alunos, partição PT#) ──────────────
AGENDA_PREFIX = "AGENDA#"


def sk_agenda(data_hora_inicio: str, agendamento_id: str) -> str:
    return f"AGENDA#{data_hora_inicio}#{agendamento_id}"


# ── Templates de treino reutilizáveis (partição PT#) ─────────────────────────
TEMPLATE_PREFIX = "TEMPLATE#"


def sk_template(template_id: str) -> str:
    return f"TEMPLATE#{template_id}"


# ── Agenda global de vencimentos (scheduler diário) ──────────────────────────
PK_SCHED = "SYSTEM#SCHED"
DUE_PREFIX = "DUE#"


def sk_due(data_fim: str, treino_id: str) -> str:
    return f"DUE#{data_fim}#{treino_id}"   # data_fim = YYYY-MM-DD (ordenável)


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


# ── GSI1: "registros por exercício no tempo" (ESPEC §4.1) ────────────────────
def gsi1_registro(aluno_id: str, exercicio_id: str) -> str:
    return f"AL#{aluno_id}#EX#{exercicio_id}"


def gsi1sk_registro(ts: str) -> str:
    return f"R#{ts}"
