"""Webhook W-API — ÚNICO endpoint público (sem Cognito). Entrada do agente (ESPEC §7).

Fluxo: valida token da URL -> instanceId resolve personal -> telefone resolve aluno ->
dedup por messageId -> monta contexto -> [orquestra LLM] -> responde via WAPIClient.

Roteado por /v1/public/{proxy+} com Authorizer NONE. Sempre responde 200 rápido.
"""
import logging
import re
import time

from fastapi import APIRouter, Request

from app.dependencies import verify_wapi_webhook
from app.models.enums import Ator, CanalOrigem
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import agent_service, llm_agent, media_service, notif_service, sessao_service
from app.services.wapi_service import WAPIClient

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1/public/wapi", tags=["webhook"])

_OK = {"ok": 1}
_TTL_DEDUP = 24 * 3600


def _digits(phone: str | None) -> str | None:
    if not phone:
        return None
    d = re.sub(r"\D", "", phone)   # tira '+', '@c.us', espaços
    return d or None


def _extract_text(payload: dict) -> str | None:
    """Texto da mensagem — formato exato da W-API a confirmar; tenta os campos comuns."""
    for v in (payload.get("text"), payload.get("message"), payload.get("body"),
              payload.get("conversation")):
        if isinstance(v, str) and v.strip():
            return v.strip()
        if isinstance(v, dict):
            inner = v.get("message") or v.get("text") or v.get("conversation")
            if isinstance(inner, str) and inner.strip():
                return inner.strip()
    return None


def _resolve_personal(instance_id: str | None) -> str | None:
    if not instance_id:
        return None
    item = repo.get_item(keys.pk_wapi(instance_id), "WAPI")
    return item.get("personal_id") if item else None


def _extract_media(payload: dict) -> dict | None:
    """Detecta mídia recebida (formato exato da W-API a confirmar)."""
    for k in ("image", "video", "audio", "document", "sticker"):
        v = payload.get(k)
        if v:
            return {"tipo": k, "ref": v if isinstance(v, (str, dict)) else str(v)}
    if payload.get("mediaKey") or payload.get("directPath"):
        return {"tipo": "media",
                "mediaKey": payload.get("mediaKey"), "directPath": payload.get("directPath"),
                "mimetype": payload.get("mimetype"), "type": payload.get("type")}
    return None


def _send(personal_id: str, phone: str, text: str) -> None:
    cfg = repo.get_item(keys.pk_personal(personal_id), keys.SK_WAPI_CONFIG)
    if cfg:
        try:
            WAPIClient(cfg["instance_id"], cfg["token"]).send_text(phone, text)
        except Exception as e:
            logger.warning("[webhook] send_text falhou: %s", e)


def _handle_text(personal_id: str, aluno_id: str, nome: str | None, sender: str, text: str) -> None:
    """Roda o agente com memória de conversa e responde."""
    history = agent_service.get_chat(aluno_id)
    reply = llm_agent.run(personal_id, aluno_id, nome, text, history)
    agent_service.log_turn(aluno_id, text, reply, ator=Ator.ALUNO, canal=CanalOrigem.WHATSAPP)
    if reply:
        _send(personal_id, sender, reply)
        agent_service.save_chat(aluno_id, history + [
            {"role": "user", "content": text},
            {"role": "assistant", "content": reply},
        ])


@router.post("/webhook/{secret}")
async def receive(secret: str, request: Request):
    verify_wapi_webhook(secret)   # 404 se inválido
    payload = await request.json()

    # ⚠️ Confirmar nomes exatos dos campos contra a doc da W-API (webhook-received).
    instance_id = payload.get("instanceId") or payload.get("instance_id")
    message_id = payload.get("messageId") or payload.get("id")
    sender = _digits(payload.get("sender") or payload.get("phone") or payload.get("from"))

    personal_id = _resolve_personal(instance_id)
    if not personal_id:
        logger.warning("[webhook] instância desconhecida: %s", instance_id)
        return _OK

    # Dedup idempotente (ESPEC §7): só a 1ª entrega passa.
    if message_id:
        novo = repo.put_item_if_absent(
            keys.pk_personal(personal_id), f"MSGSEEN#{message_id}",
            {"ttl": int(time.time()) + _TTL_DEDUP},
        )
        if not novo:
            return _OK

    # Resolve aluno pelo telefone (escopo por personal).
    phone_item = repo.get_item(keys.pk_phone(personal_id, sender), "PHONE") if sender else None
    if not phone_item:
        # Aluno desconhecido (ESPEC §8 #4) — TODO: boas-vindas / pendência de identificação.
        logger.info("[webhook] telefone não cadastrado: personal=%s phone=%s", personal_id, sender)
        return _OK
    aluno_id = phone_item["aluno_id"]
    nome = phone_item.get("nome")

    media = _extract_media(payload)
    if media:
        cfg = repo.get_item(keys.pk_personal(personal_id), keys.SK_WAPI_CONFIG)
        tipo = str(media.get("tipo") or media.get("type") or "").lower()
        # Áudio -> transcreve (Whisper) e segue como texto.
        if cfg and "audio" in tipo:
            transcrito = media_service.transcrever_audio(cfg, media)
            if transcrito:
                _handle_text(personal_id, aluno_id, nome, sender, transcrito)
                return _OK
        # Foto/vídeo -> S3; vincula ao exercício atual se houver sessão, senão pendência.
        sess = sessao_service.get_active(aluno_id)
        ex = (sess or {}).get("ex_atual") or {}
        saved = (media_service.salvar_midia(cfg, media, aluno_id, ex.get("exercicio_id"),
                                            ex.get("nome"), tipo or "media") if cfg else None)
        if ex.get("exercicio_id") and saved:
            _send(personal_id, sender, f"Mídia vinculada a {ex.get('nome')}.")
        else:
            payload = saved or media or {}
            notif_service.criar(
                personal_id, "MIDIA_PENDENTE", "Mídia sem exercício",
                "Mídia recebida sem exercício vinculado",
                aluno_id=aluno_id,
                ref_extra={"midia_id": payload.get("midia_id"), "s3_key": payload.get("s3_key")},
            )
            _send(personal_id, sender, "Recebi sua mídia. De qual exercício ela é?")
        return _OK

    # Texto -> agente com memória de conversa (se agente não estiver pausado).
    text = _extract_text(payload)
    if not text:
        return _OK
    if agent_service.is_agente_pausado(aluno_id):
        agent_service.log_direct(personal_id, aluno_id, text, Ator.ALUNO, CanalOrigem.WHATSAPP)
        return _OK
    _handle_text(personal_id, aluno_id, nome, sender, text)
    return _OK
