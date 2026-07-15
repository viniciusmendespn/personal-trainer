"""Captação de leads — funil comercial de entrada (página pública /@slug).

Um lead é um prospect que preencheu a página pública do personal. Fica na partição
PT#{personal_id} com SK LEAD#{ts}#{lead_id}, FORA de STATS#ALUNOS e do limite do plano
(só consome quota quando o personal o converte em aluno). Cada lead grava a `fonte`
(origem do link, ex.: instagram) para rastreamento de canal de aquisição.
"""
from app.models.enums import LeadStatus
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import notif_service
from app.utils import epoch_ms, new_id, now_iso


def criar_lead(personal_id: str, nome: str, telefone: str,
               objetivos: list[str] | None = None, mensagem: str | None = None,
               fonte: str | None = None) -> dict:
    """Cria o lead (status NOVO) e dispara notificação para o personal contatar."""
    objetivos = objetivos or []
    lead_id = new_id()
    sk = keys.sk_lead(epoch_ms(), lead_id)
    item = {
        "lead_id": lead_id,
        "nome": nome,
        "telefone": telefone,
        "objetivos": objetivos,
        "mensagem": mensagem,
        "fonte": fonte or "direto",
        "status": LeadStatus.NOVO.value,
        "created_at": now_iso(),
    }
    repo.put_item(keys.pk_personal(personal_id), sk, item)
    notif_service.criar(
        personal_id, "LEAD_NOVO",
        f"Novo lead: {nome}",
        f"{', '.join(objetivos) or 'Sem objetivo definido'} · via {fonte or 'direto'}",
        ref_extra={"telefone": telefone, "fonte": fonte or "direto", "lead_ref": sk},
    )
    return {**item, "ref": sk}


def listar(personal_id: str, status: str | None = None) -> dict:
    """Lista leads (mais recentes primeiro) + contagem por fonte. Volume por personal é
    baixo (funil comercial), então uma Query por partição basta — sem paginação."""
    items = repo.query_pk(keys.pk_personal(personal_id), sk_prefix=keys.LEAD_PREFIX)
    items.sort(key=lambda i: i["SK"], reverse=True)
    leads = [{**repo.clean(i), "ref": i["SK"]} for i in items]
    por_fonte: dict[str, int] = {}
    por_status: dict[str, int] = {}
    for lead in leads:
        por_fonte[lead["fonte"]] = por_fonte.get(lead["fonte"], 0) + 1
        por_status[lead["status"]] = por_status.get(lead["status"], 0) + 1
    if status:
        leads = [lead for lead in leads if lead["status"] == status]
    return {"items": leads, "por_fonte": por_fonte, "por_status": por_status}


def atualizar_status(personal_id: str, lead_ref: str, novo_status: str) -> dict | None:
    """Muda o status do lead (funil). None se o lead não existe."""
    return repo.update_item_if_exists(
        keys.pk_personal(personal_id), lead_ref,
        {"status": novo_status, "updated_at": now_iso()},
    )


def get(personal_id: str, lead_ref: str) -> dict | None:
    return repo.get_item(keys.pk_personal(personal_id), lead_ref)
