"""Access token do MCP e o contexto de tenant.

Duas regras que sustentam todo o isolamento multi-tenant do servidor MCP:

1. O `personal_id` vem SEMPRE do token, nunca de argumento de tool. Argumento de tool é
   preenchido pelo LLM, e o LLM lê conteúdo escrito por terceiros (mensagem de aluno,
   anamnese, descrição de pacote da loja) — logo é entrada não-confiável.
2. O token é emitido PARA este servidor (`aud` = URL canônica, RFC 8707). Sem isso, um
   servidor MCP malicioso poderia reaproveitar um token nosso ("confused deputy").

Molde do HS256: o token de impersonação em routers/admin.py.
"""
import time
import uuid
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass

from jose import jwt

from app.config import settings

ALGO = "HS256"
ACCESS_TTL_S = 900          # 15 min — curto porque a revogação só vale no próximo token

SCOPE_READ = "read"
SCOPE_TREINOS_WRITE = "treinos:write"
SCOPES_SUPORTADOS = (SCOPE_READ, SCOPE_TREINOS_WRITE)

# Texto mostrado ao personal na tela de consentimento do portal.
SCOPE_LABELS = {
    SCOPE_READ: "Ver seus alunos, treinos, avaliações, anamneses, sessões e agenda",
    SCOPE_TREINOS_WRITE: "Criar e alterar os treinos dos seus alunos",
}


class TokenInvalido(Exception):
    """Bearer ausente, malformado, expirado, com `aud` errado ou de conexão revogada."""


@dataclass(frozen=True)
class Tenant:
    personal_id: str
    conn_id: str
    scopes: frozenset[str]
    client_name: str
    jti: str

    def pode(self, scope: str) -> bool:
        return scope in self.scopes


_tenant: ContextVar[Tenant | None] = ContextVar("mcp_tenant", default=None)


def tenant_atual() -> Tenant:
    """Tenant da request corrente. Estoura se chamado fora do contexto — proposital:
    é melhor quebrar do que executar uma tool sem saber de quem são os dados."""
    t = _tenant.get()
    if t is None:
        raise RuntimeError("tool MCP executada fora do contexto de tenant")
    return t


@contextmanager
def usando_tenant(t: Tenant):
    token = _tenant.set(t)
    try:
        yield t
    finally:
        _tenant.reset(token)


def server_url() -> str:
    """Issuer — raiz do authorization server. Sem barra no fim."""
    return (settings.mcp_server_url or "").rstrip("/")


def resource_url() -> str:
    """Identificador do recurso protegido (RFC 8707) — o endpoint MCP em si."""
    return f"{server_url()}/mcp"


def _audiences_aceitas() -> set[str]:
    """Aceitamos o recurso e a raiz: alguns clientes mandam `resource` sem o path."""
    return {resource_url(), server_url()}


def emitir_access_token(personal_id: str, conn_id: str, scopes: list[str],
                        client_name: str) -> tuple[str, int]:
    """Retorna (token, expires_in)."""
    now = int(time.time())
    claims = {
        "iss": server_url(),
        "sub": personal_id,
        "aud": resource_url(),
        "scope": " ".join(sorted(scopes)),
        "conn": conn_id,
        "cli": client_name,
        "jti": uuid.uuid4().hex,
        "iat": now,
        "exp": now + ACCESS_TTL_S,
    }
    return jwt.encode(claims, settings.mcp_token_secret, algorithm=ALGO), ACCESS_TTL_S


def decodificar(token: str) -> dict:
    """Valida assinatura, expiração e audience. Não checa revogação — quem faz isso é
    `mcp_service.resolver_tenant`, que tem acesso ao item da conexão.

    A audience é conferida à mão (e não pelo `audience=` do jose) porque aceitamos duas
    formas equivalentes do identificador — ver `_audiences_aceitas`."""
    if not settings.mcp_token_secret:
        raise TokenInvalido("servidor sem MCP_TOKEN_SECRET configurado")
    try:
        claims = jwt.decode(
            token, settings.mcp_token_secret, algorithms=[ALGO],
            options={"verify_aud": False},
        )
    except Exception as exc:
        raise TokenInvalido(str(exc)) from exc
    if claims.get("aud") not in _audiences_aceitas():
        raise TokenInvalido("token emitido para outro recurso")
    return claims
