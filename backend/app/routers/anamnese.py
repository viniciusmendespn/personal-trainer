"""Anamnese / ficha de saúde — template configurável pelo personal e auto-cadastro do aluno."""
from fastapi import APIRouter, Depends, HTTPException
from jose import JWTError
from pydantic import BaseModel

from app import aluno_auth
from app.dependencies import get_current_personal_id
from app.models.anamnese import AnamneseResposta, AnamneseTemplate
from app.models.aluno import AlunoCreate
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import authz, media_service
from app.utils import epoch_ms, new_id, now_iso

router = APIRouter(tags=["anamnese"])


# ── Portal: configuração do template ─────────────────────────────────────────

@router.get("/v1/anamnese/template")
def get_template(personal_id: str = Depends(get_current_personal_id)):
    item = repo.get_item(keys.pk_personal(personal_id), keys.SK_ANAMNESE_TEMPLATE)
    if not item:
        return AnamneseTemplate().model_dump()
    return repo.clean(item)


@router.put("/v1/anamnese/template")
def save_template(body: AnamneseTemplate, personal_id: str = Depends(get_current_personal_id)):
    repo.put_item(keys.pk_personal(personal_id), keys.SK_ANAMNESE_TEMPLATE, body.model_dump())
    return body


@router.post("/v1/anamnese/cadastro-link")
def gerar_cadastro_link(personal_id: str = Depends(get_current_personal_id)):
    """Gera o magic link de auto-cadastro para compartilhar com novos alunos."""
    link = aluno_auth.cadastro_link(personal_id)
    return {"url": link}


# ── Portal: ver/editar anamnese de um aluno ───────────────────────────────────

@router.get("/v1/alunos/{aluno_id}/anamnese")
def get_anamnese_aluno(aluno_id: str, personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    item = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_ANAMNESE_ALUNO)
    return repo.clean(item) if item else {}


@router.put("/v1/alunos/{aluno_id}/anamnese")
def update_anamnese_aluno(aluno_id: str, body: AnamneseResposta,
                          personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    data = {**body.model_dump(), "preenchido_por": "PERSONAL", "atualizado_em": now_iso()}
    repo.put_item(keys.pk_aluno(aluno_id), keys.SK_ANAMNESE_ALUNO, data)
    return data


# ── Público: auto-cadastro do aluno ──────────────────────────────────────────

class CadastroBody(BaseModel):
    nome: str
    telefone: str
    email: str | None = None
    data_nascimento: str | None = None
    objetivos: list[str] = []
    respostas: dict = {}


@router.get("/v1/public/anamnese")
def get_form_publico(token: str):
    """Retorna o template + info básica do personal para renderizar o form de cadastro."""
    try:
        payload = aluno_auth.verify_cadastro_token(token)
    except (JWTError, ValueError) as e:
        raise HTTPException(401, f"Link inválido ou expirado: {e}")
    personal_id = payload["personal_id"]
    template_raw = repo.get_item(keys.pk_personal(personal_id), keys.SK_ANAMNESE_TEMPLATE)
    template = repo.clean(template_raw) if template_raw else AnamneseTemplate().model_dump()
    perfil = repo.get_item(keys.pk_personal(personal_id), keys.SK_PROFILE) or {}
    nome_personal = perfil.get("nome", "Personal")
    foto_key = perfil.get("foto_s3_key")
    foto_url = media_service.gerar_presigned_view_url(foto_key) if foto_key else None
    return {"template": template, "personal_nome": nome_personal, "personal_foto_url": foto_url}


@router.post("/v1/public/anamnese", status_code=201)
def cadastrar_aluno(body: CadastroBody, token: str):
    """Cria o aluno e salva a anamnese. Retorna magic link do app do aluno."""
    try:
        payload = aluno_auth.verify_cadastro_token(token)
    except (JWTError, ValueError) as e:
        raise HTTPException(401, f"Link inválido ou expirado: {e}")
    personal_id = payload["personal_id"]
    # Normaliza telefone (remove +, espaços, traços)
    telefone = body.telefone.replace("+", "").replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    # Verifica se já existe aluno com esse telefone
    phone_key = keys.pk_phone(personal_id, telefone)
    existing = repo.get_item(phone_key, "PHONE")
    if existing:
        aluno_id = existing["aluno_id"]
    else:
        # Cria o aluno
        from app.services import media_service as ms
        aluno_id = new_id()
        now = now_iso()
        aluno_data = {
            "aluno_id": aluno_id, "personal_id": personal_id,
            "nome": body.nome, "telefone": telefone,
            "email": body.email, "data_nascimento": body.data_nascimento,
            "objetivos": body.objetivos,
            "status": "ATIVO", "agente_habilitado": False,
            "created_at": now, "updated_at": now, "custom": {},
        }
        repo.put_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE, aluno_data)
        repo.put_item(keys.pk_personal(personal_id), keys.sk_aluno_pointer(aluno_id), {
            "aluno_id": aluno_id, "nome": body.nome,
            "status": "ATIVO", "telefone": telefone, "updated_at": now,
        })
        repo.put_item(phone_key, "PHONE", {"aluno_id": aluno_id, "nome": body.nome})
        repo.add_and_set(keys.pk_personal(personal_id), keys.SK_STATS_ALUNOS,
                         add={"total": 1, "ativos": 1}, set_={})
        for obj in body.objetivos:
            repo.add_and_set(keys.pk_personal(personal_id), keys.SK_STATS_OBJETIVOS,
                             add={keys.normalize_objetivo(obj): 1})
    # Salva anamnese
    if body.respostas:
        anamnese_data = {
            "respostas": body.respostas,
            "preenchido_em": now_iso(),
            "preenchido_por": "ALUNO",
        }
        repo.put_item(keys.pk_aluno(aluno_id), keys.SK_ANAMNESE_ALUNO, anamnese_data)
        # Marca no pointer do aluno que tem anamnese
        repo.update_item_if_exists(keys.pk_personal(personal_id), keys.sk_aluno_pointer(aluno_id),
                                   {"tem_anamnese": True})
    existing_profile = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE)
    token = (existing_profile or {}).get("acesso_token")
    if not token:
        token = aluno_auth.issue_token(aluno_id, personal_id)
        repo.update_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE, {"acesso_token": token})
    return {"magic_link": aluno_auth.token_link(token), "aluno_id": aluno_id}
