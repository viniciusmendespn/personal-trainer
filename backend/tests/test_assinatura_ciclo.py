"""Ciclo de vigência da assinatura do personal — mês de calendário ancorado.

O bug que originou estes testes: a validade era creditada em `+30 dias` corridos, então o
dia do vencimento andava para trás em todo mês de 31 dias (assinou 17/06 → 17/07 → 16/08
→ 15/09 → ...), enquanto o portal promete "Renovar por 1 mês" e 12 mensalidades cobriam
apenas 360 dias.

O contrato coberto aqui:
- ciclo pago avança por MÊS DE CALENDÁRIO, ancorado no dia da 1ª assinatura;
- a âncora é PERSISTIDA (`dia_ancora`), então o clamp de fevereiro não degrada o dia;
- crédito em `dias` (cupom/bônus) continua em dias corridos e re-ancora, para não ser
  comido pelo `add_meses` seguinte.
"""
from datetime import date

import pytest

from app.repositories import keys
from app.services import assinatura_service
from app.utils import add_meses

PID = "personal-teste"


@pytest.fixture
def env(repo_fake, monkeypatch):
    """`repo_fake` + segredo do FinPilot desligado (senão `origem="PIX"` tenta gerar
    promo code, que não é o objeto destes testes)."""
    from app.config import settings
    monkeypatch.setattr(settings, "promo_code_secret", "")
    assinatura_service.invalidate_alunos_bloqueados(PID)
    return repo_fake


def hoje_eh(monkeypatch, iso: str) -> None:
    monkeypatch.setattr(assinatura_service, "_hoje", lambda: date.fromisoformat(iso))


def assinatura(env) -> dict:
    return env.get_item(keys.pk_personal(PID), keys.SK_ASSINATURA)


# ── O bug do relato ────────────────────────────────────────────────────────────────────

def test_mensal_mantem_o_dia_do_mes_em_renovacoes_sucessivas(env, monkeypatch):
    """Assinou dia 17 e renovou no dia do vencimento 3x: com +30 dias dava
    17/07 → 16/08 → 15/09 → 15/10. Deve dar sempre dia 17."""
    passos = [
        ("2026-06-17", "2026-07-17"),
        ("2026-07-17", "2026-08-17"),
        ("2026-08-17", "2026-09-17"),
        ("2026-09-17", "2026-10-17"),
    ]
    for hoje, esperado in passos:
        hoje_eh(monkeypatch, hoje)
        r = assinatura_service.aplicar_pagamento(PID, meses=1, origem="PIX")
        assert r["valida_ate"] == esperado, f"renovando em {hoje}"

    item = assinatura(env)
    assert int(item["dia_ancora"]) == 17
    assert item["plano"] == assinatura_service.PLANO_GESTAO_PRO


def test_mensal_dia_31_sobrevive_a_fevereiro(env, monkeypatch):
    """A âncora persistida é o que impede a degradação: sem ela, o clamp de fevereiro
    prenderia o vencimento no dia 28 para sempre."""
    passos = [
        ("2026-01-31", "2026-02-28"),   # clamp (2026 não é bissexto)
        ("2026-02-28", "2026-03-31"),   # volta para o 31 — âncora preservada
        ("2026-03-31", "2026-04-30"),   # clamp
        ("2026-04-30", "2026-05-31"),   # volta para o 31
    ]
    for hoje, esperado in passos:
        hoje_eh(monkeypatch, hoje)
        r = assinatura_service.aplicar_pagamento(PID, meses=1, origem="PIX")
        assert r["valida_ate"] == esperado, f"renovando em {hoje}"
        assert int(r["dia_ancora"]) == 31


