"""Canal de feedback/sugestões do personal → admin.

O personal envia texto livre pela Ajuda (fire-and-forget: não vê histórico nem resposta).
O admin lê tudo num painel próprio e pode bonificar com dias grátis de Gestão Pro quando a
ideia for boa. Registro durável (sem TTL) numa partição global — ver keys.PK_FEEDBACK."""
import logging

from fastapi import HTTPException

from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import assinatura_service, notif_service
from app.utils import epoch_ms, new_id, now_iso

logger = logging.getLogger(__name__)

MSG_MAX = 2000
STATUS_VALIDOS = {"NOVO", "LIDO", "ARQUIVADO", "BONIFICADO"}


def criar(personal_id: str, mensagem: str) -> dict:
    texto = (mensagem or "").strip()
    if not texto:
        raise HTTPException(400, {"code": "MENSAGEM_VAZIA"})
    texto = texto[:MSG_MAX]
    fid = new_id()
    item = {
        "feedback_id": fid,
        "personal_id": personal_id,
        "mensagem": texto,
        "status": "NOVO",
        "criado_em": now_iso(),
    }
    repo.put_item(keys.PK_FEEDBACK, keys.sk_feedback(epoch_ms(), fid), item)
    return {"ok": 1, "feedback_id": fid}


def listar_admin(limit: int = 50, cursor: str | None = None) -> tuple[list[dict], str | None]:
    items, next_cursor = repo.query_pk_page(
        keys.PK_FEEDBACK, keys.FEEDBACK_PREFIX, limit, cursor, forward=False
    )
    return [{**repo.clean(i), "ref": i["SK"]} for i in items], next_cursor


def definir_status(ref: str, status: str) -> dict:
    if status not in STATUS_VALIDOS:
        raise HTTPException(400, {"code": "STATUS_INVALIDO", "status": status})
    updated = repo.update_item_if_exists(
        keys.PK_FEEDBACK, ref, {"status": status, "atualizado_em": now_iso()}
    )
    if updated is None:
        raise HTTPException(404, {"code": "FEEDBACK_NAO_ENCONTRADO"})
    return {**repo.clean(updated), "ref": ref}


def bonificar(personal_id: str, ref: str, dias: int) -> dict:
    if dias < 1:
        raise HTTPException(400, {"code": "DIAS_INVALIDO"})
    # Estende a validade do plano (cumulativo, promove p/ Gestão Pro) — primitiva existente.
    assinatura_service.conceder_admin(personal_id, dias=dias)
    updated = repo.update_item_if_exists(
        keys.PK_FEEDBACK, ref,
        {"status": "BONIFICADO", "dias_bonificados": dias, "bonificado_em": now_iso()},
    )
    if updated is None:
        raise HTTPException(404, {"code": "FEEDBACK_NAO_ENCONTRADO"})
    # Único aviso ao personal (não é thread): avisa que a ideia rendeu dias grátis.
    try:
        notif_service.criar(
            personal_id, "FEEDBACK_BONUS", "🎁 Você ganhou dias grátis!",
            f"Sua sugestão rendeu {dias} dias grátis de Gestão Pro. "
            "Obrigado por ajudar a melhorar o CoachPilot!",
        )
    except Exception as exc:
        logger.warning("[feedback] notif de bônus falhou para %s: %s", personal_id, exc)
    return {**repo.clean(updated), "ref": ref}
