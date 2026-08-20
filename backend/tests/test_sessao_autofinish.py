"""Sessão de treino deixada aberta: aviso em 4h e fechamento automático em 6h.

Antes disso o TTL do DynamoDB apagava sessão e registros juntos — quem treinava e esquecia de
finalizar perdia tudo, sem nem virar sessão histórica. Aqui o contrato é: o prazo é do
scheduler (não do TTL), sessão com registro vira histórico de verdade e sessão vazia é
descartada em vez de virar streak e pontos de um treino que não aconteceu.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.repositories import keys
from app.services import sessao_service

PERSONAL = "p-1"
ALUNO = "a-1"
TREINO = "t-1"


def _sched_do_dia(fake, dia: str) -> list[dict]:
    return [i for (pk, sk), i in fake.itens.items()
            if pk == keys.pk_sched(dia) and sk.startswith(keys.SESSAO_SCHED_PREFIX)]


def _todos_sched(fake) -> list[dict]:
    return [i for (_pk, sk), i in fake.itens.items()
            if sk.startswith(keys.SESSAO_SCHED_PREFIX)]


def _anotifs(fake, tipo: str) -> list[dict]:
    return [i for (pk, sk), i in fake.itens.items()
            if pk == keys.pk_aluno(ALUNO) and sk.startswith(keys.ANOTIF_PREFIX)
            and i.get("tipo") == tipo]


def _sessoes_historicas(fake) -> list[dict]:
    return [i for (pk, sk), i in fake.itens.items()
            if pk == keys.pk_aluno(ALUNO) and sk.startswith("SESSION#")
            and sk != keys.SK_SESSION_ACTIVE]


@pytest.fixture
def sessao(repo_fake, monkeypatch):
    """Treino com 2 exercícios e uma sessão iniciada pelo aluno. Push é I/O externo: o que
    interessa aqui é a notificação gravada, então o disparo fica mudo."""
    monkeypatch.setattr(sessao_service.anotif_service if hasattr(sessao_service, "anotif_service")
                        else __import__("app.services.anotif_service", fromlist=["x"]),
                        "_disparar_push", lambda *a, **k: None)
    from app.services import notif_service
    monkeypatch.setattr(notif_service, "_disparar_push_personal", lambda *a, **k: None)

    repo_fake.put_item(keys.pk_aluno(ALUNO), keys.sk_treino(TREINO),
                       {"treino_id": TREINO, "nome": "Treino A"})
    for i, (ex_id, nome) in enumerate([("e-1", "Supino Reto"), ("e-2", "Remada")]):
        repo_fake.put_item(keys.pk_aluno(ALUNO), keys.sk_exercicio(TREINO, ex_id),
                           {"exercicio_id": ex_id, "nome": nome, "ordem": i, "grupo": "Peito"})
    repo_fake.put_item(keys.pk_personal(PERSONAL), keys.sk_aluno_pointer(ALUNO), {"nome": "Aluno"})
    return repo_fake


def _iniciar(fake, minutos_atras: int = 0) -> dict:
    s = sessao_service.start_session(PERSONAL, ALUNO, TREINO, iniciado_pelo_aluno=True)
    if minutos_atras:
        # Reescreve o início para simular uma sessão antiga sem congelar o relógio.
        inicio = (datetime.now(timezone.utc) - timedelta(minutes=minutos_atras)).isoformat()
        fake.update_item(keys.pk_aluno(ALUNO), keys.SK_SESSION_ACTIVE, {"data_hora_inicio": inicio})
        s = fake.get_item(keys.pk_aluno(ALUNO), keys.SK_SESSION_ACTIVE)
    return s


def _registrar(fake, ex_id: str, minutos_apos_inicio: int | None = None) -> None:
    """Registra uma série e, opcionalmente, recua o carimbo da gravação para simular um
    treino que aconteceu horas antes de o scheduler passar."""
    sessao_service.set_series(ALUNO, ex_id, [{"reps": 10, "carga": 50}])
    if minutos_apos_inicio is None:
        return
    s = fake.get_item(keys.pk_aluno(ALUNO), keys.SK_SESSION_ACTIVE)
    inicio = datetime.fromisoformat(s["data_hora_inicio"])
    marca = (inicio + timedelta(minutes=minutos_apos_inicio)).isoformat()
    fake.update_item(keys.pk_aluno(ALUNO), keys.sk_registro(s["sessao_id"], ex_id),
                     {"atualizado_em": marca})


def _agendamento(s: dict, acao: str) -> dict:
    """Payload equivalente ao que o scheduler leria da partição SCHED#."""
    return {"acao": acao, "aluno_id": ALUNO, "personal_id": PERSONAL,
            "sessao_id": s["sessao_id"], "data_hora_inicio": s["data_hora_inicio"]}


