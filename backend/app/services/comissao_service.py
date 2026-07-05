"""Programa de divulgadores — comissão em dinheiro sobre o Gestão Pro.

NÃO confundir com a indicação entre personais (`cupom_service.processar_recompensa_indicador`,
recompensa em dias). Aqui o dono do cupom é um DIVULGADOR (conta CoachPilot comum marcada
pelo admin) que recebe % recorrente sobre os pagamentos PIX dos clientes que indicou.

Regras (estrategia/PROGRAMA_DIVULGADORES_REGRAS.md, v3):
- Faixa base pela carteira de assinantes ativos: 1–4 → 20% · 5–14 → 25% · 15+ → 30%.
- Embaixador (flag no perfil, por convite): base 30%.
- Acelerador: mês com 2+ vendas novas → +5 p.p. no mês inteiro (teto: Inicial 25,
  Oficial 30, Embaixador 35; Master permanece 30).
- Bônus de alta performance: mês com 4+ vendas novas → +R$100 (qualquer faixa).
- Comissão incide só sobre pagamentos PIX reais do plano (valor preenchido); concessões
  ADMIN/PROMO/INDICACAO não comissionam.

Modelo: agregados por mês (`STATS#COMISSAO#{YYYY-MM}`, molde do STATS#FINM# do
financeiro) alimentados no webhook de pagamento; o % é derivado NA LEITURA a partir dos
agregados — assim o acelerador vale retroativamente para o mês inteiro sem reprocessar.
"""
import logging
from datetime import date

from botocore.exceptions import ClientError
from fastapi import HTTPException

from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.utils import now_iso

logger = logging.getLogger(__name__)

# Percentuais/limiares — espelham PROGRAMA_DIVULGADORES_REGRAS.md §2 (fácil reajuste).
FAIXAS = [  # (min_assinantes_ativos, nome, pct_base, pct_teto)
    (15, "MASTER", 0.30, 0.30),
    (5, "OFICIAL", 0.25, 0.30),
    (0, "INICIAL", 0.20, 0.25),
]
EMBAIXADOR = ("EMBAIXADOR", 0.30, 0.35)
ACELERADOR_PP = 0.05
ACELERADOR_MIN_VENDAS = 2
BONUS_ALTA_PERFORMANCE = 100.0
BONUS_MIN_VENDAS = 4
_HISTORICO_MESES = 6


def _faixa(assinantes_ativos: int, embaixador: bool) -> tuple[str, float, float]:
    if embaixador:
        return EMBAIXADOR
    for minimo, nome, base, teto in FAIXAS:
        if assinantes_ativos >= minimo:
            return (nome, base, teto)
    return ("INICIAL", 0.20, 0.25)


def _pct_mes(assinantes_ativos: int, vendas_novas: int, embaixador: bool) -> tuple[str, float]:
    nome, base, teto = _faixa(assinantes_ativos, embaixador)
    pct = base + (ACELERADOR_PP if vendas_novas >= ACELERADOR_MIN_VENDAS else 0.0)
    return nome, min(pct, teto)


def _ym_offset(d: date, meses_atras: int) -> str:
    y, m = d.year, d.month - meses_atras
    while m <= 0:
        m += 12
        y -= 1
    return f"{y:04d}-{m:02d}"


# ── Perfil ────────────────────────────────────────────────────────────────────

def get_perfil(divulgador_id: str) -> dict | None:
    item = repo.get_item(keys.pk_personal(divulgador_id), keys.SK_DIVULGADOR)
    return repo.clean(item) if item else None


def registrar_divulgador(
    divulgador_id: str, *, nome: str, email: str, codigo: str,
    embaixador: bool = False, fundador: bool = False, pix_key: str | None = None,
) -> dict:
    """Marca uma conta CoachPilot como divulgador (admin). O cupom já deve existir
    (cupom_service.criar_cupom_divulgador). Idempotente por put_if_absent."""
    now = now_iso()
    perfil = {
        "cupom_codigo": codigo, "embaixador": embaixador, "fundador": fundador,
        "pix_key": pix_key, "ativo": True, "criado_em": now,
    }
    if not repo.put_item_if_absent(keys.pk_personal(divulgador_id), keys.SK_DIVULGADOR, perfil):
        raise HTTPException(409, {"code": "DIVULGADOR_JA_CADASTRADO"})
    repo.put_item(
        keys.PK_DIVULGADOR_REGISTRY, keys.sk_div_registry(divulgador_id),
        {"divulgador_id": divulgador_id, "nome": nome, "email": email,
         "codigo": codigo, "criado_em": now},
    )
    return perfil


