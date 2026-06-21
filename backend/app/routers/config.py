"""Configurações do personal."""
from fastapi import APIRouter, Depends

from app.dependencies import get_current_personal_id
from app.models.common import CustomFieldsConfig
from app.models.financeiro import MercadoPagoConfigIn
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.utils import now_iso

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


# ── Mercado Pago ──────────────────────────────────────────────────────────────

@router.get("/mercadopago")
def get_mp_config(personal_id: str = Depends(get_current_personal_id)):
    """Retorna apenas se o token está configurado — nunca expõe o token."""
    item = repo.get_item(keys.pk_personal(personal_id), keys.SK_CONFIG_MP)
    if not item:
        return {"configurado": False}
    return {"configurado": True, "configurado_em": item.get("configurado_em")}


@router.put("/mercadopago", status_code=204)
def set_mp_config(body: MercadoPagoConfigIn, personal_id: str = Depends(get_current_personal_id)):
    repo.put_item(keys.pk_personal(personal_id), keys.SK_CONFIG_MP, {
        "access_token": body.access_token,
        "configurado_em": now_iso(),
    })


@router.delete("/mercadopago", status_code=204)
def delete_mp_config(personal_id: str = Depends(get_current_personal_id)):
    repo.delete_item(keys.pk_personal(personal_id), keys.SK_CONFIG_MP)
