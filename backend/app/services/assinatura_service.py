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
from app.utils import add_meses, new_id, now_iso

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
        "dia_ancora": None,
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


def _avancar_vigencia(assinatura: dict, hoje: date, meses: int, dias: int) -> tuple[date, date, int]:
    """Calcula `(base, nova_valida_ate, dia_ancora)` do próximo ciclo.

    O ciclo pago avança por **mês de calendário ancorado** no dia da assinatura, não por 30
    dias corridos: com 30 fixos o vencimento anda para trás em todo mês de 31 dias
    (17/07 → 16/08 → 15/09) e 12 mensalidades cobrem só 360 dias.

    A base é o vencimento atual quando o plano está ativo — renovar antecipado nunca perde
    saldo — e `hoje` quando é trial/expirado (o período parado não é recuperado, é
    intencional). O `>=` é o mesmo de `_is_pro_ativo`: com `>` estrito, renovar no último dia
    de um ciclo clampado (âncora 31, `valida_ate == hoje == 28/02`) cairia no ramo de
    reativação e re-ancoraria em 28, matando a âncora 31 para sempre.

    Crédito em `dias` (cupom, indicação, bônus de feedback, admin) continua em dias corridos
    e **move a âncora** para o dia em que passou a vencer. Sem isso o `add_meses` da
    renovação seguinte teleportaria de volta para a âncora antiga e comeria o bônus: âncora
    17 + 10 dias de bônus = 27/09, e o mês seguinte voltaria para 17/10 (−10 dias)."""
    valida_ate_atual = assinatura.get("valida_ate")
    atual = date.fromisoformat(valida_ate_atual) if valida_ate_atual else None
    if atual and atual >= hoje:
        base = atual
        ancora = int(assinatura.get("dia_ancora") or base.day)
    else:
        base = hoje
        ancora = hoje.day
    nova = add_meses(base, meses, ancora) if meses else base
    if dias:
        nova += timedelta(days=dias)
        ancora = nova.day
    return base, nova, ancora


def aplicar_pagamento(
    personal_id: str, dias: int = 0, *, meses: int = 0,
    payment_id: str | None = None, valor: float | None = None,
    origem: Literal["PIX", "ADMIN", "PROMO", "INDICACAO"] = "PIX",
) -> dict:
    """Estende a validade de forma cumulativa: se ainda ativa, a partir do vencimento
    atual; se expirada/trial, a partir de hoje. `meses` avança meses de calendário (ciclo
    pago, ancorado — ver `_avancar_vigencia`); `dias` soma dias corridos (cupom/bônus).
    Registra também o histórico de pagamentos (PIX aprovado ou concessão ADMIN — ver
    conceder_admin)."""
    if meses <= 0 and dias <= 0:
        raise ValueError("aplicar_pagamento exige meses > 0 ou dias > 0")
    assinatura = _ensure_assinatura(personal_id)
    hoje = _hoje()
    base, nova_valida_ate, dia_ancora = _avancar_vigencia(assinatura, hoje, meses, dias)
    nova_aviso_data = _reagendar_aviso(personal_id, assinatura, nova_valida_ate)
    fields = {
        "plano": PLANO_GESTAO_PRO,
        "valida_ate": nova_valida_ate.isoformat(),
        "dia_ancora": dia_ancora,
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
        # Dias REAIS do ciclo (28..31 no mensal), não a constante pedida — o campo já existe
        # no histórico gravado, então continua legível para os itens antigos.
        "dias_concedidos": (nova_valida_ate - base).days,
        "plano": PLANO_GESTAO_PRO,
        "valida_ate": nova_valida_ate.isoformat(),
        "processado_em": processado_em,
    }
    if meses:
        pagamento_item["meses_concedidos"] = meses
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


def conceder_admin(personal_id: str, dias: int = 0, addons: list[str] | None = None, *,
                   meses: int = 0) -> dict:
    """Concessão manual (admin) — mesmo efeito de um pagamento aprovado, mais os
    add-ons indicados. Usado no bootstrap das contas internas e em suporte futuro.
    Preferir `meses` para conceder ciclo de plano (mantém o dia do vencimento fixo);
    `dias` é para bônus avulso."""
    resultado = aplicar_pagamento(personal_id, dias=dias, meses=meses, origem="ADMIN")
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
