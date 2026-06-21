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

# Cache em memória do container quente, TTL curto — mesmo padrão de authz.py (ESPEC §5):
# evita 2 GetItems por mensagem em instanceId->personal e telefone->aluno.
_CACHE_TTL = 120
_cache_personal: dict[str, tuple[str | None, float]] = {}
_cache_aluno: dict[tuple[str, str], tuple[dict | None, float]] = {}


def _digits(phone) -> str | None:
    if not phone:
        return None
    if isinstance(phone, dict):
        phone = phone.get("id") or phone.get("phone") or ""
    d = re.sub(r"\D", "", str(phone))
    return d or None


def _br_phone_variant(digits: str) -> str | None:
    """Gera a variante alternativa (com/sem 9º dígito) pra celular BR (DDI 55).
    A W-API às vezes entrega o telefone sem o 9º dígito; o cadastro sempre guarda com."""
    if not digits.startswith("55"):
        return None
    resto = digits[2:]
    if len(resto) == 11 and resto[2] == "9":          # tem o 9º -> gera sem
        return "55" + resto[:2] + resto[3:]
    if len(resto) == 10:                                # sem o 9º -> gera com
        return "55" + resto[:2] + "9" + resto[2:]
    return None


def _extract_text(payload: dict) -> str | None:
    msg_content = payload.get("msgContent") or {}
    for v in (
        payload.get("text"), payload.get("message"),
        payload.get("body"), payload.get("conversation"),
        msg_content.get("conversation"), msg_content.get("text"),
        msg_content.get("message"),
    ):
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
    now = time.time()
    cached = _cache_personal.get(instance_id)
    if cached and cached[1] > now:
        return cached[0]
    item = repo.get_item(keys.pk_wapi(instance_id), "WAPI")
    personal_id = item.get("personal_id") if item else None
    _cache_personal[instance_id] = (personal_id, now + _CACHE_TTL)
    return personal_id


def _get_phone_item(personal_id: str, phone: str) -> dict | None:
    now = time.time()
    key = (personal_id, phone)
    cached = _cache_aluno.get(key)
    if cached and cached[1] > now:
        return cached[0]
    item = repo.get_item(keys.pk_phone(personal_id, phone), "PHONE")
    _cache_aluno[key] = (item, now + _CACHE_TTL)
    return item


def _resolve_aluno(personal_id: str, sender: str | None) -> dict | None:
    if not sender:
        return None
    item = _get_phone_item(personal_id, sender)
    if item:
        return item
    alt = _br_phone_variant(sender)
    return _get_phone_item(personal_id, alt) if alt else None


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
    logger.info("[webhook] payload: %s", payload)

    # Ignora mensagens enviadas pelo número conectado (fromMe) — evita loop e falsos positivos.
    if payload.get("fromMe") or payload.get("from_me") or payload.get("type") == "sent":
        return _OK

    if payload.get("isGroup"):
        return _OK

    # ⚠️ Confirmar nomes exatos dos campos contra a doc da W-API (webhook-received).
    instance_id = payload.get("instanceId") or payload.get("instance_id")
    message_id = payload.get("messageId") or payload.get("id")
    sender = _digits(payload.get("sender") or payload.get("phone") or payload.get("from"))

    personal_id = _resolve_personal(instance_id)
    if not personal_id:
        logger.warning("[webhook] instância desconhecida: %s", instance_id)
        return _OK

    # Dedup idempotente (ESPEC §7), com estado intermediário: marca PROCESSING antes de
    # processar (não DONE) — se a Lambda morrer por timeout no meio do agente, uma reentrega
    # da W-API depois da janela ainda processa, em vez de ser descartada silenciosamente.
    sk_seen = f"MSGSEEN#{message_id}" if message_id else None
    if sk_seen:
        novo = repo.put_item_if_absent(
            keys.pk_personal(personal_id), sk_seen,
            {"status": "PROCESSING", "started_at": int(time.time()), "ttl": int(time.time()) + 35},
        )
        if not novo:
            existing = repo.get_item(keys.pk_personal(personal_id), sk_seen)
            ainda_processando = (
                existing and existing.get("status") == "PROCESSING"
                and int(time.time()) - int(existing.get("started_at", 0)) <= 35
            )
            if ainda_processando or (existing and existing.get("status") == "DONE"):
                return _OK

    _route(personal_id, sender, payload)

    if sk_seen:
        repo.update_item(keys.pk_personal(personal_id), sk_seen,
                         {"status": "DONE", "ttl": int(time.time()) + _TTL_DEDUP})
    return _OK


