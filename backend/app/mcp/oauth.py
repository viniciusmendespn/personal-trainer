"""Authorization server OAuth 2.1 do servidor MCP.

Por que um AS próprio em vez do Cognito: o user pool do projeto não tem hosted UI nem
domínio OAuth (login é 100% SRP via Amplify) e o Cognito não suporta Dynamic Client
Registration, que os conectores hospedados do claude.ai e do ChatGPT esperam. O Cognito
segue sendo a autoridade de identidade — o consentimento roda no portal, autenticado
pelo JWT que o front já injeta, e nós nunca vemos senha.

Endpoints (todos no subdomínio mcp.*, sem authorizer no gateway):
  GET  /.well-known/oauth-protected-resource     RFC 9728
  GET  /.well-known/oauth-authorization-server   RFC 8414
  POST /register                                 RFC 7591 (DCR)
  GET  /authorize                                redireciona ao consentimento no portal
  POST /token                                    code + PKCE / refresh rotativo
"""
from urllib.parse import parse_qs, urlencode, urlparse

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, RedirectResponse

from app.config import settings
from app.mcp import tokens as mcp_tokens
from app.services import mcp_service

router = APIRouter()

_SCOPES = list(mcp_tokens.SCOPES_SUPORTADOS)


def _erro(descricao: str, *, code: str = "invalid_request", status: int = 400) -> JSONResponse:
    return JSONResponse({"error": code, "error_description": descricao}, status_code=status)


def _redirect_permitida(cliente: dict, redirect_uri: str) -> bool:
    """Match exato, como manda a OAuth 2.1 — nada de prefixo ou wildcard, que é por onde
    entram os ataques de redirect aberto."""
    return redirect_uri in (cliente.get("redirect_uris") or [])


def _redirect_segura(uri: str) -> bool:
    """Só https, localhost (clientes desktop) ou esquema custom de app nativo."""
    p = urlparse(uri)
    if p.scheme == "https":
        return True
    if p.scheme == "http" and p.hostname in ("localhost", "127.0.0.1", "::1"):
        return True
    return bool(p.scheme) and p.scheme not in ("http", "javascript", "data", "file")


# ---------------------------------------------------------------------------
# Metadados de descoberta
# ---------------------------------------------------------------------------

_PROTECTED_RESOURCE_PATHS = [
    "/.well-known/oauth-protected-resource",
    "/.well-known/oauth-protected-resource/mcp",
]
_AUTH_SERVER_PATHS = [
    "/.well-known/oauth-authorization-server",
    "/.well-known/oauth-authorization-server/mcp",
    "/.well-known/openid-configuration",
]


def _protected_resource_metadata() -> dict:
    return {
        "resource": mcp_tokens.resource_url(),
        "authorization_servers": [mcp_tokens.server_url()],
        "scopes_supported": _SCOPES,
        "bearer_methods_supported": ["header"],
    }


def _authorization_server_metadata() -> dict:
    base = mcp_tokens.server_url()
    return {
        "issuer": base,
        "authorization_endpoint": f"{base}/authorize",
        "token_endpoint": f"{base}/token",
        "registration_endpoint": f"{base}/register",
        "scopes_supported": _SCOPES,
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["none"],
    }


for _path in _PROTECTED_RESOURCE_PATHS:
    router.add_api_route(_path, lambda: _protected_resource_metadata(), methods=["GET"])
for _path in _AUTH_SERVER_PATHS:
    router.add_api_route(_path, lambda: _authorization_server_metadata(), methods=["GET"])


# ---------------------------------------------------------------------------
# Dynamic Client Registration
# ---------------------------------------------------------------------------

@router.post("/register", status_code=201)
async def register(request: Request):
    """Registro aberto, como a spec do MCP prevê. O client_id sozinho não dá acesso a
    nada: sem o consentimento de um personal logado, nenhum token é emitido."""
    try:
        body = await request.json()
    except Exception:
        return _erro("corpo JSON inválido")

    redirect_uris = body.get("redirect_uris") or []
    if not isinstance(redirect_uris, list) or not redirect_uris:
        return _erro("redirect_uris é obrigatório", code="invalid_redirect_uri")
    if len(redirect_uris) > 10:
        return _erro("redirect_uris demais", code="invalid_redirect_uri")
    for uri in redirect_uris:
        if not isinstance(uri, str) or not _redirect_segura(uri):
            return _erro(f"redirect_uri não permitida: {uri}", code="invalid_redirect_uri")

    cliente = mcp_service.registrar_cliente(
        client_name=body.get("client_name") or "Cliente MCP",
        redirect_uris=redirect_uris,
        metadata={k: body.get(k) for k in ("client_uri", "logo_uri", "software_id") if body.get(k)},
    )
    return {
        "client_id": cliente["client_id"],
        "client_name": cliente["client_name"],
        "redirect_uris": redirect_uris,
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "token_endpoint_auth_method": "none",
    }


