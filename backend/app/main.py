from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from app.routers import wapi, webhook

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

# Próximos routers (quando os atributos das entidades forem definidos — ESPEC §8):
#   alunos, treinos, sessoes, registros, alertas, pendencias, dashboard


@app.get("/v1/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


handler = Mangum(app, lifespan="off")
