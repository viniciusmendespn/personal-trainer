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


@router.get("/personals")
def list_personals(_: str = Depends(_require_admin)):
    """Lista todos os personals cadastrados no Cognito, exceto o próprio admin."""
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
    return {"personals": users}


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
