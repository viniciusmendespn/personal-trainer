"""Superadmin: lista personals e emite tokens de impersonação (view-as).
O admin loga com Cognito normalmente; este router valida o email do caller e emite
tokens HS256 de curta duração que o frontend envia no header X-Impersonate."""
import time

import boto3
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from pydantic import BaseModel

from app.config import settings
from app.dependencies import _verify_token
from app.services import assinatura_service, cupom_service

router = APIRouter(prefix="/v1/admin", tags=["admin"])
_security = HTTPBearer()
_TOKEN_HOURS = 8


def _require_admin(creds: HTTPAuthorizationCredentials = Depends(_security)) -> str:
    """Valida JWT Cognito e exige que o caller seja o admin (email == admin_email)."""
    try:
        payload = _verify_token(creds.credentials)
    except Exception:
        raise HTTPException(401, "Token inválido")
    if not settings.admin_email or payload.get("email") != settings.admin_email:
        raise HTTPException(403, "Acesso restrito ao admin")
    return payload.get("sub", "")


def _listar_personals() -> list[dict]:
    """Todos os personals do Cognito, exceto o próprio admin."""
    client = boto3.client("cognito-idp", region_name=settings.cognito_region)
    users = []
    paginator = client.get_paginator("list_users")
    for page in paginator.paginate(UserPoolId=settings.cognito_user_pool_id):
        for u in page["Users"]:
            attrs = {a["Name"]: a["Value"] for a in u["Attributes"]}
            email = attrs.get("email", "")
            if email == settings.admin_email:
                continue
            users.append({
                "personal_id": attrs.get("sub", ""),
                "email": email,
                "name": attrs.get("name", ""),
                "status": u["UserStatus"],
            })
    return users


@router.get("/personals")
def list_personals(_: str = Depends(_require_admin)):
    """Lista todos os personals cadastrados no Cognito, exceto o próprio admin."""
    return {"personals": _listar_personals()}


@router.get("/indicacoes")
def list_indicacoes(_: str = Depends(_require_admin)):
    """Visão da campanha de indicação: todos os personals com seu cupom, quantos resgataram
    o código (indicacoes_total) e quantos viraram assinantes (indicacoes_convertidas)."""
    return {"indicacoes": cupom_service.listar_indicacoes_admin(_listar_personals())}


@router.post("/impersonate/{personal_id}")
def impersonate(personal_id: str, admin_sub: str = Depends(_require_admin)):
    """Emite token HS256 de impersonação (8h). O frontend o envia em X-Impersonate."""
    if not settings.admin_secret:
        raise HTTPException(500, "admin_secret não configurado")
    now = int(time.time())
    token = jwt.encode(
        {
            "personal_id": personal_id,
            "scope": "impersonation",
            "admin_sub": admin_sub,
            "exp": now + _TOKEN_HOURS * 3600,
            "iat": now,
        },
        settings.admin_secret,
        algorithm="HS256",
    )
    return {"token": token, "expires_in": _TOKEN_HOURS * 3600, "personal_id": personal_id}


class ConcederAssinaturaBody(BaseModel):
    dias: int
    addons: list[str] = []   # subset de ["whatsapp", "ia"]


@router.post("/personal/{personal_id}/assinatura")
def conceder_assinatura(personal_id: str, body: ConcederAssinaturaBody, _: str = Depends(_require_admin)):
    """Concessão manual de Gestão Pro + add-ons — suporte e bootstrap de contas internas.
    Nunca apaga/altera dados do personal (alunos, templates, etc.) — só estende a
    validade da assinatura e liga flags de add-on."""
    return assinatura_service.conceder_admin(personal_id, dias=body.dias, addons=body.addons)


class CriarCupomBody(BaseModel):
    campanha: str
    dias: int
    plano: str | None = None
    max_usos: int | None = None
    expira_em: str | None = None   # ISO date/datetime; null = sem expiração


