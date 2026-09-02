"""Validação do pacote (.cpkg) gerado por IA — o formato ref-based falha em silêncio.

O eixo destes testes é a falha silenciosa: antes, um `ex_ref` que não existia em `exercicios[]`
não dava erro nenhum — instalava um exercício cujo NOME era a própria ref ("ex_supino_reto"),
sem grupo e sem vídeo, e o personal descobria pelo aluno. Um `tmpl_ref` órfão simplesmente
sumia da rotina.

O outro eixo, como em `test_prescricao_validacao.py`: nenhuma regra pode reprovar pacote
legítimo — inclusive o exemplo do próprio guia servido ao personal.
"""
import json
import re
from pathlib import Path

import pytest

from app.models.pacote import PacoteFile
from app.services import validacao_pacote as vpk

PACOTE_ID = "3f2b9c14-8d5e-4a71-9f02-6c1d84be5a37"


def _pacote(**mudancas) -> PacoteFile:
    base = {
        "version": "1",
        "pacote": {"id": PACOTE_ID, "nome": "Hipertrofia ABC", "descricao": "3x/semana"},
        "exercicios": [
            {"ref": "ex_supino", "nome": "Supino reto", "grupo": "Peito",
             "tipo_exercicio": "FORCA"},
            {"ref": "ex_remada", "nome": "Remada baixa", "grupo": "Costas",
             "tipo_exercicio": "FORCA"},
        ],
        "templates": [
            {"ref": "tmpl_a", "nome": "Treino A", "exercicios": [
                {"ex_ref": "ex_supino", "ordem": 0,
                 "series_prescritas": [{"series": 3, "reps": "8-12"}]},
                {"ex_ref": "ex_remada", "ordem": 1,
                 "series_prescritas": [{"series": 3, "reps": "10"}]},
            ]},
        ],
        "rotinas": [{"ref": "rot_abc", "nome": "Rotina ABC", "treinos": ["tmpl_a"]}],
    }
    base.update(mudancas)
    return PacoteFile(**base)


def _codigos(achados) -> list[str]:
    return [a.codigo for a in achados]


# ── o caminho felizsem achado nenhum ─────────────────────────────────────────

def test_pacote_legitimo_passa_limpo():
    erros, avisos = vpk.validar(_pacote())
    assert erros == []
    assert avisos == []


def test_exemplos_do_prompt_do_pacote_passam_na_validacao():
    """O guia servido ao personal (`frontend/public/prompt-cpkg.md`) é a especificação viva.
    Se o exemplo de lá não passa, ou o guia está errado ou a regra está — nunca a IA."""
    md = Path(__file__).resolve().parents[2] / "frontend" / "public" / "prompt-cpkg.md"
    blocos = re.findall(r"```json\s*\n(.*?)```", md.read_text(encoding="utf-8"), re.S)
    completos = []
    for bloco in blocos:
        try:
            data = json.loads(bloco)
        except json.JSONDecodeError:
            continue                      # trechos parciais do guia (só um campo, com "…")
        if isinstance(data, dict) and "pacote" in data and data.get("templates"):
            completos.append(data)

    assert completos, "nenhum exemplo completo de pacote encontrado no prompt-cpkg.md"
    for data in completos:
        erros, _ = vpk.validar(PacoteFile(**data))
        assert erros == [], f"exemplo do guia reprovado: {_codigos(erros)}"


# ── falhas silenciosas, agora bloqueantes ────────────────────────────────────

def test_ex_ref_orfao_e_erro_e_diz_as_refs_disponiveis():
    p = _pacote(templates=[{"ref": "tmpl_a", "nome": "Treino A", "exercicios": [
        {"ex_ref": "ex_supino_reto", "ordem": 0,
         "series_prescritas": [{"series": 3, "reps": "8-12"}]}]}])
    erros, _ = vpk.validar(p)
    achado = next(a for a in erros if a.codigo == "EX_REF_ORFAO")
    assert achado.campo == "templates[0].exercicios[0].ex_ref"
    assert '"ex_supino"' in achado.mensagem          # a ref certa está na mensagem
    assert "nome do exercício" in achado.mensagem    # a consequência real


def test_tmpl_ref_orfao_e_erro():
    p = _pacote(rotinas=[{"ref": "rot_abc", "nome": "Rotina ABC",
                          "treinos": ["tmpl_a", "tmpl_b"]}])
    erros, _ = vpk.validar(p)
    achado = next(a for a in erros if a.codigo == "TMPL_REF_ORFAO")
    assert achado.campo == "rotinas[0].treinos[1]"
    assert '"tmpl_a"' in achado.mensagem


def test_ref_duplicada_e_erro_em_cada_colecao():
    p = _pacote(exercicios=[
        {"ref": "ex_supino", "nome": "Supino reto", "tipo_exercicio": "FORCA"},
        {"ref": "ex_supino", "nome": "Supino inclinado", "tipo_exercicio": "FORCA"},
    ])
    erros, _ = vpk.validar(p)
    achado = next(a for a in erros if a.codigo == "REF_DUPLICADA")
    assert "ex_supino" in achado.onde


def test_bloco_id_orfao_no_template_e_erro():
    p = _pacote(templates=[{"ref": "tmpl_a", "nome": "Treino A", "blocos": [], "exercicios": [
        {"ex_ref": "ex_supino", "ordem": 0, "bloco_id": "c",
         "series_prescritas": [{"series": 3, "reps": "8-12"}]}]}])
    erros, _ = vpk.validar(p)
    achado = next(a for a in erros if a.codigo == "BLOCO_ID_ORFAO")
    assert achado.campo == "templates[0].exercicios[0].bloco_id"


