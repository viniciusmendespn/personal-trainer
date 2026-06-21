"""Ferramentas do agente (ESPEC §4) — mesma lógica do portal, mas com payload COMPACTO
(chaves curtas, sem nulos) porque o resultado entra no contexto da LLM (tokens).
O `{personal_id, aluno_id}` já vem resolvido pelo webhook — a LLM nunca informa identidade.
"""
import logging
import time

from app.config import settings
from app.models.enums import Ator, CanalOrigem, Classificacao
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import alerta_service, sessao_service
from app.utils import epoch_ms, new_id, now_iso, treino_vigente

logger = logging.getLogger(__name__)

CHAT_TTL_S = 2 * 3600   # janela de conversa: 2h sem mensagem zera o contexto
CHAT_MAX_TURNS = 8      # últimas N mensagens mantidas


def get_chat(aluno_id: str) -> list[dict]:
    item = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_CHAT, consistent=True)
    return (item or {}).get("turns", [])


def save_chat(aluno_id: str, turns: list[dict]) -> None:
    repo.put_item(keys.pk_aluno(aluno_id), keys.SK_CHAT,
                  {"turns": turns[-CHAT_MAX_TURNS:], "ttl": int(time.time()) + CHAT_TTL_S})


# ── Histórico durável do chat (UI) — distinto da memória de trabalho acima ──────
def _write_chat_msg(aluno_id: str, role: str, texto: str, ator: Ator, canal: CanalOrigem,
                    direto: bool = False, midia: dict | None = None) -> None:
    msg_id = new_id()
    item = {
        "mensagem_id": msg_id, "aluno_id": aluno_id, "role": role, "texto": texto,
        "ator": ator.value, "canal_origem": canal.value, "data_hora": now_iso(), "direto": direto,
    }
    if midia:
        item["midia"] = midia
    repo.put_item(keys.pk_aluno(aluno_id), keys.sk_chat_msg(epoch_ms(), msg_id), item)


def log_turn(aluno_id: str, user_text: str, assistant_text: str,
            ator: Ator, canal: CanalOrigem) -> None:
    """Grava o par (mensagem do humano, resposta do agente) no histórico durável —
    usado pela UI (chat do aluno/personal), nunca lido pela LLM. Sempre grava a mensagem
    do humano; só grava a resposta se não vier vazia (evita bolha em branco na UI)."""
    _write_chat_msg(aluno_id, "user", user_text, ator, canal)
    if assistant_text:
        _write_chat_msg(aluno_id, "assistant", assistant_text, ator, canal)


def enviar_whatsapp(personal_id: str, aluno_id: str, text: str) -> bool:
    """Envia mensagem de texto pro WhatsApp do aluno, usando a config WAPI do personal.
    Best-effort: não levanta exceção (a mensagem já fica registrada na thread mesmo se o
    envio falhar)."""
    from app.services.wapi_service import WAPIClient
    cfg = repo.get_item(keys.pk_personal(personal_id), keys.SK_WAPI_CONFIG)
    if not cfg:
        return False
    profile = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE)
    telefone = (profile or {}).get("telefone")
    if not telefone:
        logger.warning("[agent_service] aluno %s sem telefone cadastrado", aluno_id)
        return False
    try:
        WAPIClient(cfg["instance_id"], cfg["token"]).send_text(telefone, text)
        return True
    except Exception as e:
        logger.warning("[agent_service] envio WhatsApp falhou: %s", e)
        return False


def log_direct(personal_id: str, aluno_id: str, text: str, ator: Ator, canal: CanalOrigem,
               midia: dict | None = None) -> bool:
    """Mensagem marcada como 'direta' — não passa pelo agente, só fica registrada na
    thread (compartilhada). Chat e WhatsApp são canais independentes: mensagens do portal
    ficam apenas no chat, sem encaminhar ao WhatsApp."""
    role = "assistant" if ator == Ator.PERSONAL else "user"
    _write_chat_msg(aluno_id, role, text, ator, canal, direto=True, midia=midia)
    if ator == Ator.PERSONAL:
        from app.services import anotif_service   # import tardio — evita ciclo
        anotif_service.criar(aluno_id, "MSG_PERSONAL", "Mensagem do seu personal", text[:80])
    return True


def is_agente_habilitado(aluno_id: str) -> bool:
    profile = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE)
    return bool((profile or {}).get("agente_habilitado"))


def set_agente_habilitado(aluno_id: str, habilitado: bool) -> None:
    repo.update_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE, {
        "agente_habilitado": habilitado,
    })