def atualizar_divulgador(divulgador_id: str, fields: dict) -> dict:
    permitidos = {k: v for k, v in fields.items() if k in ("ativo", "embaixador", "fundador", "pix_key")}
    if not permitidos:
        raise HTTPException(400, {"code": "NADA_PARA_ATUALIZAR"})
    if not get_perfil(divulgador_id):
        raise HTTPException(404, {"code": "DIVULGADOR_NAO_ENCONTRADO"})
    updated = repo.update_item(keys.pk_personal(divulgador_id), keys.SK_DIVULGADOR, permitidos, return_values=True)
    return repo.clean(updated)


# ── Escrita (hooks do fluxo de cupom/pagamento) ───────────────────────────────

def registrar_conta(divulgador_id: str, indicado_id: str) -> None:
    """Chamado no resgate do cupom de divulgador: cria o ledger DIVCLIENTE# (PENDENTE)
    e conta a conta criada. O vínculo reverso (divulgador_id na ASSINATURA do indicado)
    é gravado pelo cupom_service no mesmo fluxo."""
    perfil_indicado = repo.get_item(keys.pk_personal(indicado_id), keys.SK_PROFILE) or {}
    if repo.put_item_if_absent(
        keys.pk_personal(divulgador_id), keys.sk_div_cliente(indicado_id),
        {"personal_id": indicado_id, "nome_snapshot": perfil_indicado.get("name") or "",
         "status": "PENDENTE", "primeiro_pgto_em": None, "valida_ate": None,
         "criado_em": now_iso()},
    ):
        repo.increment_counter(keys.pk_personal(divulgador_id), keys.SK_STATS_DIVGERAL, "contas_total", 1)


def registrar_pagamento(indicado_id: str, assinatura: dict, valor: float | None, payment_id: str | None) -> None:
    """Chamado após um Pix aprovado de assinatura (webhook). Se o pagante veio de um
    cupom de divulgador, acumula a base de comissão do mês. Best-effort: nunca pode
    derrubar o webhook. Idempotência dada pelo MP_LOCK_ASSINATURA# do chamador."""
    divulgador_id = (assinatura or {}).get("divulgador_id")
    if not divulgador_id or not valor:
        return
    pk = keys.pk_personal(divulgador_id)
    ym = date.today().strftime("%Y-%m")

    # 1º pagamento deste indicado? Flip condicional PENDENTE→ASSINANTE = venda nova.
    venda_nova = False
    try:
        from app.repositories.dynamo_repo import _get_table
        _get_table().update_item(
            Key={"PK": pk, "SK": keys.sk_div_cliente(indicado_id)},
            UpdateExpression="SET #s = :a, primeiro_pgto_em = :ts",
            ConditionExpression="#s = :p",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":a": "ASSINANTE", ":p": "PENDENTE", ":ts": now_iso()},
        )
        venda_nova = True
    except ClientError as e:
        if e.response["Error"]["Code"] != "ConditionalCheckFailedException":
            raise

    if venda_nova:
        repo.increment_counter(pk, keys.SK_STATS_DIVGERAL, "assinantes_total", 1)

    # Espelho da validade no ledger — permite contar "assinantes ativos" com 1 query.
    repo.update_item(pk, keys.sk_div_cliente(indicado_id), {"valida_ate": assinatura.get("valida_ate")})

    geral = repo.get_item(pk, keys.SK_STATS_DIVGERAL) or {}
    add = {"base_valor": valor, "pagamentos_count": 1}
    if venda_nova:
        add["vendas_novas_count"] = 1
    repo.add_and_set(
        pk, keys.sk_stats_comissao_mes(ym),
        add=add, set_={"assinantes_snapshot": int(geral.get("assinantes_total", 0) or 0)},
    )
    logger.info("Comissão registrada: divulgador=%s indicado=%s valor=%s venda_nova=%s payment=%s",
                divulgador_id, indicado_id, valor, venda_nova, payment_id)


