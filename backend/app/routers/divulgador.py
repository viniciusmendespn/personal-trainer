"""Painel do divulgador (divulgador.coachpilot.com.br).

Auth = Cognito do portal (mesma conta CoachPilot — padrão da loja): o divulgador loga
com sua conta normal; o backend só responde se a conta estiver registrada como
divulgador pelo admin (`comissao_service.get_perfil`). Quem não é divulgador recebe
404 DIVULGADOR_NAO_CADASTRADO e o frontend mostra o CTA "fale conosco".
"""
from fastapi import APIRouter, Depends

from app.dependencies import get_current_personal_id
from app.services import comissao_service

router = APIRouter(prefix="/v1/divulgador", tags=["divulgador"])


@router.get("/status")
def status(divulgador_id: str = Depends(get_current_personal_id)):
    """Checagem leve (1 GetItem) usada pelo portal e pelo painel para decidir se a
    conta logada é um divulgador ativo — sem carregar o painel completo."""
    perfil = comissao_service.get_perfil(divulgador_id)
    return {"is_divulgador": bool(perfil and perfil.get("ativo", True))}


@router.get("/painel")
def painel(divulgador_id: str = Depends(get_current_personal_id)):
    """Visão completa: faixa, % vigente, acelerador, mês corrente, 6 meses, a receber."""
    return comissao_service.painel(divulgador_id)


@router.get("/clientes")
def clientes(divulgador_id: str = Depends(get_current_personal_id)):
    """Carteira do divulgador: contas criadas com o cupom, status e atividade."""
    return {"clientes": comissao_service.listar_clientes(divulgador_id)}
