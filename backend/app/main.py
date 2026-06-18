from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from app.config import settings
from app.routers import (agenda, aluno, alunos, avaliacoes, biblioteca, config, dashboard,
                         feed_global, notificacoes, personal, personal_chat, sessoes, templates, treinos, wapi, webhook)

app = FastAPI(
    title="Personal Trainer",
    version="0.1.0",
    docs_url="/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Cognito JWT protege as rotas autenticadas
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhook.router)   # /v1/public/wapi/... (sem auth)
app.include_router(wapi.router)      # /v1/wapi/... (JWT do personal)
app.include_router(config.router)    # /v1/config/...
app.include_router(alunos.router)    # /v1/alunos
app.include_router(treinos.router)   # /v1/alunos/{id}/treinos[/exercicios]
app.include_router(sessoes.router)   # /v1/alunos/{id}/sessao | registros | historico
app.include_router(notificacoes.router) # /v1/notificacoes | /v1/pendencias
app.include_router(dashboard.router) # /v1/dashboard
app.include_router(avaliacoes.router) # /v1/alunos/{id}/avaliacoes
app.include_router(biblioteca.router) # /v1/biblioteca/exercicios
app.include_router(aluno.router)      # /v1/aluno/* (app do aluno — JWT escopado)
app.include_router(agenda.router)     # /v1/agenda
app.include_router(templates.router)  # /v1/templates
app.include_router(personal_chat.router)  # /v1/alunos/{aluno_id}/chat
app.include_router(feed_global.router)    # /v1/feed (posts globais do personal)
app.include_router(personal.router)      # /v1/personal/me (perfil do personal)


@app.get("/v1/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


# HTTP API v2 com stage nomeado entrega o path com prefixo /{stage} — Mangum o remove.
handler = Mangum(app, lifespan="off", api_gateway_base_path=f"/{settings.stage}")