# ── Leitura (painel) ──────────────────────────────────────────────────────────

def _clientes(divulgador_id: str) -> list[dict]:
    items = repo.query_pk(keys.pk_personal(divulgador_id), sk_prefix=keys.DIVCLIENTE_PREFIX)
    return [repo.clean(it) for it in items]


def _montar_mes(ym: str, item: dict, assinantes_para_faixa: int, embaixador: bool) -> dict:
    vendas = int(item.get("vendas_novas_count", 0) or 0)
    base_valor = float(item.get("base_valor", 0) or 0)
    faixa, pct = _pct_mes(assinantes_para_faixa, vendas, embaixador)
    bonus = BONUS_ALTA_PERFORMANCE if vendas >= BONUS_MIN_VENDAS else 0.0
    comissao = round(base_valor * pct + bonus, 2)
    return {
        "mes": ym,
        "base_valor": round(base_valor, 2),
        "pagamentos_count": int(item.get("pagamentos_count", 0) or 0),
        "vendas_novas": vendas,
        "faixa": faixa,
        "pct": pct,
        "bonus": bonus,
        "comissao_valor": comissao,
        "repasse_status": item.get("repasse_status") or ("PENDENTE" if comissao > 0 else None),
        "repasse_valor": float(item["repasse_valor"]) if item.get("repasse_valor") is not None else None,
        "repasse_em": item.get("repasse_em"),
    }


def painel(divulgador_id: str) -> dict:
    """Visão completa do divulgador: perfil, faixa/% vigente, mês corrente + últimos
    meses, carteira e saldo a receber. Leitura: 2 GetItem + 2 Query (carteira pequena)."""
    perfil = get_perfil(divulgador_id)
    if not perfil or not perfil.get("ativo", True):
        raise HTTPException(404, {"code": "DIVULGADOR_NAO_CADASTRADO"})

    hoje = date.today()
    ym_atual = hoje.strftime("%Y-%m")
    embaixador = bool(perfil.get("embaixador"))

    geral = repo.get_item(keys.pk_personal(divulgador_id), keys.SK_STATS_DIVGERAL) or {}
    clientes = _clientes(divulgador_id)
    hoje_iso = hoje.isoformat()
    assinantes_ativos = sum(1 for c in clientes if (c.get("valida_ate") or "") >= hoje_iso)

    hist_raw = repo.query_pk(keys.pk_personal(divulgador_id), sk_prefix=keys.STATS_COMISSAO_PREFIX)
    hist_map = {it["SK"].rsplit("#", 1)[-1]: it for it in hist_raw}

    meses = []
    for i in range(_HISTORICO_MESES - 1, -1, -1):
        ym = _ym_offset(hoje, i)
        item = hist_map.get(ym, {})
        # Mês corrente usa a carteira ativa AO VIVO; meses fechados usam o snapshot da época.
        assinantes = assinantes_ativos if ym == ym_atual else int(item.get("assinantes_snapshot", 0) or 0)
        meses.append(_montar_mes(ym, item, assinantes, embaixador))

    mes_atual = meses[-1]
    a_receber = round(sum(
        m["comissao_valor"] for m in meses
        if m["mes"] != ym_atual and m["comissao_valor"] > 0 and m["repasse_status"] != "PAGO"
    ), 2)
    faixa_nome, pct_base, _ = _faixa(assinantes_ativos, embaixador)

    return {
        "cupom_codigo": perfil.get("cupom_codigo"),
        "embaixador": embaixador,
        "fundador": bool(perfil.get("fundador")),
        "pix_key": perfil.get("pix_key"),
        "faixa": faixa_nome,
        "pct_base": pct_base,
        "assinantes_ativos": assinantes_ativos,
        "contas_total": int(geral.get("contas_total", 0) or 0),
        "assinantes_total": int(geral.get("assinantes_total", 0) or 0),
        "mes_atual": mes_atual,
        "acelerador": {
            "vendas_no_mes": mes_atual["vendas_novas"],
            "vendas_para_ativar": max(0, ACELERADOR_MIN_VENDAS - mes_atual["vendas_novas"]),
            "ativo": mes_atual["vendas_novas"] >= ACELERADOR_MIN_VENDAS,
        },
        "a_receber": a_receber,
        "meses": meses,
    }


