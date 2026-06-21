"""Web Push (VAPID) para notificações nativas no dispositivo do aluno.
Cada aluno pode ter N subscriptions (dispositivos). Envio best-effort: falha por
dispositivo não afeta os demais. Subscriptions expiradas (HTTP 410) são removidas
on-the-fly.
"""
import hashlib
import json
import logging
import os
import time

from pywebpush import WebPushException, webpush

from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.utils import now_iso

logger = logging.getLogger(__name__)

_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")   # base64url raw scalar (32 bytes)
_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@coachpilot.com.br")
_SUB_TTL = 180 * 86400   # 180 dias


def _sub_id(endpoint: str) -> str:
    return hashlib.sha256(endpoint.encode()).hexdigest()[:16]


def save_subscription(aluno_id: str, endpoint: str, p256dh: str, auth: str) -> None:
    sid = _sub_id(endpoint)
    repo.put_item(keys.pk_aluno(aluno_id), keys.sk_push(sid), {
        "endpoint": endpoint, "p256dh": p256dh, "auth": auth,
        "created_at": now_iso(), "ttl": int(time.time()) + _SUB_TTL,
    })


def delete_subscription(aluno_id: str, endpoint: str) -> None:
    repo.delete_item(keys.pk_aluno(aluno_id), keys.sk_push(_sub_id(endpoint)))


def get_subscriptions(aluno_id: str) -> list[dict]:
    return repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.PUSH_PREFIX)


def get_public_key() -> str:
    return _PUBLIC_KEY


def send_push(aluno_id: str, title: str, body: str, url: str = "/aluno") -> None:
    if not _PRIVATE_KEY:
        return
    subs = get_subscriptions(aluno_id)
    for s in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": s["endpoint"],
                    "keys": {"p256dh": s["p256dh"], "auth": s["auth"]},
                },
                data=json.dumps({"title": title, "body": body, "url": url}),
                vapid_private_key=_PRIVATE_KEY,
                vapid_claims={"sub": _SUBJECT},
            )
        except WebPushException as exc:
            if exc.response is not None and exc.response.status_code == 410:
                repo.delete_item(keys.pk_aluno(aluno_id), keys.sk_push(_sub_id(s["endpoint"])))
            else:
                logger.warning("[push] envio falhou para aluno %s: %s", aluno_id, exc)
        except Exception as exc:
            logger.warning("[push] erro inesperado para aluno %s: %s", aluno_id, exc)
