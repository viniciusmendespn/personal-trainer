"""Configurações do personal."""
from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_personal_id
from app.models.common import CustomFieldsConfig
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import mp_service

router = APIRouter(prefix="/v1/config", tags=["config"])


@router.get("/custom-fields", response_model=CustomFieldsConfig)
def get_custom_fields(personal_id: str = Depends(get_current_personal_id)):
    item = repo.get_item(keys.pk_personal(personal_id), keys.SK_CUSTOM_FIELDS)
    if not item:
        return CustomFieldsConfig()
    return CustomFieldsConfig(**repo.clean(item))


@router.put("/custom-fields", response_model=CustomFieldsConfig)
def set_custom_fields(body: CustomFieldsConfig, personal_id: str = Depends(get_current_personal_id)):
    repo.put_item(keys.pk_personal(personal_id), keys.SK_CUSTOM_FIELDS, body.model_dump())
    return body


# ── Mercado Pago (OAuth) ──────────────────────────────────────────────────────
# Não existe endpoint para gravar Access Token: a credencial só entra pelo fluxo
# OAuth, cujo callback anônimo mora em routers/webhook.py (`PublicProxy`).

@router.get("/mercadopago")
def get_mp_config(personal_id: str = Depends(get_current_personal_id)):
    """Estado da conexão — nunca expõe access_token nem refresh_token."""
    return mp_service.status_conexao(personal_id)


@router.get("/mercadopago/oauth/iniciar")
def iniciar_oauth_mp(personal_id: str = Depends(get_current_personal_id)):
    """Devolve a URL de autorização do MP. O frontend navega o DOCUMENTO para ela."""
    try:
        return {"url": mp_service.iniciar_oauth(personal_id)}
    except mp_service.OAuthMpError as exc:
        raise HTTPException(status_code=exc.http, detail=str(exc))


@router.delete("/mercadopago", status_code=204)
def delete_mp_config(personal_id: str = Depends(get_current_personal_id)):
    mp_service.desconectar(personal_id)
