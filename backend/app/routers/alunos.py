"""CRUD de alunos (ESPEC §2). Cada aluno: perfil completo em AL#{aluno}/PROFILE +
ponteiro leve em PT#{personal}/ALUNO#{aluno} (listar sem fan-out) + lookup de
telefone PHONE#{personal}#{e164} (resolução do webhook)."""
import logging

from fastapi import APIRouter, Depends, HTTPException

from app import aluno_auth
from app.dependencies import get_current_personal_id
from app.models.aluno import Aluno, AlunoCreate, AlunoUpdate
from app.models.enums import AlunoStatus
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import assinatura_service, authz, media_service
from app.services.wapi_service import WAPIClient
from app.utils import new_id, now_iso

from pydantic import BaseModel


class AvatarUploadUrlBody(BaseModel):
    filename: str
    content_type: str

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/alunos", tags=["alunos"])


def _pointer(aluno: dict) -> dict:
    return {
        "aluno_id": aluno["aluno_id"],
        "nome": aluno["nome"],
        "status": aluno["status"],
        "telefone": aluno.get("telefone"),
        "foto_s3_key": aluno.get("foto_s3_key"),
        "updated_at": aluno["updated_at"],
        "created_at": aluno.get("created_at", aluno["updated_at"]),
    }


def _add_foto_url(item: dict) -> dict:
    s3_key = item.get("foto_s3_key")
    if s3_key:
        item["foto_url"] = media_service.gerar_presigned_view_url(s3_key)
    return item


def _phone_conflict(dono_id: str | None) -> HTTPException:
    """409 estruturado de telefone duplicado, enriquecido com os dados do aluno
    dono pra permitir ação de recuperação no front (ver/reativar) em vez de bloqueio cru."""
    aluno_existente = None
    if dono_id:
        dono = repo.get_item(keys.pk_aluno(dono_id), keys.SK_PROFILE)
        if dono:
            aluno_existente = {"aluno_id": dono["aluno_id"], "nome": dono["nome"], "status": dono["status"]}
    return HTTPException(409, {
        "code": "PHONE_ALREADY_REGISTERED",
        "message": "Telefone já cadastrado para outro aluno",
        "aluno_existente": aluno_existente,
    })


@router.get("")
def list_alunos(limit: int = 50, cursor: str | None = None, personal_id: str = Depends(get_current_personal_id)):
    items, next_cursor = repo.query_pk_page(keys.pk_personal(personal_id), "ALUNO#", limit, cursor)
    bloqueados = assinatura_service.get_alunos_bloqueados(personal_id)
    cleaned = [{**_add_foto_url(repo.clean(i)), "bloqueado": i.get("aluno_id", "") in bloqueados} for i in items]
    return {"items": cleaned, "next_cursor": next_cursor}


@router.post("", response_model=Aluno, status_code=201)
def create_aluno(body: AlunoCreate, personal_id: str = Depends(get_current_personal_id)):
    assinatura_service.verificar_limite_alunos(personal_id)
    aluno_id = new_id()
    now = now_iso()
    aluno = Aluno(aluno_id=aluno_id, personal_id=personal_id, status=AlunoStatus.ATIVO,
                  created_at=now, updated_at=now, **body.model_dump())
    if body.telefone:
        aluno.foto_s3_key = media_service.buscar_foto_perfil_whatsapp(personal_id, aluno_id, body.telefone)
        if aluno.foto_s3_key:
            aluno.foto_url = media_service.gerar_presigned_view_url(aluno.foto_s3_key)
    data = aluno.model_dump()
    # telefone único por personal (ESPEC §2): reserva o ponteiro antes de criar
    if body.telefone:
        ok = repo.put_item_if_absent(
            keys.pk_phone(personal_id, body.telefone), "PHONE",
            {"aluno_id": aluno_id, "nome": body.nome},
        )
        if not ok:
            phone_item = repo.get_item(keys.pk_phone(personal_id, body.telefone), "PHONE")
            raise _phone_conflict(phone_item.get("aluno_id") if phone_item else None)
    repo.put_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE, data)
    repo.put_item(keys.pk_personal(personal_id), keys.sk_aluno_pointer(aluno_id), _pointer(data))
    repo.add_and_set(keys.pk_personal(personal_id), keys.SK_STATS_ALUNOS, add={"total": 1, "ativos": 1})
    assinatura_service.invalidate_alunos_bloqueados(personal_id)
    return aluno


@router.get("/{aluno_id}")
def get_aluno(aluno_id: str, personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    item = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE)
    if not item:
        raise HTTPException(404, "Aluno não encontrado")
    return _add_foto_url(repo.clean(item))


