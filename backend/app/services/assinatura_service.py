"""Assinatura da plataforma: cobra o PERSONAL (não o aluno — isso é `financeiro_service`).

Plano Trial (grátis, padrão): limite de 3 alunos ativos, sem add-ons.
Plano Gestão Pro (pago via Pix, `mp_assinatura_service`): alunos ilimitados.
Add-ons (WhatsApp, Agente IA) são flags independentes do plano, hoje só ativados
manualmente pelo admin (sem checkout ainda — ver CONTEXTO_MARKETING.md / landing).
"""
import time
from datetime import date, timedelta
from typing import Literal

from fastapi import HTTPException

from app.config import settings
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.utils import new_id, now_iso

_bloqueados_cache: dict[str, tuple[float, set[str]]] = {}
_BLOQUEADOS_TTL = 60  # s

PLANO_TRIAL = "TRIAL"
PLANO_GESTAO_PRO = "GESTAO_PRO"
TRIAL_ALUNOS_LIMIT = 3
_SCHED_TTL_S = 120 * 24 * 3600   # mesmo padrão de financeiro_service

DEFAULT_CATALOGO = {
    PLANO_GESTAO_PRO: {"nome": "Gestão Pro", "preco": "39.90", "preco_anual": "399.00", "alunos_limit": None},
}


def _hoje() -> date:
    return date.today()


# ── Catálogo de planos (parametrizável, sem redeploy) ─────────────────────────

def get_catalogo() -> dict:
    item = repo.get_item(keys.pk_system(), keys.SK_CONFIG_PLANOS)
    return repo.clean(item) if item else dict(DEFAULT_CATALOGO)


def set_catalogo(catalogo: dict) -> dict:
    repo.put_item(keys.pk_system(), keys.SK_CONFIG_PLANOS, catalogo)
    return catalogo


# ── Assinatura do personal ─────────────────────────────────────────────────────

def _ensure_assinatura(personal_id: str) -> dict:
    item = repo.get_item(keys.pk_personal(personal_id), keys.SK_ASSINATURA)
    if item:
        return repo.clean(item)
    now = now_iso()
    data = {
        "plano": PLANO_TRIAL,
        "trial_iniciado_em": now,
        "valida_ate": None,
        "aviso_sched_data": None,
        "addon_whatsapp_ativo": False,
        "addon_ia_ativo": False,
        "criado_em": now,
        "atualizado_em": now,
    }
    if repo.put_item_if_absent(keys.pk_personal(personal_id), keys.SK_ASSINATURA, data):
        return data
    # Corrida: outra request já criou — relê o que está lá.
    return repo.clean(repo.get_item(keys.pk_personal(personal_id), keys.SK_ASSINATURA))


def _is_pro_ativo(assinatura: dict) -> bool:
    if assinatura.get("plano") != PLANO_GESTAO_PRO:
        return False
    valida_ate = assinatura.get("valida_ate")
    return bool(valida_ate and date.fromisoformat(valida_ate) >= _hoje())


def get_status(personal_id: str) -> dict:
    assinatura = _ensure_assinatura(personal_id)
    pro_ativo = _is_pro_ativo(assinatura)
    alunos_limit = None if pro_ativo else TRIAL_ALUNOS_LIMIT
    dias_restantes = None
    if assinatura.get("valida_ate"):
        dias_restantes = max((date.fromisoformat(assinatura["valida_ate"]) - _hoje()).days, 0)
    if pro_ativo:
        status = "ATIVO"
    elif assinatura.get("plano") == PLANO_GESTAO_PRO:
        status = "EXPIRADO"
    else:
        status = "TRIAL"
    alunos_stats = repo.get_item(keys.pk_personal(personal_id), keys.SK_STATS_ALUNOS) or {}
    return {
        **assinatura,
        "alunos_limit": alunos_limit,
        "alunos_count": int(alunos_stats.get("ativos", 0)),
        "dias_restantes": dias_restantes,
        "status": status,
    }


def verificar_limite_alunos(personal_id: str) -> None:
    status = get_status(personal_id)
    limit = status["alunos_limit"]
    if limit is None:
        return
    if status["alunos_count"] >= limit:
        raise HTTPException(403, {
            "code": "PLAN_ALUNO_LIMIT_EXCEEDED",
            "limit": limit,
            "current": status["alunos_count"],
            "plano": status["plano"],
        })


def get_alunos_bloqueados(personal_id: str) -> set[str]:
    """Retorna o conjunto de aluno_ids inacessíveis porque excedem o limite do plano.
    Os alunos permitidos são os `alunos_limit` mais antigos por `created_at`.
    Resultado cacheado por 60s por personal para evitar fan-out por chamada."""
    now = time.time()
    cached = _bloqueados_cache.get(personal_id)
    if cached and cached[0] > now:
        return cached[1]
    status = get_status(personal_id)
    limit = status["alunos_limit"]
    if limit is None:
        result: set[str] = set()
        _bloqueados_cache[personal_id] = (now + _BLOQUEADOS_TTL, result)
        return result
    ponteiros = repo.query_pk(keys.pk_personal(personal_id), sk_prefix="ALUNO#")
    ponteiros.sort(key=lambda p: p.get("created_at") or p.get("updated_at") or "")
    bloqueados = {p["aluno_id"] for p in ponteiros[limit:]}
    _bloqueados_cache[personal_id] = (now + _BLOQUEADOS_TTL, bloqueados)
    return bloqueados


