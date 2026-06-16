import hmac
import json
import urllib.request
from functools import lru_cache

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwk, jwt

from app.config import settings

security = HTTPBearer()


@lru_cache(maxsize=1)
def _get_jwks() -> dict:
    url = (
        f"https://cognito-idp.{settings.cognito_region}.amazonaws.com"
        f"/{settings.cognito_user_pool_id}/.well-known/jwks.json"
    )
    with urllib.request.urlopen(url) as r:
        return json.loads(r.read())


def _verify_token(token: str) -> dict:
    jwks = _get_jwks()
    header = jwt.get_unverified_header(token)
    key = next(k for k in jwks["keys"] if k["kid"] == header["kid"])
    public_key = jwk.construct(key)
    return jwt.decode(token, public_key, algorithms=["RS256"], options={"verify_aud": False})


def get_current_personal_id(
    creds: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """Tenant = personal. O `personal_id` é o `sub` do JWT do Cognito (ESPEC §1.1)."""
    try:
        payload = _verify_token(creds.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido")
    personal_id = payload.get("sub")
    if not personal_id:
        raise HTTPException(status_code=401, detail="Token sem sub")
    return personal_id


def get_current_aluno(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """App do aluno: valida o JWT escopado (HS256) e devolve {aluno_id, personal_id}."""
    from app import aluno_auth
    try:
        payload = aluno_auth.verify_token(creds.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Token de aluno inválido")
    return {"aluno_id": payload["aluno_id"], "personal_id": payload["personal_id"]}


def verify_wapi_webhook(secret: str) -> None:
    """Valida o token opaco da URL do webhook W-API em tempo constante (ESPEC §7).
    Levanta 404 (não 401) para não vazar a existência do endpoint."""
    expected = settings.webhook_secret
    if not expected or not hmac.compare_digest(secret, expected):
        raise HTTPException(status_code=404, detail="Not found")
