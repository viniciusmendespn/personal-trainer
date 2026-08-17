from app.services.pendencia_service import (
    PAGAMENTO_ATRASADO, SEM_TREINAR, SEM_TREINO_VIGENTE,
    avaliar, detalhar, dias_desde, resumo, tem_vigente,
)

HOJE = "2026-08-15"
ANTIGO = "2026-01-01"        # cadastro velho: fora da carência de aluno novo


def _avaliar(**over):
    base = dict(status="ATIVO", bloqueado=False, created_at=ANTIGO, vigencias=[],
                ultimo_treino_em=f"{HOJE}T10:00:00+00:00", vencidas=0, hoje=HOJE)
    return avaliar(**{**base, **over})


def _tipos(pend):
    return {p["tipo"] for p in pend}


# ── Vigência ─────────────────────────────────────────────────────────────────

def test_treino_sem_datas_e_vigente():
    assert tem_vigente([{}], HOJE) is True


def test_data_fim_ontem_nao_e_vigente():
    assert tem_vigente([{"f": "2026-08-14"}], HOJE) is False


def test_data_fim_hoje_ainda_e_vigente():
    assert tem_vigente([{"f": HOJE}], HOJE) is True


def test_data_inicio_amanha_ainda_nao_e_vigente():
    assert tem_vigente([{"i": "2026-08-16"}], HOJE) is False


def test_basta_um_treino_vigente_entre_varios():
    assert tem_vigente([{"f": "2026-01-01"}, {"i": "2026-08-01", "f": "2026-12-31"}], HOJE) is True


def test_vigencias_ausente_e_desconhecido():
    """Aluno legado antes do backfill: não decide, e por isso não alarma."""
    assert tem_vigente(None, HOJE) is None
    assert SEM_TREINO_VIGENTE not in _tipos(_avaliar(vigencias=None))


def test_sem_nenhum_treino_ativo_gera_pendencia():
    assert SEM_TREINO_VIGENTE in _tipos(_avaliar(vigencias=[]))


def test_treino_expirado_gera_pendencia():
    assert SEM_TREINO_VIGENTE in _tipos(_avaliar(vigencias=[{"f": "2026-08-14"}]))


def test_treino_vigente_nao_gera_pendencia():
    assert SEM_TREINO_VIGENTE not in _tipos(_avaliar(vigencias=[{}]))


# ── Inatividade ──────────────────────────────────────────────────────────────

def test_treinou_hoje_nao_gera_pendencia():
    assert SEM_TREINAR not in _tipos(_avaliar())


def test_nove_dias_sem_treinar_ainda_nao_alarma():
    assert SEM_TREINAR not in _tipos(_avaliar(ultimo_treino_em="2026-08-06T10:00:00+00:00"))


def test_dez_dias_sem_treinar_alarma():
    pend = _avaliar(ultimo_treino_em="2026-08-05T10:00:00+00:00")
    assert SEM_TREINAR in _tipos(pend)
    assert "10 dias" in next(p for p in pend if p["tipo"] == SEM_TREINAR)["detalhe"]


def test_nunca_treinou_alarma():
    pend = _avaliar(ultimo_treino_em=None)
    assert SEM_TREINAR in _tipos(pend)
    assert "Nunca" in next(p for p in pend if p["tipo"] == SEM_TREINAR)["detalhe"]


def test_aluno_novo_sem_treinar_nao_alarma():
    """Cadastrado há 2 dias — não dá para estar 'parado há 10 dias'."""
    assert SEM_TREINAR not in _tipos(_avaliar(created_at="2026-08-13", ultimo_treino_em=None))


def test_carencia_acompanha_o_limiar():
    """Carência acoplada a DIAS_SEM_TREINAR: quem nunca treinou não pode alarmar ANTES de
    quem treinou uma vez e parou. Na véspera do limiar, silêncio; no limiar, alarme."""
    assert SEM_TREINAR not in _tipos(_avaliar(created_at="2026-08-07", ultimo_treino_em=None))
    assert SEM_TREINAR in _tipos(_avaliar(created_at="2026-08-05", ultimo_treino_em=None))


def test_aluno_novo_ainda_alarma_sem_treino_vigente():
    assert SEM_TREINO_VIGENTE in _tipos(
        _avaliar(created_at="2026-08-13", ultimo_treino_em=None, vigencias=[])
    )


