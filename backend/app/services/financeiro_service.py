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

# Lembretes de cobrança vencida: dias após o vencimento em que o aluno é relembrado.
# Agendados só quando a cobrança de fato vence (a maioria paga em dia — sem entrada extra).
_LEMBRETES_POS_VENCIMENTO = (5, 10)
_LEMBRETE_ESCALA_PERSONAL = 10   # a partir deste atraso, o personal também é notificado


# ── Agregados do painel financeiro (ADD atômico na partição PT#) ──────────────
# Mantidos de forma incremental em cada transição de cobrança, no mesmo espírito do
# STATS#ALUNOS do dashboard: o painel/dashboard leem O(1), sem fan-out por aluno.
#   STATS#FINOPEN  → snapshot de recebíveis em aberto (pendente/vencido)
#   STATS#FINM#YM  → recebido no mês YM (regime de caixa, por data_pagamento)

def _bump_open(personal_id: str, add: dict) -> None:
    repo.add_and_set(keys.pk_personal(personal_id), keys.SK_STATS_FIN_OPEN, add=add)


def _bump_mes(personal_id: str, ano_mes: str, add: dict) -> None:
    repo.add_and_set(keys.pk_personal(personal_id), keys.sk_stats_fin_mes(ano_mes), add=add)


def _remover_de_aberto(personal_id: str, status: str, valor: float) -> None:
    """Estorna uma cobrança do snapshot de recebíveis, no balde certo (pendente vs vencido)."""
    if status == "VENCIDA":
        _bump_open(personal_id, {"vencido_valor": -valor, "vencido_count": -1})
    else:  # PENDENTE (ou qualquer estado não-pago)
        _bump_open(personal_id, {"pendente_valor": -valor, "pendente_count": -1})


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
        "mes_vencimento": body.get("mes_vencimento"),
        "ativo": body.get("ativo", True),
        "dias_antecedencia": body.get("dias_antecedencia", 15),
        "criado_em": criado_em,
        "atualizado_em": now,
    }
    repo.put_item(keys.pk_aluno(aluno_id), keys.SK_COBRANCA_CFG, cfg)
    repo.put_item(keys.pk_personal(personal_id), keys.sk_cobranca_aluno(aluno_id), {
        "aluno_id": aluno_id, "ativo": cfg["ativo"], "valor": cfg["valor"],
        "recorrencia": cfg["recorrencia"], "atualizado_em": now,
    })
    if cfg["ativo"]:
        hoje = date.today()
        mes = cfg.get("mes_vencimento")
        vencimento = _proxima_data_vencimento(cfg["dia_vencimento"], cfg["recorrencia"], hoje, mes)
        # Cria cobrança imediatamente se não existir para este período
        _criar_cobranca_pendente(aluno_id, personal_id, cfg["valor"],
                                  cfg["recorrencia"], vencimento, cfg["dias_antecedencia"])
        # Agenda próxima geração após este período
        _agendar_proxima_geracao(aluno_id, personal_id, cfg["dia_vencimento"],
                                  cfg["recorrencia"], cfg["dias_antecedencia"], vencimento, mes)
    return cfg


# ── Listagem de cobranças ─────────────────────────────────────────────────────

def listar_cobrancas(personal_id: str, aluno_id: str,
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


# ── Painel financeiro do personal (visão de carteira) ─────────────────────────

def _ym_offset(d: date, meses_atras: int) -> str:
    y, m = d.year, d.month - meses_atras
    while m <= 0:
        m += 12
        y -= 1
    return f"{y:04d}-{m:02d}"


def _iter_ponteiros_alunos(personal_id: str) -> list[dict]:
    """Ponteiros ALUNO# na partição PT# — carregam aluno_id/nome, sem GetItem de perfil."""
    return repo.query_pk(keys.pk_personal(personal_id), sk_prefix=keys.sk_aluno_pointer(""))


def _cobrancas_do_aluno(aluno_id: str) -> list[dict]:
    # begins_with("COBRANCA#") pega só cobranças reais (CONFIG/IDX usam underscore).
    return repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.COBRANCA_PREFIX)


def mrr(personal_id: str) -> float:
    """Receita recorrente mensal — soma das mensalidades ativas (ANUAL vira /12).
    1 query na partição-ponteiro PT#/COBRANCA_ALUNO#, sem fan-out por aluno."""
    total = 0.0
    for p in repo.query_pk(keys.pk_personal(personal_id), sk_prefix=keys.COBRANCA_ALUNO_PREFIX):
        if not p.get("ativo"):
            continue
        valor = float(p.get("valor", 0) or 0)
        total += valor / 12 if p.get("recorrencia") == "ANUAL" else valor
    return round(total, 2)


