"""Checagens semânticas do programa de treino.

Dois eixos, e o segundo importa tanto quanto o primeiro: cada regra pega o que deveria pegar,
e **nenhuma delas reprova prescrição legítima**. Um falso positivo aqui bloqueia o personal de
gravar um treino correto, o que é pior que o problema que a validação resolve.
"""
import json
import re
from pathlib import Path

import pytest

from app.mcp import validacao_programa as v
from app.models.treino_export import ProgramaTreinoFile
from app.services.sessao_service import chave_exercicio

PROMPT_MCP = Path(__file__).resolve().parents[1] / "app" / "mcp" / "prompts" / "montar_treino.md"


def _programa(*treinos) -> ProgramaTreinoFile:
    return ProgramaTreinoFile(version="1", treinos=list(treinos))


def _treino(nome="Treino A", exercicios=(), blocos=()) -> dict:
    return {"nome": nome, "exercicios": list(exercicios), "blocos": list(blocos)}


def _forca(nome="Supino reto", **kw) -> dict:
    base = {"nome": nome, "tipo_exercicio": "FORCA",
            "series_prescritas": [{"series": 3, "reps": "8-12", "carga": None}]}
    base.update(kw)
    return base


def _performance(nome="Bike Erg", **kw) -> dict:
    base = {"nome": nome, "tipo_exercicio": "PERFORMANCE", "unidade_reps": "cal",
            "metrica_direcao": "MAIOR",
            "observacoes": "Registre as calorias acumuladas no monitor.",
            "series_prescritas": [{"series": 1, "reps": "30", "carga": None}]}
    base.update(kw)
    return base


def _codigos(achados) -> set[str]:
    return {a.codigo for a in achados}


def _validar(programa_dict, ctx=None):
    return v.validar(ProgramaTreinoFile(**programa_dict), ctx, bruto=programa_dict)


# ── o caminho feliz não pode gerar nada ──────────────────────────────────────

def test_programa_de_musculacao_correto_nao_gera_nada():
    erros, avisos = _validar({"version": "1", "treinos": [_treino(exercicios=[_forca()])]})
    assert erros == [] and avisos == []


def test_forca_com_metrica_direcao_maior_nao_gera_nada():
    """`metrica_direcao` nasce "MAIOR" por default no modelo, então TODO exercício de força já
    gravado volta com esse valor. Tratar isso como problema reprovaria qualquer re-import."""
    ex = _forca()
    assert ProgramaTreinoFile(**{"treinos": [_treino(exercicios=[ex])]}
                              ).treinos[0].exercicios[0].metrica_direcao == "MAIOR"
    erros, avisos = _validar({"treinos": [_treino(exercicios=[ex])]})
    assert erros == [] and avisos == []


@pytest.mark.parametrize("reps", ["8-12", "10", "até a falha", "AMRAP", "10 cada lado",
                                  "máx", "6-8", "12"])
def test_reps_de_texto_livre_nao_dispara_unidade(reps):
    """A regra de unidade grudada em `reps` é a de maior risco de falso positivo."""
    ex = _forca(series_prescritas=[{"series": 3, "reps": reps, "carga": None}])
    erros, _ = _validar({"treinos": [_treino(exercicios=[ex])]})
    assert "UNIDADE_DENTRO_DE_REPS" not in _codigos(erros)


def test_reps_com_a_propria_unidade_do_exercicio_nao_dispara():
    ex = _performance(unidade_reps="s",
                      series_prescritas=[{"series": 1, "reps": "30s", "carga": None}])
    erros, _ = _validar({"treinos": [_treino(exercicios=[ex])]})
    assert "UNIDADE_DENTRO_DE_REPS" not in _codigos(erros)


# ── erros que bloqueiam ──────────────────────────────────────────────────────

def test_bloco_id_orfao_e_erro():
    ex = _forca(bloco_id="c")
    blocos = [{"id": "a", "nome": "A) Força", "ordem": 0, "formato": "LIVRE"}]
    erros, _ = _validar({"treinos": [_treino(exercicios=[ex], blocos=blocos)]})
    assert "BLOCO_ID_ORFAO" in _codigos(erros)
    achado = next(e for e in erros if e.codigo == "BLOCO_ID_ORFAO")
    assert achado.campo == "treinos[0].exercicios[0].bloco_id"
    assert '"a"' in achado.mensagem          # diz quais ids existem


