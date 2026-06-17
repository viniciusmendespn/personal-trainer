"""Alertas de dor — registra no histórico do aluno e notifica o personal."""
from app.models.enums import Ator, CanalOrigem
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import notif_service
from app.utils import epoch_ms, new_id, now_iso


# ── Dor → histórico do aluno + notificação ao personal (RF009) ───────────────
def registrar_dor(personal_id: str, aluno_id: str, descricao: str,
                  exercicio_id: str | None = None, exercicio_nome: str | None = None,
                  canal: CanalOrigem = CanalOrigem.WHATSAPP, ator: Ator = Ator.ALUNO) -> str:
    ts = epoch_ms()
    dor_id = new_id()
    repo.put_item(keys.pk_aluno(aluno_id), keys.sk_dor(exercicio_id or "NA", ts, dor_id), {
        "aluno_id": aluno_id, "exercicio_id": exercicio_id, "exercicio_nome": exercicio_nome,
        "descricao": descricao, "data_hora": now_iso(),
        "canal_origem": canal.value, "ator": ator.value,
    })
    contexto = f" em {exercicio_nome}" if exercicio_nome else ""
    notif_service.criar(personal_id, "DOR", "Relato de dor",
                        f"O aluno relatou dor{contexto}: {descricao}", aluno_id=aluno_id)
    return dor_id