# ── Agendamento ──────────────────────────────────────────────────────────────

def test_start_agenda_aviso_e_fechamento(sessao):
    s = _iniciar(sessao)
    inicio = datetime.fromisoformat(s["data_hora_inicio"])
    dias = {(inicio + timedelta(seconds=off)).strftime("%Y-%m-%d")
            for off in (sessao_service.SESSAO_AVISO_S, sessao_service.SESSAO_LIMITE_S)}

    agendados = [i for d in dias for i in _sched_do_dia(sessao, d)]
    assert {i["acao"] for i in agendados} == {"AVISO", "FECHAR"}
    assert all(i["sessao_id"] == s["sessao_id"] for i in agendados)
    # As refs voltam no item da sessão — é por elas que o cancelamento acha as entradas.
    assert len(s["sched_refs"]) == 2


def test_finish_manual_remove_o_agendamento(sessao):
    _iniciar(sessao)
    sessao_service.finish(ALUNO)
    assert _todos_sched(sessao) == []


def test_cancelar_remove_agendamento_e_registros(sessao):
    _iniciar(sessao)
    sessao_service.set_series(ALUNO, "e-1", [{"reps": 10, "carga": 50}])
    sessao_service.cancelar(ALUNO)
    assert _todos_sched(sessao) == []
    assert [sk for (_pk, sk) in sessao.itens if sk.startswith("REG#")] == []


# ── Aviso (4h) ───────────────────────────────────────────────────────────────

def test_aviso_notifica_o_aluno(sessao):
    s = _iniciar(sessao, minutos_atras=240)
    assert sessao_service.avisar_sessao_aberta(_agendamento(s, "AVISO")) == "avisada"

    notifs = _anotifs(sessao, "SESSAO_ABERTA")
    assert len(notifs) == 1
    assert "Treino A" in notifs[0]["mensagem"]
    # A sessão continua aberta: o aviso é só um lembrete.
    assert sessao_service.get_active(ALUNO) is not None


def test_aviso_de_sessao_ja_finalizada_e_ignorado(sessao):
    s = _iniciar(sessao)
    sessao_service.finish(ALUNO)
    assert sessao_service.avisar_sessao_aberta(_agendamento(s, "AVISO")) == "ignorada"
    assert _anotifs(sessao, "SESSAO_ABERTA") == []


def test_aviso_de_outra_sessao_e_ignorado(sessao):
    """Aluno finalizou e já começou outro treino — o agendamento velho não pode tocar no novo."""
    antiga = _iniciar(sessao)
    sessao_service.finish(ALUNO)
    _iniciar(sessao)
    assert sessao_service.avisar_sessao_aberta(_agendamento(antiga, "AVISO")) == "ignorada"


def test_aviso_de_sessao_conduzida_pelo_personal_vai_para_o_personal(sessao):
    s = sessao_service.start_session(PERSONAL, ALUNO, TREINO)   # sem iniciado_pelo_aluno
    assert sessao_service.avisar_sessao_aberta(_agendamento(s, "AVISO")) == "avisada"
    assert _anotifs(sessao, "SESSAO_ABERTA") == []
    notifs = [i for (pk, sk), i in sessao.itens.items()
              if pk == keys.pk_personal(PERSONAL) and sk.startswith(keys.NOTIF_PREFIX)]
    assert [n["tipo"] for n in notifs] == ["SESSAO_ABERTA"]