def test_renovar_no_ultimo_dia_de_ciclo_clampado_nao_perde_a_ancora(env, monkeypatch):
    """Regressão do `>` vs `>=`: no último dia válido o plano ainda está ATIVO
    (`_is_pro_ativo` usa `>=`), então a renovação tem que usar `valida_ate` como base e
    manter a âncora. Com `>` estrito cairia no ramo de reativação e re-ancoraria em 28."""
    hoje_eh(monkeypatch, "2026-01-31")
    assinatura_service.aplicar_pagamento(PID, meses=1, origem="PIX")
    assert assinatura(env)["valida_ate"] == "2026-02-28"

    hoje_eh(monkeypatch, "2026-02-28")   # valida_ate == hoje → ainda ativo
    assert assinatura_service.get_status(PID)["status"] == "ATIVO"
    r = assinatura_service.aplicar_pagamento(PID, meses=1, origem="PIX")
    assert r["valida_ate"] == "2026-03-31"
    assert int(r["dia_ancora"]) == 31


# ── Cumulatividade e reativação ────────────────────────────────────────────────────────

def test_renovar_antecipado_preserva_o_saldo(env, monkeypatch):
    hoje_eh(monkeypatch, "2026-06-17")
    assinatura_service.aplicar_pagamento(PID, meses=1, origem="PIX")

    hoje_eh(monkeypatch, "2026-07-02")   # 15 dias antes de vencer
    r = assinatura_service.aplicar_pagamento(PID, meses=1, origem="PIX")
    assert r["valida_ate"] == "2026-08-17"   # somou sobre 17/07, não sobre 02/07


def test_reativacao_apos_expirar_reancora_em_hoje(env, monkeypatch):
    hoje_eh(monkeypatch, "2026-06-17")
    assinatura_service.aplicar_pagamento(PID, meses=1, origem="PIX")

    hoje_eh(monkeypatch, "2026-08-25")   # venceu em 17/07, ficou parado
    assert assinatura_service.get_status(PID)["status"] == "EXPIRADO"
    r = assinatura_service.aplicar_pagamento(PID, meses=1, origem="PIX")
    assert r["valida_ate"] == "2026-09-25"   # não recupera o período parado
    assert int(r["dia_ancora"]) == 25        # novo ciclo ancora no dia 25


def test_primeira_compra_promove_trial_e_cria_a_ancora(env, monkeypatch):
    hoje_eh(monkeypatch, "2026-06-17")
    status = assinatura_service.get_status(PID)
    assert status["status"] == "TRIAL"
    assert status["alunos_limit"] == assinatura_service.TRIAL_ALUNOS_LIMIT

    assinatura_service.aplicar_pagamento(PID, meses=1, origem="PIX")
    status = assinatura_service.get_status(PID)
    assert status["plano"] == assinatura_service.PLANO_GESTAO_PRO
    assert status["status"] == "ATIVO"
    assert status["alunos_limit"] is None
    assert int(status["dia_ancora"]) == 17


# ── Anual ──────────────────────────────────────────────────────────────────────────────

def test_anual_cai_no_mesmo_dia_do_ano_seguinte(env, monkeypatch):
    hoje_eh(monkeypatch, "2026-06-17")
    r = assinatura_service.aplicar_pagamento(PID, meses=12, origem="PIX")
    assert r["valida_ate"] == "2027-06-17"


def test_anual_ancorado_em_29_02_volta_no_proximo_bissexto(env, monkeypatch):
    """Com `+365` a data escorregaria a cada ano; com a âncora, os anos comuns clampam em
    28/02 e o bissexto seguinte recupera o 29."""
    hoje_eh(monkeypatch, "2028-02-29")
    r = assinatura_service.aplicar_pagamento(PID, meses=12, origem="PIX")
    assert r["valida_ate"] == "2029-02-28"
    assert int(r["dia_ancora"]) == 29

    for hoje, esperado in [("2029-02-28", "2030-02-28"),
                           ("2030-02-28", "2031-02-28"),
                           ("2031-02-28", "2032-02-29")]:
        hoje_eh(monkeypatch, hoje)
        r = assinatura_service.aplicar_pagamento(PID, meses=12, origem="PIX")
        assert r["valida_ate"] == esperado, f"renovando em {hoje}"


# ── Crédito em dias (cupom, indicação, bônus de feedback, admin) ───────────────────────

