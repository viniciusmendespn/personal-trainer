"""Gestão de cobranças e faturamento de alunos."""
import logging
import time
from calendar import monthrange
from datetime import date, timedelta
from typing import Optional

from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import anotif_service, notif_service
from app.utils import new_id, now_iso

logger = logging.getLogger(__name__)

_SCHED_TTL_S = 120 * 24 * 3600   # 120 dias de cleanup para entradas de scheduler


# ── Config de faturamento ─────────────────────────────────────────────────────

def get_config(personal_id: str, aluno_id: str) -> dict | None:
    item = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_COBRANCA_CFG)
    if not item or item.get("personal_id") != personal_id:
        return None
    return repo.clean(item)


def set_config(personal_id: str, aluno_id: str, body: dict) -> dict:
    now = now_iso()
    existing = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_COBRANCA_CFG)
    criado_em = (existing or {}).get("criado_em", now)
    cfg = {
        "personal_id": personal_id,
        "aluno_id": aluno_id,
        "valor": body["valor"],
        "recorrencia": body["recorrencia"],
        "dia_vencimento": body["dia_vencimento"],
        "ativo": body.get("ativo", True),
        "dias_antecedencia": body.get("dias_antecedencia", 15),
        "criado_em": criado_em,
        "atualizado_em": now,
    }
    repo.put_item(keys.pk_aluno(aluno_id), keys.SK_COBRANCA_CFG, cfg)
    repo.put_item(keys.pk_personal(personal_id), keys.sk_cobranca_aluno(aluno_id), {
        "aluno_id": aluno_id, "ativo": cfg["ativo"],
        "valor": cfg["valor"], "atualizado_em": now,
    })
    if cfg["ativo"]:
        hoje = date.today()
        vencimento = _proxima_data_vencimento(cfg["dia_vencimento"], cfg["recorrencia"], hoje)
        # Cria cobrança imediatamente se não existir para este período
        _criar_cobranca_pendente(aluno_id, personal_id, cfg["valor"],
                                  cfg["recorrencia"], vencimento, cfg["dias_antecedencia"])
        # Agenda próxima geração após este período
        _agendar_proxima_geracao(aluno_id, personal_id, cfg["dia_vencimento"],
                                  cfg["recorrencia"], cfg["dias_antecedencia"], vencimento)
    return cfg


# ── Listagem de cobranças ─────────────────────────────────────────────────────

def listar_cobranças(personal_id: str, aluno_id: str,
                     limit: int = 50, cursor: str | None = None,
                     status: str | None = None) -> tuple[list[dict], str | None]:
    items, next_cursor = repo.query_pk_page(
        keys.pk_aluno(aluno_id), keys.COBRANCA_PREFIX,
        limit=limit, cursor=cursor, forward=False,
    )
    result = []
    for it in items:
        if it.get("personal_id") != personal_id:
            continue
        c = repo.clean(it)
        c["ref"] = it["SK"]
        if status and c.get("status") != status:
            continue
        result.append(c)
    return result, next_cursor


# ── Criação manual ────────────────────────────────────────────────────────────

def criar_cobranca_manual(personal_id: str, aluno_id: str, body: dict) -> dict:
    vencimento = date.fromisoformat(body["vencimento"])
    cid = new_id()
    ano_mes = vencimento.strftime("%Y-%m")
    sk = keys.sk_cobranca(ano_mes, cid)
    now = now_iso()
    item = {
        "cobranca_id": cid, "aluno_id": aluno_id, "personal_id": personal_id,
        "valor": body["valor"], "recorrencia": body.get("recorrencia", "MENSAL"),
        "vencimento": vencimento.isoformat(), "status": "PENDENTE",
        "notas": body.get("notas"), "origem": "MANUAL",
        "forma_pagamento": None, "data_pagamento": None,
        "mp_payment_id": None, "mp_valor_liquido": None, "mp_taxa": None,
        "criado_em": now, "atualizado_em": now,
    }
    repo.put_item(keys.pk_aluno(aluno_id), sk, item)
    repo.put_item(keys.pk_aluno(aluno_id), keys.sk_cobranca_idx(cid),
                  {"cobranca_id": cid, "sk": sk, "personal_id": personal_id})
    # Agenda transição para VENCIDA no dia do vencimento
    _agendar_vencer(aluno_id, cid, personal_id, vencimento)
    item["ref"] = sk
    return item


# ── Registrar pagamento (manual) ──────────────────────────────────────────────

