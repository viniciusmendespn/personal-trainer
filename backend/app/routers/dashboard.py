"""Dashboard do personal — contadores a partir da partição PT# (bounded, sem scan)."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends

from app.dependencies import get_current_personal_id
from app.models.enums import SessaoStatus
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import media_service, notif_service
from app.services.sessao_service import SESSION_TTL_S

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

    # Aderência (últimos 7d vs 7d anteriores) — union dos alunos_set por dia
    dias_7d = {(hoje - timedelta(days=i)).isoformat() for i in range(7)}
    dias_7d_ant = {(hoje - timedelta(days=i)).isoformat() for i in range(7, 14)}
    alunos_semana: set[str] = set()
    alunos_semana_ant: set[str] = set()
    for s in stats_dias:
        d = s.get("data", "")
        ss = s.get("alunos_set") or set()
        if d in dias_7d:
            alunos_semana |= ss
        elif d in dias_7d_ant:
            alunos_semana_ant |= ss

    # % alunos no app
    alunos_app = int(stats_alunos.get("alunos_app", 0)) if stats_alunos else 0

    # Distribuição por objetivo
    dist_obj_item = repo.get_item(pk, keys.SK_STATS_OBJETIVOS)
    _meta = {"PK", "SK", "GSI1PK", "GSI1SK"}
    dist_objetivos: dict[str, int] = {}
    if dist_obj_item:
        for k, v in dist_obj_item.items():
            if k not in _meta and isinstance(v, (int, float, Decimal)) and int(v) > 0:
                dist_objetivos[k] = int(v)

    # Próximos eventos (next 7 days, bounded range query na partição PT#)
    agora_iso = datetime.now(timezone.utc).isoformat()
    em7d_iso = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    proximos_raw = repo.query_between(pk, f"AGENDA#{agora_iso}", f"AGENDA#{em7d_iso}￿")
    _campos_evento = ("agendamento_id", "aluno_id", "data_hora_inicio", "duracao_min", "status", "observacao")
    proximos_eventos = [
        {c: a.get(c) for c in _campos_evento}
        for a in repo.clean_all(proximos_raw[:20])
    ]

    # Atividade recente (últimos 10 alunos que treinaram/estão treinando) — 1 query no GSI1
    # (item denormalizado na escrita por sessao_service._touch_atividade, sem fan-out por aluno).
    atividade_raw = repo.clean_all(repo.query_gsi1_last(keys.gsi1_atividade(personal_id), limit=10))
    perfis = {
        aid: repo.get_item(keys.pk_aluno(aid), keys.SK_PROFILE)
        for aid in {a["aluno_id"] for a in atividade_raw}
    }

    # Status efetivo: ATIVIDADE# não tem TTL, então uma sessão abandonada fica presa em
    # EM_ANDAMENTO mesmo após o SESSION#ACTIVE expirar. Deriva ABANDONADA quando a última
    # atividade é mais antiga que o tempo de vida da sessão (6h) — sem GetItem/scan extra.
    agora = datetime.now(timezone.utc)

    def _status_efetivo(a: dict) -> str | None:
        st = a.get("status")
        if st == SessaoStatus.EM_ANDAMENTO.value:
            try:
                dt = datetime.fromisoformat((a.get("atualizado_em") or "").replace("Z", "+00:00"))
                if (agora - dt).total_seconds() > SESSION_TTL_S:
                    return SessaoStatus.ABANDONADA.value
            except (ValueError, AttributeError):
                pass
        return st

    atividade_recente = []
    for a in atividade_raw:
        perfil = perfis.get(a["aluno_id"]) or {}
        foto_s3_key = perfil.get("foto_s3_key")
        status_ef = _status_efetivo(a)
        em_andamento = status_ef == SessaoStatus.EM_ANDAMENTO.value
        atividade_recente.append({
            "aluno_id": a["aluno_id"],
            "aluno_nome": perfil.get("nome", "?"),
            "foto_url": media_service.gerar_presigned_view_url(foto_s3_key) if foto_s3_key else None,
            "status": status_ef,
            "treino_nome": a.get("treino_nome"),
            "exercicio_atual": a.get("exercicio_atual") if em_andamento else None,
            "ordem_atual": a.get("ordem_atual") if em_andamento else None,
            "total_ex": a.get("total_ex"),
            "atualizado_em": a.get("atualizado_em"),
        })

    return {
        "alunos": total_alunos,
        "alunos_ativos": alunos_ativos,
        "notificacoes_nao_lidas": nao_lidas,
        "sessoes_por_dia": sessoes_por_dia,
        "atividade_recente": atividade_recente,
        "aderencia_7d": {
            "alunos_unicos": len(alunos_semana),
            "alunos_unicos_prev": len(alunos_semana_ant),
        },
        "alunos_app": alunos_app,
        "dist_objetivos": dist_objetivos,
        "proximos_eventos": proximos_eventos,
    }
