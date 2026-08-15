"""Persistência do servidor MCP: clientes OAuth, grants, códigos, refresh, auditoria,
snapshots e quota.

Tudo vive no single-table, seguindo o padrão de aluno_auth.py (token/sessão/revogação
em DynamoDB com TTL). Nada de segredo em claro: códigos e refresh tokens são guardados
como SHA-256 — se a tabela vazar, os tokens em trânsito não são reutilizáveis.
"""
import base64
import hashlib
import json
import secrets
import time
import uuid
from datetime import datetime, timezone

from app.mcp import tokens as mcp_tokens
from app.repositories import dynamo_repo as repo
from app.repositories import keys

CLIENTE_TTL_S = 30 * 86400       # cliente registrado e nunca usado some em 30 dias
AUTHREQ_TTL_S = 600              # 10 min para o personal aprovar no portal
CODE_TTL_S = 60                  # authorization code: curto e one-shot
REFRESH_TTL_S = 30 * 86400
AUDIT_TTL_S = 180 * 86400
SNAPSHOT_TTL_S = 7 * 86400
QUOTA_LIMITE_POR_MIN = 60        # teto por personal — controle de custo, já que não há gate de plano


def _hash(valor: str) -> str:
    return hashlib.sha256(valor.encode()).hexdigest()


def agora() -> int:
    return int(time.time())


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


# ---------------------------------------------------------------------------
# Clientes OAuth (Dynamic Client Registration — RFC 7591)
# ---------------------------------------------------------------------------

def registrar_cliente(client_name: str, redirect_uris: list[str],
                      metadata: dict | None = None) -> dict:
    """Cria um client_id público (sem secret — os clientes MCP são apps nativos/SPA e
    usam PKCE). O TTL some no primeiro uso; cliente que nunca autorizou nada evapora."""
    client_id = uuid.uuid4().hex
    item = {
        "client_name": (client_name or "Cliente MCP")[:120],
        "redirect_uris": redirect_uris,
        "metadata": metadata or {},
        "created_at": _iso(),
        "ttl": agora() + CLIENTE_TTL_S,
    }
    repo.put_item(keys.pk_mcp_client(client_id), "META", item)
    return {"client_id": client_id, **item}


def get_cliente(client_id: str) -> dict | None:
    return repo.get_item(keys.pk_mcp_client(client_id), "META")


def _fixar_cliente(client_id: str) -> None:
    """Remove o TTL — o cliente foi efetivamente usado, não é lixo de registro."""
    repo.update_item(keys.pk_mcp_client(client_id), "META", {"ttl": None})


# ---------------------------------------------------------------------------
# Requisição de autorização (aguardando consentimento no portal)
# ---------------------------------------------------------------------------

def criar_authreq(*, client_id: str, client_name: str, redirect_uri: str,
                  code_challenge: str, code_challenge_method: str, state: str | None,
                  scopes: list[str], resource: str | None) -> str:
    req_id = secrets.token_urlsafe(24)
    repo.put_item(keys.pk_mcp_authreq(req_id), "META", {
        "client_id": client_id,
        "client_name": client_name,
        "redirect_uri": redirect_uri,
        "code_challenge": code_challenge,
        "code_challenge_method": code_challenge_method,
        "state": state,
        "scopes": scopes,
        "resource": resource,
        "ttl": agora() + AUTHREQ_TTL_S,
    })
    return req_id


def get_authreq(req_id: str) -> dict | None:
    item = repo.get_item(keys.pk_mcp_authreq(req_id), "META")
    if not item or int(item.get("ttl", 0)) < agora():
        return None
    return item


def descartar_authreq(req_id: str) -> None:
    repo.delete_item(keys.pk_mcp_authreq(req_id), "META")


# ---------------------------------------------------------------------------
# Conexões (grants) — partição do personal
# ---------------------------------------------------------------------------

def _criar_conexao(personal_id: str, client_id: str, client_name: str,
                   scopes: list[str]) -> str:
    conn_id = uuid.uuid4().hex
    repo.put_item(keys.pk_personal(personal_id), keys.sk_mcp_conn(conn_id), {
        "conn_id": conn_id,
        "client_id": client_id,
        "client_name": client_name,
        "scopes": scopes,
        "created_at": _iso(),
        "last_used_at": None,
    })
    return conn_id


def get_conexao(personal_id: str, conn_id: str) -> dict | None:
    return repo.get_item(keys.pk_personal(personal_id), keys.sk_mcp_conn(conn_id))