_STATS_FIN_VER = 2   # bump se o esquema do agregado mudar (força re-backfill)
                     # v2: passa a contar mp_pix_count / mp_taxa_count (certeza da taxa)


def _backfill_stats(personal_id: str) -> dict:
    """Recalcula os agregados por fan-out (1x, quando o snapshot não existe/está desatualizado
    — personal legado ou migração). Persiste STATS#FINOPEN (com marcador de versão) e
    STATS#FINM#YM. Mesma ideia do lazy-init de STATS#ALUNOS no dashboard."""
    aberto = {"pendente_valor": 0.0, "pendente_count": 0, "vencido_valor": 0.0,
              "vencido_count": 0, "v": _STATS_FIN_VER}
    por_mes: dict[str, dict] = {}
    for ptr in _iter_ponteiros_alunos(personal_id):
        aluno_id = ptr.get("aluno_id")
        if not aluno_id:
            continue
        for c in _cobrancas_do_aluno(aluno_id):
            if c.get("personal_id") != personal_id:
                continue
            status = c.get("status")
            valor = float(c.get("valor", 0) or 0)
            if status == "PENDENTE":
                aberto["pendente_valor"] += valor
                aberto["pendente_count"] += 1
            elif status == "VENCIDA":
                aberto["vencido_valor"] += valor
                aberto["vencido_count"] += 1
            elif status == "PAGA" and c.get("data_pagamento"):
                ym = str(c["data_pagamento"])[:7]
                m = por_mes.setdefault(ym, {"recebido_valor": 0.0, "pago_count": 0,
                                            "mp_taxa": 0.0, "mp_pix_count": 0, "mp_taxa_count": 0})
                m["recebido_valor"] += valor
                m["pago_count"] += 1
                if c.get("forma_pagamento") == "PIX_MP":
                    m["mp_pix_count"] += 1
                    # Taxa só conta quando conhecida e > 0. Pix legado (bug de leitura)
                    # gravou mp_taxa=0, indistinguível de taxa real zero — tratamos como
                    # desconhecida, deixando o mês "incerto" (mostra aviso, não número).
                    if c.get("mp_taxa"):
                        m["mp_taxa"] += float(c["mp_taxa"])
                        m["mp_taxa_count"] += 1
    repo.put_item(keys.pk_personal(personal_id), keys.SK_STATS_FIN_OPEN, aberto)
    for ym, m in por_mes.items():
        repo.put_item(keys.pk_personal(personal_id), keys.sk_stats_fin_mes(ym), m)
    return aberto


def _ensure_aberto(personal_id: str) -> dict:
    """Snapshot de recebíveis pronto para leitura O(1). Faz backfill 1x se o item não existe
    ou está parcial (um bump incremental pode tê-lo criado sem o marcador de versão) — evita
    servir números incompletos de um personal legado."""
    aberto = repo.get_item(keys.pk_personal(personal_id), keys.SK_STATS_FIN_OPEN)
    if aberto is None or aberto.get("v") != _STATS_FIN_VER:
        aberto = _backfill_stats(personal_id)
    return aberto


def dashboard_bloco(personal_id: str) -> dict:
    """Bloco financeiro do dashboard (bounded): snapshot O(1) + recebido do mês + MRR.
    Faz backfill 1x na primeira leitura, igual ao lazy-init de STATS#ALUNOS."""
    aberto = _ensure_aberto(personal_id)
    mes_item = repo.get_item(keys.pk_personal(personal_id),
                             keys.sk_stats_fin_mes(date.today().strftime("%Y-%m"))) or {}
    return {
        "recebido_valor": float(mes_item.get("recebido_valor", 0) or 0),
        "a_receber_valor": float(aberto.get("pendente_valor", 0) or 0),
        "vencido_valor": float(aberto.get("vencido_valor", 0) or 0),
        "vencido_count": int(aberto.get("vencido_count", 0) or 0),
        "mrr": mrr(personal_id),
    }


