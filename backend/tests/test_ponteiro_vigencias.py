"""O ponteiro PT#{personal}/ALUNO#{aluno} carrega `vigencias` — o insumo denormalizado que a
listagem de alunos (e o `resumo_carteira` do MCP) usa para decidir a pendência "sem treino
vigente" sem varrer a partição de cada aluno.

Quem cria treino tem de recalculá-lo. `rotinas.aplicar_rotina` tinha uma cópia local do touch
que só bumpava `updated_at`, e `templates.aplicar_template` não tocava o ponteiro de jeito
nenhum: o aluno ganhava treino e continuava marcado como "sem treino vigente" no card (ícone
vermelho na listagem, nenhuma pendência ao abrir a aba, que recalcula do jeito exato).

O que estes testes travam é o insumo no banco, não o texto da pendência — é lá que a
divergência entre os dois caminhos de leitura nasce.
"""
import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_current_personal_id
from app.main import app
from app.repositories import keys
from app.services import pendencia_service

PERSONAL = "personal-1"
ALUNO = "aluno-1"

EXERCICIO = {"nome": "Supino reto", "ordem": 0,
             "series_prescritas": [{"series": 3, "reps": "8-12"}]}


@pytest.fixture
def cliente(repo_fake):
    # Ponteiro no estado do bug: aluno já ficou sem treino algum dia e o insumo congelou em [].
    repo_fake.put_item(keys.pk_personal(PERSONAL), keys.sk_aluno_pointer(ALUNO),
                       {"aluno_id": ALUNO, "nome": "Marina", "status": "ATIVO", "vigencias": []})
    app.dependency_overrides[get_current_personal_id] = lambda: PERSONAL
    yield TestClient(app), repo_fake
    app.dependency_overrides.clear()


def _vigencias(repo):
    ptr = repo.get_item(keys.pk_personal(PERSONAL), keys.sk_aluno_pointer(ALUNO))
    return ptr.get("vigencias")


def _seed_rotina(repo, treinos):
    repo.put_item(keys.pk_personal(PERSONAL), keys.sk_rotina("rot-1"), {
        "rotina_id": "rot-1", "personal_id": PERSONAL, "created_at": "2026-08-01T00:00:00+00:00",
        "nome": "Rotina AB", "treinos": treinos,
    })


def _seed_template(repo, **over):
    repo.put_item(keys.pk_personal(PERSONAL), keys.sk_template("tpl-1"), {
        "template_id": "tpl-1", "personal_id": PERSONAL,
        "created_at": "2026-08-01T00:00:00+00:00",
        "nome": "Treino A", "exercicios": [EXERCICIO], **over,
    })


# ── rotina ───────────────────────────────────────────────────────────────────

def test_aplicar_rotina_atualiza_vigencias_do_ponteiro(cliente):
    """O caso relatado: rotina aplicada, aluno com treino, card seguia vermelho."""
    tc, repo = cliente
    _seed_rotina(repo, [{"nome": "Treino A", "ordem": 0, "exercicios": [EXERCICIO]},
                        {"nome": "Treino B", "ordem": 1, "exercicios": [EXERCICIO]}])
    r = tc.post("/v1/rotinas/rot-1/aplicar", json={"aluno_ids": [ALUNO]})
    assert r.status_code == 200

    # Treino de rotina não tem datas: janela vazia, vigente sempre — uma por treino ativo.
    assert _vigencias(repo) == [{}, {}]
    assert pendencia_service.tem_vigente(_vigencias(repo), "2026-08-17") is True


def test_aplicar_rotina_substituindo_reflete_o_programa_novo(cliente):
    tc, repo = cliente
    repo.put_item(keys.pk_aluno(ALUNO), keys.sk_treino("t-velho"),
                  {"treino_id": "t-velho", "aluno_id": ALUNO, "nome": "Expirado",
                   "ordem": 0, "ativo": True, "data_fim": "2026-01-01"})
    _seed_rotina(repo, [{"nome": "Treino A", "ordem": 0, "exercicios": [EXERCICIO]}])
    r = tc.post("/v1/rotinas/rot-1/aplicar",
                json={"aluno_ids": [ALUNO], "modo": "substituir"})
    assert r.status_code == 200
    # A janela do treino apagado não pode sobrar no ponteiro.
    assert _vigencias(repo) == [{}]


# ── template ─────────────────────────────────────────────────────────────────

def test_aplicar_template_atualiza_vigencias_do_ponteiro(cliente):
    tc, repo = cliente
    _seed_template(repo)
    r = tc.post("/v1/templates/tpl-1/aplicar", json={"aluno_ids": [ALUNO]})
    assert r.status_code == 200
    assert _vigencias(repo) == [{}]
    assert pendencia_service.tem_vigente(_vigencias(repo), "2026-08-17") is True


def test_aplicar_template_marca_o_ponteiro_como_atualizado(cliente):
    """`updated_at` alimenta o "última atualização" da listagem — o template não mexia nele."""
    tc, repo = cliente
    _seed_template(repo)
    tc.post("/v1/templates/tpl-1/aplicar", json={"aluno_ids": [ALUNO]})
    ptr = repo.get_item(keys.pk_personal(PERSONAL), keys.sk_aluno_pointer(ALUNO))
    assert ptr.get("updated_at")