def listar_conexoes(personal_id: str) -> list[dict]:
    itens = repo.query_pk(keys.pk_personal(personal_id), sk_prefix=keys.MCP_CONN_PREFIX)
    ativas = [i for i in itens if not i.get("revoked_at")]
    ativas.sort(key=lambda i: i.get("created_at") or "", reverse=True)
    return repo.clean_all(ativas)


def revogar_conexao(personal_id: str, conn_id: str) -> bool:
    """Marca a conexão como revogada. Access tokens já emitidos morrem em até 15 min
    (comparação `revoked_at` × `iat`); o refresh para de funcionar na hora."""
    atualizado = repo.update_item_if_exists(
        keys.pk_personal(personal_id), keys.sk_mcp_conn(conn_id),
        {"revoked_at": agora()},
    )
    return atualizado is not None


def touch_conexao(personal_id: str, conn_id: str) -> None:
    repo.update_item_if_exists(
        keys.pk_personal(personal_id), keys.sk_mcp_conn(conn_id),
        {"last_used_at": _iso()},
    )


# ---------------------------------------------------------------------------
# Authorization code (one-shot, PKCE)
# ---------------------------------------------------------------------------

def aprovar(req_id: str, personal_id: str, scopes: list[str]) -> dict:
    """Consome a authreq, cria a conexão e emite o authorization code.
    Retorna {redirect_uri, code, state}. Levanta ValueError se a req expirou."""
    req = get_authreq(req_id)
    if not req:
        raise ValueError("requisição de autorização expirada ou inexistente")

    concedidos = [s for s in scopes if s in req.get("scopes", [])]
    if not concedidos:
        raise ValueError("nenhum escopo válido concedido")

    conn_id = _criar_conexao(personal_id, req["client_id"], req["client_name"], concedidos)
    _fixar_cliente(req["client_id"])

    code = secrets.token_urlsafe(32)
    repo.put_item(keys.pk_mcp_code(_hash(code)), "META", {
        "personal_id": personal_id,
        "conn_id": conn_id,
        "client_id": req["client_id"],
        "client_name": req["client_name"],
        "redirect_uri": req["redirect_uri"],
        "code_challenge": req["code_challenge"],
        "code_challenge_method": req["code_challenge_method"],
        "scopes": concedidos,
        "ttl": agora() + CODE_TTL_S,
    })
    descartar_authreq(req_id)
    return {"redirect_uri": req["redirect_uri"], "code": code, "state": req.get("state")}


def _pkce_confere(verifier: str, challenge: str, metodo: str) -> bool:
    if metodo == "S256":
        digest = hashlib.sha256(verifier.encode()).digest()
        calculado = base64.urlsafe_b64encode(digest).decode().rstrip("=")
        return secrets.compare_digest(calculado, challenge)
    # `plain` só existe por compatibilidade; a spec do MCP exige S256 e é o que anunciamos.
    return secrets.compare_digest(verifier, challenge)


def resgatar_code(code: str, client_id: str, redirect_uri: str,
                  code_verifier: str) -> dict:
    """Troca o code por uma conexão validada. One-shot: o delete condicional garante
    que um code interceptado e reusado falhe."""
    pk = keys.pk_mcp_code(_hash(code))
    item = repo.get_item(pk, "META")
    if not item or int(item.get("ttl", 0)) < agora():
        raise ValueError("código inválido ou expirado")
    if not repo.delete_item_if_exists(pk, "META"):
        raise ValueError("código já utilizado")
    if item["client_id"] != client_id:
        raise ValueError("código emitido para outro cliente")
    if item["redirect_uri"] != redirect_uri:
        raise ValueError("redirect_uri não confere com a da autorização")
    if not _pkce_confere(code_verifier, item["code_challenge"],
                         item.get("code_challenge_method") or "S256"):
        raise ValueError("code_verifier inválido")
    return item


# ---------------------------------------------------------------------------
# Refresh token — rotativo
# ---------------------------------------------------------------------------

def emitir_refresh(personal_id: str, conn_id: str, client_id: str,
                   scopes: list[str], client_name: str) -> str:
    token = secrets.token_urlsafe(40)
    repo.put_item(keys.pk_mcp_refresh(_hash(token)), "META", {
        "personal_id": personal_id,
        "conn_id": conn_id,
        "client_id": client_id,
        "client_name": client_name,
        "scopes": scopes,
        "ttl": agora() + REFRESH_TTL_S,
    })
    return token


