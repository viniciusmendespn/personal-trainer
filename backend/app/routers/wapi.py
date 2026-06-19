"""Configuração e conexão da instância W-API pelo PORTAL do personal (ESPEC §7).
Credenciais ficam na partição PT#; ao salvar, registra o ponteiro WAPI#{instance}->personal
para o webhook conseguir rotear de volta."""
import logging
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.dependencies import get_current_personal_id
from app.models.enums import InstanceStatus
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services.wapi_service import WAPIClient

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1/wapi", tags=["wapi"])


class WapiConfig(BaseModel):
    instance_id: str
    token: str


def _load_config(personal_id: str) -> dict:
    item = repo.get_item(keys.pk_personal(personal_id), keys.SK_WAPI_CONFIG)
    if not item:
        raise HTTPException(404, "Instância W-API não configurada.")
    return item


@router.post("/config", status_code=201)
def save_config(
    body: WapiConfig,
    personal_id: str = Depends(get_current_personal_id),
    x_admin_key: str = Header(default=""),
):
    if not settings.admin_secret or not secrets.compare_digest(x_admin_key, settings.admin_secret):
        raise HTTPException(403, "Proibido.")
    now = datetime.now(timezone.utc).isoformat()
    repo.put_item(keys.pk_personal(personal_id), keys.SK_WAPI_CONFIG, {
        "instance_id": body.instance_id,
        "token": body.token,   # TODO: cifrar em repouso (ESPEC §8 #3)
        "status": InstanceStatus.DISCONNECTED.value,
        "updated_at": now,
    })
    # Ponteiro de roteamento do webhook (instanceId -> personal)
    repo.put_item(keys.pk_wapi(body.instance_id), "WAPI", {"personal_id": personal_id})

    # Auto-configura o webhook da W-API p/ a nossa API única (a Lambda resolve o personal
    # pelo instanceId). Todos os personais apontam para a mesma URL.
    if settings.webhook_base_url and settings.webhook_secret:
        url = f"{settings.webhook_base_url}/v1/public/wapi/webhook/{settings.webhook_secret}"
        try:
            WAPIClient(body.instance_id, body.token).set_received_webhook(url)
        except Exception as e:
            logger.warning("[wapi] não foi possível configurar o webhook: %s", e)
    return {"ok": True}


@router.get("/status")
def get_status(personal_id: str = Depends(get_current_personal_id)):
    cfg = _load_config(personal_id)
    client = WAPIClient(cfg["instance_id"], cfg["token"])
    try:
        data = client.get_status()
        connected = bool(data.get("connected"))
        status = InstanceStatus.CONNECTED if connected else InstanceStatus.DISCONNECTED
        repo.update_item_if_exists(
            keys.pk_personal(personal_id), keys.SK_WAPI_CONFIG, {"status": status.value}
        )
        return {"status": status.value, "connected": connected,
                "phone": data.get("phone") or data.get("number")}
    except Exception:
        return {"status": InstanceStatus.DISCONNECTED.value, "connected": False}


@router.get("/qr")
def get_qr(personal_id: str = Depends(get_current_personal_id)):
    cfg = _load_config(personal_id)
    try:
        data = WAPIClient(cfg["instance_id"], cfg["token"]).get_qr_code()
        qr = data.get("qrcode") or data.get("qr") or data.get("base64") or data.get("value")
        if not qr:
            raise HTTPException(502, f"QR indisponível. W-API retornou: {list(data.keys())}")
        return {"qr_code": qr}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"Erro ao obter QR: {e}")


@router.get("/pairing-code")
def get_pairing_code(phone: str, personal_id: str = Depends(get_current_personal_id)):
    cfg = _load_config(personal_id)
    try:
        data = WAPIClient(cfg["instance_id"], cfg["token"]).get_pairing_code(phone)
        code = data.get("code") or data.get("pairingCode")
        if not code:
            raise HTTPException(502, f"Código indisponível. W-API retornou: {list(data.keys())}")
        return {"code": code}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"Erro ao obter código: {e}")


@router.post("/disconnect", status_code=204)
def disconnect(personal_id: str = Depends(get_current_personal_id)):
    cfg = _load_config(personal_id)
    try:
        WAPIClient(cfg["instance_id"], cfg["token"]).disconnect()
    except Exception:
        pass
    repo.update_item_if_exists(
        keys.pk_personal(personal_id), keys.SK_WAPI_CONFIG,
        {"status": InstanceStatus.DISCONNECTED.value},
    )