def test_bloco_id_sem_nenhum_bloco_declarado_e_erro():
    erros, _ = _validar({"treinos": [_treino(exercicios=[_forca(bloco_id="c")])]})
    assert "BLOCO_ID_ORFAO" in _codigos(erros)


def test_amrap_sem_duracao_e_erro():
    blocos = [{"id": "c", "nome": "C) Metcon", "ordem": 0, "formato": "AMRAP"}]
    ex = _performance(bloco_id="c")
    erros, _ = _validar({"treinos": [_treino(exercicios=[ex], blocos=blocos)]})
    assert "BLOCO_SEM_DURACAO" in _codigos(erros)


def test_emom_sem_intervalo_e_erro():
    blocos = [{"id": "e", "nome": "EMOM", "ordem": 0, "formato": "EMOM",
               "params": {"duracao_s": 600}}]
    erros, _ = _validar({"treinos": [_treino(exercicios=[_performance(bloco_id="e")],
                                             blocos=blocos)]})
    assert "BLOCO_EMOM_SEM_INTERVALO" in _codigos(erros)


def test_performance_sem_unidade_e_erro_com_a_correcao():
    ex = _performance(unidade_reps=None)
    erros, _ = _validar({"treinos": [_treino(exercicios=[ex])]})
    achado = next(e for e in erros if e.codigo == "PERF_SEM_UNIDADE")
    assert achado.campo == "treinos[0].exercicios[0].unidade_reps"
    assert "cal" in achado.correcao          # dá exemplos de unidade


def test_performance_com_unidade_longa_e_erro():
    erros, _ = _validar({"treinos": [_treino(exercicios=[_performance(unidade_reps="calorias")])]})
    assert "PERF_UNIDADE_LONGA" in _codigos(erros)


def test_performance_com_direcao_invalida_e_erro():
    erros, _ = _validar({"treinos": [_treino(exercicios=[_performance(metrica_direcao="ACIMA")])]})
    assert "PERF_DIRECAO_INVALIDA" in _codigos(erros)


def test_unidade_dentro_de_reps_e_erro():
    ex = _performance(unidade_reps="cal",
                      series_prescritas=[{"series": 1, "reps": "30s", "carga": None}])
    erros, _ = _validar({"treinos": [_treino(exercicios=[ex])]})
    achado = next(e for e in erros if e.codigo == "UNIDADE_DENTRO_DE_REPS")
    assert "30s cal" in achado.mensagem      # mostra o que o app renderizaria


def test_exercicio_sem_series_e_erro():
    erros, _ = _validar({"treinos": [_treino(exercicios=[_forca(series_prescritas=[])])]})
    assert "SEM_SERIES_PRESCRITAS" in _codigos(erros)


def test_series_zero_e_erro():
    ex = _forca(series_prescritas=[{"series": 0, "reps": "10", "carga": None}])
    erros, _ = _validar({"treinos": [_treino(exercicios=[ex])]})
    assert "SERIES_INVALIDA" in _codigos(erros)


def test_bloco_com_id_duplicado_e_erro():
    blocos = [{"id": "a", "nome": "A", "ordem": 0, "formato": "LIVRE"},
              {"id": "a", "nome": "B", "ordem": 1, "formato": "LIVRE"}]
    erros, _ = _validar({"treinos": [_treino(exercicios=[_forca(bloco_id="a")], blocos=blocos)]})
    assert "BLOCO_ID_DUPLICADO" in _codigos(erros)


def test_formato_de_bloco_inexistente_e_erro():
    blocos = [{"id": "a", "nome": "A", "ordem": 0, "formato": "TABATA"}]
    erros, _ = _validar({"treinos": [_treino(exercicios=[_forca(bloco_id="a")], blocos=blocos)]})
    assert "BLOCO_FORMATO_INVALIDO" in _codigos(erros)


def test_treino_sem_nome_e_erro():
    erros, _ = _validar({"treinos": [_treino(nome="", exercicios=[_forca()])]})
    assert "TREINO_SEM_NOME" in _codigos(erros)


# ── avisos: informam, nunca bloqueiam ────────────────────────────────────────

def test_forca_com_direcao_menor_e_so_aviso():
    erros, avisos = _validar({"treinos": [_treino(exercicios=[_forca(metrica_direcao="MENOR")])]})
    assert erros == []
    assert "FORCA_COM_DIRECAO_MENOR" in _codigos(avisos)


