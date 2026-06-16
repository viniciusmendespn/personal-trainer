"""App do aluno (ESPEC §1.5) — escopo limitado à própria partição, via JWT do magic-link.
Sem Cognito (rota /v1/aluno/* com Authorizer NONE; o token é validado na Lambda)."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_current_aluno
from app.models.enums import Ator, CanalOrigem, Classificacao
from app.models.registro import SerieExec
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import agent_service, sessao_service

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
    return {"hoje": agent_service.treino_de_hoje(aluno_id)["treinos"], "treinos": repo.clean_all(treinos)}


@router.get("/treinos/{treino_id}/exercicios")
def exercicios(treino_id: str, ctx: dict = Depends(get_current_aluno)):
    items = repo.query_pk(keys.pk_aluno(ctx["aluno_id"]), sk_prefix=keys.sk_exercicio_prefix(treino_id))
    items.sort(key=lambda e: e.get("ordem", 0))
    return repo.clean_all(items)


@router.get("/sessao")
def get_sessao(ctx: dict = Depends(get_current_aluno)):
    return repo.clean(sessao_service.get_active(ctx["aluno_id"]))


@router.post("/sessao/start", status_code=201)
def start(body: StartBody, ctx: dict = Depends(get_current_aluno)):
    return repo.clean(sessao_service.start_session(ctx["personal_id"], ctx["aluno_id"], body.treino_id))


@router.post("/sessao/advance")
def advance(ctx: dict = Depends(get_current_aluno)):
    return repo.clean(sessao_service.advance(ctx["aluno_id"]))


@router.post("/sessao/finish")
def finish(ctx: dict = Depends(get_current_aluno)):
    return repo.clean(sessao_service.finish(ctx["aluno_id"]))


@router.post("/registros", status_code=201)
def registrar(body: RegistroBody, ctx: dict = Depends(get_current_aluno)):
    series = [s.model_dump() for s in body.series]
    registro, pr = sessao_service.record(
        ctx["aluno_id"], series, exercicio_id=body.exercicio_id,
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
