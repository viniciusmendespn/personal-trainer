"""Scheduler horário: cada entrada dispara na manhã LOCAL de quem recebe.

O contrato (docs/TIMEZONE.md §7, Passo 5):
  • a partição continua sendo a DATA CIVIL do disparo — é o que mantém o cancelamento
    determinístico em `_cancelar_agendamentos_billing`, sem depender do fuso;
  • quem decide a hora é o campo `tz` gravado na entrada;
  • entrada sem `tz` (dado anterior à mudança) cai no padrão, que é o fuso em que ela
    foi agendada — nenhuma migração;
  • o gate roda ANTES do claim: uma entrada cuja hora ainda não chegou não pode ser
    deletada, senão some para sempre.
"""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from app import scheduler
from app.repositories import keys
from app.services import locale_service

PERSONAL = "p-1"
ALUNO = "a-1"

SP = "America/Sao_Paulo"     # UTC-3
TOKYO = "Asia/Tokyo"         # UTC+9
HONOLULU = "Pacific/Honolulu"  # UTC-10


@pytest.fixture
def sched(repo_fake, monkeypatch):
    from app.services import notif_service
    monkeypatch.setattr(notif_service, "_disparar_push_personal", lambda *a, **k: None)
    return repo_fake


def _due(fake, data_fim: str, tz: str | None):
    item = {
        "personal_id": PERSONAL, "aluno_id": ALUNO, "treino_id": "t-1",
        "treino_nome": "Treino A", "aluno_nome": "Aluno", "data_fim": data_fim,
    }
    if tz:
        item["tz"] = tz
    fake.put_item(keys.pk_sched(data_fim), keys.sk_due("t-1"), item)


def _notificacoes(fake) -> list[dict]:
    return [i for (pk, sk), i in fake.itens.items()
            if pk == keys.pk_personal(PERSONAL) and sk.startswith("NOTIF#")]


def _congelar(monkeypatch, instante_utc: str):
    """Fixa o 'agora' que o gate enxerga, sem tocar no relógio do processo."""
    alvo = datetime.fromisoformat(instante_utc)

    def _now(tz=None):
        return alvo.astimezone(tz) if tz else alvo.replace(tzinfo=None)

    monkeypatch.setattr(locale_service, "datetime", type("D", (), {
        "now": staticmethod(_now),
        "fromisoformat": staticmethod(datetime.fromisoformat),
    }))
    return alvo


def _rodar(monkeypatch, instante_utc: str):
    alvo = _congelar(monkeypatch, instante_utc)
    monkeypatch.setattr(scheduler, "datetime", type("D", (), {
        "now": staticmethod(lambda tz=None: alvo),
    }))
    return scheduler.handler({}, None)


# ── O gate ───────────────────────────────────────────────────────────────────

def test_nao_dispara_antes_das_6h_locais(sched, monkeypatch):
    """05h em São Paulo: ainda não é hora, e a entrada tem que continuar viva."""
    _due(sched, "2026-09-09", SP)
    total = _rodar(monkeypatch, "2026-09-08T08:00:00+00:00")   # 05:00 BRT

    assert total["treinos"] == 0
    assert (keys.pk_sched("2026-09-09"), keys.sk_due("t-1")) in sched.itens
    assert _notificacoes(sched) == []


def test_dispara_a_partir_das_6h_locais(sched, monkeypatch):
    _due(sched, "2026-09-09", SP)
    total = _rodar(monkeypatch, "2026-09-08T09:00:00+00:00")   # 06:00 BRT

    assert total["treinos"] == 1
    assert (keys.pk_sched("2026-09-09"), keys.sk_due("t-1")) not in sched.itens
    assert len(_notificacoes(sched)) == 1


def test_entrada_sem_tz_usa_o_padrao(sched, monkeypatch):
    """Dado gravado antes da mudança: continua disparando às 06:00 BRT, como sempre foi."""
    _due(sched, "2026-09-09", None)
    assert _rodar(monkeypatch, "2026-09-08T08:00:00+00:00")["treinos"] == 0
    assert _rodar(monkeypatch, "2026-09-08T09:00:00+00:00")["treinos"] == 1


# ── O mesmo instante, fusos diferentes ───────────────────────────────────────

def test_tokyo_dispara_enquanto_sao_paulo_ainda_espera(sched, monkeypatch):
    """21:00 UTC de 08/09 = 06:00 de 09/09 em Tóquio, mas ainda 18:00 de 08/09 em SP."""
    _due(sched, "2026-09-10", TOKYO)
    total = _rodar(monkeypatch, "2026-09-08T21:00:00+00:00")
    assert total["treinos"] == 1     # a véspera (09/09) já amanheceu em Tóquio

    sched.itens.clear()
    _due(sched, "2026-09-10", SP)
    total = _rodar(monkeypatch, "2026-09-08T21:00:00+00:00")
    assert total["treinos"] == 0     # em SP ainda é 08/09 à tarde


def test_honolulu_espera_o_dia_inteiro_do_utc(sched, monkeypatch):
    """UTC-10: as 06:00 locais de 09/09 só chegam às 16:00 UTC do mesmo dia."""
    _due(sched, "2026-09-10", HONOLULU)
    assert _rodar(monkeypatch, "2026-09-09T12:00:00+00:00")["treinos"] == 0   # 02:00 local
    assert _rodar(monkeypatch, "2026-09-09T16:00:00+00:00")["treinos"] == 1   # 06:00 local


# ── Régua financeira ─────────────────────────────────────────────────────────

def test_cobranca_so_vence_na_manha_local(sched, monkeypatch):
    """A entrada BILLING_VENCER mora na partição de D+1 e dispara às 06:00 locais dela."""
    chamadas = []
    from app.services import financeiro_service
    monkeypatch.setattr(financeiro_service, "_marcar_vencida",
                        lambda *a: chamadas.append(a))
    sched.put_item(keys.pk_sched("2026-09-11"),
                   keys.sk_sched_billing_vencer(ALUNO, "c-1"),
                   {"aluno_id": ALUNO, "cobranca_id": "c-1", "personal_id": PERSONAL,
                    "vencimento": "2026-09-10", "tz": SP})

    assert _rodar(monkeypatch, "2026-09-11T08:00:00+00:00")["billing_vencer"] == 0   # 05h BRT
    assert chamadas == []
    assert _rodar(monkeypatch, "2026-09-11T09:00:00+00:00")["billing_vencer"] == 1   # 06h BRT
    assert chamadas == [(ALUNO, "c-1", "2026-09-10", PERSONAL)]


def test_uma_entrada_dispara_uma_vez_so(sched, monkeypatch):
    """Rodando de hora em hora, o claim por delete impede o aviso duplicado."""
    _due(sched, "2026-09-09", SP)
    assert _rodar(monkeypatch, "2026-09-08T09:00:00+00:00")["treinos"] == 1
    assert _rodar(monkeypatch, "2026-09-08T10:00:00+00:00")["treinos"] == 0
    assert len(_notificacoes(sched)) == 1


def test_entrada_atrasada_ainda_e_processada(sched, monkeypatch):
    """A janela para trás continua valendo: Lambda fora do ar por dias não perde entrada."""
    _due(sched, "2026-09-09", SP)
    assert _rodar(monkeypatch, "2026-09-20T09:00:00+00:00")["treinos"] == 1
