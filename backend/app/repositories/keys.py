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


def sk_aluno_pointer(aluno_id: str) -> str:
    return f"ALUNO#{aluno_id}"


def sk_alerta(ts: str, alerta_id: str) -> str:
    return f"ALERT#{ts}#{alerta_id}"


def sk_pendencia(ts: str, pendencia_id: str) -> str:
    return f"PEND#{ts}#{pendencia_id}"


# ── SKs do aluno (partição AL#) ──────────────────────────────────────────────
SK_SESSION_ACTIVE = "SESSION#ACTIVE"


SK_TREINO_PREFIX = "TREINO#"


def sk_treino(treino_id: str) -> str:
    return f"TREINO#{treino_id}"


def sk_exercicio(treino_id: str, exercicio_id: str) -> str:
    return f"EX#{treino_id}#{exercicio_id}"


def sk_exercicio_prefix(treino_id: str) -> str:
    return f"EX#{treino_id}#"


def sk_sessao_hist(ts: str, sessao_id: str) -> str:
    return f"SESSION#{ts}#{sessao_id}"


def sk_registro(sessao_id: str, exercicio_id: str) -> str:
    return f"REG#{sessao_id}#{exercicio_id}"


def sk_msg(message_id: str) -> str:
    return f"MSG#{message_id}"


# ── GSI1: "registros por exercício no tempo" (ESPEC §4.1) ────────────────────
def gsi1_registro(aluno_id: str, exercicio_id: str) -> str:
    return f"AL#{aluno_id}#EX#{exercicio_id}"


def gsi1sk_registro(ts: str) -> str:
    return f"R#{ts}"
