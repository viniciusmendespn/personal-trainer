"""Transporte MCP Streamable HTTP, modo stateless.

Escrito à mão em vez de usar o SDK `mcp`: o `StreamableHTTPSessionManager` do SDK exige um
task group vivo no lifespan ASGI, e aqui o handler é `Mangum(app, lifespan="off")` em
Lambda — não fecha. Responder `application/json` em vez de SSE também evita o teto de 29 s
do HTTP API, e a spec permite explicitamente.

Sem sessão: nada de `Mcp-Session-Id`, nada de stream server-initiated. `GET`/`DELETE` em
/mcp devolvem 405, como manda a spec para servidores que não oferecem esses recursos.
"""
import logging

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse

from app.mcp import tokens as mcp_tokens
from app.mcp import tools as mcp_tools
from app.services import mcp_service

log = logging.getLogger(__name__)
router = APIRouter()

PROTOCOL_VERSION = "2025-06-18"
VERSOES_SUPORTADAS = ("2025-06-18", "2025-03-26", "2024-11-05")

SERVER_INFO = {"name": "coachpilot", "title": "CoachPilot", "version": "1.0.0"}

# Códigos JSON-RPC 2.0
PARSE_ERROR = -32700
INVALID_REQUEST = -32600
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603


def _resultado(req_id, result: dict) -> dict:
    return {"jsonrpc": "2.0", "id": req_id, "result": result}


def _erro(req_id, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}


def _desafio_oauth(detalhe: str) -> JSONResponse:
    """401 com o ponteiro para os metadados — é assim que o cliente MCP descobre que
    precisa rodar o fluxo OAuth em vez de simplesmente desistir."""
    return JSONResponse(
        {"error": "invalid_token", "error_description": detalhe},
        status_code=401,
        headers={
            "WWW-Authenticate": (
                'Bearer error="invalid_token", '
                f'resource_metadata="{mcp_tokens.server_url()}/.well-known/oauth-protected-resource"'
            )
        },
    )


def _negociar_versao(pedida: str | None) -> str:
    return pedida if pedida in VERSOES_SUPORTADAS else PROTOCOL_VERSION


def _tratar(metodo: str, params: dict, req_id, tenant: mcp_tokens.Tenant) -> dict | None:
    """Retorna o envelope JSON-RPC, ou None para notificações (que não têm resposta)."""
    if metodo == "initialize":
        return _resultado(req_id, {
            "protocolVersion": _negociar_versao(params.get("protocolVersion")),
            "capabilities": {"tools": {"listChanged": False},
                             "prompts": {"listChanged": False}},
            "serverInfo": SERVER_INFO,
            "instructions": mcp_tools.INSTRUCOES_SERVIDOR,
        })

    if metodo.startswith("notifications/"):
        return None

    if metodo == "ping":
        return _resultado(req_id, {})

    if metodo == "tools/list":
        return _resultado(req_id, {"tools": mcp_tools.listar_tools(tenant)})

    if metodo == "tools/call":
        nome = params.get("name") or ""
        argumentos = params.get("arguments") or {}
        return _resultado(req_id, mcp_tools.chamar_tool(nome, argumentos, tenant))

    if metodo == "prompts/list":
        return _resultado(req_id, {"prompts": mcp_tools.listar_prompts()})

    if metodo == "prompts/get":
        try:
            return _resultado(req_id, mcp_tools.obter_prompt(params.get("name") or ""))
        except KeyError:
            return _erro(req_id, INVALID_PARAMS, "prompt desconhecido")

    return _erro(req_id, METHOD_NOT_FOUND, f"método não suportado: {metodo}")


@router.post("/mcp")
async def mcp_endpoint(request: Request):
    autorizacao = request.headers.get("authorization") or ""
    if not autorizacao.lower().startswith("bearer "):
        return _desafio_oauth("é preciso autenticar com OAuth para usar o CoachPilot")

    try:
        tenant = mcp_service.resolver_tenant(autorizacao[7:].strip())
    except mcp_tokens.TokenInvalido as exc:
        return _desafio_oauth(str(exc))

    if not mcp_service.dentro_da_quota(tenant.personal_id):
        return JSONResponse(
            {"error": "rate_limited",
             "error_description": "muitas chamadas em um minuto; tente de novo em instantes"},
            status_code=429, headers={"Retry-After": "60"},
        )

    try:
        corpo = await request.json()
    except Exception:
        return JSONResponse(_erro(None, PARSE_ERROR, "JSON inválido"), status_code=400)

    # Batching de JSON-RPC foi removido do MCP em 2025-06-18.
    if not isinstance(corpo, dict):
        return JSONResponse(_erro(None, INVALID_REQUEST, "esperado um único objeto JSON-RPC"),
                            status_code=400)

    req_id = corpo.get("id")
    metodo = corpo.get("method")
    if not metodo:
        return JSONResponse(_erro(req_id, INVALID_REQUEST, "campo `method` ausente"),
                            status_code=400)

    with mcp_tokens.usando_tenant(tenant):
        try:
            resposta = _tratar(metodo, corpo.get("params") or {}, req_id, tenant)
        except Exception:
            # Nunca vazar stack trace para o cliente: o texto vai direto para o contexto do LLM.
            log.exception("erro no método MCP %s", metodo)
            resposta = _erro(req_id, INTERNAL_ERROR, "erro interno ao processar a chamada")

    mcp_service.touch_conexao(tenant.personal_id, tenant.conn_id)

    if resposta is None:
        return Response(status_code=202)
    return JSONResponse(resposta, headers={"MCP-Protocol-Version": PROTOCOL_VERSION})


@router.get("/mcp")
@router.delete("/mcp")
def mcp_sem_sessao():
    """Servidor stateless: não abre stream server-initiated nem mantém sessão."""
    return Response(status_code=405, headers={"Allow": "POST"})
