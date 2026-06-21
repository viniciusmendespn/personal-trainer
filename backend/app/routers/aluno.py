"""App do aluno (ESPEC §1.5) — escopo limitado à própria partição, via JWT do magic-link.
Sem Cognito (rota /v1/aluno/* com Authorizer NONE; o token é validado na Lambda)."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, model_validator

from app.dependencies import get_current_aluno
from app.models.enums import Ator, CanalOrigem, Classificacao
from app.models.registro import SerieExec
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.models.postagem import MidiaRef, PostagemCreate, PostagemTipo
from app.services import agent_service, alerta_service, anotif_service, badge_service, conhecimento_service, correcao_service, feed_global_service, financeiro_service, media_service, meta_service, notif_service, pontos_service, postagem_service, sessao_service
from app.utils import new_id, now_iso

router = APIRouter(prefix="/v1/aluno", tags=["app-aluno"])


class AlunoProprioPerfil(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    foto_s3_key: Optional[str] = None


class AvatarUploadUrlBody(BaseModel):
    filename: str
    content_type: str


class StartBody(BaseModel):
    treino_id: str


class RegistroBody(BaseModel):
    series: list[SerieExec]
    exercicio_id: str | None = None


@router.get("/me")
def me(ctx: dict = Depends(get_current_aluno)):
    item = repo.get_item(keys.pk_aluno(ctx["aluno_id"]), keys.SK_PROFILE)
    if not item:
        return {}
    profile = repo.clean(item)
    s3_key = profile.get("foto_s3_key")
    if s3_key:
        profile["foto_url"] = media_service.gerar_presigned_view_url(s3_key)
    return profile


@router.put("/me")
def update_me(body: AlunoProprioPerfil, ctx: dict = Depends(get_current_aluno)):
    fields = body.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(400, "Nenhum campo informado")
    fields["updated_at"] = now_iso()
    updated = repo.update_item(keys.pk_aluno(ctx["aluno_id"]), keys.SK_PROFILE, fields, return_values=True)
    # Sync foto_s3_key no pointer do personal para atualizar a lista de alunos
    if "foto_s3_key" in fields or "nome" in fields:
        pointer = repo.get_item(keys.pk_personal(ctx["personal_id"]), keys.sk_aluno_pointer(ctx["aluno_id"]))
        if pointer:
            pointer_fields: dict = {}
            if "nome" in fields:
                pointer_fields["nome"] = fields["nome"]
            if "foto_s3_key" in fields:
                pointer_fields["foto_s3_key"] = fields["foto_s3_key"]
            if pointer_fields:
                repo.update_item(keys.pk_personal(ctx["personal_id"]),
                                 keys.sk_aluno_pointer(ctx["aluno_id"]), pointer_fields)
    result = repo.clean(updated)
    s3_key = result.get("foto_s3_key")
    if s3_key:
        result["foto_url"] = media_service.gerar_presigned_view_url(s3_key)
    return result


@router.post("/me/avatar/upload-url")
def me_avatar_upload_url(body: AvatarUploadUrlBody, ctx: dict = Depends(get_current_aluno)):
    result = media_service.gerar_presigned_upload_url_perfil(
        "aluno", ctx["aluno_id"], body.filename, body.content_type
    )
    if not result:
        raise HTTPException(502, "Não foi possível gerar a URL de upload.")
    return result


@router.get("/personal")
def get_personal_profile(ctx: dict = Depends(get_current_aluno)):
    """Retorna o perfil público do personal — para a aba 'Sobre o Personal' no app do aluno."""
    item = repo.get_item(keys.pk_personal(ctx["personal_id"]), keys.SK_PROFILE)
    if not item:
        return {"personal_id": ctx["personal_id"]}
    profile = repo.clean(item)
    s3_key = profile.get("foto_s3_key")
    if s3_key:
        profile["foto_url"] = media_service.gerar_presigned_view_url(s3_key)
    return profile


@router.get("/conhecimento")
def conhecimento_listar(ctx: dict = Depends(get_current_aluno)):
    """Nomes dos arquivos da base de conhecimento do personal — só pra exibir antes de baixar."""
    return [{"filename": a["filename"]} for a in conhecimento_service.list_arquivos(ctx["personal_id"])]


@router.get("/conhecimento/download")
def conhecimento_download(ctx: dict = Depends(get_current_aluno)):
    try:
        url = conhecimento_service.gerar_zip_download_url(ctx["personal_id"])
    except ValueError as e:
        raise HTTPException(413, str(e))
    if not url:
        raise HTTPException(404, "Seu personal ainda não disponibilizou material.")
    return {"download_url": url}


@router.get("/hoje")
def hoje(ctx: dict = Depends(get_current_aluno)):
    aluno_id = ctx["aluno_id"]
    treinos = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.SK_TREINO_PREFIX)
    hoje_str = date.today().isoformat()
    treinos = [
        t for t in treinos
        if t.get("ativo", True)
        and (not t.get("data_inicio") or t["data_inicio"] <= hoje_str)
        and (not t.get("data_fim") or t["data_fim"] >= hoje_str)
    ]
    treinos.sort(key=lambda t: t.get("ordem", 0))
    ult_prox = sessao_service.ultimo_e_proximo(aluno_id)
    return {
        "hoje": agent_service.treino_de_hoje(aluno_id)["treinos"],
        "treinos": repo.clean_all(treinos),
        "ultimo": ult_prox["ultimo"],
        "proximo": ult_prox["proximo"],
    }


@router.get("/treinos/{treino_id}/exercicios")
def exercicios(treino_id: str, ctx: dict = Depends(get_current_aluno)):
    items = repo.query_pk(keys.pk_aluno(ctx["aluno_id"]), sk_prefix=keys.sk_exercicio_prefix(treino_id))
    items.sort(key=lambda e: e.get("ordem", 0))
    return repo.clean_all(items)


@router.get("/sessao")
def get_sessao(ctx: dict = Depends(get_current_aluno)):
    return repo.clean(sessao_service.get_active(ctx["aluno_id"]))


@router.get("/sessao/exercicios")
def sessao_exercicios(ctx: dict = Depends(get_current_aluno)):
    """Sessão ativa com todos os exercícios + o que já foi registrado (ver treino todo)."""
    return sessao_service.sessao_exercicios(ctx["aluno_id"])


@router.post("/sessao/start", status_code=201)
def start(body: StartBody, ctx: dict = Depends(get_current_aluno)):
    return repo.clean(sessao_service.start_session(ctx["personal_id"], ctx["aluno_id"], body.treino_id))


@router.post("/sessao/advance")
def advance(ctx: dict = Depends(get_current_aluno)):
    return repo.clean(sessao_service.advance(ctx["aluno_id"]))


@router.post("/sessao/cancel", status_code=204)
def cancel(ctx: dict = Depends(get_current_aluno)):
    sessao_service.cancelar(ctx["aluno_id"])


@router.post("/sessao/finish")
def finish(ctx: dict = Depends(get_current_aluno)):
    return repo.clean(sessao_service.finish(ctx["aluno_id"]))


@router.post("/registros", status_code=201)
def registrar(body: RegistroBody, ctx: dict = Depends(get_current_aluno)):
    """Substitui as séries do exercício (permite registrar e editar depois)."""
    series = [s.model_dump() for s in body.series]
    registro, pr = sessao_service.set_series(
        ctx["aluno_id"], body.exercicio_id, series,
        canal=CanalOrigem.PORTAL, classificacao=Classificacao.AUTO, ator=Ator.ALUNO)
    out = repo.clean(registro)
    # Streak atual para aplicar multiplicador (1 GetItem, compartilhado entre os awards)
    st = repo.get_item(keys.pk_aluno(ctx["aluno_id"]), keys.SK_STATS_ALUNO) or {}
    streak = int(st.get("streak_atual", 0))
    if pr:
        out["pr_novo"] = pr
        pontos_service.award(ctx["aluno_id"], "PR", ctx["personal_id"],
                             descricao=f"Novo recorde: {pr}", streak=streak)
        meta_service.verificar_metas_carga(
            ctx["aluno_id"], ctx["personal_id"], body.exercicio_id or "", float(pr)
        )
    pontos_service.award(ctx["aluno_id"], "SERIE", ctx["personal_id"],
                        descricao="Série registrada", streak=streak)
    return out


@router.get("/exercicios")
def list_exercicios(ctx: dict = Depends(get_current_aluno)):
    return sessao_service.list_exercicios_aluno(ctx["aluno_id"])


@router.get("/exercicios/{exercicio_id}/evolucao")
def evolucao(exercicio_id: str, ctx: dict = Depends(get_current_aluno)):
    return sessao_service.evolucao_exercicio(ctx["aluno_id"], exercicio_id)


@router.get("/exercicios/{exercicio_id}/midia")
def midia_exercicio_aluno(exercicio_id: str, ctx: dict = Depends(get_current_aluno)):
    """Vídeos/fotos (execução do aluno + correção do personal) anexados nesse exercício."""
    return media_service.list_midia_exercicio(ctx["aluno_id"], exercicio_id)


@router.get("/sessoes")
def list_sessoes(limit: int = 10, cursor: str | None = None, ctx: dict = Depends(get_current_aluno)):
    """Histórico de sessões finalizadas (mais recentes primeiro) — timeline do aluno."""
    items, next_cursor = sessao_service.list_sessoes(ctx["aluno_id"], limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/sessoes/{sessao_id}")
def get_sessao_detalhe_aluno(sessao_id: str, ctx: dict = Depends(get_current_aluno)):
    """Detalhe completo de uma sessão com prescrição + mídia por exercício."""
    aluno_id = ctx["aluno_id"]
    pk = keys.pk_aluno(aluno_id)
    idx = repo.get_item(pk, keys.sk_sessao_idx(sessao_id))
    if not idx:
        raise HTTPException(404, "Sessão não encontrada")
    session = repo.get_item(pk, idx["sk"])
    if not session:
        raise HTTPException(404, "Sessão não encontrada")
    s = repo.clean(session)
    for ex in s.get("exercicios_exec") or []:
        ex["midia"] = media_service.list_midia_exercicio(aluno_id, ex["exercicio_id"])
        ex["relatos"] = correcao_service.relatos_sessao(aluno_id, ex["exercicio_id"], sessao_id)
    return s


@router.get("/resumo")
def resumo(ctx: dict = Depends(get_current_aluno)):
    return sessao_service.resumo_aluno(ctx["aluno_id"])


@router.get("/avaliacoes")
def avaliacoes(ctx: dict = Depends(get_current_aluno)):
    items = repo.query_pk(keys.pk_aluno(ctx["aluno_id"]), sk_prefix=keys.AVAL_PREFIX)
    return repo.clean_all(items)


class ChatBody(BaseModel):
    text: str


class MidiaUploadUrlBody(BaseModel):
    filename: str
    content_type: str


class MidiaRegistrarBody(BaseModel):
    s3_key: str
    tipo: str                          # "video_execucao" | "foto_exercicio"
    exercicio_id: str
    exercicio_nome: str | None = None


@router.post("/midia/upload-url")
def midia_upload_url(body: MidiaUploadUrlBody, ctx: dict = Depends(get_current_aluno)):
    result = media_service.gerar_presigned_upload_url(ctx["aluno_id"], body.filename, body.content_type)
    if not result:
        raise HTTPException(502, "Não foi possível gerar a URL de upload.")
    return result


@router.post("/midia", status_code=201)
def midia_registrar(body: MidiaRegistrarBody, ctx: dict = Depends(get_current_aluno)):
    item = media_service.registrar_midia_vinculada(
        ctx["aluno_id"], body.exercicio_id, body.exercicio_nome, body.tipo, body.s3_key
    )
    notif_service.criar(
        ctx["personal_id"], "MIDIA", "Nova mídia de execução",
        f"O aluno enviou uma mídia em {body.exercicio_nome or 'um exercício'} pra você analisar.",
        aluno_id=ctx["aluno_id"],
        ref_extra={"exercicio_id": body.exercicio_id, "exercicio_nome": body.exercicio_nome},
    )
    return {"ok": 1, "midia_id": item["midia_id"]}


class RelatoBody(BaseModel):
    tipo: str                          # "dor" | "duvida"
    exercicio_id: str | None = None
    exercicio_nome: str | None = None
    descricao: str


@router.post("/relato", status_code=201)
def relato(body: RelatoBody, ctx: dict = Depends(get_current_aluno)):
    """Relato de dor ou dúvida sobre um exercício — cria item próprio + notificação ao personal."""
    sessao_ativa = sessao_service.get_active(ctx["aluno_id"])
    sessao_id = sessao_ativa["sessao_id"] if sessao_ativa else None
    if body.tipo == "dor":
        alerta_service.registrar_dor(
            ctx["personal_id"], ctx["aluno_id"], body.descricao,
            exercicio_id=body.exercicio_id, exercicio_nome=body.exercicio_nome,
            canal=CanalOrigem.PORTAL, ator=Ator.ALUNO, sessao_id=sessao_id,
        )
    else:
        alerta_service.registrar_duvida(
            ctx["personal_id"], ctx["aluno_id"], body.descricao,
            exercicio_id=body.exercicio_id, exercicio_nome=body.exercicio_nome,
            canal=CanalOrigem.PORTAL, ator=Ator.ALUNO, sessao_id=sessao_id,
        )
    return {"ok": 1}


class ComentarRelatoBody(BaseModel):
    relato_sk: str
    texto: str | None = None
    midias: list[MidiaRef] = []

    @model_validator(mode="after")
    def ao_menos_texto_ou_midia(self):
        if not self.texto and not self.midias:
            raise ValueError("Informe um texto ou ao menos uma mídia.")
        return self


@router.post("/relato/comentar", status_code=201)
def comentar_relato(body: ComentarRelatoBody, ctx: dict = Depends(get_current_aluno)):
    """Aluno adiciona comentário (com ou sem mídia) em uma thread de dor ou dúvida."""
    midias = [m.model_dump() for m in body.midias]
    ok = alerta_service.adicionar_comentario(ctx["aluno_id"], body.relato_sk, Ator.ALUNO.value, body.texto, midias)
    if not ok:
        raise HTTPException(404, "Relato não encontrado")
    parts = body.relato_sk.split("#")
    exercicio_id = parts[1] if len(parts) > 1 and parts[1] != "NA" else None
    tipo_notif = "DOR" if body.relato_sk.startswith("DOR#") else "DUVIDA"
    preview = body.texto or "Enviou uma mídia"
    notif_service.criar(
        ctx["personal_id"], tipo_notif, "Novo comentário do aluno",
        preview[:120] + ("…" if len(preview) > 120 else ""),
        aluno_id=ctx["aluno_id"],
        ref_extra={"relato_sk": body.relato_sk, "relato_tipo": tipo_notif.lower(),
                   "exercicio_id": exercicio_id},
    )
    return {"ok": 1}


@router.get("/notificacoes")
def list_anotif(limit: int = 30, cursor: str | None = None,
                ctx: dict = Depends(get_current_aluno)):
    items, next_cursor = anotif_service.listar(ctx["aluno_id"], limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/notificacoes/count")
def count_anotif(ctx: dict = Depends(get_current_aluno)):
    return {"nao_lidas": anotif_service.nao_lidas(ctx["aluno_id"])}


class AnotifRefBody(BaseModel):
    ref: str


@router.post("/notificacoes/lida")
def marcar_anotif_lida(body: AnotifRefBody, ctx: dict = Depends(get_current_aluno)):
    anotif_service.marcar_lida(ctx["aluno_id"], body.ref)
    return {"ok": True}


@router.get("/exercicios/{exercicio_id}/feed")
def feed_exercicio_aluno(exercicio_id: str, ctx: dict = Depends(get_current_aluno)):
    """Feed unificado do exercício: dores, dúvidas, correções, mídias e postagens."""
    return correcao_service.feed_exercicio(ctx["aluno_id"], exercicio_id)


@router.post("/exercicios/{exercicio_id}/postagem", status_code=201)
def criar_postagem(exercicio_id: str, body: PostagemCreate, ctx: dict = Depends(get_current_aluno)):
    """Aluno cria postagem no exercício: execução, dor, dúvida ou outro."""
    if body.tipo == PostagemTipo.CORRECAO:
        raise HTTPException(403, "Aluno não pode criar postagem do tipo CORRECAO.")
    sessao_ativa = sessao_service.get_active(ctx["aluno_id"])
    sessao_id = sessao_ativa["sessao_id"] if sessao_ativa else body.sessao_id
    item = postagem_service.criar_postagem(
        aluno_id=ctx["aluno_id"],
        exercicio_id=exercicio_id,
        exercicio_nome=body.exercicio_nome,
        tipo=body.tipo.value,
        descricao=body.descricao,
        midias=[m.model_dump() for m in body.midias],
        sessao_id=sessao_id,
        ator="ALUNO",
        personal_id=ctx["personal_id"],
    )
    pontos_service.award(ctx["aluno_id"], "POST", ctx["personal_id"], descricao=f"Post {body.tipo.value}")
    return {"ok": 1, "post_id": item["post_id"]}


class ComentarPostBody(BaseModel):
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
def comentar_post(body: ComentarPostBody, ctx: dict = Depends(get_current_aluno)):
    """Aluno adiciona comentário (com ou sem mídia) em thread de postagem (POST#)."""
    midias = [m.model_dump() for m in body.midias]
    ok = alerta_service.adicionar_comentario(ctx["aluno_id"], body.post_sk, "ALUNO", body.texto, midias)
    if not ok:
        raise HTTPException(404, "Postagem não encontrada.")
    parts = body.post_sk.split("#")
    exercicio_id = parts[1] if len(parts) > 1 else None
    preview = body.texto or "Enviou uma mídia"
    tipo_notif = "DOR" if body.post_tipo == "DOR" else "DUVIDA"
    notif_service.criar(
        ctx["personal_id"], tipo_notif, "Novo comentário do aluno",
        preview[:120] + ("…" if len(preview) > 120 else ""),
        aluno_id=ctx["aluno_id"],
        ref_extra={"relato_sk": body.post_sk, "exercicio_id": exercicio_id},
    )
    pontos_service.award(ctx["aluno_id"], "COMENTARIO", ctx["personal_id"], descricao="Comentário em post")
    return {"ok": 1}


@router.get("/chat")
def chat_history(limit: int = 50, cursor: str | None = None, ctx: dict = Depends(get_current_aluno)):
    items, next_cursor = agent_service.list_chat_msgs(ctx["aluno_id"], limit, cursor)
    return {
        "items": items,
        "next_cursor": next_cursor,
        "agente_habilitado": agent_service.is_agente_habilitado(ctx["aluno_id"]),
    }


@router.post("/chat")
def chat_send(body: ChatBody, ctx: dict = Depends(get_current_aluno)):
    if not agent_service.is_agente_habilitado(ctx["aluno_id"]):
        agent_service.log_direct(ctx["personal_id"], ctx["aluno_id"],
                                 body.text, Ator.ALUNO, CanalOrigem.PORTAL)
        return {"reply": "Seu personal irá responder em breve.", "habilitado": False}
    reply = agent_service.handle_chat_turn(ctx["personal_id"], ctx["aluno_id"], body.text, Ator.ALUNO)
    return {"reply": reply}


@router.post("/chat/personal", status_code=201)
def chat_send_personal(body: ChatBody, ctx: dict = Depends(get_current_aluno)):
    """Pergunta direta ao personal — não passa pelo agente, gera notificação."""
    agent_service.log_direct(ctx["personal_id"], ctx["aluno_id"], body.text, Ator.ALUNO, CanalOrigem.PORTAL)
    notif_service.criar(
        ctx["personal_id"], "PERGUNTA_DIRETA", "Pergunta direta do aluno",
        body.text, aluno_id=ctx["aluno_id"],
    )
    return {"ok": 1}


# ── Feed global do personal ─────────────────────────────────────────────────

@router.get("/feed")
def listar_feed_global(limit: int = 20, cursor: str | None = None, ctx: dict = Depends(get_current_aluno)):
    items, next_cursor = feed_global_service.listar_posts_global(
        ctx["personal_id"], aluno_id=ctx["aluno_id"], limit=limit, cursor=cursor,
    )
    return {"items": items, "next_cursor": next_cursor}


class CurtirFeedBody(BaseModel):
    post_sk: str   # "FEED#{ts}#{post_id}"


@router.post("/feed/curtir")
def curtir_feed(body: CurtirFeedBody, ctx: dict = Depends(get_current_aluno)):
    parts = body.post_sk.split("#")
    post_id = parts[-1]
    result = feed_global_service.toggle_curtida(ctx["aluno_id"], ctx["personal_id"], post_id, body.post_sk)
    return result


# ── Gamificação ─────────────────────────────────────────────────────────────

@router.get("/pontos")
def get_pontos(ctx: dict = Depends(get_current_aluno)):
    result = pontos_service.get_pontos(ctx["aluno_id"])
    # Inclui streak e multiplicador para o widget de pontos
    st = repo.get_item(keys.pk_aluno(ctx["aluno_id"]), keys.SK_STATS_ALUNO) or {}
    streak_atual = int(st.get("streak_atual", 0))
    result["streak_atual"] = streak_atual
    result["streak_maximo"] = int(st.get("streak_maximo", 0))
    result["multiplicador_atual"] = pontos_service.multiplicador_streak(streak_atual)
    return result


@router.get("/badges")
def listar_badges(ctx: dict = Depends(get_current_aluno)):
    return badge_service.listar_badges_aluno(ctx["aluno_id"])


@router.get("/ranking")
def get_ranking(ctx: dict = Depends(get_current_aluno)):
    ranking = pontos_service.get_ranking(ctx["personal_id"])
    aluno_id = ctx["aluno_id"]
    for r in ranking:
        r["eu"] = r.get("aluno_id") == aluno_id
        # foto_s3_key já vem denormalizada no item de ranking (pontos_service.award) — sem N+1.
        s3_key = r.get("foto_s3_key")
        r["foto_url"] = media_service.gerar_presigned_view_url(s3_key) if s3_key else None
    return ranking


# ── Metas / objetivos ────────────────────────────────────────────────────────

class MetaPropostaBody(BaseModel):
    tipo: str
    titulo: str
    descricao: str | None = None
    valor_alvo: float
    unidade: str
    exercicio_id: str | None = None
    exercicio_nome: str | None = None
    campo_medida: str | None = None
    data_limite: str | None = None


@router.get("/metas")
def listar_metas_aluno(ctx: dict = Depends(get_current_aluno)):
    return meta_service.listar(ctx["aluno_id"], status=None)


@router.post("/metas", status_code=201)
def propor_meta_aluno(body: MetaPropostaBody, ctx: dict = Depends(get_current_aluno)):
    return meta_service.criar(ctx["aluno_id"], ctx["personal_id"],
                              body.model_dump(), criado_por="ALUNO")


@router.get("/financeiro")
def listar_cobranças_aluno(ctx: dict = Depends(get_current_aluno)):
    """Cobranças do próprio aluno — somente leitura."""
    items, _ = financeiro_service.listar_cobranças(
        ctx["personal_id"], ctx["aluno_id"], limit=100)
    return {"items": items}