def listar_clientes(divulgador_id: str) -> list[dict]:
    if not get_perfil(divulgador_id):
        raise HTTPException(404, {"code": "DIVULGADOR_NAO_CADASTRADO"})
    hoje_iso = date.today().isoformat()
    out = []
    for c in _clientes(divulgador_id):
        out.append({
            "nome": c.get("nome_snapshot") or f"Personal {str(c.get('personal_id', ''))[:6]}",
            "status": c.get("status"),
            "ativo": (c.get("valida_ate") or "") >= hoje_iso,
            "desde": c.get("criado_em"),
            "primeiro_pgto_em": c.get("primeiro_pgto_em"),
        })
    out.sort(key=lambda x: x.get("desde") or "", reverse=True)
    return out


# ── Admin ─────────────────────────────────────────────────────────────────────

def listar_divulgadores_admin() -> list[dict]:
    """Lista do registro global + agregados do mês corrente (BatchGetItem)."""
    registros = [repo.clean(it) for it in repo.query_pk(keys.PK_DIVULGADOR_REGISTRY)]
    if not registros:
        return []
    ym = date.today().strftime("%Y-%m")
    chaves = []
    for r in registros:
        did = r["divulgador_id"]
        chaves += [
            (keys.pk_personal(did), keys.SK_DIVULGADOR),
            (keys.pk_personal(did), keys.SK_STATS_DIVGERAL),
            (keys.pk_personal(did), keys.sk_stats_comissao_mes(ym)),
        ]
    itens = repo.batch_get_items(chaves)
    out = []
    for r in registros:
        did = r["divulgador_id"]
        perfil = repo.clean(itens.get((keys.pk_personal(did), keys.SK_DIVULGADOR))) or {}
        geral = itens.get((keys.pk_personal(did), keys.SK_STATS_DIVGERAL)) or {}
        mes = itens.get((keys.pk_personal(did), keys.sk_stats_comissao_mes(ym))) or {}
        vendas = int(mes.get("vendas_novas_count", 0) or 0)
        assinantes = int(geral.get("assinantes_total", 0) or 0)
        _, pct = _pct_mes(assinantes, vendas, bool(perfil.get("embaixador")))
        base_valor = float(mes.get("base_valor", 0) or 0)
        bonus = BONUS_ALTA_PERFORMANCE if vendas >= BONUS_MIN_VENDAS else 0.0
        out.append({
            **r,
            "ativo": bool(perfil.get("ativo", True)),
            "embaixador": bool(perfil.get("embaixador")),
            "fundador": bool(perfil.get("fundador")),
            "pix_key": perfil.get("pix_key"),
            "contas_total": int(geral.get("contas_total", 0) or 0),
            "assinantes_total": assinantes,
            "mes_atual": {"mes": ym, "base_valor": round(base_valor, 2), "vendas_novas": vendas,
                          "pct": pct, "comissao_valor": round(base_valor * pct + bonus, 2)},
        })
    out.sort(key=lambda x: x["mes_atual"]["comissao_valor"], reverse=True)
    return out


def marcar_repasse_pago(divulgador_id: str, mes: str, valor: float, obs: str | None = None) -> dict:
    """Marca a comissão do mês como repassada (PIX manual). Flip condicional — não
    permite marcar duas vezes."""
    if not get_perfil(divulgador_id):
        raise HTTPException(404, {"code": "DIVULGADOR_NAO_ENCONTRADO"})
    from app.repositories.dynamo_repo import _get_table
    try:
        _get_table().update_item(
            Key={"PK": keys.pk_personal(divulgador_id), "SK": keys.sk_stats_comissao_mes(mes)},
            UpdateExpression="SET repasse_status = :pago, repasse_valor = :v, repasse_em = :ts, repasse_obs = :obs",
            ConditionExpression="attribute_exists(PK) AND (attribute_not_exists(repasse_status) OR repasse_status <> :pago)",
            ExpressionAttributeValues={
                ":pago": "PAGO", ":v": repo._san(valor), ":ts": now_iso(), ":obs": obs or "",
            },
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise HTTPException(409, {"code": "REPASSE_JA_PAGO_OU_MES_INEXISTENTE", "mes": mes})
        raise
    return {"ok": True, "mes": mes, "repasse_valor": valor}
