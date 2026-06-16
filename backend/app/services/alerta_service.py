"""Alertas (dor) e pendências — visões cross-aluno do personal, gravadas na partição
PT# para leitura recente-primeiro sem fan-out (ESPEC §2.2). Volume baixo."""
import time

from app.models.enums import PendenciaStatus
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import notif_service
from app.utils import epoch_ms, new_id, now_iso

PEND_TTL_S = 30 * 24 * 3600  # pendência não resolvida some em ~30 dias (RN013)


def _with_ref(items: list[dict]) -> list[dict]:
    """Inclui o SK como `ref` para o cliente conseguir resolver o item depois."""
    return [{**repo.clean(i), "ref": i["SK"]} for i in items]


# ── Dor → histórico do aluno + notificação ao personal (RF009) ───────────────
def registrar_dor(personal_id: str, aluno_id: str, descricao: str,
                  exercicio_id: str | None = None, exercicio_nome: str | None = None) -> str:
    ts = epoch_ms()
    dor_id = new_id()
    repo.put_item(keys.pk_aluno(aluno_id), keys.sk_dor(exercicio_id or "NA", ts, dor_id), {
        "aluno_id": aluno_id, "exercicio_id": exercicio_id, "exercicio_nome": exercicio_nome,
        "descricao": descricao, "data_hora": now_iso(),
    })
    contexto = f" em {exercicio_nome}" if exercicio_nome else ""
    notif_service.criar(personal_id, "DOR", "Relato de dor",
                        f"O aluno relatou dor{contexto}: {descricao}", aluno_id=aluno_id)
    return dor_id


# ── Pendências (RF005/RF006) ─────────────────────────────────────────────────
def criar_pendencia(personal_id: str, aluno_id: str, tipo: str, payload: dict, motivo: str) -> str:
    ts = epoch_ms()
    pid = new_id()
    repo.put_item(keys.pk_personal(personal_id), keys.sk_pendencia(ts, pid), {
        "pendencia_id": pid, "aluno_id": aluno_id, "tipo": tipo, "payload": payload,
        "motivo": motivo, "status": PendenciaStatus.ABERTA.value, "data_hora": now_iso(),
        "ttl": int(time.time()) + PEND_TTL_S,
    })
    notif_service.criar(personal_id, "PENDENCIA", "Nova pendência", motivo, aluno_id=aluno_id)
    return pid


def list_pendencias(personal_id: str, limit: int = 50) -> list[dict]:
    return _with_ref(repo.query_pk_last_n(keys.pk_personal(personal_id), "PEND#", limit))


def resolve_pendencia(personal_id: str, ref: str) -> bool:
    return repo.delete_item_if_exists(keys.pk_personal(personal_id), ref)
