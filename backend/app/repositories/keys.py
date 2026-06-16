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


def sk_aluno_pointer(aluno_id: str) -> str:
    return f"ALUNO#{aluno_id}"


# ── SKs do aluno (partição AL#) ──────────────────────────────────────────────
SK_SESSION_ACTIVE = "SESSION#ACTIVE"


def sk_msg(message_id: str) -> str:
    return f"MSG#{message_id}"


# Demais SKs (TREINO#, EX#, REG#, MIDIA#, ...) são definidos quando as entidades
# forem modeladas (atributos ainda em aberto — ESPEC §8 / FUNCIONAL §5.2).
