"""Regressão do par export-rico / import-enxuto do programa de treino + helpers puros
do contexto (sem DynamoDB)."""
from app.models.treino_export import ProgramaTreinoExportFile, ProgramaTreinoFile
from app.services.contexto_aluno_service import (
    _compactar_sessao,
    _evolucao_do_programa,
    _fmt_serie,
)

CONTEXTO_MINIMO = {
    "gerado_em": "2026-07-04",
    "perfil": {"nome": "Fulano", "objetivos": ["Hipertrofia"]},
    "ultimas_sessoes": [],
}


def test_import_ignora_contexto_aluno():
    """Colar o arquivo exportado de volta (com contexto_aluno) não pode quebrar o import."""
    programa = ProgramaTreinoFile(**{
        "version": "1",
        "treinos": [{"nome": "Treino A", "exercicios": []}],
        "contexto_aluno": CONTEXTO_MINIMO,
    })
    assert programa.treinos[0].nome == "Treino A"
    assert "contexto_aluno" not in programa.model_dump()


def test_export_serializa_contexto_aluno():
    exportado = ProgramaTreinoExportFile(
        treinos=[], contexto_aluno=CONTEXTO_MINIMO,
    ).model_dump()
    assert exportado["contexto_aluno"]["perfil"]["nome"] == "Fulano"
    assert exportado["version"] == "1"


def test_fmt_serie():
    assert _fmt_serie({"carga": 20, "reps": 10}, "kg", None) == "20kg x 10"
    assert _fmt_serie({"carga": "20kg", "reps": 8, "rpe": 8}, "kg", None) == "20kg x 8 @RPE8"
    assert _fmt_serie({"carga": None, "reps": 30}, None, "min") == "30min"
    assert _fmt_serie({"reps": 12}, None, None) == "12 reps"


def test_compactar_sessao():
    sessao = {
        "treino_nome": "Treino A",
        "status": "FINALIZADA",
        "data_hora_inicio": "2026-07-01T10:00:00+00:00",
        "data_hora_fim": "2026-07-01T11:02:00+00:00",
        "duracao_segundos": 3720,
        "volume_total": 1234.5,
        "total_series": 12,
        "novos_prs": [{"exercicio_nome": "Supino reto", "carga": 80, "unidade": "kg"}],
        "exercicios_exec": [
            {
                "exercicio_nome": "Supino reto",
                "unidade_carga": "kg",
                "series_exec": [{"carga": 20, "reps": 10}, {"carga": 22, "reps": 8}],
            },
        ],
    }
    c = _compactar_sessao(sessao)
    assert c.data == "2026-07-01"
    assert c.treino == "Treino A"
    assert c.duracao_min == 62
    assert c.novos_recordes == ["Supino reto: 80kg"]
    assert c.exercicios[0].series_realizadas == "20kg x 10 | 22kg x 8"


def _sessao_com_carga(data: str, nome: str, carga: float) -> dict:
    return {
        "data_hora_fim": data,
        "exercicios_exec": [
            {"exercicio_nome": nome, "series_exec": [{"carga": carga, "reps": 10}]},
        ],
    }


def test_evolucao_tendencia_subindo():
    # sessões chegam mais recente primeiro (ordem do scan reverso)
    sessoes = [
        _sessao_com_carga("2026-07-01", "Agachamento Livre", 100),
        _sessao_com_carga("2026-06-24", "Agachamento Livre", 90),
        _sessao_com_carga("2026-06-17", "Agachamento Livre", 80),
    ]
    prs = [{"exercicio": "Agachamento livre", "carga": 100, "data": "2026-07-01"}]
    out = _evolucao_do_programa(sessoes, prs, ["Agachamento livre"])
    assert len(out) == 1
    ev = out[0]
    assert ev.tendencia == "SUBINDO"
    assert ev.carga_max_primeira_sessao == 80
    assert ev.carga_max_ultima_sessao == 100
    assert ev.recorde_carga == 100
    assert ev.sessoes_no_periodo == 3


def test_evolucao_estavel_e_sem_dados():
    sessoes = [
        _sessao_com_carga("2026-07-01", "Supino reto", 51),
        _sessao_com_carga("2026-06-24", "Supino reto", 50),
    ]
    out = _evolucao_do_programa(sessoes, [], ["Supino reto", "Remada curvada"])
    por_nome = {e.exercicio: e for e in out}
    assert por_nome["Supino reto"].tendencia == "ESTAVEL"     # delta 2% <= 5%
    assert por_nome["Remada curvada"].tendencia == "SEM_DADOS"