def test_forca_com_unidade_reps_e_so_aviso():
    erros, avisos = _validar({"treinos": [_treino(exercicios=[_forca(unidade_reps="kg")])]})
    assert erros == []
    assert "FORCA_COM_UNIDADE_REPS" in _codigos(avisos)


def test_performance_sem_dizer_o_que_registrar_e_aviso():
    _, avisos = _validar({"treinos": [_treino(exercicios=[_performance(observacoes=None)])]})
    assert "PERF_SEM_O_QUE_REGISTRAR" in _codigos(avisos)


def test_performance_em_bloco_cronometrado_nao_exige_o_que_registrar():
    """Dentro de AMRAP/EMOM/FOR_TIME quem pontua é o bloco, não o exercício — cobrar ali
    contrariaria o próprio guia."""
    blocos = [{"id": "c", "nome": "C) Metcon", "ordem": 0, "formato": "AMRAP",
               "params": {"duracao_s": 900}}]
    ex = _performance(bloco_id="c", observacoes="12 por round")
    erros, avisos = _validar({"treinos": [_treino(exercicios=[ex], blocos=blocos)]})
    assert erros == []
    assert "PERF_SEM_O_QUE_REGISTRAR" not in _codigos(avisos)


def test_bloco_de_descanso_pode_ficar_sem_exercicios():
    blocos = [{"id": "a", "nome": "A", "ordem": 0, "formato": "LIVRE"},
              {"id": "d", "nome": "Descanso", "ordem": 1, "formato": "LIVRE",
               "descanso": True, "params": {"duracao_s": 120}}]
    erros, avisos = _validar({"treinos": [_treino(exercicios=[_forca(bloco_id="a")],
                                                  blocos=blocos)]})
    assert erros == []
    assert "BLOCO_SEM_EXERCICIOS" not in _codigos(avisos)


def test_bloco_normal_sem_exercicios_gera_aviso():
    blocos = [{"id": "a", "nome": "A", "ordem": 0, "formato": "LIVRE"},
              {"id": "b", "nome": "B", "ordem": 1, "formato": "LIVRE"}]
    _, avisos = _validar({"treinos": [_treino(exercicios=[_forca(bloco_id="a")], blocos=blocos)]})
    assert "BLOCO_SEM_EXERCICIOS" in _codigos(avisos)


def test_campo_inexistente_avisa_para_onde_mover():
    """O guia mandava escrever em `recomendacoes`/`descricao`, que o Pydantic descarta calado."""
    _, avisos = _validar({"treinos": [_treino(exercicios=[_forca(recomendacoes="controle a descida")])]})
    achado = next(a for a in avisos if a.codigo == "CAMPO_DESCONHECIDO")
    assert "observacoes" in achado.correcao


def test_raiz_com_contexto_e_so_aviso():
    """O export devolve `contexto_aluno` junto; colar de volta é tolerado de propósito."""
    prog = {"version": "1", "treinos": [_treino(exercicios=[_forca()])], "contexto_aluno": {}}
    erros, avisos = _validar(prog)
    assert erros == []
    assert "RAIZ_COM_CONTEXTO" in _codigos(avisos)


# ── biblioteca: a regra de ouro do vídeo ─────────────────────────────────────

def _ctx_lib():
    return v.Contexto(biblioteca={
        chave_exercicio("Agachamento livre"): {
            "nome": "Agachamento livre", "grupo": "Pernas",
            "video_url": "https://youtu.be/DA-BIBLIOTECA"},
    })


def test_nome_com_grafia_diferente_avisa_com_o_nome_exato():
    ex = _forca(nome="AGACHAMENTO LIVRE")
    _, avisos = _validar({"treinos": [_treino(exercicios=[ex])]}, _ctx_lib())
    achado = next(a for a in avisos if a.codigo == "NOME_DIVERGE_BIBLIOTECA")
    assert "Agachamento livre" in achado.correcao


def test_video_diferente_do_cadastrado_avisa_que_sera_descartado():
    ex = _forca(nome="Agachamento livre", video_url="https://youtu.be/OUTRO")
    _, avisos = _validar({"treinos": [_treino(exercicios=[ex])]}, _ctx_lib())
    achado = next(a for a in avisos if a.codigo == "VIDEO_DIVERGE_BIBLIOTECA")
    assert "DA-BIBLIOTECA" in achado.correcao


def test_video_igual_ao_cadastrado_nao_avisa():
    ex = _forca(nome="Agachamento livre", video_url="https://youtu.be/DA-BIBLIOTECA")
    _, avisos = _validar({"treinos": [_treino(exercicios=[ex])]}, _ctx_lib())
    assert avisos == []


