"""Dashboard do personal — contadores a partir da partição PT# (bounded, sem scan)."""
from fastapi import APIRouter, Depends

from app.dependencies import get_current_personal_id
from app.models.enums import AlertaStatus
from app.repositories import dynamo_repo as repo
from app.repositories import keys

router = APIRouter(prefix="/v1", tags=["dashboard"])


@router.get("/dashboard")
def dashboard(personal_id: str = Depends(get_current_personal_id)):
    pk = keys.pk_personal(personal_id)
    alunos = repo.query_pk(pk, sk_prefix="ALUNO#")
    alertas = repo.query_pk(pk, sk_prefix="ALERT#")
    pendencias = repo.query_pk(pk, sk_prefix="PEND#")
    abertos = sum(1 for a in alertas if a.get("status") == AlertaStatus.ABERTO.value)
    return {
        "alunos": len(alunos),
        "alunos_ativos": sum(1 for a in alunos if a.get("status") == "ATIVO"),
        "alertas_abertos": abertos,
        "pendencias": len(pendencias),
    }