@router.post("/{aluno_id}/avatar/upload-url")
def avatar_upload_url(aluno_id: str, body: AvatarUploadUrlBody,
                      personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    result = media_service.gerar_presigned_upload_url_perfil(
        "aluno", aluno_id, body.filename, body.content_type
    )
    if not result:
        raise HTTPException(502, "Não foi possível gerar a URL de upload.")
    return result


@router.post("/{aluno_id}/sync-foto")
def sync_foto(aluno_id: str, personal_id: str = Depends(get_current_personal_id)):
    """Best-effort: busca foto do WhatsApp para alunos sem foto_s3_key.
    Idempotente — se já tem foto, só devolve a URL presignada sem chamar o WhatsApp."""
    authz.authorize_aluno(personal_id, aluno_id)
    item = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE)
    if not item:
        raise HTTPException(404, "Aluno não encontrado")
    if item.get("foto_s3_key"):
        return {"foto_url": media_service.gerar_presigned_view_url(item["foto_s3_key"])}
    telefone = item.get("telefone")
    if not telefone:
        return {"foto_url": None}
    foto_key = media_service.buscar_foto_perfil_whatsapp(personal_id, aluno_id, telefone)
    if not foto_key:
        return {"foto_url": None}
    updated = repo.update_item(
        keys.pk_aluno(aluno_id), keys.SK_PROFILE,
        {"foto_s3_key": foto_key, "updated_at": now_iso()}, return_values=True,
    )
    repo.put_item(keys.pk_personal(personal_id), keys.sk_aluno_pointer(aluno_id), _pointer(updated))
    return {"foto_url": media_service.gerar_presigned_view_url(foto_key)}


@router.put("/{aluno_id}")
def update_aluno(aluno_id: str, body: AlunoUpdate, personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    current = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE)
    if not current:
        raise HTTPException(404, "Aluno não encontrado")

    fields = body.model_dump(exclude_none=True)
    # troca de telefone: re-aponta o lookup (remove o antigo, reserva o novo)
    new_phone = fields.get("telefone")
    old_phone = current.get("telefone")
    if new_phone and new_phone != old_phone:
        nome = fields.get("nome") or current.get("nome")
        if not repo.put_item_if_absent(keys.pk_phone(personal_id, new_phone), "PHONE",
                                       {"aluno_id": aluno_id, "nome": nome}):
            phone_item = repo.get_item(keys.pk_phone(personal_id, new_phone), "PHONE")
            raise _phone_conflict(phone_item.get("aluno_id") if phone_item else None)
        if old_phone:
            repo.delete_item(keys.pk_phone(personal_id, old_phone), "PHONE")
        foto_key = media_service.buscar_foto_perfil_whatsapp(personal_id, aluno_id, new_phone)
        if foto_key:
            fields["foto_s3_key"] = foto_key

    fields["updated_at"] = now_iso()
    updated = repo.update_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE, fields, return_values=True)
    repo.put_item(keys.pk_personal(personal_id), keys.sk_aluno_pointer(aluno_id), _pointer(updated))
    novo_status = fields.get("status")
    if novo_status and novo_status != current.get("status"):
        delta = 1 if novo_status == AlunoStatus.ATIVO else -1
        repo.add_and_set(keys.pk_personal(personal_id), keys.SK_STATS_ALUNOS, add={"ativos": delta})
    return _add_foto_url(repo.clean(updated))


@router.get("/{aluno_id}/link")
def gerar_link(aluno_id: str, personal_id: str = Depends(get_current_personal_id)):
    """Gera o magic-link do app sem enviar nada — pra copiar e mandar manualmente."""
    authz.authorize_aluno(personal_id, aluno_id)
    return {"link": aluno_auth.magic_link(aluno_id, personal_id)}


@router.post("/{aluno_id}/enviar-link")
def enviar_link(aluno_id: str, personal_id: str = Depends(get_current_personal_id)):
    """Gera o magic-link do app e envia no WhatsApp do aluno (e devolve p/ copiar)."""
    authz.authorize_aluno(personal_id, aluno_id)
    aluno = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE)
    if not aluno:
        raise HTTPException(404, "Aluno não encontrado")
    link = aluno_auth.magic_link(aluno_id, personal_id)
    enviado = False
    cfg = repo.get_item(keys.pk_personal(personal_id), keys.SK_WAPI_CONFIG)
    telefone = aluno.get("telefone")
    if cfg and telefone and assinatura_service.has_addon(personal_id, "whatsapp"):
        try:
            WAPIClient(cfg["instance_id"], cfg["token"]).send_text(
                telefone, f"Olá, {aluno.get('nome', '')}! Acesse seu app de treino: {link}")
            enviado = True
        except Exception as e:
            logger.warning("[enviar-link] envio falhou: %s", e)
    return {"link": link, "enviado": enviado}


@router.delete("/{aluno_id}", status_code=204)
def delete_aluno(aluno_id: str, personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    current = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE)
    if current and current.get("telefone"):
        repo.delete_item(keys.pk_phone(personal_id, current["telefone"]), "PHONE")
    repo.delete_item(keys.pk_personal(personal_id), keys.sk_aluno_pointer(aluno_id))
    repo.delete_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE)
    authz.invalidate(personal_id, aluno_id)
    assinatura_service.invalidate_alunos_bloqueados(personal_id)
    decremento = {"total": -1}
    if current and current.get("status") == AlunoStatus.ATIVO:
        decremento["ativos"] = -1
    repo.add_and_set(keys.pk_personal(personal_id), keys.SK_STATS_ALUNOS, add=decremento)
    # Limpa entradas DUE# para evitar notificações fantasma após deleção do aluno.
    # Dados completos (treinos/sessões/registros) permanecem em AL# — limpeza em lote futura.
    treinos = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.SK_TREINO_PREFIX)
    due_deletes = [
        (keys.pk_sched(t["data_fim"]), keys.sk_due(t["treino_id"]))
        for t in treinos if t.get("data_fim") and t.get("treino_id")
    ]
    if due_deletes:
        repo.batch_write(deletes=due_deletes)
