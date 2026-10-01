"""PSE na série de evolução — o gráfico de carga do app do aluno desenha a PSE como um traço a
mais. O valor já vive no REG (gravado no `registrar`); aqui só se trava que ele chega no ponto,
e que "não sei dizer"/legado viram `None` (o front liga os pontos com `connectNulls`)."""
from app.repositories import keys
from app.services import sessao_service

ALUNO = "a-1"
EX_ID = "e-1"
EX_NOME = "Supino Reto"
CHAVE = "supino reto"
PK = keys.pk_aluno(ALUNO)


def _gravar_reg(fake, sessao_id, ts, tipo=None, **extra):
    fake.put_item(PK, keys.sk_registro(sessao_id, EX_ID), {
        "sessao_id": sessao_id, "exercicio_id": EX_ID, "exercicio_nome": EX_NOME,
        "series_exec": [{"carga": "60", "reps": 8}],
        "data_hora": "2026-08-01T10:00:00+00:00",
        **({"tipo_exercicio": tipo} if tipo else {}),
        "GSI1PK": keys.gsi1_registro(ALUNO, CHAVE), "GSI1SK": keys.gsi1sk_registro(ts),
        **extra,
    })


def test_pse_chega_no_ponto_da_serie(repo_fake):
    _gravar_reg(repo_fake, "s-1", "0001756000000000", pse=7)
    _gravar_reg(repo_fake, "s-2", "0001756100000000")   # "não sei dizer" / legado

    serie = sessao_service.evolucao_por_chave(ALUNO, CHAVE)["serie"]

    assert [p["pse"] for p in serie] == [7.0, None]


def test_pse_tambem_em_exercicio_de_performance(repo_fake):
    _gravar_reg(repo_fake, "s-1", "0001756000000000", tipo="PERFORMANCE", pse=9)

    ponto = sessao_service.evolucao_por_chave(ALUNO, CHAVE)["serie"][0]

    assert ponto["pse"] == 9.0
    assert ponto["metrica_max"] == 8
