"""Entrada Lambda do servidor MCP (mcp.coachpilot.com.br).

App separado do portal de propósito: o tráfego vindo de LLM é feito de rajadas longas de
leitura, o IAM aqui é menor (só DynamoDB) e um problema no MCP não pode derrubar a API do
portal — mesmo raciocínio do item 7 de docs/PERFORMANCE_ESCALA.md.

Roda numa HttpApi própria com stage `$default`, sem authorizer no gateway: quem valida o
Bearer é a própria Lambda, porque o token é nosso (HS256), não do Cognito.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from app.mcp import jsonrpc, oauth

app = FastAPI(
    title="CoachPilot MCP",
    description="Servidor MCP do CoachPilot — conecta ChatGPT, Claude e Gemini aos dados do personal.",
    docs_url=None, redoc_url=None, openapi_url=None,
)

# Clientes MCP que rodam no navegador precisam ler o desafio 401 para iniciar o OAuth.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "MCP-Protocol-Version"],
    expose_headers=["WWW-Authenticate", "MCP-Protocol-Version"],
)

app.include_router(oauth.router)
app.include_router(jsonrpc.router)


@app.get("/health")
def health():
    return {"ok": True, "service": "mcp"}


handler = Mangum(app, lifespan="off")
