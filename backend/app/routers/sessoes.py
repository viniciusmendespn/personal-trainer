"""Sessão de treino e registros pelo PORTAL (personal). Pelo agente, as mesmas
operações vêm de agent_service. Tudo aninhado sob o aluno (ESPEC §3)."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, model_validator

from app.dependencies import get_current_personal_id
from app.models.enums import Ator, CanalOrigem
from app.models.registro import SerieExec
from app.repositories import dynamo_repo as repo, keys
from app.models.postagem import MidiaRef, PostagemPersonalCreate
from app.services import agent_service, alerta_service, anotif_service, authz, correcao_service, media_service, nota_service, notif_service, postagem_service, sessao_service

router = APIRouter(prefix="/v1/alunos/{aluno_id}", tags=["sessoes"])


class StartBody(BaseModel):
    treino_id: str


class RegistroBody(BaseModel):
    series: list[SerieExec]
    exercicio_id: str | None = None


@router.get("/sessoes")
def list_sessoes(aluno_id: str, limit: int = 10, cursor: str | None = None,
                 personal_id: str = Depends(get_current_personal_id)):
    """Histórico de sessões finalizadas do aluno (mais recentes primeiro)."""
    authz.authorize_aluno(personal_id, aluno_id)
    items, next_cursor = sessao_service.list_sessoes(aluno_id, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/historico/mes")
def historico_mes(aluno_id: str, ano: int, mes: int,
                  personal_id: str = Depends(get_current_personal_id)):
    """Resumo mensal do aluno para o calendário do portal — igual ao app do aluno, mas
    SEM as fotos de check-in (nem miniatura): privacidade do aluno + economia de presign."""
    authz.authorize_aluno(personal_id, aluno_id)
    return sessao_service.historico_mes(aluno_id, ano, mes, incluir_fotos=False)


@router.get("/sessoes/{sessao_id}")
def get_sessao_detalhe(aluno_id: str, sessao_id: str,
                       personal_id: str = Depends(get_current_personal_id)):
    """Detalhe completo de uma sessão: prescrição + execução + mídia por exercício."""
    authz.authorize_aluno(personal_id, aluno_id)
    pk = keys.pk_aluno(aluno_id)
    idx = repo.get_item(pk, keys.sk_sessao_idx(sessao_id))
    if not idx:
        raise HTTPException(404, "Sessão não encontrada")
    session = repo.get_item(pk, idx["sk"])
    if not session:
        raise HTTPException(404, "Sessão não encontrada")
    s = repo.clean(session)
    snap_by_id = {e["exercicio_id"]: e for e in s.get("exercicios", [])}
    for ex in s.get("exercicios_exec") or []:
        snap = snap_by_id.get(ex.get("exercicio_id", ""), {})
        if ex.get("unidade_reps") is None:
            ex["unidade_reps"] = snap.get("unidade_reps")
        if ex.get("unidade_carga") is None:
            ex["unidade_carga"] = snap.get("unidade_carga")
        ex["midia"] = media_service.list_midia_exercicio(aluno_id, ex["exercicio_id"])
        ex["relatos"] = correcao_service.relatos_sessao(aluno_id, ex["exercicio_id"], sessao_id)
    return s


@router.get("/sessao")
def get_sessao(aluno_id: str, personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    return repo.clean(sessao_service.get_active(aluno_id))


@router.post("/sessao/start", status_code=201)
def start(aluno_id: str, body: StartBody, personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    return repo.clean(sessao_service.start_session(personal_id, aluno_id, body.treino_id))


@router.post("/sessao/advance")
def advance(aluno_id: str, personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    return repo.clean(sessao_service.advance(aluno_id))


@router.post("/sessao/finish")
def finish(aluno_id: str, personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    return repo.clean(sessao_service.finish(aluno_id))


@router.post("/registros", status_code=201)
def registrar(aluno_id: str, body: RegistroBody, personal_id: str = Depends(get_current_personal_id)):
    """Personal atuando como aluno → ator=PERSONAL, classificacao=MANUAL (ESPEC §1.3)."""
    authz.authorize_aluno(personal_id, aluno_id)
    series = [s.model_dump() for s in body.series]
    registro, pr = sessao_service.record(aluno_id, series, exercicio_id=body.exercicio_id)
    out = repo.clean(registro)
    if pr:
        out["pr_novo"] = pr
    return out


@router.get("/exercicios/{exercicio_id}/midia")
def midia_exercicio(aluno_id: str, exercicio_id: str, personal_id: str = Depends(get_current_personal_id)):
    """Vídeos/fotos (execução do aluno + correção do personal) anexados nesse exercício."""
    authz.authorize_aluno(personal_id, aluno_id)
    return media_service.list_midia_exercicio(aluno_id, exercicio_id)


class MidiaUploadUrlBody(BaseModel):
    filename: str
    content_type: str


class MidiaCorrecaoBody(BaseModel):
    s3_key: str
    tipo: str                          # "video_correcao" | "foto_correcao"
    exercicio_id: str
    exercicio_nome: str | None = None
    texto: str | None = None           # legenda opcional, vai como texto da msg de chat


@router.post("/midia/upload-url")
def midia_upload_url_personal(aluno_id: str, body: MidiaUploadUrlBody,
                              personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    result = media_service.gerar_presigned_upload_url(aluno_id, body.filename, body.content_type)
    if not result:
        raise HTTPException(502, "Não foi possível gerar a URL de upload.")
    return result


@router.post("/midia/correcao", status_code=201)
def midia_correcao(aluno_id: str, body: MidiaCorrecaoBody,
                   personal_id: str = Depends(get_current_personal_id)):
    """Personal anexa vídeo/foto de correção: vira mídia vinculada ao exercício (aparece
    na timeline de evolução) E mensagem no chat (com anexo), sem passar pela IA."""
    authz.authorize_aluno(personal_id, aluno_id)
    item = media_service.registrar_midia_vinculada(
        aluno_id, body.exercicio_id, body.exercicio_nome, body.tipo, body.s3_key, ator=Ator.PERSONAL,
    )
    midia_ref = {"midia_id": item["midia_id"], "tipo": item["tipo"], "s3_key": item["s3_key"]}
    texto = body.texto or f"Enviei uma {'foto' if 'foto' in body.tipo else 'vídeo'} de correção."
    enviado = agent_service.log_direct(
        personal_id, aluno_id, texto, Ator.PERSONAL, CanalOrigem.PORTAL, midia=midia_ref,
    )
    return {"ok": 1, "midia_id": item["midia_id"], "whatsapp_enviado": enviado}


@router.get("/exercicios/{exercicio_id}/historico")
def historico(aluno_id: str, exercicio_id: str, limit: int = 5,
              personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    return sessao_service.historico_exercicio(aluno_id, exercicio_id, limit)


@router.get("/exercicios")
def list_exercicios(aluno_id: str, personal_id: str = Depends(get_current_personal_id)):
    """Lista plana de exercícios do aluno (todos os treinos)."""
    authz.authorize_aluno(personal_id, aluno_id)
    return sessao_service.list_exercicios_aluno(aluno_id)


@router.get("/resumo")
def resumo(aluno_id: str, personal_id: str = Depends(get_current_personal_id)):
    """Resumo de evolução do aluno (totais, volume semanal, PRs) — agregados."""
    authz.authorize_aluno(personal_id, aluno_id)
    return sessao_service.resumo_aluno(aluno_id)


@router.get("/exercicios/{exercicio_id}/evolucao")
def evolucao(aluno_id: str, exercicio_id: str, limit: int = 100,
             personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    return sessao_service.evolucao_exercicio(aluno_id, exercicio_id, limit)


class CorrecaoBody(BaseModel):
    texto: str
    exercicio_nome: str | None = None
    midias: list[dict] = []   # [{ s3_key: str, tipo: str }]


@router.post("/exercicios/{exercicio_id}/correcao", status_code=201)
def criar_correcao(aluno_id: str, exercicio_id: str, body: CorrecaoBody,
                   personal_id: str = Depends(get_current_personal_id)):
    """Post rico de correção (texto + mídias) vinculado a um exercício — aparece no feed."""
    authz.authorize_aluno(personal_id, aluno_id)
    item = correcao_service.criar_correcao(
        personal_id, aluno_id, exercicio_id, body.exercicio_nome,
        body.texto, body.midias,
    )
    return {"ok": 1, "correcao_id": item["correcao_id"]}


@router.get("/exercicios/{exercicio_id}/feed")
def feed_exercicio(aluno_id: str, exercicio_id: str,
                   personal_id: str = Depends(get_current_personal_id)):
    """Feed unificado do exercício: dores, dúvidas, correções, mídias e postagens."""
    authz.authorize_aluno(personal_id, aluno_id)
    return correcao_service.feed_exercicio(aluno_id, exercicio_id)


@router.post("/sessoes/backfill-evolucao")
def backfill_evolucao(aluno_id: str, personal_id: str = Depends(get_current_personal_id)):
    """Reconstrói os REG de evolução a partir do histórico de sessões.
    Corrige alunos afetados pelo bug de TTL (REG expirados em 6h)."""
    authz.authorize_aluno(personal_id, aluno_id)
    return sessao_service.backfill_reg_from_history(aluno_id)


@router.post("/exercicios/{exercicio_id}/postagem", status_code=201)
def criar_postagem_personal(aluno_id: str, exercicio_id: str, body: PostagemPersonalCreate,
                            personal_id: str = Depends(get_current_personal_id)):
    """Personal cria postagem no exercício do aluno (correção, execução ou outro)."""
    authz.authorize_aluno(personal_id, aluno_id)
    item = postagem_service.criar_postagem(
        aluno_id=aluno_id,
        exercicio_id=exercicio_id,
        exercicio_nome=body.exercicio_nome,
        tipo=body.tipo.value,
        descricao=body.descricao,
        midias=[m.model_dump() for m in body.midias],
        sessao_id=None,
        ator="PERSONAL",
        personal_id=personal_id,
    )
    return {"ok": 1, "post_id": item["post_id"]}


class ComentarPostPersonalBody(BaseModel):
    post_sk: str
    texto: str | None = None
    midias: list[MidiaRef] = []
    post_tipo: str | None = None  # DOR | DUVIDA | EXECUCAO | CORRECAO | OUTRO

    @model_validator(mode="after")
    def ao_menos_texto_ou_midia(self):
        if not self.texto and not self.midias:
            raise ValueError("Informe um texto ou ao menos uma mídia.")
        return self


@router.post("/post/comentar", status_code=201)
def comentar_post_personal(aluno_id: str, body: ComentarPostPersonalBody,
                            personal_id: str = Depends(get_current_personal_id)):
    """Personal adiciona comentário (com ou sem mídia) em thread de postagem (POST#)."""
    authz.authorize_aluno(personal_id, aluno_id)
    midias = [m.model_dump() for m in body.midias]
    ok = alerta_service.adicionar_comentario(aluno_id, body.post_sk, "PERSONAL", body.texto, midias)
    if not ok:
        raise HTTPException(404, "Postagem não encontrada.")
    parts = body.post_sk.split("#")
    exercicio_id = parts[1] if len(parts) > 1 else None
    preview = body.texto or "Enviou uma mídia"
    tipo_notif = "DOR_RESPONDIDA" if body.post_tipo == "DOR" else "DUVIDA_RESPONDIDA"
    anotif_service.criar(
        aluno_id, tipo_notif, "Resposta do seu personal",
        preview[:120] + ("…" if len(preview) > 120 else ""),
        ref_extra={"exercicio_id": exercicio_id, "relato_sk": body.post_sk},
    )
    return {"ok": True}


class ComentarRelatoPersonalBody(BaseModel):
    relato_sk: str
    texto: str | None = None
    midias: list[MidiaRef] = []

    @model_validator(mode="after")
    def ao_menos_texto_ou_midia(self):
        if not self.texto and not self.midias:
            raise ValueError("Informe um texto ou ao menos uma mídia.")
        return self


@router.post("/relato/comentar")
def comentar_relato_personal(aluno_id: str, body: ComentarRelatoPersonalBody,
                              personal_id: str = Depends(get_current_personal_id)):
    """Personal adiciona comentário (com ou sem mídia) em thread de dor/dúvida."""
    authz.authorize_aluno(personal_id, aluno_id)
    midias = [m.model_dump() for m in body.midias]
    ok = alerta_service.adicionar_comentario(aluno_id, body.relato_sk, "PERSONAL", body.texto, midias)
    if not ok:
        raise HTTPException(404, "Relato não encontrado")
    parts = body.relato_sk.split("#")
    exercicio_id = parts[1] if len(parts) > 1 and parts[1] != "NA" else None
    tipo_notif = "DOR_RESPONDIDA" if body.relato_sk.startswith("DOR#") else "DUVIDA_RESPONDIDA"
    preview = body.texto or "Enviou uma mídia"
    anotif_service.criar(aluno_id, tipo_notif, "Resposta do seu personal",
                         preview[:120] + ("…" if len(preview) > 120 else ""),
                         ref_extra={"exercicio_id": exercicio_id, "relato_sk": body.relato_sk})
    return {"ok": True}


class NotaBody(BaseModel):
    texto: str


@router.get("/notas")
def list_notas(aluno_id: str, limit: int = 50, cursor: str | None = None,
              personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    items, next_cursor = nota_service.listar(aluno_id, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.post("/notas", status_code=201)
def create_nota(aluno_id: str, body: NotaBody, personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    return nota_service.criar(aluno_id, body.texto)
