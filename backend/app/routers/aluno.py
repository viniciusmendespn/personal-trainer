"""App do aluno (ESPEC §1.5) — escopo limitado à própria partição, via JWT do magic-link.
Sem Cognito (rota /v1/aluno/* com Authorizer NONE; o token é validado na Lambda)."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_current_aluno
from app.models.enums import Ator, CanalOrigem, Classificacao
from app.models.registro import SerieExec
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import agent_service, alerta_service, media_service, notif_service, sessao_service

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
    )
    return {"ok": 1, "midia_id": item["midia_id"]}


class RelatoBody(BaseModel):
    tipo: str                          # "dor" | "duvida"
    exercicio_id: str | None = None
    exercicio_nome: str | None = None
    descricao: str


@router.post("/relato", status_code=201)
def relato(body: RelatoBody, ctx: dict = Depends(get_current_aluno)):
    """Relato de dor ou dúvida sobre um exercício, fora do fluxo do agente — gera
    notificação direta ao personal (RF009 / mesmo padrão do agente, mas via UI)."""
    if body.tipo == "dor":
        alerta_service.registrar_dor(
            ctx["personal_id"], ctx["aluno_id"], body.descricao,
            exercicio_id=body.exercicio_id, exercicio_nome=body.exercicio_nome,
            canal=CanalOrigem.PORTAL, ator=Ator.ALUNO,
        )
    else:
        contexto = f" em {body.exercicio_nome}" if body.exercicio_nome else ""
        notif_service.criar(
            ctx["personal_id"], "DUVIDA", "Dúvida do aluno",
            f"O aluno teve uma dúvida{contexto}: {body.descricao}", aluno_id=ctx["aluno_id"],
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
    agent_service.log_direct(ctx["aluno_id"], body.text, Ator.ALUNO, CanalOrigem.PORTAL)
    notif_service.criar(
        ctx["personal_id"], "PERGUNTA_DIRETA", "Pergunta direta do aluno",
        body.text, aluno_id=ctx["aluno_id"],
    )
    return {"ok": 1}
