"""Cupons / promo codes (indicação + campanhas futuras).

NÃO confundir com `promo_code_service.py`, que gera códigos HMAC do parceiro FinPilot
(bônus entregue ao assinante para resgatar lá fora). Aqui é o sistema de cupons do
CoachPilot: códigos curtos e opacos, com todo o estado (campanha, plano, dias, dono,
limites, usos) guardado no DynamoDB e lido server-side — nunca confiamos no frontend.

Lookup global O(1) por código na partição `CUPOM#{codigo}` (mesmo padrão de TOKEN#/WAPI#/
PHONE# — sem GSI, sem scan). Um único gerador serve todas as campanhas; o que muda é só
o conteúdo do registro.

Regras (PROMO_CODES.md):
- Todo personal tem um código fixo de indicação (campanha INDICACAO, plano GESTAO_PRO, 30 dias).
- Quem resgata um código ganha os dias do plano associado; não pode usar o próprio código.
- 1 cupom por campanha por usuário (não impede usar códigos de outras campanhas no futuro).
- Quando o indicado vira pagante (1º Pix), o indicador ganha 30 dias + notificação (1x só).
"""
import logging
import os
import time
from datetime import date, datetime, timezone

from fastapi import HTTPException

from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import assinatura_service
from app.utils import now_iso

logger = logging.getLogger(__name__)

# Alfabeto Crockford sem caracteres ambíguos (sem 0/O, 1/I/L, U) — fácil de ditar/copiar.
_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ"
_CODE_LEN = 6
_GEN_RETRIES = 6

CAMPANHA_INDICACAO = "INDICACAO"
TIPO_INDICACAO = "INDICACAO"
TIPO_CAMPANHA = "CAMPANHA"
TIPO_ADMIN = "ADMIN"

INDICACAO_DIAS = 30


def _gen_random_code() -> str:
    return "CP-" + "".join(_ALPHABET[b % len(_ALPHABET)] for b in os.urandom(_CODE_LEN))


def normalizar(codigo: str) -> str:
    return (codigo or "").strip().upper()


def _criar_registro(
    *, tipo: str, campanha: str, plano: str, dias: int,
    owner_personal_id: str | None = None, max_usos: int | None = None,
    expira_em: str | None = None,
) -> dict:
    """Gera um código único e grava o registro global. Unicidade via put_if_absent + retry."""
    now = now_iso()
    for _ in range(_GEN_RETRIES):
        codigo = _gen_random_code()
        registro = {
            "codigo": codigo, "tipo": tipo, "campanha": campanha, "plano": plano,
            "dias": dias, "owner_personal_id": owner_personal_id, "ativo": True,
            "max_usos": max_usos, "usos": 0, "expira_em": expira_em, "criado_em": now,
        }
        if repo.put_item_if_absent(keys.pk_cupom(codigo), keys.SK_META, registro):
            return registro
    raise RuntimeError("Não foi possível gerar um código de cupom único")


# ── Cupom de indicação do personal (fixo, lazy-init) ──────────────────────────

def ensure_cupom_indicacao(personal_id: str) -> dict:
    """Garante o código fixo de indicação do personal. Lazy (padrão _ensure_assinatura):
    criado na 1ª visita à página — é quando ele precisa do código para compartilhar."""
    proprio = repo.get_item(keys.pk_personal(personal_id), keys.SK_CUPOM_PROPRIO)
    if proprio:
        return repo.clean(proprio)

    registro = _criar_registro(
        tipo=TIPO_INDICACAO, campanha=CAMPANHA_INDICACAO,
        plano=assinatura_service.PLANO_GESTAO_PRO, dias=INDICACAO_DIAS,
        owner_personal_id=personal_id,
    )
    data = {
        "codigo": registro["codigo"], "indicacoes_total": 0,
        "indicacoes_convertidas": 0, "meses_ganhos": 0, "criado_em": now_iso(),
    }
    if repo.put_item_if_absent(keys.pk_personal(personal_id), keys.SK_CUPOM_PROPRIO, data):
        return data
    # Corrida: outra request criou — relê e descarta o código órfão recém-gerado.
    repo.delete_item(keys.pk_cupom(registro["codigo"]), keys.SK_META)
    return repo.clean(repo.get_item(keys.pk_personal(personal_id), keys.SK_CUPOM_PROPRIO))


def listar_indicacoes_admin(personals: list[dict]) -> list[dict]:
    """Painel admin: enriquece cada personal com seu cupom de indicação e contadores
    (quantos resgataram o código = `indicacoes_total`; quantos viraram assinantes =
    `indicacoes_convertidas`). BatchGetItem dos CUPOM#PROPRIO — sem N GetItem.
    Personals que nunca abriram a página de indicação vêm com `codigo=None` e zeros."""
    chaves = [
        (keys.pk_personal(p["personal_id"]), keys.SK_CUPOM_PROPRIO)
        for p in personals if p.get("personal_id")
    ]
    proprios = repo.batch_get_items(chaves) if chaves else {}
    out = []
    for p in personals:
        pid = p.get("personal_id")
        cupom = proprios.get((keys.pk_personal(pid), keys.SK_CUPOM_PROPRIO)) if pid else None
        c = repo.clean(cupom) or {}
        out.append({
            "personal_id": pid,
            "name": p.get("name", ""),
            "email": p.get("email", ""),
            "codigo": c.get("codigo"),
            "indicacoes_total": int(c.get("indicacoes_total", 0)),
            "indicacoes_convertidas": int(c.get("indicacoes_convertidas", 0)),
        })
    out.sort(key=lambda x: (x["indicacoes_convertidas"], x["indicacoes_total"]), reverse=True)
    return out


