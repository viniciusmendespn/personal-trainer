"""Dashboard do personal — contadores a partir da partição PT# (bounded, sem scan)."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from app.dependencies import get_current_personal_id
from app.repositories import dynamo_repo as repo
from app.repositories import keys

router = APIRouter(prefix="/v1", tags=["dashboard"])


@router.get("/dashboard")
def dashboard(personal_id: str = Depends(get_current_personal_id)):
    pk = keys.pk_personal(personal_id)
    alunos = repo.query_pk(pk, sk_prefix="ALUNO#")
    notifs = repo.query_pk(pk, sk_prefix=keys.NOTIF_PREFIX)
    nao_lidas = sum(1 for n in notifs if not n.get("lida"))

    # Sessões por dia (últimos 14 dias) — lê STATS#D# da partição PT# (escrita em finish())
    hoje = datetime.now(timezone.utc).date()
    dias = [(hoje - timedelta(days=i)).isoformat() for i in range(13, -1, -1)]
    stats_dias = repo.query_pk(pk, sk_prefix="STATS#D#")
    por_dia = {s.get("data", ""): int(s.get("sessoes", 0)) for s in stats_dias}
    sessoes_por_dia = [{"data": d, "total": por_dia.get(d, 0)} for d in dias]

    return {
        "alunos": len(alunos),
        "alunos_ativos": sum(1 for a in alunos if a.get("status") == "ATIVO"),
        "notificacoes_nao_lidas": nao_lidas,
        "sessoes_por_dia": sessoes_por_dia,
    }
