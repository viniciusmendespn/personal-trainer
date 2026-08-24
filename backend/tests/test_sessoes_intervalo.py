"""Sessões de um intervalo — insumo do link "ver treino desse dia" no feed do exercício.

Dois contratos, e os dois são fáceis de quebrar sem perceber:

1. **O dia é do cliente, não do servidor.** O backend grava tudo em UTC e não conhece o fuso do
   aluno; quem recorta o dia é o app, mandando os dois instantes. Um treino de 21h em BRT é
   00h UTC do dia seguinte — recortar no servidor traria o treino errado.
2. **O `ts` da SK `SESSION#{ts}#{id}` é a hora do FINISH, não a do início.** Uma sessão esquecida
   e fechada pelo scheduler 6h depois fica indexada em outro dia. Se a busca confiasse só no
   BETWEEN, o treino sumiria justamente do dia em que aconteceu.
"""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_current_aluno, get_current_personal_id
from app.main import app
from app.models.enums import SessaoStatus
from app.repositories import keys
from app.services import sessao_service

PERSONAL = "p-1"
ALUNO = "a-1"

# Dia local 20/08/2026 para quem está em UTC-3.
DIA_20 = ("2026-08-20T03:00:00.000Z", "2026-08-21T03:00:00.000Z")
DIA_21 = ("2026-08-21T03:00:00.000Z", "2026-08-22T03:00:00.000Z")


def _iso(ano, mes, dia, hora=12, minuto=0) -> str:
    return datetime(ano, mes, dia, hora, minuto, tzinfo=timezone.utc).isoformat()


def _gravar_sessao(fake, sessao_id, inicio_iso, *, fim_iso=None,
                   status=SessaoStatus.FINALIZADA, treino_nome="Treino A"):
    """Grava a sessão histórica indexando pelo FIM (é o que o finish faz de verdade)."""
    fim = datetime.fromisoformat(fim_iso or inicio_iso)
    ts = f"{int(fim.timestamp() * 1000):013d}"
    fake.put_item(keys.pk_aluno(ALUNO), keys.sk_sessao_hist(ts, sessao_id), {
        "sessao_id": sessao_id,
        "treino_nome": treino_nome,
        "status": status.value,
        "data_hora_inicio": inicio_iso,
        "data_hora_fim": fim_iso or inicio_iso,
        # Campo gordo de propósito: a projeção não pode deixá-lo passar.
        "exercicios_exec": [{"exercicio_nome": "Supino Reto", "series_exec": [{"carga": "60", "reps": 10}]}],
    })


@pytest.fixture
def dados(repo_fake):
    repo_fake.put_item(keys.pk_personal(PERSONAL), keys.sk_aluno_pointer(ALUNO),
                       {"aluno_id": ALUNO, "nome": "Marina", "status": "ATIVO"})
    return repo_fake


@pytest.fixture
def cliente(dados):
    app.dependency_overrides[get_current_personal_id] = lambda: PERSONAL
    app.dependency_overrides[get_current_aluno] = lambda: {"aluno_id": ALUNO, "personal_id": PERSONAL}
    yield TestClient(app), dados
    app.dependency_overrides.clear()


def _buscar(dia=DIA_20):
    return sessao_service.sessoes_no_intervalo(ALUNO, *dia)


# ── recorte ──────────────────────────────────────────────────────────────────

def test_devolve_so_as_sessoes_do_intervalo(dados):
    _gravar_sessao(dados, "s-19", _iso(2026, 8, 19, 14), treino_nome="Treino do dia 19")
    _gravar_sessao(dados, "s-20", _iso(2026, 8, 20, 14), treino_nome="Treino do dia 20")
    _gravar_sessao(dados, "s-21", _iso(2026, 8, 21, 14), treino_nome="Treino do dia 21")

    assert [s["sessao_id"] for s in _buscar()] == ["s-20"]


def test_intervalo_e_semiaberto(dados):
    de, ate = DIA_20
    _gravar_sessao(dados, "s-borda-de", de)     # exatamente no início: entra
    _gravar_sessao(dados, "s-borda-ate", ate)   # exatamente no fim: fica de fora

    assert [s["sessao_id"] for s in _buscar()] == ["s-borda-de"]


def test_sessao_autofinalizada_de_madrugada_conta_no_dia_em_que_comecou(dados):
    """23h em BRT = 02h UTC do dia seguinte; o scheduler fechou às 05h locais (08h UTC), então
    a SK está indexada no dia 21. Ainda assim o treino é do dia 20 de quem treinou."""
    _gravar_sessao(dados, "s-madrugada", _iso(2026, 8, 21, 2), fim_iso=_iso(2026, 8, 21, 8))

    assert [s["sessao_id"] for s in _buscar(DIA_20)] == ["s-madrugada"]
    assert _buscar(DIA_21) == []


def test_sessao_que_terminou_no_intervalo_mas_comecou_antes_fica_de_fora(dados):
    _gravar_sessao(dados, "s-anterior", _iso(2026, 8, 20, 1), fim_iso=_iso(2026, 8, 20, 5))

    assert _buscar(DIA_20) == []


def test_ignora_sessao_nao_finalizada(dados):
    _gravar_sessao(dados, "s-abandonada", _iso(2026, 8, 20, 14), status=SessaoStatus.ABANDONADA)

    assert _buscar() == []


