"""App do aluno (ESPEC §1.5) — escopo limitado à própria partição, via JWT do magic-link.
Sem Cognito (rota /v1/aluno/* com Authorizer NONE; o token é validado na Lambda)."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_aluno
from app.models.enums import Ator, CanalOrigem, Classificacao
from app.models.registro import SerieExec
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.models.postagem import PostagemCreate, PostagemTipo
from app.services import agent_service, alerta_service, anotif_service, correcao_service, media_service, notif_service, postagem_service, sessao_service
from app.utils import new_id, now_iso

router = APIRouter(prefix="/v1/aluno", tags=["app-aluno"])


class StartBody(BaseModel):
    treino_id: str


class RegistroBody(BaseModel):
    series: list[SerieExec]
    exercicio_id: str | None = None


@router.get("/me")
def me(ctx: dict = Depends(get_current_aluno)):
    item = repo.get_item(keys.pk_aluno(ctx["aluno_id"]), keys.SK_PROFILE)
    return repo.clean(item) or {}


@router.get("/hoje")
def hoje(ctx: dict = Depends(get_current_aluno)):
    aluno_id = ctx["aluno_id"]
    treinos = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.SK_TREINO_PREFIX)
    hoje_str = date.today().isoformat()
    treinos = [
        t for t in treinos
        if (not t.get("data_inicio") or t["data_inicio"] <= hoje_str)
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
    if pr:
        out["pr_novo"] = pr
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
    texto: str


@router.post("/relato/comentar", status_code=201)
def comentar_relato(body: ComentarRelatoBody, ctx: dict = Depends(get_current_aluno)):
    """Aluno adiciona comentário em uma thread de dor ou dúvida."""
    ok = alerta_service.adicionar_comentario(ctx["aluno_id"], body.relato_sk, Ator.ALUNO.value, body.texto)
    if not ok:
        raise HTTPException(404, "Relato não encontrado")
    # Parse exercicio_id from relato_sk (e.g. DOR#{exercicio_id}#{ts}#{id})
    parts = body.relato_sk.split("#")
    exercicio_id = parts[1] if len(parts) > 1 and parts[1] != "NA" else None
    tipo_notif = "DOR" if body.relato_sk.startswith("DOR#") else "DUVIDA"
    notif_service.criar(
        ctx["personal_id"], tipo_notif, "Novo comentário do aluno",
        body.texto[:120] + ("…" if len(body.texto) > 120 else ""),
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
    """Aluno cria postagem no exercício: execução (mídia), dor ou dúvida."""
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
    return {"ok": 1, "post_id": item["post_id"]}


class ComentarPostBody(BaseModel):
    post_sk: str
    texto: str


@router.post("/post/comentar", status_code=201)
def comentar_post(body: ComentarPostBody, ctx: dict = Depends(get_current_aluno)):
    """Aluno adiciona comentário em thread de postagem (POST#)."""
    ok = alerta_service.adicionar_comentario(ctx["aluno_id"], body.post_sk, "ALUNO", body.texto)
    if not ok:
        raise HTTPException(404, "Postagem não encontrada.")
    parts = body.post_sk.split("#")
    exercicio_id = parts[1] if len(parts) > 1 else None
    notif_service.criar(
        ctx["personal_id"], "DOR", "Novo comentário do aluno",
        body.texto[:120] + ("…" if len(body.texto) > 120 else ""),
        aluno_id=ctx["aluno_id"],
        ref_extra={"relato_sk": body.post_sk, "exercicio_id": exercicio_id},
    )
    return {"ok": 1}


@router.get("/chat")
def chat_history(limit: int = 50, cursor: str | None = None, ctx: dict = Depends(get_current_aluno)):
    items, next_cursor = agent_service.list_chat_msgs(ctx["aluno_id"], limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.post("/chat")
def chat_send(body: ChatBody, ctx: dict = Depends(get_current_aluno)):
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
