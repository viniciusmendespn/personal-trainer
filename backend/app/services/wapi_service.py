"""Cliente da W-API (uma instância por personal — ESPEC §7).
Espelha o padrão de C:\\ia\\wa-automation\\backend\\app\\services\\wapi_service.py."""
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class WAPIClient:
    def __init__(self, instance_id: str, token: str):
        self.instance_id = instance_id
        self.base_url = settings.wapi_base_url
        self.headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    def _params(self, extra: dict | None = None) -> dict:
        return {"instanceId": self.instance_id, **(extra or {})}

    def _get(self, path: str, params: dict | None = None, timeout: int = 15) -> dict:
        with httpx.Client(timeout=timeout) as c:
            r = c.get(f"{self.base_url}{path}", headers=self.headers, params=self._params(params))
            logger.info(f"[wapi] GET {path} -> {r.status_code}")
            r.raise_for_status()
            return r.json()

    def _post(self, path: str, body: dict, timeout: int = 30) -> dict:
        with httpx.Client(timeout=timeout) as c:
            r = c.post(f"{self.base_url}{path}", headers=self.headers, params=self._params(), json=body)
            logger.info(f"[wapi] POST {path} -> {r.status_code}")
            r.raise_for_status()
            return r.json()

    # ── Conexão da instância ──────────────────────────────────────────────────
    def get_status(self) -> dict:
        return self._get("/v1/instance/status-instance", timeout=10)

    def get_qr_code(self) -> dict:
        return self._get("/v1/instance/qr-code")

    def get_pairing_code(self, phone: str) -> dict:
        return self._get("/v1/instance/pairing-code", params={"phoneNumber": phone})

    def get_profile_picture(self, phone: str) -> dict:
        return self._get("/v1/contacts/profile-picture", params={"phoneNumber": phone}, timeout=10)

    def set_received_webhook(self, url: str) -> dict:
        """Configura o webhook de mensagens recebidas (PUT update-webhook-received)."""
        with httpx.Client(timeout=15) as c:
            r = c.put(f"{self.base_url}/v1/webhook/update-webhook-received",
                      headers=self.headers, params=self._params(), json={"value": url})
            logger.info(f"[wapi] PUT update-webhook-received -> {r.status_code}")
            r.raise_for_status()
            return r.json()

    def disconnect(self) -> dict:
        return self._get("/v1/instance/disconnect", timeout=10)

    def restart(self) -> dict:
        return self._get("/v1/instance/restart", timeout=10)

    # ── Mensagens ──────────────────────────────────────────────────────────────
    def send_text(self, phone: str, message: str, delay_ms: int = 0) -> dict:
        return self._post("/v1/message/send-text",
                          {"phone": phone, "message": message, "delayMessage": delay_ms})

    def download_media(self, media_key: str, direct_path: str, media_type: str, mimetype: str) -> dict:
        return self._post("/v1/message/download-media",
                          {"mediaKey": media_key, "directPath": direct_path,
                           "type": media_type, "mimetype": mimetype})
