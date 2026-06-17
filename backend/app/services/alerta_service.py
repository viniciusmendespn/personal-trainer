"""Alertas de dor e dúvidas — registra no histórico do aluno e notifica o personal."""
from app.models.enums import Ator, CanalOrigem
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import anotif_service, notif_service
from app.utils import epoch_ms, new_id, now_iso


# ── Dor → histórico do aluno + notificação ao personal (RF009) ───────────────
def registrar_dor(personal_id: str, aluno_id: str, descricao: str,
                  exercicio_id: str | None = None, exercicio_nome: str | None = None,
                  canal: CanalOrigem = CanalOrigem.WHATSAPP, ator: Ator = Ator.ALUNO,
                  sessao_id: str | None = None) -> str:
    ts = epoch_ms()
    dor_id = new_id()
    sk = keys.sk_dor(exercicio_id or "NA", ts, dor_id)
    repo.put_item(keys.pk_aluno(aluno_id), sk, {
        "aluno_id": aluno_id, "exercicio_id": exercicio_id, "exercicio_nome": exercicio_nome,
        "descricao": descricao, "data_hora": now_iso(), "respondido": False,
        "canal_origem": canal.value, "ator": ator.value,
        **({"sessao_id": sessao_id} if sessao_id else {}),
    })
    contexto = f" em {exercicio_nome}" if exercicio_nome else ""
    notif_service.criar(personal_id, "DOR", "Relato de dor",
                        f"O aluno relatou dor{contexto}: {descricao}", aluno_id=aluno_id,
                        ref_extra={"relato_sk": sk, "relato_tipo": "dor"})
    return dor_id


# ── Dúvida → histórico do aluno + notificação ao personal ────────────────────
def registrar_duvida(personal_id: str, aluno_id: str, descricao: str,
                     exercicio_id: str | None = None, exercicio_nome: str | None = None,
                     canal: CanalOrigem = CanalOrigem.WHATSAPP, ator: Ator = Ator.ALUNO,
                     sessao_id: str | None = None) -> str:
    ts = epoch_ms()
    duvida_id = new_id()
    sk = keys.sk_duvida(exercicio_id or "NA", ts, duvida_id)
    repo.put_item(keys.pk_aluno(aluno_id), sk, {
        "aluno_id": aluno_id, "exercicio_id": exercicio_id, "exercicio_nome": exercicio_nome,
        "descricao": descricao, "data_hora": now_iso(), "respondido": False,
        "canal_origem": canal.value, "ator": ator.value,
        **({"sessao_id": sessao_id} if sessao_id else {}),
    })
    contexto = f" em {exercicio_nome}" if exercicio_nome else ""
    notif_service.criar(personal_id, "DUVIDA", "Dúvida do aluno",
                        f"O aluno teve uma dúvida{contexto}: {descricao}", aluno_id=aluno_id,
                        ref_extra={"relato_sk": sk, "relato_tipo": "duvida"})
    return duvida_id


# ── Resposta do personal → atualiza relato + notifica o aluno ────────────────
def responder_relato(aluno_id: str, relato_sk: str, texto: str, personal_id: str) -> bool:
    updated = repo.update_item_if_exists(
        keys.pk_aluno(aluno_id), relato_sk,
        {"respondido": True, "resposta_texto": texto,
         "respondido_em": now_iso(), "respondido_por": personal_id},
    )
    if not updated:
        return False
    tipo_notif = "DOR_RESPONDIDA" if relato_sk.startswith("DOR#") else "DUVIDA_RESPONDIDA"
    titulo = "Resposta do seu personal"
    mensagem = texto[:120] + ("…" if len(texto) > 120 else "")
    anotif_service.criar(aluno_id, tipo_notif, titulo, mensagem)
    return True
