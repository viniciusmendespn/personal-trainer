"""Configurações do personal. Por ora: definições de atributos customizados que o
portal usa para renderizar/validar inputs extras de aluno/treino/exercício (ESPEC §2.4)."""
from fastapi import APIRouter, Depends

from app.dependencies import get_current_personal_id
from app.models.common import CustomFieldsConfig
from app.repositories import dynamo_repo as repo
from app.repositories import keys

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