def test_created_at_ausente_nao_aplica_carencia():
    assert SEM_TREINAR in _tipos(_avaliar(created_at=None, ultimo_treino_em=None))


# ── Financeiro ───────────────────────────────────────────────────────────────

def test_sem_cobranca_vencida_nao_gera_pendencia():
    assert PAGAMENTO_ATRASADO not in _tipos(_avaliar(vencidas=0))


def test_cobranca_vencida_gera_pendencia_alta():
    pend = _avaliar(vencidas=2)
    p = next(p for p in pend if p["tipo"] == PAGAMENTO_ATRASADO)
    assert p["severidade"] == "alta"
    assert p["detalhe"] == "2 cobranças vencidas."
    assert p["tab"] == "financeiro"


def test_singular_de_uma_cobranca():
    p = next(p for p in _avaliar(vencidas=1) if p["tipo"] == PAGAMENTO_ATRASADO)
    assert p["detalhe"] == "1 cobrança vencida."


# ── Alunos fora de operação ──────────────────────────────────────────────────

def test_aluno_inativo_nao_gera_nenhuma_pendencia():
    assert _avaliar(status="INATIVO", vigencias=[], ultimo_treino_em=None, vencidas=3) == []


def test_aluno_bloqueado_nao_gera_nenhuma_pendencia():
    assert _avaliar(bloqueado=True, vigencias=[], ultimo_treino_em=None, vencidas=3) == []


# ── Acumulação e formato ─────────────────────────────────────────────────────

def test_tres_regras_acumulam():
    pend = _avaliar(vigencias=[], ultimo_treino_em=None, vencidas=1)
    assert _tipos(pend) == {SEM_TREINO_VIGENTE, SEM_TREINAR, PAGAMENTO_ATRASADO}


def test_resumo_enxuga_payload_do_card():
    assert resumo(_avaliar(vigencias=[])) == [
        {"tipo": SEM_TREINO_VIGENTE, "severidade": "alta", "titulo": "Sem treino vigente"}
    ]


def test_dias_desde_aceita_data_e_datetime():
    assert dias_desde("2026-08-08", HOJE) == 7
    assert dias_desde("2026-08-08T23:59:59+00:00", HOJE) == 7
    assert dias_desde(None, HOJE) is None
    assert dias_desde("nao-e-data", HOJE) is None


# ── Versão detalhada (aba do aluno) ──────────────────────────────────────────

def _detalhar(**over):
    base = dict(status="ATIVO", bloqueado=False, created_at=ANTIGO, treinos=[],
                ultimo_treino=None, cobrancas_vencidas=[], hoje=HOJE)
    return detalhar(**{**base, **over})


def test_detalhar_aluno_sem_treino_nenhum():
    p = next(p for p in _detalhar() if p["tipo"] == SEM_TREINO_VIGENTE)
    assert p["detalhe"] == "Este aluno ainda não tem nenhum treino cadastrado."


def test_detalhar_nomeia_os_treinos_expirados():
    treinos = [{"nome": "Treino A", "ativo": True, "data_fim": "2026-08-01"}]
    p = next(p for p in _detalhar(treinos=treinos) if p["tipo"] == SEM_TREINO_VIGENTE)
    assert "Treino A" in p["detalhe"]


def test_detalhar_ignora_treino_inativo_na_vigencia():
    treinos = [{"nome": "Treino A", "ativo": False}]
    assert SEM_TREINO_VIGENTE in _tipos(_detalhar(treinos=treinos))


def test_detalhar_treino_ativo_sem_datas_nao_alarma():
    assert SEM_TREINO_VIGENTE not in _tipos(_detalhar(treinos=[{"nome": "A", "ativo": True}]))


def test_detalhar_ultimo_treino_com_data_formatada():
    p = next(p for p in _detalhar(ultimo_treino="2026-08-02T10:00:00+00:00")
             if p["tipo"] == SEM_TREINAR)
    assert p["detalhe"] == "Último treino em 02/08/2026 — há 13 dias."


def test_detalhar_soma_valor_das_cobrancas_vencidas():
    cobs = [{"valor": 200, "vencimento": "2026-07-10"}, {"valor": 160, "vencimento": "2026-06-10"}]
    p = next(p for p in _detalhar(cobrancas_vencidas=cobs) if p["tipo"] == PAGAMENTO_ATRASADO)
    assert p["detalhe"] == "2 cobranças vencidas, total de R$ 360.00 — a mais antiga venceu em 10/06/2026."
