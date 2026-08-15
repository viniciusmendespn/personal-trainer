"""Lado do portal da integração MCP: consentimento e gestão de conexões.

Estas rotas rodam na API principal, atrás do authorizer Cognito — é justamente o que
permite reaproveitar o login SRP que o personal já tem, sem construir tela de senha nova
nem tocar em credencial. O `/authorize` do servidor MCP redireciona o navegador para
`/oauth/consent` no portal, e é daqui que o authorization code sai.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel

from app.dependencies import _verify_token, get_current_personal_id, security
from app.mcp import tokens as mcp_tokens
from app.services import mcp_service

router = APIRouter(prefix="/v1/mcp", tags=["mcp"])


def _email_do_token(creds: HTTPAuthorizationCredentials = Depends(security)) -> str | None:
    """E-mail do personal logado, do próprio JWT Cognito. Guardado no grant para o
    `/userinfo` do servidor MCP — o ChatGPT exige `email`/`email_verified` na submissão.
    Falha silenciosa: sem e-mail a conexão funciona igual, só não há claim de identidade."""
    try:
        return _verify_token(creds.credentials).get("email")
    except Exception:
        return None


class AprovarBody(BaseModel):
    req: str
    scopes: list[str]


@router.get("/oauth/request/{req_id}")
def detalhar_request(req_id: str, personal_id: str = Depends(get_current_personal_id)):
    """Dados da autorização pendente, para a tela de consentimento renderizar."""
    req = mcp_service.get_authreq(req_id)
    if not req:
        raise HTTPException(404, detail={"code": "AUTHREQ_EXPIRADA"})
    escopos = req.get("scopes") or []
    return {
        "client_name": req.get("client_name"),
        "scopes": [{"id": s, "label": mcp_tokens.SCOPE_LABELS.get(s, s)} for s in escopos],
    }


@router.post("/oauth/approve")
def aprovar(body: AprovarBody, personal_id: str = Depends(get_current_personal_id),
            email: str | None = Depends(_email_do_token)):
    """Cria a conexão e devolve a URL de retorno com o `code`. O front só redireciona."""
    try:
        resultado = mcp_service.aprovar(body.req, personal_id, body.scopes, email=email)
    except ValueError as exc:
        raise HTTPException(400, detail={"code": "AUTHREQ_INVALIDA", "detail": str(exc)})

    from urllib.parse import urlencode
    params = {"code": resultado["code"]}
    if resultado.get("state"):
        params["state"] = resultado["state"]
    destino = resultado["redirect_uri"]
    sep = "&" if "?" in destino else "?"
    return {"redirect_to": f"{destino}{sep}{urlencode(params)}"}


@router.post("/oauth/deny")
def negar(body: AprovarBody, personal_id: str = Depends(get_current_personal_id)):
    """Recusa: descarta a requisição sem criar conexão nenhuma."""
    mcp_service.descartar_authreq(body.req)
    return {"ok": True}


@router.get("/conexoes")
def listar_conexoes(personal_id: str = Depends(get_current_personal_id)):
    conexoes = mcp_service.listar_conexoes(personal_id)
    return {
        "items": [
            {
                "conn_id": c.get("conn_id"),
                "client_name": c.get("client_name"),
                "created_at": c.get("created_at"),
                "last_used_at": c.get("last_used_at"),
                "scopes": [{"id": s, "label": mcp_tokens.SCOPE_LABELS.get(s, s)}
                           for s in (c.get("scopes") or [])],
            }
            for c in conexoes
        ],
        "server_url": mcp_tokens.resource_url(),
    }


@router.delete("/conexoes/{conn_id}", status_code=204)
def revogar_conexao(conn_id: str, personal_id: str = Depends(get_current_personal_id)):
    if not mcp_service.revogar_conexao(personal_id, conn_id):
        raise HTTPException(404, detail={"code": "CONEXAO_NAO_ENCONTRADA"})
