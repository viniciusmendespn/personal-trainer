"""Autenticação do aluno via magic-link + sessão DynamoDB com cookie HttpOnly.

Fluxo:
  1. issue_code() → salva CODE#{uuid} no DynamoDB (TTL 15 min, one-time use)
  2. magic_link() → URL com ?code=<uuid>
  3. redeem_code() → valida e deleta code, cria SESSION#{uuid} (TTL 30 dias)
  4. get_session() → valida sessão existente, retorna {aluno_id, personal_id}
"""
import time
import uuid

from jose import jwt

from app.config import settings
from app.repositories import dynamo_repo as repo

_ALGO = "HS256"
_CODE_TTL = 900        # 15 minutos
_SESSION_TTL = 2592000 # 30 dias


# ---------------------------------------------------------------------------
# Sessão DynamoDB (nova autenticação via cookie)
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
    repo.put_item(
        f"SESSION#{session_id}", "META",
        {"aluno_id": item["aluno_id"], "personal_id": item["personal_id"], "ttl": int(time.time()) + _SESSION_TTL},
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
    return {"aluno_id": item["aluno_id"], "personal_id": item["personal_id"]}


def delete_session(session_id: str) -> None:
    repo.delete_item(f"SESSION#{session_id}", "META")


def magic_link(aluno_id: str, personal_id: str) -> str:
    base = settings.aluno_frontend_url or settings.frontend_url
    code = issue_code(aluno_id, personal_id)
    return f"{base}/auth/redeem?code={code}"


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
