"""Sessão de treino e registros pelo PORTAL (personal). Pelo agente, as mesmas
operações vêm de agent_service. Tudo aninhado sob o aluno (ESPEC §3)."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_current_personal_id
from app.models.registro import SerieExec
from app.repositories import dynamo_repo as repo
from app.services import authz, sessao_service

router = APIRouter(prefix="/v1/alunos/{aluno_id}", tags=["sessoes"])


class StartBody(BaseModel):
    treino_id: str


class RegistroBody(BaseModel):
    series: list[SerieExec]
    exercicio_id: str | None = None


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
    return repo.clean(sessao_service.record(aluno_id, series, exercicio_id=body.exercicio_id))


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


@router.get("/exercicios/{exercicio_id}/evolucao")
def evolucao(aluno_id: str, exercicio_id: str, limit: int = 100,
             personal_id: str = Depends(get_current_personal_id)):
    authz.authorize_aluno(personal_id, aluno_id)
    return sessao_service.evolucao_exercicio(aluno_id, exercicio_id, limit)