def list_chat_msgs(aluno_id: str, limit: int = 50, cursor: str | None = None) -> tuple[list[dict], str | None]:
    items, next_cursor = repo.query_pk_page(
        keys.pk_aluno(aluno_id), keys.CHAT_MSG_PREFIX, limit, cursor, forward=False
    )
    cleaned = repo.clean_all(items)
    for m in cleaned:
        if m.get("midia"):
            from app.services import media_service   # import tardio — evita ciclo
            m["midia"]["url"] = media_service.gerar_presigned_view_url(m["midia"]["s3_key"])
    return list(reversed(cleaned)), next_cursor  # mais antiga primeiro, p/ renderizar a thread


def handle_chat_turn(personal_id: str, aluno_id: str, text: str, ator: Ator) -> str:
    """Lógica compartilhada pelos endpoints de chat (aluno e personal). Canal sempre
    PORTAL aqui — WHATSAPP só existe no caminho do webhook."""
    from app.services import llm_agent   # import tardio — evita ciclo (llm_agent já importa este módulo)
    nome = (repo.get_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE) or {}).get("nome")
    history = get_chat(aluno_id)
    reply = llm_agent.run(personal_id, aluno_id, nome, text, history,
                          canal=CanalOrigem.PORTAL, ator=ator)
    log_turn(aluno_id, text, reply, ator=ator, canal=CanalOrigem.PORTAL)
    if reply:
        save_chat(aluno_id, history + [
            {"role": "user", "content": text}, {"role": "assistant", "content": reply},
        ])
    return reply


def _ult(aluno_id: str, exercicio_id: str | None) -> dict | None:
    if not exercicio_id:
        return None
    last = repo.query_gsi1_last(keys.gsi1_registro(aluno_id, exercicio_id), 1)
    if not last:
        return None
    return {"series": repo.clean(last[0]).get("series_exec")}


def montar_contexto(aluno_id: str, nome: str | None = None) -> dict:
    """Estado do turno em 1 GetItem (sessão ativa) + último registro do exercício atual."""
    s = sessao_service.get_active(aluno_id, consistent=True)
    if not s:
        return {"al": aluno_id, "nome": nome, "sessao": None}
    ex = s.get("ex_atual") or {}
    out = {
        "al": aluno_id, "nome": nome, "sid": s.get("sessao_id"), "t": s.get("treino_nome"),
        "ex": {"id": ex.get("exercicio_id"), "n": ex.get("nome"),
               "s": ex.get("series"), "rp": ex.get("reps_prescritas"), "cg": ex.get("carga_prescrita")},
        "ord": s.get("ordem_atual"), "tot": s.get("total_ex"),
    }
    ult = _ult(aluno_id, ex.get("exercicio_id"))
    if ult:
        out["ult"] = ult
    return out


def _classificacao_for(ator: Ator) -> Classificacao:
    return Classificacao.AUTO if ator == Ator.ALUNO else Classificacao.MANUAL


def registrar(aluno_id: str, series: list, exercicio_id: str | None = None,
             canal: CanalOrigem = CanalOrigem.WHATSAPP, ator: Ator = Ator.ALUNO) -> dict:
    r, pr = sessao_service.record(aluno_id, series, exercicio_id=exercicio_id,
                                  canal=canal, classificacao=_classificacao_for(ator), ator=ator)
    out = {"ok": 1, "ex": r.get("exercicio_nome")}
    if pr:
        out["pr"] = pr   # novo recorde de carga — o agente pode comemorar
    return out


def consultar_historico(aluno_id: str, exercicio_id: str) -> dict:
    last = repo.query_gsi1_last(keys.gsi1_registro(aluno_id, exercicio_id), 1)
    if not last:
        return {"vazio": 1}
    le = repo.clean(last[0])
    return {"ex": le.get("exercicio_nome"), "series": le.get("series_exec")}


def buscar_exercicio(aluno_id: str, nome: str) -> dict:
    """Acha exercícios do aluno por nome (p/ vídeo, histórico ou registrar fora do atual)."""
    nl = (nome or "").lower()
    exs = sessao_service.list_exercicios_aluno(aluno_id)
    matches = [e for e in exs if nl in (e.get("nome", "").lower())] if nl else exs
    return {"ex": [{"id": e["exercicio_id"], "n": e.get("nome"),
                    "s": e.get("series"), "rp": e.get("reps_prescritas"),
                    "cg": e.get("carga_prescrita"), "sp": e.get("series_prescritas"),
                    "int": e.get("intervalo_s"),
                    "video": e.get("video_url"), "obs": e.get("observacoes")}
                   for e in matches[:5]]}


def avancar(aluno_id: str) -> dict:
    s = sessao_service.advance(aluno_id)
    ex = s.get("ex_atual") or {}
    return {"ok": 1, "ex": ex.get("nome"), "fim": s.get("status") != "EM_ANDAMENTO"}


