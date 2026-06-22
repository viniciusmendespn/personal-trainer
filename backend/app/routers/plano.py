"""Assinatura da plataforma (cobra o personal — Trial grátis x Gestão Pro pago)."""
from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_personal_id
from app.services import assinatura_service, mp_assinatura_service

router = APIRouter(prefix="/v1/plano", tags=["plano"])


@router.get("")
def get_status(personal_id: str = Depends(get_current_personal_id)):
    return assinatura_service.get_status(personal_id)


@router.get("/catalogo")
def get_catalogo(personal_id: str = Depends(get_current_personal_id)):
    return assinatura_service.get_catalogo()


@router.post("/pix")
def criar_pix(personal_id: str = Depends(get_current_personal_id)):
    try:
        return mp_assinatura_service.criar_pix(personal_id)
    except ValueError as e:
        raise HTTPException(502, str(e))


@router.get("/pix/{payment_id}")
def get_pix_status(payment_id: str, personal_id: str = Depends(get_current_personal_id)):
    try:
        return mp_assinatura_service.get_payment_status(payment_id)
    except ValueError as e:
        raise HTTPException(502, str(e))