def registrar_pagamento(personal_id: str, aluno_id: str, cobranca_id: str, body: dict) -> dict | None:
    sk = _lookup_sk(aluno_id, cobranca_id)
    if not sk:
        return None
    fields = {
        "status": "PAGA",
        "forma_pagamento": body.get("forma_pagamento", "MANUAL"),
        "origem": "MANUAL",
        "data_pagamento": body["data_pagamento"],
        "notas": body.get("notas"),
        "atualizado_em": now_iso(),
    }
    updated = repo.update_item_if_exists(keys.pk_aluno(aluno_id), sk, fields)
    if updated:
        updated = repo.clean(updated)
        updated["ref"] = sk
        aluno = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE) or {}
        notif_service.criar(personal_id, "COBRANCA_PAGA",
            f"Pagamento registrado — {aluno.get('nome', 'Aluno')}",
            f"Cobrança de {aluno.get('nome', 'Aluno')} marcada como paga.",
            aluno_id=aluno_id)
    return updated


# ── Cancelar cobrança ─────────────────────────────────────────────────────────

def cancelar_cobranca(personal_id: str, aluno_id: str, cobranca_id: str) -> bool:
    sk = _lookup_sk(aluno_id, cobranca_id)
    if not sk:
        return False
    item = repo.get_item(keys.pk_aluno(aluno_id), sk)
    if not item or item.get("personal_id") != personal_id:
        return False
    if item.get("status") == "PAGA":
        return False  # não cancela cobranças pagas
    repo.delete_item(keys.pk_aluno(aluno_id), sk)
    repo.delete_item(keys.pk_aluno(aluno_id), keys.sk_cobranca_idx(cobranca_id))
    return True


# ── Funções internas (chamadas pelo scheduler) ────────────────────────────────

def _gerar_cobranca_agendada(aluno_id: str, personal_id: str, vencimento_str: str) -> None:
    """Chamado pelo scheduler ao disparar BILLING_GERAR#."""
    cfg = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_COBRANCA_CFG)
    if not cfg or not cfg.get("ativo") or cfg.get("personal_id") != personal_id:
        return
    vencimento = date.fromisoformat(vencimento_str)
    valor = float(cfg["valor"])
    recorrencia = str(cfg["recorrencia"])
    dias_antecedencia = int(cfg.get("dias_antecedencia", 15))
    _criar_cobranca_pendente(aluno_id, personal_id, valor, recorrencia, vencimento, dias_antecedencia)
    dia_vencimento = int(cfg["dia_vencimento"])
    _agendar_proxima_geracao(aluno_id, personal_id, dia_vencimento, recorrencia, dias_antecedencia, vencimento)


def _marcar_vencida(aluno_id: str, cobranca_id: str, vencimento_str: str, personal_id: str) -> None:
    """Chamado pelo scheduler ao disparar BILLING_VENCER#."""
    ano_mes = vencimento_str[:7]
    sk = keys.sk_cobranca(ano_mes, cobranca_id)
    item = repo.get_item(keys.pk_aluno(aluno_id), sk)
    if not item or item.get("status") != "PENDENTE":
        return  # já paga ou inexistente
    repo.update_item_if_exists(keys.pk_aluno(aluno_id), sk,
                                {"status": "VENCIDA", "atualizado_em": now_iso()})
    aluno = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE) or {}
    valor = float(item.get("valor", 0))
    venc_fmt = date.fromisoformat(vencimento_str).strftime("%d/%m/%Y")
    notif_service.criar(personal_id, "COBRANCA_VENCIDA",
        f"Cobrança vencida — {aluno.get('nome', 'Aluno')}",
        f"Cobrança de R$ {valor:.2f} venceu em {venc_fmt} sem pagamento.",
        aluno_id=aluno_id)
    anotif_service.criar(aluno_id, "COBRANCA_VENCIDA",
        "Mensalidade vencida",
        f"Sua mensalidade de R$ {valor:.2f} venceu em {venc_fmt}. Fale com seu personal.")


# ── Helpers privados ──────────────────────────────────────────────────────────

def _lookup_sk(aluno_id: str, cobranca_id: str) -> str | None:
    idx = repo.get_item(keys.pk_aluno(aluno_id), keys.sk_cobranca_idx(cobranca_id))
    return idx.get("sk") if idx else None