def test_nao_devolve_a_sessao_ativa(dados):
    dados.put_item(keys.pk_aluno(ALUNO), keys.SK_SESSION_ACTIVE, {
        "sessao_id": "s-ativa", "treino_nome": "Em andamento",
        "status": SessaoStatus.EM_ANDAMENTO.value, "data_hora_inicio": _iso(2026, 8, 20, 14),
    })

    assert _buscar() == []


def test_ordena_por_inicio_ascendente(dados):
    _gravar_sessao(dados, "s-tarde", _iso(2026, 8, 20, 18))
    _gravar_sessao(dados, "s-manha", _iso(2026, 8, 20, 9))

    assert [s["sessao_id"] for s in _buscar()] == ["s-manha", "s-tarde"]


# ── payload ──────────────────────────────────────────────────────────────────

def test_devolve_so_os_campos_minimos(dados):
    """O item SESSION# carrega `exercicios_exec` inteiro — o link do feed só precisa de 3 campos."""
    _gravar_sessao(dados, "s-20", _iso(2026, 8, 20, 14), treino_nome="Treino A")

    assert _buscar() == [{"sessao_id": "s-20", "data_hora": _iso(2026, 8, 20, 14),
                          "treino_nome": "Treino A"}]


# ── fuso ─────────────────────────────────────────────────────────────────────

def test_o_recorte_do_dia_e_do_cliente(dados, monkeypatch):
    """Os mesmos itens, dois fusos: quem está em UTC+9 vê o treino num dia diferente. E o
    TZ_OFFSET_HOURS do servidor (usado só para formatar texto de push) não interfere."""
    _gravar_sessao(dados, "s-noite", _iso(2026, 8, 20, 22))

    dia_local_utc_menos_3 = _buscar(DIA_20)
    dia_local_utc_mais_9 = sessao_service.sessoes_no_intervalo(
        ALUNO, "2026-08-19T15:00:00.000Z", "2026-08-20T15:00:00.000Z")

    assert [s["sessao_id"] for s in dia_local_utc_menos_3] == ["s-noite"]
    assert dia_local_utc_mais_9 == []

    monkeypatch.setenv("TZ_OFFSET_HOURS", "9")
    assert _buscar(DIA_20) == dia_local_utc_menos_3


# ── validação ────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("de,ate", [
    ("2026-08-21T03:00:00Z", "2026-08-20T03:00:00Z"),   # invertido
    ("2026-08-20T03:00:00Z", "2026-08-20T03:00:00Z"),   # vazio
    ("ontem", "2026-08-20T03:00:00Z"),                  # ilegível
    ("2026-08-20T03:00:00Z", "2026-08-24T03:00:00Z"),   # 96h
])
def test_intervalo_invalido_da_400(dados, de, ate):
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as e:
        sessao_service.sessoes_no_intervalo(ALUNO, de, ate)
    assert e.value.status_code == 400


def test_sessao_com_data_ilegivel_e_ignorada_sem_quebrar(dados):
    _gravar_sessao(dados, "s-ok", _iso(2026, 8, 20, 14))
    ts = f"{int(datetime(2026, 8, 20, 15, tzinfo=timezone.utc).timestamp() * 1000):013d}"
    dados.put_item(keys.pk_aluno(ALUNO), keys.sk_sessao_hist(ts, "s-torto"), {
        "sessao_id": "s-torto", "treino_nome": "?", "status": SessaoStatus.FINALIZADA.value,
        "data_hora_inicio": "",
    })

    assert [s["sessao_id"] for s in _buscar()] == ["s-ok"]


# ── HTTP ─────────────────────────────────────────────────────────────────────

def test_rota_do_aluno_responde_com_as_sessoes(cliente):
    tc, fake = cliente
    _gravar_sessao(fake, "s-20", _iso(2026, 8, 20, 14))

    r = tc.get("/v1/aluno/historico/intervalo", params={"de": DIA_20[0], "ate": DIA_20[1]})

    assert r.status_code == 200
    assert [s["sessao_id"] for s in r.json()["sessoes"]] == ["s-20"]


def test_rota_do_personal_responde_com_as_sessoes(cliente):
    tc, fake = cliente
    _gravar_sessao(fake, "s-20", _iso(2026, 8, 20, 14))

    r = tc.get(f"/v1/alunos/{ALUNO}/historico/intervalo",
               params={"de": DIA_20[0], "ate": DIA_20[1]})

    assert r.status_code == 200
    assert [s["sessao_id"] for s in r.json()["sessoes"]] == ["s-20"]


def test_personal_de_outro_aluno_nao_alcanca_o_historico(cliente):
    tc, _ = cliente

    r = tc.get("/v1/alunos/aluno-de-outro/historico/intervalo",
               params={"de": DIA_20[0], "ate": DIA_20[1]})

    assert r.status_code == 404


def test_a_rota_nova_nao_e_engolida_por_sessoes_id(cliente):
    """`/sessoes/{sessao_id}` casaria com "intervalo" — por isso o recurso vive em /historico/."""
    tc, _ = cliente

    r = tc.get("/v1/aluno/historico/intervalo", params={"de": DIA_20[0], "ate": DIA_20[1]})

    assert r.status_code == 200
    assert "sessoes" in r.json()