def test_nome_parecido_avisa_para_reaproveitar_o_da_biblioteca():
    """Nome quase igual entra como exercício novo e o vídeo cadastrado fica para trás."""
    ex = _forca(nome="Agachamento livre com barra")
    _, avisos = _validar({"treinos": [_treino(exercicios=[ex])]}, _ctx_lib())
    achado = next(a for a in avisos if a.codigo == "NOME_PARECIDO_BIBLIOTECA")
    assert "Agachamento livre" in achado.correcao


def test_exercicio_realmente_novo_nao_gera_aviso_de_parecido():
    _, avisos = _validar({"treinos": [_treino(exercicios=[_forca(nome="Rosca direta")])]},
                         _ctx_lib())
    assert "NOME_PARECIDO_BIBLIOTECA" not in _codigos(avisos)


def _ctx(*nomes):
    return v.Contexto(biblioteca={chave_exercicio(n): {"nome": n, "video_url": None}
                                  for n in nomes})


@pytest.mark.parametrize("cadastrado,proposto", [
    ("Agachamento livre", "Agachamento"),
    ("Supino reto", "Supino reto com barra"),
    ("Remada curvada", "Remada curvada barra"),
    ("Desenvolvimento", "Desenvolvimento militar"),
])
def test_variacao_do_mesmo_exercicio_avisa(cadastrado, proposto):
    _, avisos = _validar({"treinos": [_treino(exercicios=[_forca(nome=proposto)])]},
                         _ctx(cadastrado))
    assert "NOME_PARECIDO_BIBLIOTECA" in _codigos(avisos), \
        f"{proposto!r} deveria apontar para {cadastrado!r}"


@pytest.mark.parametrize("cadastrado,proposto", [
    # Medidos por similaridade de string, vários destes pontuam igual aos de cima — é por isso
    # que a regra compara palavras em vez de caracteres.
    ("Remada baixa", "Remada alta"),
    ("Supino reto", "Supino inclinado"),
    ("Agachamento livre", "Agachamento frontal"),
    ("Elevacao lateral", "Elevacao frontal"),
    ("Rosca direta", "Rosca martelo"),
    ("Terra romeno", "Terra sumo"),
])
def test_exercicio_diferente_nao_avisa(cadastrado, proposto):
    _, avisos = _validar({"treinos": [_treino(exercicios=[_forca(nome=proposto)])]},
                         _ctx(cadastrado))
    assert "NOME_PARECIDO_BIBLIOTECA" not in _codigos(avisos), \
        f"{proposto!r} não é {cadastrado!r}"


# ── o doc e o código não podem divergir ──────────────────────────────────────

def test_exemplos_do_guia_passam_na_validacao():
    """Se o guia ensina um JSON que o validador reprova, um dos dois está errado. É este
    teste que substitui 'lembrar de manter os dois em sincronia'."""
    texto = PROMPT_MCP.read_text(encoding="utf-8")
    blocos = re.findall(r"```json\n(.*?)\n```", texto, re.S)
    assert blocos, "o guia perdeu os exemplos JSON"

    validados = 0
    for bruto in blocos:
        if "..." in bruto:                      # esqueleto ilustrativo, não é exemplo completo
            continue
        try:
            dados = json.loads(bruto)
        except json.JSONDecodeError:
            continue
        if "treinos" in dados:
            programa = dados
        elif "exercicios" in dados:             # snippet de um treino solto
            programa = {"version": "1", "treinos": [dados]}
        else:
            continue                            # snippet de exercício ou de bloco
        erros, _ = _validar(programa)
        assert erros == [], (
            f"o exemplo do guia reprova em {[(e.codigo, e.campo) for e in erros]}")
        validados += 1
    assert validados >= 2, f"esperava validar os exemplos completos do guia, validei {validados}"


def test_achados_sempre_dizem_como_corrigir():
    """Regra editorial: se o LLM precisa reler o guia para entender o achado, a mensagem
    está incompleta."""
    prog = {"treinos": [_treino(exercicios=[
        _performance(unidade_reps=None, metrica_direcao=None),
        _forca(bloco_id="fantasma", series_prescritas=[]),
    ])]}
    erros, avisos = _validar(prog)
    assert erros
    for achado in erros + avisos:
        assert achado.correcao.strip(), f"{achado.codigo} não diz o que fazer"
        assert achado.campo.startswith("treinos[")
        assert achado.onde