def _criar_cobranca_pendente(aluno_id: str, personal_id: str, valor: float,
                              recorrencia: str, vencimento: date,
                              dias_antecedencia: int) -> Optional[str]:
    ano_mes = vencimento.strftime("%Y-%m")
    # Idempotência: não cria se já existe cobrança para este período
    existing = repo.query_pk_last_n(keys.pk_aluno(aluno_id), f"COBRANCA#{ano_mes}#", 1)
    if existing:
        return None
    cid = new_id()
    sk = keys.sk_cobranca(ano_mes, cid)
    now = now_iso()
    item = {
        "cobranca_id": cid, "aluno_id": aluno_id, "personal_id": personal_id,
        "valor": valor, "recorrencia": recorrencia,
        "vencimento": vencimento.isoformat(), "status": "PENDENTE",
        "notas": None, "origem": "AUTO",
        "forma_pagamento": None, "data_pagamento": None,
        "mp_payment_id": None, "mp_valor_liquido": None, "mp_taxa": None,
        "criado_em": now, "atualizado_em": now,
    }
    repo.put_item(keys.pk_aluno(aluno_id), sk, item)
    repo.put_item(keys.pk_aluno(aluno_id), keys.sk_cobranca_idx(cid),
                  {"cobranca_id": cid, "sk": sk, "personal_id": personal_id})
    _agendar_vencer(aluno_id, cid, personal_id, vencimento)
    aluno = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE) or {}
    aluno_nome = aluno.get("nome", "Aluno")
    venc_fmt = vencimento.strftime("%d/%m/%Y")
    notif_service.criar(personal_id, "COBRANCA_VENCER",
        f"Cobrança criada — {aluno_nome}",
        f"Mensalidade de R$ {valor:.2f} com vencimento em {venc_fmt}.",
        aluno_id=aluno_id)
    anotif_service.criar(aluno_id, "COBRANCA_VENCER",
        "Nova cobrança",
        f"Mensalidade de R$ {valor:.2f} vence em {venc_fmt}.")
    return cid


def _agendar_vencer(aluno_id: str, cobranca_id: str, personal_id: str, vencimento: date) -> None:
    repo.put_item(
        keys.pk_sched(vencimento.isoformat()),
        keys.sk_sched_billing_vencer(aluno_id, cobranca_id),
        {
            "aluno_id": aluno_id, "cobranca_id": cobranca_id,
            "personal_id": personal_id, "vencimento": vencimento.isoformat(),
            "ttl": int(time.time()) + _SCHED_TTL_S,
        },
    )


def _agendar_proxima_geracao(aluno_id: str, personal_id: str, dia: int,
                              recorrencia: str, dias_antecedencia: int,
                              ultimo_vencimento: date) -> None:
    proximo_vencimento = _proximo_periodo(dia, recorrencia, ultimo_vencimento)
    data_criacao = proximo_vencimento - timedelta(days=dias_antecedencia)
    if data_criacao <= date.today():
        data_criacao = date.today()
    repo.put_item(
        keys.pk_sched(data_criacao.isoformat()),
        keys.sk_sched_billing_gerar(aluno_id),
        {
            "aluno_id": aluno_id, "personal_id": personal_id,
            "vencimento": proximo_vencimento.isoformat(),
            "ttl": int(time.time()) + _SCHED_TTL_S,
        },
    )


def _fim_do_mes(year: int, month: int) -> date:
    return date(year, month, monthrange(year, month)[1])


def _proxima_data_vencimento(dia: int, recorrencia: str, a_partir: date) -> date:
    """Retorna a próxima data de vencimento >= a_partir."""
    if recorrencia == "MENSAL":
        ultimo_dia = monthrange(a_partir.year, a_partir.month)[1]
        candidata = a_partir.replace(day=min(dia, ultimo_dia))
        if candidata >= a_partir:
            return candidata
        # Próximo mês
        if a_partir.month == 12:
            proximo = date(a_partir.year + 1, 1, 1)
        else:
            proximo = date(a_partir.year, a_partir.month + 1, 1)
        ultimo_dia = monthrange(proximo.year, proximo.month)[1]
        return proximo.replace(day=min(dia, ultimo_dia))
    else:  # ANUAL
        try:
            candidata = a_partir.replace(day=dia)
        except ValueError:
            candidata = _fim_do_mes(a_partir.year, a_partir.month)
        if candidata >= a_partir:
            return candidata
        return candidata.replace(year=candidata.year + 1)


def _proximo_periodo(dia: int, recorrencia: str, ultimo_vencimento: date) -> date:
    """Retorna o próximo vencimento APÓS ultimo_vencimento."""
    if recorrencia == "MENSAL":
        if ultimo_vencimento.month == 12:
            proximo = date(ultimo_vencimento.year + 1, 1, 1)
        else:
            proximo = date(ultimo_vencimento.year, ultimo_vencimento.month + 1, 1)
        ultimo_dia = monthrange(proximo.year, proximo.month)[1]
        return proximo.replace(day=min(dia, ultimo_dia))
    else:  # ANUAL
        try:
            return ultimo_vencimento.replace(year=ultimo_vencimento.year + 1)
        except ValueError:
            return _fim_do_mes(ultimo_vencimento.year + 1, ultimo_vencimento.month)