def invalidate_alunos_bloqueados(personal_id: str) -> None:
    _bloqueados_cache.pop(personal_id, None)


def has_addon(personal_id: str, addon: Literal["whatsapp", "ia"]) -> bool:
    assinatura = _ensure_assinatura(personal_id)
    field = "addon_whatsapp_ativo" if addon == "whatsapp" else "addon_ia_ativo"
    return bool(assinatura.get(field))


def require_addon(personal_id: str, addon: Literal["whatsapp", "ia"]) -> None:
    if not has_addon(personal_id, addon):
        raise HTTPException(403, {"code": "ADDON_REQUIRED", "addon": addon})


# ── Pagamento / concessão ──────────────────────────────────────────────────────

def _reagendar_aviso(personal_id: str, assinatura_atual: dict, nova_valida_ate: date) -> str:
    """Move o lembrete de vencimento (SCHED#{data-7d}) para a nova data — mesmo padrão
    de reagendamento usado em financeiro_service/_agendar_proxima_geracao."""
    nova_aviso_data = (nova_valida_ate - timedelta(days=7)).isoformat()
    antiga_aviso_data = assinatura_atual.get("aviso_sched_data")
    if antiga_aviso_data and antiga_aviso_data != nova_aviso_data:
        repo.delete_item(keys.pk_sched(antiga_aviso_data), keys.sk_sched_assinatura_aviso(personal_id))
    if antiga_aviso_data != nova_aviso_data:
        repo.put_item(
            keys.pk_sched(nova_aviso_data),
            keys.sk_sched_assinatura_aviso(personal_id),
            {"personal_id": personal_id, "ttl": int(time.time()) + _SCHED_TTL_S},
        )
    return nova_aviso_data


def aplicar_pagamento(
    personal_id: str, dias: int = 30, *,
    payment_id: str | None = None, valor: float | None = None,
    origem: Literal["PIX", "ADMIN", "PROMO", "INDICACAO"] = "PIX",
) -> dict:
    """Estende a validade de forma cumulativa: se ainda ativa, soma a partir do
    vencimento atual; se expirada/trial, soma a partir de hoje. Registra também o
    histórico de pagamentos (PIX aprovado ou concessão ADMIN — ver conceder_admin)."""
    assinatura = _ensure_assinatura(personal_id)
    hoje = _hoje()
    valida_ate_atual = assinatura.get("valida_ate")
    base = date.fromisoformat(valida_ate_atual) if valida_ate_atual and date.fromisoformat(valida_ate_atual) > hoje else hoje
    nova_valida_ate = base + timedelta(days=dias)
    nova_aviso_data = _reagendar_aviso(personal_id, assinatura, nova_valida_ate)
    fields = {
        "plano": PLANO_GESTAO_PRO,
        "valida_ate": nova_valida_ate.isoformat(),
        "aviso_sched_data": nova_aviso_data,
        "atualizado_em": now_iso(),
    }
    updated = repo.update_item(keys.pk_personal(personal_id), keys.SK_ASSINATURA, fields, return_values=True)
    invalidate_alunos_bloqueados(personal_id)

    finpilot_code: str | None = None
    if origem == "PIX" and settings.promo_code_secret:
        from app.services.promo_code_service import generate_code
        finpilot_code = generate_code(settings.promo_code_secret, valid_for_days=90)

    processado_em = now_iso()
    pagamento_item: dict = {
        "payment_id": payment_id,
        "origem": origem,
        "valor": valor,
        "dias_concedidos": dias,
        "plano": PLANO_GESTAO_PRO,
        "valida_ate": nova_valida_ate.isoformat(),
        "processado_em": processado_em,
    }
    if finpilot_code is not None:
        pagamento_item["finpilot_code"] = finpilot_code
    repo.put_item(
        keys.pk_personal(personal_id),
        keys.sk_pagamento_assinatura(processado_em, payment_id or new_id()),
        pagamento_item,
    )
    return repo.clean(updated)


def listar_pagamentos(personal_id: str, limit: int = 24) -> list[dict]:
    items = repo.query_pk_last_n(keys.pk_personal(personal_id), keys.PAGAMENTO_ASSINATURA_PREFIX, limit)
    return [repo.clean(it) for it in items]


def conceder_admin(personal_id: str, dias: int, addons: list[str] | None = None) -> dict:
    """Concessão manual (admin) — mesmo efeito de um pagamento aprovado, mais os
    add-ons indicados. Usado no bootstrap das contas internas e em suporte futuro."""
    resultado = aplicar_pagamento(personal_id, dias=dias, origem="ADMIN")
    fields = {}
    for addon in addons or []:
        if addon == "whatsapp":
            fields["addon_whatsapp_ativo"] = True
        elif addon == "ia":
            fields["addon_ia_ativo"] = True
    if fields:
        fields["atualizado_em"] = now_iso()
        resultado = repo.clean(repo.update_item(keys.pk_personal(personal_id), keys.SK_ASSINATURA, fields, return_values=True))
    return resultado