def test_bonus_em_dias_reancora_e_nao_e_comido_pela_renovacao(env, monkeypatch):
    hoje_eh(monkeypatch, "2026-08-17")
    assinatura_service.aplicar_pagamento(PID, meses=1, origem="PIX")
    assert assinatura(env)["valida_ate"] == "2026-09-17"

    hoje_eh(monkeypatch, "2026-09-01")
    r = assinatura_service.aplicar_pagamento(PID, dias=10, origem="INDICACAO")
    assert r["valida_ate"] == "2026-09-27"
    assert int(r["dia_ancora"]) == 27

    hoje_eh(monkeypatch, "2026-09-27")
    r = assinatura_service.aplicar_pagamento(PID, meses=1, origem="PIX")
    assert r["valida_ate"] == "2026-10-27"   # os 10 dias de bônus continuam de pé


def test_cupom_no_trial_ancora_no_fim_do_bonus(env, monkeypatch):
    hoje_eh(monkeypatch, "2026-06-17")
    r = assinatura_service.aplicar_pagamento(PID, dias=30, origem="PROMO")
    assert r["valida_ate"] == "2026-07-17"
    assert int(r["dia_ancora"]) == 17


def test_sem_meses_nem_dias_e_erro(env, monkeypatch):
    hoje_eh(monkeypatch, "2026-06-17")
    with pytest.raises(ValueError):
        assinatura_service.aplicar_pagamento(PID, origem="ADMIN")


# ── Histórico de pagamentos e lembrete D-7 ─────────────────────────────────────────────

def test_historico_grava_meses_e_os_dias_reais_do_ciclo(env, monkeypatch):
    hoje_eh(monkeypatch, "2026-06-17")
    assinatura_service.aplicar_pagamento(PID, meses=1, origem="PIX")
    hoje_eh(monkeypatch, "2026-07-17")
    assinatura_service.aplicar_pagamento(PID, meses=1, origem="PIX")

    pagamentos = assinatura_service.listar_pagamentos(PID)
    assert len(pagamentos) == 2
    # Sem asserção de ordem: o SK carrega `now_iso()` real, cuja resolução no Windows pode
    # empatar entre dois pagamentos do mesmo teste, deixando o desempate para o uuid.
    # 30 dias = 17/06 → 17/07 (junho tem 30); 31 = 17/07 → 17/08 (julho tem 31).
    assert sorted(p["dias_concedidos"] for p in pagamentos) == [30, 31]
    assert all(p["meses_concedidos"] == 1 for p in pagamentos)


def test_aviso_d7_acompanha_a_nova_data(env, monkeypatch):
    hoje_eh(monkeypatch, "2026-06-17")
    assinatura_service.aplicar_pagamento(PID, meses=1, origem="PIX")
    sk = keys.sk_sched_assinatura_aviso(PID)
    assert env.get_item(keys.pk_sched("2026-07-10"), sk) is not None   # 17/07 − 7d

    hoje_eh(monkeypatch, "2026-07-17")
    assinatura_service.aplicar_pagamento(PID, meses=1, origem="PIX")
    assert env.get_item(keys.pk_sched("2026-07-10"), sk) is None       # antigo removido
    assert env.get_item(keys.pk_sched("2026-08-10"), sk) is not None   # 17/08 − 7d


# ── O helper puro ──────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("base,meses,ancora,esperado", [
    (date(2026, 12, 15), 1, None, date(2027, 1, 15)),    # virada de ano
    (date(2026, 1, 15), 12, None, date(2027, 1, 15)),    # 12 meses
    (date(2026, 12, 31), 1, 31, date(2027, 1, 31)),      # virada de ano com âncora 31
    (date(2026, 1, 31), 1, None, date(2026, 2, 28)),     # clamp em fevereiro comum
    (date(2028, 1, 31), 1, None, date(2028, 2, 29)),     # clamp em fevereiro bissexto
    (date(2026, 2, 28), 1, 31, date(2026, 3, 31)),       # âncora recupera o 31
    (date(2026, 3, 31), 1, 31, date(2026, 4, 30)),       # clamp em mês de 30
    (date(2026, 5, 31), 24, 31, date(2028, 5, 31)),      # múltiplos anos
])
def test_add_meses(base, meses, ancora, esperado):
    assert add_meses(base, meses, ancora) == esperado