def test_exercicio_sem_serie_e_erro():
    p = _pacote(templates=[{"ref": "tmpl_a", "nome": "Treino A", "exercicios": [
        {"ex_ref": "ex_supino", "ordem": 0}]}])
    erros, _ = vpk.validar(p)
    assert "SEM_SERIES_PRESCRITAS" in _codigos(erros)


def test_pacote_sem_nada_para_instalar_e_erro():
    erros, _ = vpk.validar(_pacote(exercicios=[], templates=[], rotinas=[]))
    assert "PACOTE_VAZIO" in _codigos(erros)


# ── regras reusadas de validacao_programa ────────────────────────────────────

def test_performance_sem_unidade_aponta_o_catalogo_nao_o_template():
    """`unidade_reps` mora em `exercicios[]`; apontar o template mandaria a IA editar o
    lugar errado."""
    p = _pacote(exercicios=[
        {"ref": "ex_supino", "nome": "Supino reto", "tipo_exercicio": "FORCA"},
        {"ref": "ex_bike", "nome": "Bike Erg", "tipo_exercicio": "PERFORMANCE"},
    ], templates=[{"ref": "tmpl_a", "nome": "Treino A", "exercicios": [
        {"ex_ref": "ex_bike", "ordem": 0,
         "series_prescritas": [{"series": 1, "reps": "20"}]}]}],
        rotinas=[])
    erros, _ = vpk.validar(p)
    achado = next(a for a in erros if a.codigo == "PERF_SEM_UNIDADE")
    assert achado.campo == "exercicios[1].unidade_reps"


def test_unidade_grudada_no_reps_e_erro():
    p = _pacote(exercicios=[
        {"ref": "ex_bike", "nome": "Bike Erg", "tipo_exercicio": "PERFORMANCE",
         "unidade_reps": "cal"},
    ], templates=[{"ref": "tmpl_a", "nome": "Treino A", "exercicios": [
        {"ex_ref": "ex_bike", "ordem": 0,
         "series_prescritas": [{"series": 1, "reps": "30s", "observacoes": "registre as cal"}]}]}],
        rotinas=[])
    erros, _ = vpk.validar(p)
    achado = next(a for a in erros if a.codigo == "UNIDADE_DENTRO_DE_REPS")
    assert achado.campo == "templates[0].exercicios[0].series_prescritas[0].reps"


@pytest.mark.parametrize("reps", ["8-12", "10", "até a falha", "AMRAP", "10 cada lado", "máx"])
def test_reps_legitimo_nao_e_confundido_com_unidade(reps):
    p = _pacote(templates=[{"ref": "tmpl_a", "nome": "Treino A", "exercicios": [
        {"ex_ref": "ex_supino", "ordem": 0,
         "series_prescritas": [{"series": 3, "reps": reps}]}]}], rotinas=[])
    erros, _ = vpk.validar(p)
    assert erros == []


# ── pacote.id: aviso, não erro ───────────────────────────────────────────────

def test_id_nao_uuid_avisa_mas_deixa_importar():
    """Pacote antigo com id fora do padrão continua reimportável (regra nova nasce aviso)."""
    erros, avisos = vpk.validar(_pacote(
        pacote={"id": "pacote-hipertrofia", "nome": "Hipertrofia ABC"}))
    assert erros == []
    assert "PACOTE_ID_NAO_UUID" in _codigos(avisos)


def test_id_vazio_e_erro():
    erros, _ = vpk.validar(_pacote(pacote={"id": "  ", "nome": "Hipertrofia ABC"}))
    assert "PACOTE_SEM_ID" in _codigos(erros)


# ── contrato editorial, igual ao do programa ─────────────────────────────────

def test_achados_sempre_dizem_como_corrigir():
    """Mesma regra de `test_prescricao_validacao.py`: achado sem correção é achado inútil,
    porque quem lê é uma LLM que precisa consertar sozinha."""
    casos = [
        _pacote(templates=[{"ref": "tmpl_a", "nome": "Treino A", "exercicios": [
            {"ex_ref": "nao_existe", "ordem": 0}]}]),
        _pacote(rotinas=[{"ref": "rot_x", "nome": "R", "treinos": ["nao_existe"]}]),
        _pacote(pacote={"id": "", "nome": ""}),
        _pacote(templates=[{"ref": "tmpl_a", "nome": "", "exercicios": []}]),
    ]
    for pacote in casos:
        erros, avisos = vpk.validar(pacote)
        for achado in erros + avisos:
            assert achado.correcao, f"{achado.codigo} sem correção"
            assert achado.campo, f"{achado.codigo} sem campo"
            assert achado.onde, f"{achado.codigo} sem onde"


# ── grupo muscular múltiplo ──────────────────────────────────────────────────

def test_grupos_no_pacote_nao_geram_achado():
    """`grupos` (lista) é o campo novo; `grupo` (string) segue aceito nos pacotes antigos."""
    pacote = _pacote(exercicios=[
        {"ref": "ex_supino", "nome": "Supino reto", "grupos": ["Peito", "Tríceps"],
         "tipo_exercicio": "FORCA"},
        {"ref": "ex_remada", "nome": "Remada baixa", "grupo": "Costas, Bíceps",
         "tipo_exercicio": "FORCA"},
    ])
    erros, avisos = vpk.validar(pacote)
    assert erros == [] and avisos == []
    # O campo legado sai derivado, para os leitores que ainda esperam texto.
    assert pacote.exercicios[0].grupo == "Peito, Tríceps"
    assert pacote.exercicios[1].grupos is None   # nada é reescrito no item antigo
