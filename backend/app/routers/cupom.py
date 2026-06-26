"""Cupons / promo codes do personal: código fixo de indicação + resgate genérico
(qualquer campanha). Ver `cupom_service`."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_current_personal_id
from app.services import cupom_service

router = APIRouter(prefix="/v1/cupom", tags=["cupom"])


class ResgatarBody(BaseModel):
    codigo: str


@router.get("/indicacao")
def get_indicacao(personal_id: str = Depends(get_current_personal_id)):
    """Código fixo de indicação do personal + estatísticas (lazy-init na 1ª chamada)."""
    return cupom_service.ensure_cupom_indicacao(personal_id)


@router.post("/resgatar")
def resgatar(body: ResgatarBody, personal_id: str = Depends(get_current_personal_id)):
    """Resgata um cupom (indicação ou campanha). Erros via HTTPException com `code`."""
    return cupom_service.resgatar(personal_id, body.codigo)