def resumo(personal_id: str, mes: str | None = None) -> dict:
    """KPIs do painel — leitura O(1) dos agregados (com backfill preguiçoso)."""
    from app.services import mp_service   # import tardio — evita ciclo
    hoje = date.today()
    mes = mes or hoje.strftime("%Y-%m")

    aberto = _ensure_aberto(personal_id)
    mes_item = repo.get_item(keys.pk_personal(personal_id), keys.sk_stats_fin_mes(mes)) or {}

    hist_raw = repo.query_pk(keys.pk_personal(personal_id), sk_prefix=keys.STATS_FIN_MES_PREFIX)
    hist_map = {it["SK"].rsplit("#", 1)[-1]: float(it.get("recebido_valor", 0) or 0) for it in hist_raw}
    historico = [{"mes": (ym := _ym_offset(hoje, i)), "recebido": hist_map.get(ym, 0.0)}
                 for i in range(11, -1, -1)]

    recebido = float(mes_item.get("recebido_valor", 0) or 0)
    taxa = float(mes_item.get("mp_taxa", 0) or 0)
    mp_conf = mp_service.is_configured(personal_id)
    mp_pix_count = int(mes_item.get("mp_pix_count", 0) or 0)
    mp_taxa_count = int(mes_item.get("mp_taxa_count", 0) or 0)
    # Só afirmamos líquido/taxa com CERTEZA: todo Pix do mês trouxe a taxa real do MP.
    # Se algum ficou sem taxa conhecida (pagamento legado, ou MP ainda não informou),
    # devolvemos None — o painel mostra apenas o aviso sobre as taxas, sem inventar
    # um número que faria o personal achar que recebeu o valor bruto cheio.
    mp_certo = mp_conf and mp_pix_count > 0 and mp_pix_count == mp_taxa_count
    return {
        "mes": mes,
        "recebido_valor": recebido,
        "pago_count": int(mes_item.get("pago_count", 0) or 0),
        "a_receber_valor": float(aberto.get("pendente_valor", 0) or 0),
        "pendente_count": int(aberto.get("pendente_count", 0) or 0),
        "vencido_valor": float(aberto.get("vencido_valor", 0) or 0),
        "vencido_count": int(aberto.get("vencido_count", 0) or 0),
        "mrr": mrr(personal_id),
        "mp_configurado": mp_conf,
        # Líquido = recebido - taxas MP (pagamentos manuais não têm taxa, entram cheios).
        "mp_liquido": round(recebido - taxa, 2) if mp_certo else None,
        "mp_taxa": round(taxa, 2) if mp_certo else None,
        "historico": historico,
    }


def listar_recebiveis(personal_id: str, status: str | None = None, limit: int = 200) -> list[dict]:
    """Cobranças em aberto (pendentes/vencidas) de toda a carteira, com nome do aluno,
    ordenadas por vencimento (mais atrasadas primeiro). Fan-out bounded — página aberta
    deliberadamente, não no caminho do dashboard."""
    alvo = {status} if status else {"PENDENTE", "VENCIDA"}
    out: list[dict] = []
    for ptr in _iter_ponteiros_alunos(personal_id):
        aluno_id, nome = ptr.get("aluno_id"), ptr.get("nome", "Aluno")
        if not aluno_id:
            continue
        for c in _cobrancas_do_aluno(aluno_id):
            if c.get("personal_id") != personal_id or c.get("status") not in alvo:
                continue
            cc = repo.clean(c)
            cc["ref"] = c["SK"]
            cc["aluno_nome"] = nome
            out.append(cc)
    out.sort(key=lambda x: x.get("vencimento") or "")
    return out[:limit]


def listar_pagamentos_recentes(personal_id: str, limit: int = 20) -> list[dict]:
    """Últimos pagamentos confirmados da carteira (aluno, valor, data, forma). Fan-out bounded."""
    out: list[dict] = []
    for ptr in _iter_ponteiros_alunos(personal_id):
        aluno_id, nome = ptr.get("aluno_id"), ptr.get("nome", "Aluno")
        if not aluno_id:
            continue
        for c in repo.query_pk_last_n(keys.pk_aluno(aluno_id), keys.COBRANCA_PREFIX, 12):
            if c.get("personal_id") != personal_id:
                continue
            if c.get("status") == "PAGA" and c.get("data_pagamento"):
                cc = repo.clean(c)
                cc["aluno_nome"] = nome
                out.append(cc)
    out.sort(key=lambda x: x.get("data_pagamento") or "", reverse=True)
    return out[:limit]


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
    _bump_open(personal_id, {"pendente_valor": float(body["valor"]), "pendente_count": 1})
    # Agenda transição para VENCIDA no dia do vencimento
    _agendar_vencer(aluno_id, cid, personal_id, vencimento)
    item["ref"] = sk
    return item


# ── Registrar pagamento (manual) ──────────────────────────────────────────────

