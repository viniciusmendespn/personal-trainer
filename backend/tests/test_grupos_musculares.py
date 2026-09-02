"""Grupo muscular múltiplo: leitura tolerante ao legado e sincronia do campo derivado.

Um exercício atinge mais de um grupo, então a verdade é `grupos: list[str]`. Mas a base tem
milhares de itens gravados com `grupo: "Peito, Tríceps"` — uma string que o gráfico de volume
tratava como um grupo próprio, separado de "Peito". A quebra acontece na LEITURA: nenhum item
já gravado é reescrito, e mesmo assim o histórico inteiro passa a somar nos grupos certos.
"""
import pytest

from app.models.biblioteca import ExLibCreate
from app.models.exercicio import ExercicioCreate
from app.models.grupos_musculares import (
    SEM_GRUPO,
    grupo_legado,
    grupos_do_item,
    normalizar_grupo,
    separar_grupos,
)
from app.models.pacote import ExercicioPacote
from app.models.template import ExercicioTemplate
from app.models.treino_export import ExercicioTreinoFile


# ── Quebra do campo legado ───────────────────────────────────────────────────

@pytest.mark.parametrize("bruto, esperado", [
    ("Peito, Tríceps", ["Peito", "Tríceps"]),
    ("Peito/Tríceps", ["Peito", "Tríceps"]),
    ("Peito + Tríceps", ["Peito", "Tríceps"]),
    ("Peito e Tríceps", ["Peito", "Tríceps"]),
    ("Peito & Tríceps", ["Peito", "Tríceps"]),
    ("Costas; Bíceps", ["Costas", "Bíceps"]),
    ("Peito", ["Peito"]),
    ("  Peito  ", ["Peito"]),
    ("Peito,,Tríceps", ["Peito", "Tríceps"]),
    ("", []),
    (None, []),
])
def test_separar_grupos(bruto, esperado):
    assert separar_grupos(bruto) == esperado


def test_separar_grupos_deduplica_por_caixa_e_acento():
    """"Peito, PEITO, peíto" é um grupo só — a mesma normalização que vira SK do agregado."""
    assert separar_grupos("Peito, PEITO, peito") == ["Peito"]


def test_separar_grupos_nao_pica_nome_com_e_no_meio_da_palavra():
    """O separador " e " precisa de fronteira de palavra: "Posteriores de coxa" é um grupo só."""
    assert separar_grupos("Posteriores de coxa") == ["Posteriores de coxa"]


# ── O acessor ────────────────────────────────────────────────────────────────

def test_grupos_do_item_prefere_a_lista():
    item = {"grupos": ["Peito", "Tríceps"], "grupo": "qualquer coisa velha"}
    assert grupos_do_item(item) == ["Peito", "Tríceps"]


def test_grupos_do_item_cai_no_legado_quebrado():
    assert grupos_do_item({"grupo": "Peito, Tríceps"}) == ["Peito", "Tríceps"]


def test_grupos_do_item_deduplica_a_lista():
    assert grupos_do_item({"grupos": ["Peito", "PEITO", "Tríceps", " "]}) == ["Peito", "Tríceps"]


@pytest.mark.parametrize("item", [None, {}, {"grupo": None}, {"grupos": []}, {"grupos": [""]}])
def test_grupos_do_item_nunca_devolve_vazio(item):
    assert grupos_do_item(item) == [SEM_GRUPO]


def test_normalizar_grupo_e_a_chave_do_agregado():
    assert normalizar_grupo("Tríceps") == "triceps"
    assert normalizar_grupo("  POSTERIORES   DE  COXA ") == "posteriores de coxa"
    assert normalizar_grupo(None) == "sem grupo"


def test_grupo_legado():
    assert grupo_legado(["Peito", "Tríceps"]) == "Peito, Tríceps"
    assert grupo_legado([]) is None
    assert grupo_legado(None) is None


# ── Sincronia do campo derivado nos modelos ──────────────────────────────────
# `grupo` continua existindo porque muita coisa ainda o lê: export .cpkg, markdown da
# biblioteca para a IA, agrupamento do PacotesPage, busca. Com `grupos` preenchido ele passa
# a ser derivado, então nenhum desses leitores precisou mudar.

MODELOS = [
    (ExLibCreate, {"nome": "Supino reto"}),
    (ExercicioCreate, {"nome": "Supino reto"}),
    (ExercicioTemplate, {"nome": "Supino reto"}),
    (ExercicioTreinoFile, {"nome": "Supino reto"}),
    (ExercicioPacote, {"ref": "ex_supino", "nome": "Supino reto"}),
]


@pytest.mark.parametrize("modelo, base", MODELOS)
def test_grupos_preenchido_deriva_o_grupo_legado(modelo, base):
    m = modelo(**base, grupos=["Peito", "Tríceps"])
    assert m.grupos == ["Peito", "Tríceps"]
    assert m.grupo == "Peito, Tríceps"


@pytest.mark.parametrize("modelo, base", MODELOS)
def test_grupos_vence_um_grupo_divergente_recebido_junto(modelo, base):
    m = modelo(**base, grupos=["Costas"], grupo="Peito")
    assert m.grupo == "Costas"


@pytest.mark.parametrize("modelo, base", MODELOS)
def test_item_legado_nao_ganha_grupos_no_write(modelo, base):
    """O inverso NÃO acontece: quem só tem `grupo` continua sem `grupos` gravado. É o que
    garante que nenhum item existente seja reescrito — a quebra é só na leitura."""
    m = modelo(**base, grupo="Peito, Tríceps")
    assert m.grupos is None
    assert m.grupo == "Peito, Tríceps"
    # ...e ainda assim o acessor lê os dois grupos.
    assert grupos_do_item(m.model_dump()) == ["Peito", "Tríceps"]


@pytest.mark.parametrize("modelo, base", MODELOS)
def test_sem_grupo_nenhum_continua_nulo(modelo, base):
    m = modelo(**base)
    assert m.grupos is None and m.grupo is None
