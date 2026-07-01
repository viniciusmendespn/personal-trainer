"""Alertas de dor e dúvidas — registra no histórico do aluno e notifica o personal."""
from app.models.enums import Ator, CanalOrigem
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import anotif_service, notif_service
from app.services.sessao_service import chave_exercicio
from app.utils import epoch_ms, new_id, now_iso

SK_PREFIX_DOR = "DOR#"
SK_PREFIX_DUVIDA = "DUVIDA#"


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
        "chave": chave_exercicio(exercicio_nome or ""),
        "descricao": descricao, "data_hora": now_iso(), "respondido": False,
        "canal_origem": canal.value, "ator": ator.value,
        **({"sessao_id": sessao_id} if sessao_id else {}),
    })
    contexto = f" em {exercicio_nome}" if exercicio_nome else ""
    notif_service.criar(personal_id, "DOR", "Relato de dor",
                        f"O aluno relatou dor{contexto}: {descricao}", aluno_id=aluno_id,
                        ref_extra={"relato_sk": sk, "relato_tipo": "dor",
                                   "exercicio_id": exercicio_id})
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
        "chave": chave_exercicio(exercicio_nome or ""),
        "descricao": descricao, "data_hora": now_iso(), "respondido": False,
        "canal_origem": canal.value, "ator": ator.value,
        **({"sessao_id": sessao_id} if sessao_id else {}),
    })
    contexto = f" em {exercicio_nome}" if exercicio_nome else ""
    notif_service.criar(personal_id, "DUVIDA", "Dúvida do aluno",
                        f"O aluno teve uma dúvida{contexto}: {descricao}", aluno_id=aluno_id,
                        ref_extra={"relato_sk": sk, "relato_tipo": "duvida",
                                   "exercicio_id": exercicio_id})
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
    # Append comment to the thread
    repo.list_append_item(keys.pk_aluno(aluno_id), relato_sk, "comentarios", {
        "com_id": new_id(), "ator": "PERSONAL", "texto": texto, "data_hora": now_iso(),
    })
    tipo_notif = "DOR_RESPONDIDA" if relato_sk.startswith("DOR#") else "DUVIDA_RESPONDIDA"
    exercicio_id = updated.get("exercicio_id")
    anotif_service.criar(aluno_id, tipo_notif, "Resposta do seu personal",
                         texto[:120] + ("…" if len(texto) > 120 else ""),
                         ref_extra={"exercicio_id": exercicio_id, "relato_sk": relato_sk})
    return True


# ── Comentário em thread (personal ou aluno) ─────────────────────────────────
def adicionar_comentario(aluno_id: str, relato_sk: str, ator: str,
                         texto: str | None, midias: list[dict] | None = None) -> bool:
    """Appends a comment to a DOR/DUVIDA/POST thread. Returns False if item not found."""
    comentario: dict = {"com_id": new_id(), "ator": ator, "data_hora": now_iso()}
    if texto:
        comentario["texto"] = texto
    if midias:
        comentario["midias"] = midias
    return repo.list_append_item(keys.pk_aluno(aluno_id), relato_sk, "comentarios", comentario)
