"""Import de JSON de IA pelo portal: a mensagem de erro é o produto aqui.

Quem escreve o JSON é uma LLM, e quem cola o erro de volta nela é o personal. Então o que
estes testes travam não é só "recusou": é que a resposta diga QUAL campo, ONDE, e o que
escrever no lugar — e que traga o `relatorio_ia` colável. Um 400 sem isso era exatamente o
bug relatado (o portal mostrava "Erro ao importar. Tente novamente. ([object Object])").

O outro eixo: recusa não deixa rastro. Se um programa recusado apagasse os treinos atuais, o
personal perderia o programa do aluno por causa de um typo da IA.
"""
import json

import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_current_personal_id
from app.main import app
from app.repositories import keys

PERSONAL = "personal-1"
ALUNO = "aluno-1"
URL = f"/v1/alunos/{ALUNO}/treinos/importar"
URL_VALIDAR = f"/v1/alunos/{ALUNO}/treinos/validar"

BOM = {"version": "1", "treinos": [{"nome": "Treino A", "exercicios": [
    {"nome": "Supino reto", "series_prescritas": [{"series": 3, "reps": "8-12"}]}]}]}


@pytest.fixture
def cliente(repo_fake, monkeypatch):
    repo_fake.put_item(keys.pk_personal(PERSONAL), keys.sk_aluno_pointer(ALUNO),
                       {"aluno_id": ALUNO, "nome": "Marina", "status": "ATIVO"})
    repo_fake.put_item(keys.pk_aluno(ALUNO), keys.sk_treino("t-antigo"),
                       {"treino_id": "t-antigo", "aluno_id": ALUNO, "nome": "Treino Original",
                        "ordem": 0, "ativo": True})
    app.dependency_overrides[get_current_personal_id] = lambda: PERSONAL
    yield TestClient(app), repo_fake
    app.dependency_overrides.clear()


def _treinos_no_banco(repo) -> list:
    return repo.query_pk(keys.pk_aluno(ALUNO), sk_prefix=keys.SK_TREINO_PREFIX)


def _importar(cliente, conteudo):
    tc, _ = cliente
    return tc.post(URL, json={"conteudo": conteudo})


# ── formas de lixo que a IA devolve ──────────────────────────────────────────

def test_json_malformado_diz_onde_quebrou(cliente):
    r = _importar(cliente, '{"version": "1", "treinos": [}')
    assert r.status_code == 400
    d = r.json()["detail"]
    assert d["code"] == "ARQUIVO_INVALIDO"
    assert d["problemas"][0]["codigo"] == "JSON_MALFORMADO"
    # A dica que resolve o caso mais comum: o personal colou a cerca do markdown junto.
    assert "```json" in d["problemas"][0]["correcao"]


def test_bloco_de_markdown_colado_inteiro_nao_vira_erro_generico(cliente):
    """O texto que a IA imprime na tela vem com cerca. Aqui ainda é 400 (a limpeza é no
    cliente), mas com mensagem que diz o que fazer."""
    r = _importar(cliente, '```json\n{"version": "1", "treinos": []}\n```')
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "ARQUIVO_INVALIDO"


def test_tipo_errado_aponta_o_caminho_do_campo_e_o_valor_recebido(cliente):
    ruim = {"version": "1", "treinos": [{"nome": "Treino A", "exercicios": [
        {"nome": "Supino", "series_prescritas": [{"series": "três", "reps": "8-12"}]}]}]}
    r = _importar(cliente, json.dumps(ruim))
    assert r.status_code == 400
    d = r.json()["detail"]
    assert d["code"] == "ESTRUTURA_INVALIDA"
    p = d["problemas"][0]
    assert p["campo"] == "treinos[0].exercicios[0].series_prescritas[0].series"
    assert "três" in p["mensagem"]          # o valor recebido, para a IA se localizar
    assert p["onde"] == "treino 1 › exercício 1 › série 1"


def test_programa_vazio_nao_apaga_o_treino_do_aluno(cliente):
    """Sem este guard, `{"treinos": []}` respondia 201 e deixava o aluno sem treino nenhum."""
    r = _importar(cliente, '{"version": "1", "treinos": []}')
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "PROGRAMA_VAZIO"
    _, repo = cliente
    assert len(_treinos_no_banco(repo)) == 1


# ── erro semântico: o que o Pydantic deixa passar ────────────────────────────

