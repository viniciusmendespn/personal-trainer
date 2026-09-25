"""Modelo de anamnese padrão: quem ainda não tem anamnese recebe um pronto para usar/editar.

O que estes testes travam: o padrão aparece no portal E no formulário público (senão o
personal vê perguntas que o aluno não recebe), o template salvo pelo personal sempre vence,
e um template esvaziado de propósito não "ressuscita" o padrão.
"""
import pytest
from fastapi.testclient import TestClient

from app import aluno_auth
from app.dependencies import get_current_personal_id
from app.main import app
from app.models.anamnese import PerguntaAnamnese
from app.repositories import keys
from app.services import anamnese_padrao

PERSONAL = "personal-1"


@pytest.fixture
def cliente(repo_fake, monkeypatch):
    app.dependency_overrides[get_current_personal_id] = lambda: PERSONAL
    monkeypatch.setattr(aluno_auth, "verify_cadastro_token", lambda _t: {"personal_id": PERSONAL})
    yield TestClient(app), repo_fake
    app.dependency_overrides.clear()


def test_padrao_valido_e_com_chaves_unicas():
    perguntas = anamnese_padrao.template_padrao()["perguntas"]
    assert len(perguntas) >= 10
    assert len({p["key"] for p in perguntas}) == len(perguntas)
    for p in perguntas:
        PerguntaAnamnese(**p)
        if p["type"] == "SELECT":
            assert p["options"]


def test_sem_template_recebe_padrao_no_portal_e_no_publico(cliente):
    tc, _ = cliente
    portal = tc.get("/v1/anamnese/template").json()
    publico = tc.get("/v1/public/anamnese", params={"token": "x"}).json()["template"]
    assert portal["padrao"] is True
    assert portal["perguntas"] == publico["perguntas"]
    assert any(p["key"] == "lesoes_dores" for p in portal["perguntas"])


def test_template_legado_vazio_recebe_padrao(cliente):
    tc, repo = cliente
    repo.put_item(keys.pk_personal(PERSONAL), keys.SK_ANAMNESE_TEMPLATE,
                  {"perguntas": [], "mensagem_boas_vindas": ""})
    assert tc.get("/v1/anamnese/template").json()["padrao"] is True


def test_template_salvo_vence_o_padrao(cliente):
    tc, _ = cliente
    corpo = {"perguntas": [{"key": "k1", "label": "Minha pergunta", "type": "TEXT", "required": False}],
             "mensagem_boas_vindas": "Oi", "solicitar_email": False,
             "solicitar_nascimento": True, "solicitar_objetivo": True}
    assert tc.put("/v1/anamnese/template", json=corpo).status_code == 200
    lido = tc.get("/v1/anamnese/template").json()
    assert "padrao" not in lido
    assert [p["label"] for p in lido["perguntas"]] == ["Minha pergunta"]


def test_esvaziar_de_proposito_nao_ressuscita_padrao(cliente):
    tc, _ = cliente
    corpo = {"perguntas": [], "mensagem_boas_vindas": "", "solicitar_email": True,
             "solicitar_nascimento": True, "solicitar_objetivo": True}
    tc.put("/v1/anamnese/template", json=corpo)
    assert tc.get("/v1/anamnese/template").json()["perguntas"] == []


def test_endpoint_padrao_para_restaurar(cliente):
    tc, _ = cliente
    r = tc.get("/v1/anamnese/template/padrao").json()
    assert r["perguntas"] == anamnese_padrao.template_padrao()["perguntas"]