def registrar_pagamento(personal_id: str, aluno_id: str, cobranca_id: str, body: dict) -> dict | None:
    """Marca uma cobrança como PAGA. Caminho único para pagamento manual e via PIX/MP
    (o webhook do Mercado Pago também chama aqui, passando mp_valor_liquido/mp_taxa)."""
    sk = _lookup_sk(aluno_id, cobranca_id)
    if not sk:
        return None
    atual = repo.get_item(keys.pk_aluno(aluno_id), sk)
    if not atual or atual.get("personal_id") != personal_id:
        return None
    ja_paga = atual.get("status") == "PAGA"
    fields = {
        "status": "PAGA",
        "forma_pagamento": body.get("forma_pagamento", "MANUAL"),
        "origem": "MANUAL",
        "data_pagamento": body["data_pagamento"],
        "notas": body.get("notas"),
        "atualizado_em": now_iso(),
    }
    mp_liquido = body.get("mp_valor_liquido")
    mp_taxa = body.get("mp_taxa")
    if mp_liquido is not None:
        fields["mp_valor_liquido"] = mp_liquido
    if mp_taxa is not None:
        fields["mp_taxa"] = mp_taxa
    updated = repo.update_item_if_exists(keys.pk_aluno(aluno_id), sk, fields)
    if updated and not ja_paga:
        valor = float(atual.get("valor", 0))
        _remover_de_aberto(personal_id, atual.get("status"), valor)
        add = {"recebido_valor": valor, "pago_count": 1}
        # Só Pix via MP entra na conta de certeza da taxa. mp_pix_count = todos os Pix
        # do mês; mp_taxa_count = os que trouxeram taxa real. Iguais ⇒ mês "certo".
        if body.get("forma_pagamento") == "PIX_MP":
            add["mp_pix_count"] = 1
            if mp_taxa is not None:
                add["mp_taxa"] = float(mp_taxa)
                add["mp_taxa_count"] = 1
        _bump_mes(personal_id, str(body["data_pagamento"])[:7], add)
        aluno = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE) or {}
        notif_service.criar(personal_id, "COBRANCA_PAGA",
            f"Pagamento registrado — {aluno.get('nome', 'Aluno')}",
            f"Cobrança de {aluno.get('nome', 'Aluno')} marcada como paga.",
            aluno_id=aluno_id)
    if updated:
        updated = repo.clean(updated)
        updated["ref"] = sk
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
    _remover_de_aberto(personal_id, item.get("status"), float(item.get("valor", 0)))
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
    mes_vencimento = cfg.get("mes_vencimento")
    _agendar_proxima_geracao(aluno_id, personal_id, dia_vencimento, recorrencia, dias_antecedencia, vencimento, mes_vencimento)


def _marcar_vencida(aluno_id: str, cobranca_id: str, vencimento_str: str, personal_id: str) -> None:
    """Chamado pelo scheduler ao disparar BILLING_VENCER#."""
    ano_mes = vencimento_str[:7]
    sk = keys.sk_cobranca(ano_mes, cobranca_id)
    item = repo.get_item(keys.pk_aluno(aluno_id), sk)
    if not item or item.get("status") != "PENDENTE":
        return  # já paga ou inexistente
    repo.update_item_if_exists(keys.pk_aluno(aluno_id), sk,
                                {"status": "VENCIDA", "atualizado_em": now_iso()})
    valor = float(item.get("valor", 0))
    _bump_open(personal_id, {
        "pendente_valor": -valor, "pendente_count": -1,
        "vencido_valor": valor, "vencido_count": 1,
    })
    aluno = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE) or {}
    venc_fmt = date.fromisoformat(vencimento_str).strftime("%d/%m/%Y")
    notif_service.criar(personal_id, "COBRANCA_VENCIDA",
        f"Cobrança vencida — {aluno.get('nome', 'Aluno')}",
        f"Cobrança de R$ {valor:.2f} venceu em {venc_fmt} sem pagamento.",
        aluno_id=aluno_id)
    anotif_service.criar(aluno_id, "COBRANCA_VENCIDA",
        "Mensalidade vencida",
        f"Sua mensalidade de R$ {valor:.2f} venceu em {venc_fmt}. Fale com seu personal.")
    _agendar_lembretes_vencida(aluno_id, cobranca_id, personal_id,
                               date.fromisoformat(vencimento_str))