def test_bloco_id_orfao_bloqueia_e_nao_grava_nada(cliente):
    """Antes: importava, o vínculo era descartado em silêncio e o exercício saía do bloco."""
    com_erro = {"version": "1", "treinos": [{"nome": "Treino C", "blocos": [], "exercicios": [
        {"nome": "Wall Ball", "bloco_id": "c",
         "series_prescritas": [{"series": 1, "reps": "12"}]}]}]}
    r = _importar(cliente, json.dumps(com_erro))
    assert r.status_code == 400
    d = r.json()["detail"]
    assert d["code"] == "PRESCRICAO_INVALIDA"
    p = d["problemas"][0]
    assert p["codigo"] == "BLOCO_ID_ORFAO"
    assert p["campo"] == "treinos[0].exercicios[0].bloco_id"
    assert p["correcao"]

    _, repo = cliente
    treinos = _treinos_no_banco(repo)
    assert len(treinos) == 1 and treinos[0]["nome"] == "Treino Original"


def test_relatorio_ia_traz_o_achado_e_manda_devolver_o_programa_completo(cliente):
    """É o texto que o personal cola de volta na IA — o pedido que originou a mudança."""
    com_erro = {"version": "1", "treinos": [{"nome": "Treino C", "exercicios": [
        {"nome": "Bike Erg", "tipo_exercicio": "PERFORMANCE",
         "series_prescritas": [{"series": 1, "reps": "20"}]}]}]}
    r = _importar(cliente, json.dumps(com_erro))
    assert r.status_code == 400
    relatorio = r.json()["detail"]["relatorio_ia"]
    assert "PERF_SEM_UNIDADE" in relatorio
    assert "unidade_reps" in relatorio
    assert "COMPLETO" in relatorio          # senão a IA devolve só o trecho corrigido


def test_total_e_o_real_mesmo_com_muitos_problemas(cliente):
    """A tela precisa poder dizer "e mais N": cortar a lista sem dizer o total fazia 30
    problemas parecerem 20."""
    exs = [{"nome": f"Ex {i}", "bloco_id": "x",
            "series_prescritas": [{"series": 1, "reps": "10"}]} for i in range(25)]
    r = _importar(cliente, json.dumps(
        {"version": "1", "treinos": [{"nome": "T", "exercicios": exs}]}))
    d = r.json()["detail"]
    assert d["total"] == 25
    assert len(d["problemas"]) == 20        # LIMITE_ACHADOS


# ── aviso não bloqueia ───────────────────────────────────────────────────────

def test_campo_inventado_pela_ia_importa_e_avisa(cliente):
    """`recomendacoes` não existe no formato e o Pydantic descarta calado. Importa, mas o
    personal fica sabendo que aquele texto foi perdido."""
    com_aviso = {"version": "1", "treinos": [{"nome": "Treino A", "exercicios": [
        {"nome": "Supino reto", "recomendacoes": "desça devagar",
         "series_prescritas": [{"series": 3, "reps": "8-12"}]}]}]}
    r = _importar(cliente, json.dumps(com_aviso))
    assert r.status_code == 201
    body = r.json()
    assert body["treinos_importados"] == 1
    codigos = [a["codigo"] for a in body["avisos"]]
    assert "CAMPO_DESCONHECIDO" in codigos
    assert "observacoes" in body["relatorio_ia"]


def test_programa_limpo_importa_sem_avisos(cliente):
    r = _importar(cliente, json.dumps(BOM))
    assert r.status_code == 201
    body = r.json()
    assert body == {"treinos_importados": 1, "exercicios_importados": 1,
                    "avisos": [], "relatorio_ia": None}


def test_export_colado_de_volta_sem_editar_continua_valendo(cliente):
    """O arquivo baixado traz `contexto_aluno`; colar ele inteiro é o caminho preguiçoso e
    tem de funcionar — vira aviso, não erro."""
    com_contexto = dict(BOM, contexto_aluno={"nome": "Marina"})
    r = _importar(cliente, json.dumps(com_contexto))
    assert r.status_code == 201
    assert "RAIZ_COM_CONTEXTO" in [a["codigo"] for a in r.json()["avisos"]]


# ── conferir sem importar ────────────────────────────────────────────────────

def test_validar_nao_grava_nada(cliente):
    tc, repo = cliente
    r = tc.post(URL_VALIDAR, json={"conteudo": json.dumps(BOM)})
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert r.json()["contagem"] == {"treinos": 1, "exercicios": 1, "avisos": 0}
    treinos = _treinos_no_banco(repo)
    assert len(treinos) == 1 and treinos[0]["nome"] == "Treino Original"


def test_validar_recusa_com_o_mesmo_corpo_do_import(cliente):
    """A tela renderiza um só formato de problema, venha de qual endpoint vier."""
    tc, _ = cliente
    r = tc.post(URL_VALIDAR, json={"conteudo": '{"version": "1", "treinos": []}'})
    assert r.status_code == 400
    d = r.json()["detail"]
    assert d["code"] == "PROGRAMA_VAZIO"
    assert d["relatorio_ia"]
