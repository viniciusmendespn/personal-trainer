"""Autenticação do aluno via token permanente revogável + sessão DynamoDB com cookie HttpOnly.

Fluxo novo (token permanente):
  1. issue_token() → salva TOKEN#{uuid}/META no DynamoDB (sem TTL)
  2. token_link() → URL com ?token=<uuid>
  3. redeem_token() → valida TOKEN item, cria SESSION#{uuid} com created_at
  4. get_session() → valida sessão, retorna {aluno_id, personal_id, created_at}
  5. revoke_and_reissue_token() → deleta TOKEN antigo, cria novo, atualiza perfil do aluno

Fluxo legado (magic-link efêmero 48h — mantido para compat):
  issue_code / redeem_code / magic_link — URLs existentes continuam funcionando até expirarem.
"""
import time
import uuid

from jose import jwt

from app.config import settings
from app.repositories import dynamo_repo as repo
from app.repositories import keys

_ALGO = "HS256"
_CODE_TTL = 172800     # 48 horas — tempo para o aluno abrir o link (legado)
_SESSION_TTL = 15552000 # 180 dias (6 meses)


# ---------------------------------------------------------------------------
# Token permanente revogável
# ---------------------------------------------------------------------------

def issue_token(aluno_id: str, personal_id: str) -> str:
    """Cria TOKEN#{uuid}/META permanente (sem TTL). Retorna o UUID do token."""
    token = str(uuid.uuid4())
    repo.put_item(
        f"TOKEN#{token}", "META",
        {"aluno_id": aluno_id, "personal_id": personal_id},
    )
    return token


def revoke_and_reissue_token(aluno_id: str, personal_id: str, old_token: str | None) -> str:
    """Revoga token antigo, cria novo, atualiza perfil do aluno com session_revoked_before."""
    new_token = issue_token(aluno_id, personal_id)
    repo.update_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE, {
        "acesso_token": new_token,
        "session_revoked_before": int(time.time()),
    })
    if old_token:
        repo.delete_item(f"TOKEN#{old_token}", "META")
    return new_token


def redeem_token(token: str) -> dict | None:
    """Valida TOKEN item e cria SESSION com created_at. Token não é deletado (permanente)."""
    item = repo.get_item(f"TOKEN#{token}", "META")
    if not item:
        return None
    session_id = str(uuid.uuid4())
    now = int(time.time())
    repo.put_item(
        f"SESSION#{session_id}", "META",
        {
            "aluno_id": item["aluno_id"],
            "personal_id": item["personal_id"],
            "created_at": now,
            "ttl": now + _SESSION_TTL,
        },
    )
    return {
        "session_id": session_id,
        "aluno_id": item["aluno_id"],
        "personal_id": item["personal_id"],
    }


def token_link(token: str) -> str:
    base = settings.aluno_frontend_url or settings.frontend_url
    # /token/<uuid> serve HTML com OG tags personalizadas (preview WhatsApp) e
    # redireciona o usuário real p/ /?token=<uuid>, onde o redeem/cookie acontece.
    return f"{base}/token/{token}"


# ---------------------------------------------------------------------------
# Sessão DynamoDB
# ---------------------------------------------------------------------------

def issue_code(aluno_id: str, personal_id: str) -> str:
    code = str(uuid.uuid4())
    repo.put_item(
        f"CODE#{code}", "META",
        {"aluno_id": aluno_id, "personal_id": personal_id, "ttl": int(time.time()) + _CODE_TTL},
    )
    return code


def redeem_code(code: str) -> dict | None:
    item = repo.get_item(f"CODE#{code}", "META")
    if not item or item.get("ttl", 0) < int(time.time()):
        return None
    repo.delete_item(f"CODE#{code}", "META")
    session_id = str(uuid.uuid4())
    now = int(time.time())
    repo.put_item(
        f"SESSION#{session_id}", "META",
        {
            "aluno_id": item["aluno_id"],
            "personal_id": item["personal_id"],
            "created_at": now,
            "ttl": now + _SESSION_TTL,
        },
    )
    return {
        "session_id": session_id,
        "aluno_id": item["aluno_id"],
        "personal_id": item["personal_id"],
    }


def get_session(session_id: str) -> dict | None:
    item = repo.get_item(f"SESSION#{session_id}", "META")
    if not item or item.get("ttl", 0) < int(time.time()):
        return None
    return {
        "aluno_id": item["aluno_id"],
        "personal_id": item["personal_id"],
        "created_at": item.get("created_at"),
    }


def delete_session(session_id: str) -> None:
    repo.delete_item(f"SESSION#{session_id}", "META")


def magic_link(aluno_id: str, personal_id: str) -> str:
    base = settings.aluno_frontend_url or settings.frontend_url
    code = issue_code(aluno_id, personal_id)
    return f"{base}/?code={code}"


# ---------------------------------------------------------------------------
# Cadastro token (link de auto-cadastro — sem aluno_id)
# ---------------------------------------------------------------------------

def issue_cadastro_token(personal_id: str, days: int = 30) -> str:
    payload = {
        "sub": personal_id, "personal_id": personal_id,
        "scope": "cadastro", "exp": int(time.time()) + days * 86400,
    }
    return jwt.encode(payload, settings.webhook_secret, algorithm=_ALGO)


def verify_cadastro_token(token: str) -> dict:
    payload = jwt.decode(token, settings.webhook_secret, algorithms=[_ALGO])
    if payload.get("scope") != "cadastro":
        raise ValueError("escopo inválido")
    return payload


def cadastro_link(personal_id: str) -> str:
    return f"{settings.frontend_url}/cadastro?token={issue_cadastro_token(personal_id)}"