# ---------------------------------------------------------------------------
# /authorize — entrega o usuário ao consentimento no portal
# ---------------------------------------------------------------------------

@router.get("/authorize")
def authorize(client_id: str = "", redirect_uri: str = "", response_type: str = "code",
              code_challenge: str = "", code_challenge_method: str = "S256",
              state: str | None = None, scope: str | None = None,
              resource: str | None = None):
    cliente = mcp_service.get_cliente(client_id) if client_id else None
    if not cliente:
        return _erro("client_id desconhecido", code="unauthorized_client", status=401)
    if not _redirect_permitida(cliente, redirect_uri):
        # Sem redirect confiável, o erro NÃO pode voltar pela redirect_uri.
        return _erro("redirect_uri não registrada para este cliente",
                     code="invalid_redirect_uri")

    def _volta_com_erro(code: str, descricao: str) -> RedirectResponse:
        params = {"error": code, "error_description": descricao}
        if state:
            params["state"] = state
        sep = "&" if "?" in redirect_uri else "?"
        return RedirectResponse(f"{redirect_uri}{sep}{urlencode(params)}", status_code=302)

    if response_type != "code":
        return _volta_com_erro("unsupported_response_type", "só suportamos response_type=code")
    if code_challenge_method != "S256" or not code_challenge:
        return _volta_com_erro("invalid_request", "PKCE com S256 é obrigatório")

    pedidos = (scope or " ".join(_SCOPES)).split()
    escopos = [s for s in pedidos if s in _SCOPES]
    if not escopos:
        return _volta_com_erro("invalid_scope", f"escopos válidos: {', '.join(_SCOPES)}")

    req_id = mcp_service.criar_authreq(
        client_id=client_id, client_name=cliente.get("client_name") or "Cliente MCP",
        redirect_uri=redirect_uri, code_challenge=code_challenge,
        code_challenge_method=code_challenge_method, state=state,
        scopes=escopos, resource=resource,
    )
    portal = (settings.frontend_url or "").rstrip("/")
    return RedirectResponse(f"{portal}/oauth/consent?req={req_id}", status_code=302)


# ---------------------------------------------------------------------------
# /token
# ---------------------------------------------------------------------------

@router.post("/token")
async def token(request: Request):
    # Corpo lido e parseado à mão em vez de `Form(...)`: a declaração Form do FastAPI exige
    # `python-multipart` já no import do módulo, e o /token do OAuth é sempre
    # application/x-www-form-urlencoded — não vale uma dependência nova no pacote da Lambda.
    corpo = parse_qs((await request.body()).decode("utf-8", "replace"), keep_blank_values=True)

    def campo(nome: str) -> str:
        return (corpo.get(nome) or [""])[0]

    grant_type = campo("grant_type")
    client_id = campo("client_id")
    code = campo("code")
    redirect_uri = campo("redirect_uri")
    code_verifier = campo("code_verifier")
    refresh_token = campo("refresh_token")

    if grant_type == "authorization_code":
        try:
            grant = mcp_service.resgatar_code(code, client_id, redirect_uri, code_verifier)
        except ValueError as exc:
            return _erro(str(exc), code="invalid_grant")
    elif grant_type == "refresh_token":
        try:
            grant = mcp_service.rotacionar_refresh(refresh_token, client_id)
        except ValueError as exc:
            return _erro(str(exc), code="invalid_grant")
    else:
        return _erro("grant_type não suportado", code="unsupported_grant_type")

    escopos = list(grant["scopes"])
    access, expires_in = mcp_tokens.emitir_access_token(
        grant["personal_id"], grant["conn_id"], escopos, grant["client_name"],
    )
    novo_refresh = mcp_service.emitir_refresh(
        grant["personal_id"], grant["conn_id"], grant["client_id"],
        escopos, grant["client_name"],
    )
    return JSONResponse(
        {
            "access_token": access,
            "token_type": "Bearer",
            "expires_in": expires_in,
            "refresh_token": novo_refresh,
            "scope": " ".join(escopos),
        },
        headers={"Cache-Control": "no-store", "Pragma": "no-cache"},
    )
