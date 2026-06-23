"""JWT escopado do aluno (ESPEC §1.5) — assinado pelo backend (HS256), entregue por
magic-link no WhatsApp. Dá acesso somente à própria partição do aluno. Reaproveita o
`webhook_secret` como chave de assinatura (já é um segredo forte no ambiente)."""
import time

from jose import jwt

from app.config import settings

_ALGO = "HS256"


def issue_token(aluno_id: str, personal_id: str, days: int = 7) -> str:
    payload = {
        "sub": aluno_id, "aluno_id": aluno_id, "personal_id": personal_id,
        "scope": "aluno", "exp": int(time.time()) + days * 86400,
    }
    return jwt.encode(payload, settings.webhook_secret, algorithm=_ALGO)


def verify_token(token: str) -> dict:
    payload = jwt.decode(token, settings.webhook_secret, algorithms=[_ALGO])
    if payload.get("scope") != "aluno":
        raise ValueError("escopo inválido")
    return payload


def magic_link(aluno_id: str, personal_id: str) -> str:
    base = settings.aluno_frontend_url or settings.frontend_url
    return f"{base}/aluno?token={issue_token(aluno_id, personal_id)}"


def issue_cadastro_token(personal_id: str, days: int = 30) -> str:
    """Token para o link de auto-cadastro (sem aluno_id — aluno ainda não existe)."""
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