def _lembrar_vencida(aluno_id: str, cobranca_id: str, personal_id: str, dias: int) -> None:
    """Chamado pelo scheduler ao disparar BILLING_LEMBRETE# (D+5 e D+10 do vencimento).
    Só notifica se a cobrança ainda está VENCIDA — paga/cancelada nesse meio-tempo, silencia."""
    sk = _lookup_sk(aluno_id, cobranca_id)
    if not sk:
        return  # cobrança cancelada (idx removido)
    item = repo.get_item(keys.pk_aluno(aluno_id), sk)
    if not item or item.get("status") != "VENCIDA" or item.get("personal_id") != personal_id:
        return
    valor = float(item.get("valor", 0))
    vencimento = date.fromisoformat(item["vencimento"])
    venc_fmt = vencimento.strftime("%d/%m/%Y")
    # Atraso real (o scheduler pode processar a entrada com dias de folga)
    atraso = max((date.today() - vencimento).days, dias)
    anotif_service.criar(aluno_id, "COBRANCA_VENCIDA",
        "Mensalidade em atraso",
        f"Sua mensalidade de R$ {valor:.2f} está vencida há {atraso} dias "
        f"(venceu em {venc_fmt}). Fale com seu personal para regularizar.")
    if dias >= _LEMBRETE_ESCALA_PERSONAL:
        aluno = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE) or {}
        notif_service.criar(personal_id, "COBRANCA_VENCIDA",
            f"Cobrança em atraso há {atraso} dias — {aluno.get('nome', 'Aluno')}",
            f"Cobrança de R$ {valor:.2f} vencida desde {venc_fmt} sem pagamento.",
            aluno_id=aluno_id)


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
    _bump_open(personal_id, {"pendente_valor": float(valor), "pendente_count": 1})
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


def _agendar_lembretes_vencida(aluno_id: str, cobranca_id: str, personal_id: str,
                                vencimento: date) -> None:
    """Agenda os lembretes pós-vencimento (D+5 e D+10). Datas já passadas não são
    problema: o handler do scheduler varre uma janela de 30 dias para trás."""
    for dias in _LEMBRETES_POS_VENCIMENTO:
        data = vencimento + timedelta(days=dias)
        repo.put_item(
            keys.pk_sched(data.isoformat()),
            keys.sk_sched_billing_lembrete(aluno_id, cobranca_id),
            {
                "aluno_id": aluno_id, "cobranca_id": cobranca_id,
                "personal_id": personal_id, "vencimento": vencimento.isoformat(),
                "dias": dias,
                "ttl": int(time.time()) + _SCHED_TTL_S,
            },
        )


def _agendar_proxima_geracao(aluno_id: str, personal_id: str, dia: int,
                              recorrencia: str, dias_antecedencia: int,
                              ultimo_vencimento: date,
                              mes: Optional[int] = None) -> None:
    proximo_vencimento = _proximo_periodo(dia, recorrencia, ultimo_vencimento, mes)
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


def _proxima_data_vencimento(dia: int, recorrencia: str, a_partir: date,
                              mes: Optional[int] = None) -> date:
    """Retorna a próxima data de vencimento >= a_partir."""
    if recorrencia == "MENSAL":
        ultimo_dia = monthrange(a_partir.year, a_partir.month)[1]
        candidata = a_partir.replace(day=min(dia, ultimo_dia))
        if candidata >= a_partir:
            return candidata
        if a_partir.month == 12:
            proximo = date(a_partir.year + 1, 1, 1)
        else:
            proximo = date(a_partir.year, a_partir.month + 1, 1)
        ultimo_dia = monthrange(proximo.year, proximo.month)[1]
        return proximo.replace(day=min(dia, ultimo_dia))
    else:  # ANUAL
        m = mes or a_partir.month
        ultimo_dia = monthrange(a_partir.year, m)[1]
        try:
            candidata = date(a_partir.year, m, min(dia, ultimo_dia))
        except ValueError:
            candidata = _fim_do_mes(a_partir.year, m)
        if candidata >= a_partir:
            return candidata
        try:
            return date(a_partir.year + 1, m, min(dia, monthrange(a_partir.year + 1, m)[1]))
        except ValueError:
            return _fim_do_mes(a_partir.year + 1, m)


def _proximo_periodo(dia: int, recorrencia: str, ultimo_vencimento: date,
                     mes: Optional[int] = None) -> date:
    """Retorna o próximo vencimento APÓS ultimo_vencimento."""
    if recorrencia == "MENSAL":
        if ultimo_vencimento.month == 12:
            proximo = date(ultimo_vencimento.year + 1, 1, 1)
        else:
            proximo = date(ultimo_vencimento.year, ultimo_vencimento.month + 1, 1)
        ultimo_dia = monthrange(proximo.year, proximo.month)[1]
        return proximo.replace(day=min(dia, ultimo_dia))
    else:  # ANUAL
        m = mes or ultimo_vencimento.month
        proximo_ano = ultimo_vencimento.year + 1
        try:
            return date(proximo_ano, m, min(dia, monthrange(proximo_ano, m)[1]))
        except ValueError:
            return _fim_do_mes(proximo_ano, m)