def enviar_link_portal(aluno_id: str, personal_id: str) -> dict:
    """Gera o magic-link do app do aluno (JWT escopado)."""
    from app import aluno_auth
    if not settings.frontend_url:
        return {"erro": "indisponível"}
    return {"link": aluno_auth.magic_link(aluno_id, personal_id)}


def treino_de_hoje(aluno_id: str) -> dict:
    """Treino(s) com exercícios agendados para hoje (vigentes + dia da semana ou diários)."""
    from datetime import date, datetime, timezone
    hoje = datetime.now(timezone.utc).weekday()   # 0=seg .. 6=dom
    hoje_str = date.today().isoformat()
    exs = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix="EX#")
    # Inclui exercícios do dia E exercícios sem dia fixo (diários, dia_semana=None)
    ids_hoje = {e["treino_id"] for e in exs if e.get("dia_semana") in (None, hoje)}
    treinos = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.SK_TREINO_PREFIX)
    matches = [t for t in treinos
               if t["treino_id"] in ids_hoje and treino_vigente(t, hoje_str)]
    # Conta exercícios de cada treino para hoje
    counts: dict[str, int] = {}
    for e in exs:
        tid = e["treino_id"]
        if tid in ids_hoje and e.get("dia_semana") in (None, hoje):
            counts[tid] = counts.get(tid, 0) + 1
    return {"treinos": [{"id": t["treino_id"], "nome": t.get("nome"),
                         "foco": t.get("foco"), "num_ex": counts.get(t["treino_id"], 0)}
                        for t in matches]}


def listar_treinos(aluno_id: str) -> dict:
    """Todos os treinos do aluno com sinalização de vigência."""
    from datetime import date
    hoje_str = date.today().isoformat()
    treinos = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.SK_TREINO_PREFIX)
    exs = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix="EX#")
    counts: dict[str, int] = {}
    for e in exs:
        tid = e["treino_id"]
        counts[tid] = counts.get(tid, 0) + 1
    return {"treinos": [
        {"id": t["treino_id"], "nome": t.get("nome"), "foco": t.get("foco"),
         "ativo": t.get("ativo", True), "vigente": treino_vigente(t, hoje_str),
         "num_ex": counts.get(t["treino_id"], 0),
         "inicio": t.get("data_inicio"), "fim": t.get("data_fim")}
        for t in treinos
    ]}


def detalhar_treino(aluno_id: str, treino_id: str) -> dict:
    """Exercícios de um treino com prescrição completa."""
    if not treino_id:
        return {"erro": "treino_id obrigatório"}
    treino = repo.get_item(keys.pk_aluno(aluno_id), keys.sk_treino(treino_id))
    if not treino:
        return {"erro": "treino não encontrado"}
    exs = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.sk_exercicio_prefix(treino_id))
    exs_clean = repo.clean_all(exs)
    exs_clean.sort(key=lambda e: e.get("ordem", 0))
    return {
        "nome": treino.get("nome"), "foco": treino.get("foco"),
        "obs": treino.get("observacoes"),
        "ex": [{"id": e["exercicio_id"], "nome": e.get("nome"),
                "s": e.get("series"), "rp": e.get("reps_prescritas"),
                "cg": e.get("carga_prescrita"), "sp": e.get("series_prescritas"),
                "int": e.get("intervalo_s"),
                "video": e.get("video_url"), "obs": e.get("observacoes"),
                "dia": e.get("dia_semana")}
               for e in exs_clean],
    }


def cancelar_sessao(aluno_id: str) -> dict:
    """Cancela a sessão ativa (como se nunca tivesse começado)."""
    sessao_service.cancelar(aluno_id)
    return {"ok": 1}


def iniciar_sessao(personal_id: str, aluno_id: str, treino_id: str) -> dict:
    s = sessao_service.start_session(personal_id, aluno_id, treino_id)
    ex = s.get("ex_atual") or {}
    return {"ok": 1, "ex": ex.get("nome")}


def finalizar(aluno_id: str) -> dict:
    sessao_service.finish(aluno_id)
    return {"ok": 1, "fim": 1}


def registrar_dor(personal_id: str, aluno_id: str, descricao: str,
                  canal: CanalOrigem = CanalOrigem.WHATSAPP, ator: Ator = Ator.ALUNO) -> dict:
    """Registra dor no exercício atual (se houver) e gera alerta ao personal (RF009)."""
    s = sessao_service.get_active(aluno_id, consistent=True)
    ex = (s or {}).get("ex_atual") or {}
    alerta_service.registrar_dor(personal_id, aluno_id, descricao,
                                 exercicio_id=ex.get("exercicio_id"), exercicio_nome=ex.get("nome"),
                                 canal=canal, ator=ator)
    return {"ok": 1, "avisado": 1}
