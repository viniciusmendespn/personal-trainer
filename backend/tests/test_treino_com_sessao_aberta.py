"""Apagar/substituir treino que o aluno está executando agora, e lixo na partição TREINO#.

Dois eixos, com a mesma origem: em produção o personal remontou o programa enquanto a aluna
treinava, e o agregado do fechamento automático recriou o treino apagado como casca — um
TREINO# só com contadores, sem `treino_id`. O item torto derrubava `GET /v1/aluno/hoje` com
KeyError e o app do aluno ficava sem nenhum treino.

  1. O guard: o caminho destrutivo recusa UMA vez quando há sessão aberta no treino, para o
     personal decidir sabendo. É aviso, não bloqueio — `confirmar` na segunda passa direto,
     porque sessão "em andamento" costuma ser sessão esquecida aberta (o scheduler só fecha
     em 6h) e travar o personal por isso seria pior.
  2. A blindagem: item de TREINO# sem `treino_id` não é treino — some da leitura em vez de
     derrubar a tela. Vale para qualquer causa futura, não só aquele bug.
"""
import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_current_personal_id
from app.main import app
from app.repositories import keys

PERSONAL = "personal-1"
ALUNO = "aluno-1"
TREINO = "t-1"

BOM = {"version": "1", "treinos": [{"nome": "Treino Novo", "exercicios": [
    {"nome": "Supino reto", "series_prescritas": [{"series": 3, "reps": "8-12"}]}]}]}


@pytest.fixture
def cliente(repo_fake):
    repo_fake.put_item(keys.pk_personal(PERSONAL), keys.sk_aluno_pointer(ALUNO),
                       {"aluno_id": ALUNO, "nome": "Marina", "status": "ATIVO"})
    repo_fake.put_item(keys.pk_aluno(ALUNO), keys.sk_treino(TREINO),
                       {"treino_id": TREINO, "aluno_id": ALUNO, "nome": "Treino A",
                        "ordem": 0, "ativo": True})
    app.dependency_overrides[get_current_personal_id] = lambda: PERSONAL
    yield TestClient(app), repo_fake
    app.dependency_overrides.clear()


def _abrir_sessao(repo, treino_id: str = TREINO) -> None:
    repo.put_item(keys.pk_aluno(ALUNO), keys.SK_SESSION_ACTIVE, {
        "sessao_id": "s-1", "aluno_id": ALUNO, "personal_id": PERSONAL,
        "treino_id": treino_id, "treino_nome": "Treino A",
        "status": "EM_ANDAMENTO", "data_hora_inicio": "2026-08-23T19:28:46+00:00",
    })


def _treinos(repo) -> list:
    return repo.query_pk(keys.pk_aluno(ALUNO), sk_prefix=keys.SK_TREINO_PREFIX)


# ── Excluir um treino ────────────────────────────────────────────────────────

def test_excluir_treino_em_execucao_avisa_antes(cliente):
    tc, repo = cliente
    _abrir_sessao(repo)

    r = tc.delete(f"/v1/alunos/{ALUNO}/treinos/{TREINO}")

    assert r.status_code == 409
    d = r.json()["detail"]
    assert d["code"] == "SESSAO_EM_ANDAMENTO"
    assert d["treino_nome"] == "Treino A"
    assert d["desde"] == "2026-08-23T19:28:46+00:00"
    assert len(_treinos(repo)) == 1   # recusa não apaga nada


def test_excluir_com_confirmar_passa(cliente):
    tc, repo = cliente
    _abrir_sessao(repo)

    assert tc.delete(f"/v1/alunos/{ALUNO}/treinos/{TREINO}?confirmar=true").status_code == 204
    assert _treinos(repo) == []


def test_sessao_de_outro_treino_nao_atrapalha(cliente):
    """O guard é sobre o treino que vai sumir, não sobre "o aluno está treinando"."""
    tc, repo = cliente
    _abrir_sessao(repo, treino_id="outro-treino")

    assert tc.delete(f"/v1/alunos/{ALUNO}/treinos/{TREINO}").status_code == 204


def test_sem_sessao_aberta_exclui_direto(cliente):
    tc, repo = cliente
    assert tc.delete(f"/v1/alunos/{ALUNO}/treinos/{TREINO}").status_code == 204
    assert _treinos(repo) == []


# ── Substituir o programa inteiro (import do portal) ─────────────────────────

def test_import_avisa_com_qualquer_sessao_aberta(cliente):
    """Substituição total apaga todos os treinos — qualquer sessão aberta está em risco."""
    tc, repo = cliente
    _abrir_sessao(repo, treino_id="outro-treino")

    r = tc.post(f"/v1/alunos/{ALUNO}/treinos/importar", json={"conteudo": _json(BOM)})

    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "SESSAO_EM_ANDAMENTO"
    assert [t["treino_id"] for t in _treinos(repo)] == [TREINO]   # programa intacto


def test_import_com_confirmar_grava(cliente):
    tc, repo = cliente
    _abrir_sessao(repo)

    r = tc.post(f"/v1/alunos/{ALUNO}/treinos/importar",
                json={"conteudo": _json(BOM), "confirmar": True})

    assert r.status_code == 201
    assert [t["nome"] for t in _treinos(repo)] == ["Treino Novo"]


def test_json_invalido_reprova_antes_do_guard(cliente):
    """A ordem importa: erro de conteúdo continua sendo 400, não um 409 que esconde o typo."""
    tc, repo = cliente
    _abrir_sessao(repo)

    r = tc.post(f"/v1/alunos/{ALUNO}/treinos/importar", json={"conteudo": "{nao e json"})

    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "ARQUIVO_INVALIDO"


# ── Item de TREINO# sem treino_id ────────────────────────────────────────────

def test_treino_sem_id_nao_aparece_na_listagem(cliente):
    tc, repo = cliente
    repo.put_item(keys.pk_aluno(ALUNO), keys.sk_treino("fantasma"),
                  {"total_execucoes": 1, "ultima_execucao": "2026-08-23T20:34:23+00:00"})

    r = tc.get(f"/v1/alunos/{ALUNO}/treinos")

    assert r.status_code == 200
    assert [t["treino_id"] for t in r.json()] == [TREINO]


def test_treino_sem_id_nao_derruba_o_export(cliente):
    tc, repo = cliente
    repo.put_item(keys.pk_aluno(ALUNO), keys.sk_treino("fantasma"), {"total_execucoes": 1})

    r = tc.get(f"/v1/alunos/{ALUNO}/treinos/exportar")

    assert r.status_code == 200
    assert [t["nome"] for t in r.json()["treinos"]] == ["Treino A"]


def _json(obj) -> str:
    import json
    return json.dumps(obj)