def _route(personal_id: str, sender: str | None, payload: dict) -> None:
    """Resolve o aluno e despacha mídia/texto. Levanta exceção em caso de erro — o dedup só
    marca DONE depois deste retornar com sucesso (ver `receive`)."""
    # Resolve aluno pelo telefone (escopo por personal).
    phone_item = _resolve_aluno(personal_id, sender)
    if not phone_item:
        # Aluno desconhecido (ESPEC §8 #4) — TODO: boas-vindas / pendência de identificação.
        logger.info("[webhook] telefone não cadastrado: personal=%s phone=%s", personal_id, sender)
        return
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
                return
        # Foto/vídeo -> S3; vincula ao exercício atual se houver sessão, senão pendência.
        sess = sessao_service.get_active(aluno_id)
        ex = (sess or {}).get("ex_atual") or {}
        saved = (media_service.salvar_midia(cfg, media, aluno_id, ex.get("exercicio_id"),
                                            ex.get("nome"), tipo or "media") if cfg else None)
        if ex.get("exercicio_id") and saved:
            _send(personal_id, sender, f"Mídia vinculada a {ex.get('nome')}.")
        else:
            midia_info = saved or media or {}
            notif_service.criar(
                personal_id, "MIDIA_PENDENTE", "Mídia sem exercício",
                "Mídia recebida sem exercício vinculado",
                aluno_id=aluno_id,
                ref_extra={"midia_id": midia_info.get("midia_id"), "s3_key": midia_info.get("s3_key")},
            )
            _send(personal_id, sender, "Recebi sua mídia. De qual exercício ela é?")
        return

    # Texto -> agente com memória de conversa (se agente não estiver pausado).
    text = _extract_text(payload)
    if not text:
        return
    if not agent_service.is_agente_habilitado(aluno_id):
        agent_service.log_direct(personal_id, aluno_id, text, Ator.ALUNO, CanalOrigem.WHATSAPP)
        _notificar_msg_direta(personal_id, aluno_id, nome, text)
        return
    _handle_text(personal_id, aluno_id, nome, sender, text)


def _notificar_msg_direta(personal_id: str, aluno_id: str, nome: str | None, text: str) -> None:
    """Notifica o personal quando o aluno escreve enquanto o agente está pausado.
    Cria no máximo 1 notificação por hora por aluno (dedup via chave dedicada com TTL)."""
    if not notif_service.deve_notificar_msg_direta(personal_id, aluno_id):
        return
    preview = text[:80] + ("…" if len(text) > 80 else "")
    notif_service.criar(
        personal_id, "MSG_ALUNO_DIRETO",
        f"Mensagem de {nome or 'aluno'}",
        preview, aluno_id=aluno_id,
    )


# ── Mercado Pago webhook ───────────────────────────────────────────────────────

mp_router = APIRouter(prefix="/v1/public/mp", tags=["mp-webhook"])


@mp_router.post("/webhook")
async def mp_webhook(request: Request):
    """Recebe notificações do Mercado Pago. Sempre retorna 200 (spec MP).
    400 apenas se o body não for JSON parseável."""
    from app.services import mp_service
    try:
        body = await request.json()
    except Exception:
        return {"ok": 0}   # body inválido — retorna 200 mesmo assim (MP exige)
    try:
        mp_service.processar_webhook(body)
    except Exception as exc:
        logger.exception("MP webhook erro interno: %s", exc)
    return {"ok": 1}