@router.post("/cupom")
def criar_cupom(body: CriarCupomBody, _: str = Depends(_require_admin)):
    """Gera um cupom de campanha/bônus (ex.: Black Friday, parceiro). Não vinculado a
    um indicador. Retorna o registro com o código gerado."""
    return cupom_service.criar_cupom_campanha(
        campanha=body.campanha, dias=body.dias, plano=body.plano,
        max_usos=body.max_usos, expira_em=body.expira_em,
    )


@router.post("/loja/anuncios/{anuncio_id}/despublicar")
def despublicar_anuncio(anuncio_id: str, _: str = Depends(_require_admin)):
    """Remove um anúncio do catálogo da loja (moderação). Notifica o vendedor."""
    from app.services import loja_service
    loja_service.despublicar_admin(anuncio_id)
    return {"ok": True}


# ── Programa de divulgadores (comissão em dinheiro — comissao_service) ─────────

class CriarDivulgadorBody(BaseModel):
    email: str            # conta CoachPilot existente (o divulgador cria conta normal antes)
    codigo: str           # cupom nomeado, ex.: MARIA (3–20 chars alfanum/hífen)
    embaixador: bool = False
    fundador: bool = False
    pix_key: str | None = None


@router.post("/divulgador")
def criar_divulgador(body: CriarDivulgadorBody, _: str = Depends(_require_admin)):
    """Registra uma conta CoachPilot como divulgador: cria o cupom nomeado (tipo
    DIVULGADOR) e o perfil. A conta é resolvida pelo e-mail no Cognito."""
    from app.services import comissao_service, cupom_service
    email = body.email.strip().lower()
    alvo = next((p for p in _listar_personals() if p["email"].lower() == email), None)
    if not alvo:
        raise HTTPException(404, {"code": "CONTA_NAO_ENCONTRADA", "email": email})
    registro = cupom_service.criar_cupom_divulgador(codigo=body.codigo, divulgador_id=alvo["personal_id"])
    try:
        perfil = comissao_service.registrar_divulgador(
            alvo["personal_id"], nome=alvo.get("name", ""), email=email,
            codigo=registro["codigo"], embaixador=body.embaixador,
            fundador=body.fundador, pix_key=body.pix_key,
        )
    except HTTPException:
        # Perfil já existia — desfaz o cupom órfão recém-criado e propaga.
        from app.repositories import dynamo_repo as repo
        from app.repositories import keys
        repo.delete_item(keys.pk_cupom(registro["codigo"]), keys.SK_META)
        raise
    return {"divulgador_id": alvo["personal_id"], "codigo": registro["codigo"], **perfil}


@router.get("/divulgadores")
def listar_divulgadores(_: str = Depends(_require_admin)):
    """Todos os divulgadores com contadores e a prévia de comissão do mês corrente."""
    from app.services import comissao_service
    return {"divulgadores": comissao_service.listar_divulgadores_admin()}


class AtualizarDivulgadorBody(BaseModel):
    ativo: bool | None = None
    embaixador: bool | None = None
    fundador: bool | None = None
    pix_key: str | None = None


@router.patch("/divulgador/{divulgador_id}")
def atualizar_divulgador(divulgador_id: str, body: AtualizarDivulgadorBody, _: str = Depends(_require_admin)):
    from app.services import comissao_service
    return comissao_service.atualizar_divulgador(divulgador_id, body.model_dump(exclude_none=True))


@router.delete("/divulgador/{divulgador_id}")
def excluir_divulgador(divulgador_id: str, _: str = Depends(_require_admin)):
    """Remove um divulgador criado por engano (só sem clientes; libera o código do cupom).
    Com carteira, usar PATCH ativo=false."""
    from app.services import comissao_service
    return comissao_service.excluir_divulgador(divulgador_id)


class RepasseBody(BaseModel):
    mes: str              # YYYY-MM
    valor: float          # valor efetivamente transferido via PIX
    obs: str | None = None


@router.post("/divulgador/{divulgador_id}/repasse")
def marcar_repasse(divulgador_id: str, body: RepasseBody, _: str = Depends(_require_admin)):
    """Marca a comissão do mês como paga (repasse PIX manual). Condicional — não paga 2x."""
    from app.services import comissao_service
    return comissao_service.marcar_repasse_pago(divulgador_id, body.mes, body.valor, body.obs)