# ── Fechamento (6h) ──────────────────────────────────────────────────────────

def test_fechamento_salva_os_registros_feitos(sessao):
    s = _iniciar(sessao, minutos_atras=360)
    sessao_service.set_series(ALUNO, "e-1", [{"reps": 10, "carga": 50}])

    assert sessao_service.encerrar_sessao_aberta(_agendamento(s, "FECHAR")) == "finalizada"

    historicas = _sessoes_historicas(sessao)
    assert len(historicas) == 1
    hist = historicas[0]
    assert hist["encerrada_automaticamente"] is True
    assert [e["exercicio_id"] for e in hist["exercicios_exec"]] == ["e-1"]
    # Os REG viram fonte permanente da evolução: sem o TTL, não somem mais.
    regs = [i for (_pk, sk), i in sessao.itens.items() if sk.startswith("REG#")]
    assert regs and all("ttl" not in r for r in regs)
    assert sessao_service.get_active(ALUNO) is None
    assert _todos_sched(sessao) == []


def test_fechamento_usa_a_hora_do_ultimo_registro_e_nao_as_6h(sessao):
    """Aluno treinou 50 min e esqueceu o app aberto. Marcar 6h de duração entraria em
    soma_duracao_segundos e estragaria o "tempo médio de treino" dele e do treino."""
    s = _iniciar(sessao, minutos_atras=360)
    _registrar(sessao, "e-1", minutos_apos_inicio=20)
    _registrar(sessao, "e-2", minutos_apos_inicio=50)

    sessao_service.encerrar_sessao_aberta(_agendamento(s, "FECHAR"))

    hist = _sessoes_historicas(sessao)[0]
    assert hist["duracao_segundos"] == 50 * 60                       # e não 6h
    assert hist["data_hora_fim"] != hist["data_hora_encerramento"]
    stats = sessao.get_item(keys.pk_aluno(ALUNO), keys.SK_STATS_ALUNO)
    assert stats["soma_duracao_segundos"] == 50 * 60


def test_fechamento_notifica_o_aluno(sessao):
    s = _iniciar(sessao, minutos_atras=360)
    sessao_service.set_series(ALUNO, "e-1", [{"reps": 10, "carga": 50}])
    sessao_service.encerrar_sessao_aberta(_agendamento(s, "FECHAR"))

    notifs = _anotifs(sessao, "SESSAO_AUTOFINALIZADA")
    assert len(notifs) == 1
    assert "1 exercício" in notifs[0]["mensagem"]


def test_sessao_sem_registro_e_descartada(sessao):
    s = _iniciar(sessao, minutos_atras=360)

    assert sessao_service.encerrar_sessao_aberta(_agendamento(s, "FECHAR")) == "descartada"

    assert _sessoes_historicas(sessao) == []
    assert sessao_service.get_active(ALUNO) is None
    assert _anotifs(sessao, "SESSAO_AUTOFINALIZADA") == []
    # Nada de streak, contagem de sessão ou pontos por um treino que não aconteceu.
    stats = sessao.get_item(keys.pk_aluno(ALUNO), keys.SK_STATS_ALUNO) or {}
    assert "total_sessoes" not in stats and "streak_atual" not in stats
    assert not [sk for (_pk, sk) in sessao.itens if sk.startswith(keys.PONTO_LOG_PREFIX)]


def test_fechamento_de_sessao_ja_finalizada_e_ignorado(sessao):
    s = _iniciar(sessao)
    sessao_service.set_series(ALUNO, "e-1", [{"reps": 10, "carga": 50}])
    sessao_service.finish(ALUNO)

    assert sessao_service.encerrar_sessao_aberta(_agendamento(s, "FECHAR")) == "ignorada"
    assert len(_sessoes_historicas(sessao)) == 1   # não duplicou o histórico