def rotacionar_refresh(refresh_token: str, client_id: str) -> dict:
    """Valida e queima o refresh antigo. Rotação obrigatória: se o mesmo refresh for
    apresentado duas vezes, a segunda falha — sinal clássico de token vazado."""
    pk = keys.pk_mcp_refresh(_hash(refresh_token))
    item = repo.get_item(pk, "META")
    if not item or int(item.get("ttl", 0)) < agora():
        raise ValueError("refresh token inválido ou expirado")
    if not repo.delete_item_if_exists(pk, "META"):
        raise ValueError("refresh token já utilizado")
    if item["client_id"] != client_id:
        raise ValueError("refresh token emitido para outro cliente")
    conn = get_conexao(item["personal_id"], item["conn_id"])
    if not conn or conn.get("revoked_at"):
        raise ValueError("conexão revogada")
    return item


# ---------------------------------------------------------------------------
# Quota, auditoria e snapshot
# ---------------------------------------------------------------------------

def dentro_da_quota(personal_id: str, limite: int = QUOTA_LIMITE_POR_MIN) -> bool:
    """Janela fixa de 1 min com contador atômico e TTL — mesmo padrão de
    llm_agent._check_rate_limit. É o único controle de custo, já que o MCP não tem
    gate de plano."""
    minuto = str(agora() // 60)
    attrs = repo.add_and_set(
        keys.pk_personal(personal_id), keys.sk_mcp_quota(minuto),
        add={"n": 1}, set_={"ttl": agora() + 120}, return_values=True,
    )
    return int(attrs.get("n", 0)) <= limite


def registrar_auditoria(personal_id: str, *, tool: str, client_name: str, jti: str,
                        resumo: str, alvo: str | None = None,
                        resultado: str = "ok") -> None:
    ts = _iso()
    repo.put_item(keys.pk_personal(personal_id), keys.sk_mcp_audit(ts, jti), {
        "tool": tool,
        "client_name": client_name,
        "resumo": resumo[:500],
        "alvo": alvo,
        "resultado": resultado,
        "ts": ts,
        "ttl": agora() + AUDIT_TTL_S,
    })


def salvar_snapshot(aluno_id: str, programa: dict, *, tool: str, client_name: str) -> None:
    """Guarda o programa anterior antes de uma escrita destrutiva. Serializado como
    string JSON: o item fica menor que a árvore de mapas equivalente e não esbarra nas
    restrições de tipo do DynamoDB (float, set vazio)."""
    ts = _iso()
    repo.put_item(keys.pk_aluno(aluno_id), keys.sk_mcp_snap(ts), {
        "programa": json.dumps(programa, ensure_ascii=False, default=str),
        "tool": tool,
        "client_name": client_name,
        "ts": ts,
        "ttl": agora() + SNAPSHOT_TTL_S,
    })


def ultimo_snapshot(aluno_id: str) -> dict | None:
    itens = repo.query_pk_last_n(keys.pk_aluno(aluno_id), keys.MCP_SNAP_PREFIX, 1)
    if not itens:
        return None
    item = itens[0]
    return {"ts": item.get("ts"), "programa": json.loads(item["programa"])}


def descartar_snapshot(aluno_id: str, ts: str) -> None:
    repo.delete_item(keys.pk_aluno(aluno_id), keys.sk_mcp_snap(ts))


# ---------------------------------------------------------------------------
# Resolução do Bearer → Tenant
# ---------------------------------------------------------------------------

def resolver_tenant(bearer: str) -> mcp_tokens.Tenant:
    """Valida o access token e checa revogação. Só faz GetItem quando o token traz
    `conn`; o caminho quente da tool é apenas a verificação da assinatura."""
    claims = mcp_tokens.decodificar(bearer)
    personal_id = claims.get("sub")
    conn_id = claims.get("conn")
    if not personal_id or not conn_id:
        raise mcp_tokens.TokenInvalido("token sem sub/conn")

    conn = get_conexao(personal_id, conn_id)
    if not conn:
        raise mcp_tokens.TokenInvalido("conexão inexistente")
    revoked_at = conn.get("revoked_at")
    if revoked_at is not None and int(claims.get("iat", 0)) < int(revoked_at):
        raise mcp_tokens.TokenInvalido("conexão revogada")

    return mcp_tokens.Tenant(
        personal_id=personal_id,
        conn_id=conn_id,
        scopes=frozenset((claims.get("scope") or "").split()),
        client_name=claims.get("cli") or conn.get("client_name") or "Cliente MCP",
        jti=claims.get("jti") or "",
    )
