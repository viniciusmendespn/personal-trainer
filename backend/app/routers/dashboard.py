"""Dashboard do personal — contadores a partir da partição PT# (bounded, sem scan)."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from app.dependencies import get_current_personal_id
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import media_service, notif_service

router = APIRouter(prefix="/v1", tags=["dashboard"])


@router.get("/dashboard")
def dashboard(personal_id: str = Depends(get_current_personal_id)):
    pk = keys.pk_personal(personal_id)
    stats_alunos = repo.get_item(pk, keys.SK_STATS_ALUNOS)
    if stats_alunos is not None:
        total_alunos = int(stats_alunos.get("total", 0))
        alunos_ativos = int(stats_alunos.get("ativos", 0))
    else:
        # Lazy init: personal existente, contador ainda não criado — calcula 1x e aquece o agregado.
        alunos = repo.query_pk(pk, sk_prefix="ALUNO#")
        total_alunos = len(alunos)
        alunos_ativos = sum(1 for a in alunos if a.get("status") == "ATIVO")
        repo.update_item(pk, keys.SK_STATS_ALUNOS, {"total": total_alunos, "ativos": alunos_ativos})
    stats_notif = repo.get_item(pk, keys.SK_STATS_NOTIF)
    nao_lidas = int(stats_notif.get("nao_lidas", 0)) if stats_notif is not None else notif_service.nao_lidas(personal_id)

    # Sessões por dia (últimos 14 dias) — lê STATS#D# da partição PT# (escrita em finish())
    hoje = datetime.now(timezone.utc).date()
    dias = [(hoje - timedelta(days=i)).isoformat() for i in range(13, -1, -1)]
    stats_dias = repo.query_pk(pk, sk_prefix="STATS#D#")
    por_dia = {s.get("data", ""): int(s.get("sessoes", 0)) for s in stats_dias}
    sessoes_por_dia = [{"data": d, "total": por_dia.get(d, 0)} for d in dias]

    # Atividade recente (últimos 10 alunos que treinaram/estão treinando) — 1 query no GSI1
    # (item denormalizado na escrita por sessao_service._touch_atividade, sem fan-out por aluno).
    atividade_raw = repo.clean_all(repo.query_gsi1_last(keys.gsi1_atividade(personal_id), limit=10))
    perfis = {
        aid: repo.get_item(keys.pk_aluno(aid), keys.SK_PROFILE)
        for aid in {a["aluno_id"] for a in atividade_raw}
    }
    atividade_recente = []
    for a in atividade_raw:
        perfil = perfis.get(a["aluno_id"]) or {}
        foto_s3_key = perfil.get("foto_s3_key")
        atividade_recente.append({
            "aluno_id": a["aluno_id"],
            "aluno_nome": perfil.get("nome", "?"),
            "foto_url": media_service.gerar_presigned_view_url(foto_s3_key) if foto_s3_key else None,
            "status": a.get("status"),
            "treino_nome": a.get("treino_nome"),
            "exercicio_atual": a.get("exercicio_atual"),
            "ordem_atual": a.get("ordem_atual"),
            "total_ex": a.get("total_ex"),
            "atualizado_em": a.get("atualizado_em"),
        })

    return {
        "alunos": total_alunos,
        "alunos_ativos": alunos_ativos,
        "notificacoes_nao_lidas": nao_lidas,
        "sessoes_por_dia": sessoes_por_dia,
        "atividade_recente": atividade_recente,
    }
