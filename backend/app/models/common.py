"""Customização por personal (ESPEC §2.4).

Diretriz: toda entidade tem um conjunto de **campos base fixos** + um mapa **`custom`**
livre. O personal declara, uma vez, quais atributos extras quer (por tipo de entidade)
em `CustomFieldsConfig`; o portal renderiza/valida os inputs a partir dessas definições e
cada entidade guarda os valores em `custom`. Começar básico, detalhar depois — sem migração
de schema (DynamoDB é schemaless; só os models e o portal evoluem).
"""
from typing import Any, Optional

from pydantic import BaseModel

from app.models.enums import CustomFieldType


class CustomFieldDef(BaseModel):
    key: str                                  # chave usada no mapa `custom`
    label: str                                # rótulo exibido no portal
    type: CustomFieldType = CustomFieldType.TEXT
    options: Optional[list[str]] = None       # para SELECT
    required: bool = False


class CustomFieldsConfig(BaseModel):
    """Definições de atributos customizados do personal, por tipo de entidade.
    Persistido em PT#{personal_id} / CONFIG#CUSTOMFIELDS."""
    aluno: list[CustomFieldDef] = []
    treino: list[CustomFieldDef] = []
    exercicio: list[CustomFieldDef] = []


# Alias para o mapa de valores customizados carregado por cada entidade.
Custom = dict[str, Any]
