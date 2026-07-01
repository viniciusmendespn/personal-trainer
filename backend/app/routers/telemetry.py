"""Telemetria leve do cliente (sem auth, sob /v1/public). Só grava no CloudWatch — sem
DynamoDB, sem custo, sem tabela. Serve pra tornar visíveis falhas que hoje são silenciosas
(ex.: compressão de vídeo no navegador caindo no fallback e subindo o arquivo cru)."""
import logging

from fastapi import APIRouter, Request

router = APIRouter(prefix="/v1/public/telemetry", tags=["telemetry"])
logger = logging.getLogger(__name__)


@router.post("/media")
async def media_telemetry(request: Request):
    """Beacon (navigator.sendBeacon) da compressão de mídia no cliente. Fire-and-forget:
    parseia de forma defensiva e sempre responde 200 — nunca deve atrapalhar o upload."""
    try:
        data = await request.json()
    except Exception:
        data = {}
    if not isinstance(data, dict):
        data = {}
    logger.warning(
        "[media-telemetry] event=%s reason=%s in_mb=%s out_mb=%s ua=%s",
        data.get("event"), data.get("reason"), data.get("in_mb"), data.get("out_mb"), data.get("ua"),
    )
    return {"ok": 1}
