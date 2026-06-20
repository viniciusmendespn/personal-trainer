"""Metas / objetivos do aluno — criação, verificação automática e conclusão."""
import logging

from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import anotif_service, notif_service, pontos_service
from app.utils import epoch_ms, new_id, now_iso

logger = logging.getLogger(__name__)


def criar(aluno_id: str, personal_id: str, dados: dict, criado_por: str = "PERSONAL") -> dict:
    meta_id = new_id()
    ts = epoch_ms()
    status = "APROVADA" if criado_por == "PERSONAL" else "PENDENTE"
    item = {
        "meta_id": meta_id, "aluno_id": aluno_id, "personal_id": personal_id,
        "status": status, "criado_por": criado_por, "created_at": now_iso(), "ts": str(ts),
        **dados,
    }
    repo.put_item(keys.pk_aluno(aluno_id), keys.sk_meta(str(ts), meta_id), item)
    if criado_por == "ALUNO":
        notif_service.criar(
            personal_id, "META_PROPOSTA", "Nova meta proposta",
            f"O aluno propôs uma nova meta: {dados.get('titulo', '')}",
            aluno_id=aluno_id,
        )
    return item


def listar(aluno_id: str, status: str | None = None) -> list[dict]:
    items = repo.clean_all(repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.META_PREFIX))
    if status:
        items = [i for i in items if i.get("status") == status]
    items.sort(key=lambda x: x.get("ts", ""), reverse=True)
    return items


def atualizar(aluno_id: str, ts: str, meta_id: str, campos: dict) -> dict | None:
    campos = {k: v for k, v in campos.items() if v is not None}
    if not campos:
        return None
    sk = keys.sk_meta(ts, meta_id)
    return repo.clean(repo.update_item_if_exists(keys.pk_aluno(aluno_id), sk, campos))


def alterar_status(aluno_id: str, ts: str, meta_id: str, novo_status: str) -> dict | None:
    sk = keys.sk_meta(ts, meta_id)
    updated = repo.update_item_if_exists(keys.pk_aluno(aluno_id), sk, {"status": novo_status})
    if updated and novo_status == "APROVADA":
        item = repo.clean(updated)
        anotif_service.criar(
            aluno_id, "META_APROVADA", "Meta aprovada!",
            f"O personal aprovou sua meta: {item.get('titulo', '')}",
            ref_extra={"meta_id": meta_id},
        )
    return repo.clean(updated) if updated else None


def excluir(aluno_id: str, ts: str, meta_id: str) -> None:
    repo.delete_item(keys.pk_aluno(aluno_id), keys.sk_meta(ts, meta_id))


def _concluir(aluno_id: str, personal_id: str, meta: dict, valor_atingido: float) -> None:
    ts = str(meta.get("ts", ""))
    meta_id = meta.get("meta_id", "")
    if not ts or not meta_id:
        return
    sk = keys.sk_meta(ts, meta_id)
    repo.update_item_if_exists(keys.pk_aluno(aluno_id), sk, {
        "status": "CONCLUIDA",
        "data_conclusao": now_iso(),
        "valor_atingido": valor_atingido,
    })
    pontos_service.award(aluno_id, "META", personal_id,
                        descricao=f"Meta atingida: {meta.get('titulo', '')}")
    anotif_service.criar(
        aluno_id, "META_CONCLUIDA", "🎯 Meta atingida!",
        f"Você atingiu a meta '{meta.get('titulo', '')}' — +50 pontos!",
        ref_extra={"meta_id": meta_id},
    )
    notif_service.criar(
        personal_id, "META_CONCLUIDA", "Aluno atingiu uma meta",
        f"A meta '{meta.get('titulo', '')}' foi atingida.",
        aluno_id=aluno_id,
    )


def verificar_metas_carga(aluno_id: str, personal_id: str,
                           exercicio_id: str, nova_carga: float) -> None:
    """Chamado após novo PR. Verifica metas APROVADAS de tipo CARGA para esse exercício."""
    try:
        metas = listar(aluno_id, status="APROVADA")
        for m in metas:
            if m.get("tipo") == "CARGA" and m.get("exercicio_id") == exercicio_id:
                if nova_carga >= float(m.get("valor_alvo", 0)):
                    _concluir(aluno_id, personal_id, m, nova_carga)
    except Exception:
        logger.exception("[meta] verificar_metas_carga falhou: aluno=%s", aluno_id)


def verificar_metas_avaliacao(aluno_id: str, personal_id: str,
                               peso: float | None, medidas: dict) -> None:
    """Chamado após nova avaliação. Verifica metas PESO e MEDIDA."""
    try:
        metas = listar(aluno_id, status="APROVADA")
        for m in metas:
            tipo = m.get("tipo")
            if tipo == "PESO" and peso is not None:
                alvo = float(m.get("valor_alvo", 0))
                # Meta de perda (alvo < inicial) ou ganho (alvo > inicial)
                if peso <= alvo or peso >= alvo:
                    if abs(peso - alvo) <= 0.5:  # tolerância de 0.5kg
                        _concluir(aluno_id, personal_id, m, peso)
            elif tipo == "MEDIDA":
                campo = m.get("campo_medida")
                if campo and campo in medidas:
                    val = float(medidas[campo])
                    alvo = float(m.get("valor_alvo", 0))
                    if abs(val - alvo) <= 0.5:
                        _concluir(aluno_id, personal_id, m, val)
    except Exception:
        logger.exception("[meta] verificar_metas_avaliacao falhou: aluno=%s", aluno_id)
