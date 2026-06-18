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
from app.services import authz
from app.services.wapi_service import WAPIClient
from app.utils import new_id, now_iso

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/alunos", tags=["alunos"])


def _pointer(aluno: dict) -> dict:
    return {
        "aluno_id": aluno["aluno_id"],
        "nome": aluno["nome"],
        "status": aluno["status"],
        "telefone": aluno.get("telefone"),
        "updated_at": aluno["updated_at"],
    }


@router.get("")
def list_alunos(limit: int = 50, cursor: str | None = None, personal_id: str = Depends(get_current_personal_id)):
    items, next_cursor = repo.query_pk_page(keys.pk_personal(personal_id), "ALUNO#", limit, cursor)
    return {"items": repo.clean_all(items), "next_cursor": next_cursor}


@router.post("", response_model=Aluno, status_code=201)
def create_aluno(body: AlunoCreate, personal_id: str = Depends(get_current_personal_id)):
    aluno_id = new_id()
    now = now_iso()
    aluno = Aluno(aluno_id=aluno_id, personal_id=personal_id, status=AlunoStatus.ATIVO,
                  created_at=now, updated_at=now, **body.model_dump())
    data = aluno.model_dump()
    # telefone único por personal (ESPEC §2): reserva o ponteiro antes de criar
    if body.telefone:
        ok = repo.put_item_if_absent(
            keys.pk_phone(personal_id, body.telefone), "PHONE",
            {"aluno_id": aluno_id, "nome": body.nome},
        )
        if not ok:
            raise HTTPException(409, "Telefone já cadastrado para outro aluno")
    repo.put_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE, data)
    repo.put_item(keys.pk_personal(personal_id), keys.sk_aluno_pointer(aluno_id), _pointer(data))
    return aluno


@router.get("/{aluno_id}")
def get_aluno(aluno_id: str, personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    item = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE)
    if not item:
        raise HTTPException(404, "Aluno não encontrado")
    return repo.clean(item)


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
            raise HTTPException(409, "Telefone já cadastrado para outro aluno")
        if old_phone:
            repo.delete_item(keys.pk_phone(personal_id, old_phone), "PHONE")

    fields["updated_at"] = now_iso()
    updated = repo.update_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE, fields, return_values=True)
    repo.put_item(keys.pk_personal(personal_id), keys.sk_aluno_pointer(aluno_id), _pointer(updated))
    return repo.clean(updated)


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
    if cfg and telefone:
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
    # Limpa entradas DUE# para evitar notificações fantasma após deleção do aluno.
    # Dados completos (treinos/sessões/registros) permanecem em AL# — limpeza em lote futura.
    treinos = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.SK_TREINO_PREFIX)
    due_deletes = [
        (keys.PK_SCHED, keys.sk_due(t["data_fim"], t["treino_id"]))
        for t in treinos if t.get("data_fim") and t.get("treino_id")
    ]
    if due_deletes:
        repo.batch_write(deletes=due_deletes)
