"""Preview público p/ WhatsApp + redirect para o app do aluno.

O crawler do WhatsApp não executa JS — para personalizar o card de preview por aluno
precisamos servir um HTML server-side com as OG tags já preenchidas. O usuário real é
redirecionado para a SPA (`/?token=<uuid>`), onde o fluxo de auth/cookie acontece igual.

Link amigável compartilhado: https://app.coachpilot.com.br/token/<uuid>
"""
from html import escape

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from app.config import settings
from app.repositories import dynamo_repo as repo
from app.repositories import keys

router = APIRouter(tags=["preview"])

_OG_IMAGE = "https://app.coachpilot.com.br/icon-512.png"  # ícone do app (quadrado, leve) — og-image.jpg é grande/poluída demais p/ o card


@router.get("/token/{token}", response_class=HTMLResponse, include_in_schema=False)
def preview_token(token: str):
    app_url = f"{settings.aluno_frontend_url}/?token={token}"
    preview_url = f"{settings.aluno_frontend_url}/token/{token}"

    titulo = "Treinos — CoachPilot"
    descricao = "Acesse seus treinos no CoachPilot"

    tok = repo.get_item(f"TOKEN#{token}", "META")
    if tok:
        aluno = repo.get_item(keys.pk_aluno(tok["aluno_id"]), keys.SK_PROFILE) or {}
        personal = repo.get_item(keys.pk_personal(tok["personal_id"]), keys.SK_PROFILE) or {}
        nome_aluno = (aluno.get("nome") or "").split()[0] if aluno.get("nome") else ""
        nome_personal = (personal.get("nome") or "").split()[0] if personal.get("nome") else ""
        if nome_aluno:
            titulo = f"Treinos de {nome_aluno} — CoachPilot"
        if nome_personal:
            descricao = f"Acompanhe seus treinos com {nome_personal}"

    return HTMLResponse(_html(app_url, preview_url, escape(titulo), escape(descricao)))


def _html(app_url: str, og_url: str, titulo: str, descricao: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8">
<title>{titulo}</title>
<meta name="description" content="{descricao}">
<meta property="og:type" content="website">
<meta property="og:url" content="{og_url}">
<meta property="og:title" content="{titulo}">
<meta property="og:description" content="{descricao}">
<meta property="og:image" content="{_OG_IMAGE}">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="CoachPilot">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url={app_url}">
</head><body><script>window.location.replace("{app_url}");</script></body></html>"""