def criar_cupom_campanha(
    *, campanha: str, dias: int, plano: str | None = None,
    tipo: str = TIPO_CAMPANHA, max_usos: int | None = None, expira_em: str | None = None,
) -> dict:
    """Cria um cupom de campanha/bônus (admin). Não vinculado a um indicador."""
    return _criar_registro(
        tipo=tipo, campanha=campanha.strip().upper(),
        plano=plano or assinatura_service.PLANO_GESTAO_PRO,
        dias=dias, max_usos=max_usos, expira_em=expira_em,
    )


# ── Resgate (genérico, qualquer campanha) ─────────────────────────────────────

def _expirado(expira_em: str | None) -> bool:
    if not expira_em:
        return False
    try:
        return datetime.fromisoformat(expira_em) < datetime.now(timezone.utc)
    except ValueError:
        return date.fromisoformat(expira_em) < date.today()


def resgatar(personal_id: str, codigo: str) -> dict:
    """Valida e aplica um cupom. O(1), sem read-before-write nas garantias de unicidade.
    Lança HTTPException com `code` semântico em cada regra violada."""
    codigo = normalizar(codigo)
    if not codigo:
        raise HTTPException(400, {"code": "CUPOM_INVALIDO"})

    registro = repo.get_item(keys.pk_cupom(codigo), keys.SK_META)
    if not registro or not registro.get("ativo") or _expirado(registro.get("expira_em")):
        raise HTTPException(404, {"code": "CUPOM_INVALIDO"})

    max_usos = registro.get("max_usos")
    if max_usos is not None and int(registro.get("usos", 0)) >= int(max_usos):
        raise HTTPException(404, {"code": "CUPOM_ESGOTADO"})

    if registro.get("owner_personal_id") == personal_id:
        raise HTTPException(400, {"code": "CUPOM_PROPRIO"})

    campanha = registro["campanha"]
    dias = int(registro["dias"])
    owner_id = registro.get("owner_personal_id")

    # 1 cupom por campanha por usuário — guarda atômica.
    if not repo.put_item_if_absent(
        keys.pk_personal(personal_id), keys.sk_cupom_uso(campanha),
        {"codigo": codigo, "owner_personal_id": owner_id, "plano": registro["plano"],
         "dias": dias, "campanha": campanha, "usado_em": now_iso()},
    ):
        raise HTTPException(409, {"code": "CUPOM_CAMPANHA_JA_USADA", "campanha": campanha})

    origem = "INDICACAO" if registro.get("tipo") == TIPO_INDICACAO else "PROMO"
    status = assinatura_service.aplicar_pagamento(personal_id, dias=dias, origem=origem)
    repo.increment_counter(keys.pk_cupom(codigo), keys.SK_META, "usos", 1)

    # Ledger de indicação (pendente até o indicado pagar o 1º Pix).
    if registro.get("tipo") == TIPO_INDICACAO and owner_id:
        repo.put_item(
            keys.pk_personal(owner_id), keys.sk_indicacao(personal_id),
            {"indicado_id": personal_id, "codigo": codigo, "status": "PENDENTE",
             "usado_em": now_iso(), "recompensado_em": None},
        )
        repo.increment_counter(keys.pk_personal(owner_id), keys.SK_CUPOM_PROPRIO, "indicacoes_total", 1)

    return {**assinatura_service.get_status(personal_id), "cupom": {"campanha": campanha, "dias": dias}}


# ── Recompensa do indicador (disparada quando o indicado paga) ────────────────

def processar_recompensa_indicador(indicado_id: str) -> None:
    """Chamado após um Pix aprovado do `indicado_id`. Se ele veio de uma indicação e o
    indicador ainda não foi recompensado, concede 30 dias + notifica. Idempotente: o flip
    condicional PENDENTE→RECOMPENSADO garante recompensa única mesmo com webhook duplicado
    ou pagamentos subsequentes."""
    uso = repo.get_item(keys.pk_personal(indicado_id), keys.sk_cupom_uso(CAMPANHA_INDICACAO))
    if not uso:
        return
    owner_id = uso.get("owner_personal_id")
    if not owner_id:
        return

    from botocore.exceptions import ClientError
    from app.repositories.dynamo_repo import _get_table
    try:
        _get_table().update_item(
            Key={"PK": keys.pk_personal(owner_id), "SK": keys.sk_indicacao(indicado_id)},
            UpdateExpression="SET #s = :rec, recompensado_em = :ts",
            ConditionExpression="#s = :pend",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":rec": "RECOMPENSADO", ":pend": "PENDENTE", ":ts": now_iso()},
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return  # já recompensado ou ledger ausente — não recompensa de novo
        raise

    assinatura_service.aplicar_pagamento(owner_id, dias=INDICACAO_DIAS, origem="INDICACAO")
    repo.increment_counter(keys.pk_personal(owner_id), keys.SK_CUPOM_PROPRIO, "indicacoes_convertidas", 1)
    repo.increment_counter(keys.pk_personal(owner_id), keys.SK_CUPOM_PROPRIO, "meses_ganhos", 1)

    from app.services import notif_service
    notif_service.criar(
        owner_id, "INDICACAO_RECOMPENSA", "Você ganhou 30 dias grátis!",
        "Boa! Um personal assinou o CoachPilot usando seu código. "
        "Você ganhou 30 dias grátis no plano Gestão Pro.",
    )
    logger.info("Indicação recompensada: owner=%s indicado=%s", owner_id, indicado_id)
