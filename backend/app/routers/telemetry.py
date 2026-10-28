"""Telemetria leve do cliente (sem auth, sob /v1/public). A de mídia só grava no
CloudWatch — sem DynamoDB, sem custo. A de visitas soma contadores minúsculos no DynamoDB
(aba Campanhas do admin — `campanha_service`)."""
import logging

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field

from app.services import campanha_service

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


class Visita(BaseModel):
    """⚠️ `max_length` folgado e sem `min_length`, de propósito: quem valida é o
    `campanha_service`, e um 422 num sinal de telemetria viraria erro no console de quem
    só quis visitar o site."""
    origem: str = Field(default="", max_length=64)
    pagina: str = Field(default="", max_length=200)


def _ip(request: Request) -> str:
    """IP do visitante. Atrás do CloudFront → API Gateway, o primeiro do
    `X-Forwarded-For` é o do viewer; o `sourceIp` do evento seria o do edge."""
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "?"


@router.post("/visita", status_code=204)
def registrar_visita(body: Visita, request: Request) -> Response:
    """Uma visita ao site institucional: de onde veio (`origem`, só na primeira página da
    aba) e que página foi vista (`pagina`, uma vez por caminho por aba).

    ⚠️ **Nunca responde erro — 204 sempre.** Origem irreconhecível, rate limit estourado,
    DynamoDB fora: o visitante não fez nada errado. Um 4xx/5xx aqui só daria erro vermelho
    no console da landing (a página do anúncio) — e o dado perdido é uma linha de métrica.
    Rate limit ANTES da escrita, como todo endpoint público que grava.
    """
    origem = campanha_service.normalizar(body.origem)
    pagina = campanha_service.normalizar_pagina(body.pagina)
    if origem or pagina:
        try:
            campanha_service.checar_limite(_ip(request))
            campanha_service.registrar(origem, pagina)
        except campanha_service.LimiteExcedido:
            logger.info("[visita] rate limit em %s %s", origem, pagina)
        except Exception:
            logger.warning("[visita] falha ao registrar %s %s", origem, pagina, exc_info=True)
    return Response(status_code=204)
