"""Corrigir um PR digitado errado — 600 kg no lugar de 60.

O item `STATS#PR#` foi construído para nunca cair (`update_if_greater`/`update_if_less`), o que
torna um erro de digitação permanente. A edição é a porta de correção, e o contrato tem três
partes que estes testes travam:

1. **Corrigir não é bater recorde.** Nenhum ponto, meta, badge ou notificação sai daqui — senão
   quem errasse a digitação ganharia pontos de novo ao consertar.
2. **O update não pode virar put.** O PR de WOD carrega `formato`/`unidade`/`rx`/`direcao`; um
   put reconstruiria o item sem eles e "8:32" viraria "512" na tela.
3. **Uma vez corrigido, o item manda.** A evolução deriva o PR varrendo os REG — e o REG errado
   continua lá. Sem o override, o gráfico continuaria mostrando o valor que acabou de ser
   corrigido, na aba ao lado da que mostra o valor certo.
"""
from math import floor

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.dependencies import get_current_aluno, get_current_personal_id
from app.main import app
from app.models.enums import Ator
from app.repositories import keys
from app.services import meta_service, pontos_service, sessao_service

PERSONAL = "p-1"
ALUNO = "a-1"
TREINO = "t-1"
EX_ID = "e-1"
EX_NOME = "Supino Reto"
CHAVE = "supino reto"

PK = keys.pk_aluno(ALUNO)


def _pr_item(fake, chave=CHAVE):
    return fake.get_item(PK, keys.sk_stats_pr(chave))


def _gravar_pr(fake, carga, chave=CHAVE, **extra):
    fake.put_item(PK, keys.sk_stats_pr(chave),
                  {"carga": carga, "exercicio_nome": EX_NOME, "data": "2026-08-01T10:00:00+00:00",
                   **extra})


def _sks(fake, prefixo):
    return [sk for (pk, sk) in fake.itens if pk == PK and sk.startswith(prefixo)]


@pytest.fixture
def dados(repo_fake, monkeypatch):
    from app.services import anotif_service, notif_service
    monkeypatch.setattr(anotif_service, "_disparar_push", lambda *a, **k: None)
    monkeypatch.setattr(notif_service, "_disparar_push_personal", lambda *a, **k: None)

    repo_fake.put_item(keys.pk_personal(PERSONAL), keys.sk_aluno_pointer(ALUNO),
                       {"aluno_id": ALUNO, "nome": "Marina", "status": "ATIVO"})
    repo_fake.put_item(PK, keys.sk_treino(TREINO), {"treino_id": TREINO, "nome": "Treino A"})
    repo_fake.put_item(PK, keys.sk_exercicio(TREINO, EX_ID),
                       {"exercicio_id": EX_ID, "nome": EX_NOME, "ordem": 0, "grupo": "Peito"})
    return repo_fake


@pytest.fixture
def cliente(dados):
    app.dependency_overrides[get_current_personal_id] = lambda: PERSONAL
    app.dependency_overrides[get_current_aluno] = lambda: {"aluno_id": ALUNO, "personal_id": PERSONAL}
    yield TestClient(app), dados
    app.dependency_overrides.clear()


# ── o caso que motivou a feature ─────────────────────────────────────────────

def test_corrige_o_valor_e_deixa_rastro(dados):
    _gravar_pr(dados, 600)

    out = sessao_service.editar_pr(ALUNO, CHAVE, 60, Ator.ALUNO.value)

    assert out["carga"] == 60
    assert out["editado_por"] == Ator.ALUNO.value
    assert out["editado_em"]


def test_nao_mexe_na_data_do_recorde(dados):
    _gravar_pr(dados, 600)

    out = sessao_service.editar_pr(ALUNO, CHAVE, 60, Ator.PERSONAL.value)

    assert out["data"] == "2026-08-01T10:00:00+00:00"


def test_pr_de_wod_preserva_formato_unidade_rx_e_direcao(dados):
    """O update só toca `carga` — um put reconstruiria o item e o score perderia o formato."""
    _gravar_pr(dados, 512.0, chave="wod#fran", direcao="MENOR", formato="FOR_TIME",
               wod=True, unidade="s", rx=True)

    out = sessao_service.editar_pr(ALUNO, "wod#fran", 512 + 20, Ator.PERSONAL.value)

    assert out["carga"] == 532
    assert (out["formato"], out["unidade"], out["rx"], out["direcao"], out["wod"]) == \
        ("FOR_TIME", "s", True, "MENOR", True)


def test_aceita_carga_negativa_de_contrapeso(dados):
    """Graviton/assistida: -10 é melhor que -30 (menos assistência). Rejeitar negativo quebraria."""
    _gravar_pr(dados, -30)

    assert sessao_service.editar_pr(ALUNO, CHAVE, "-10", Ator.ALUNO.value)["carga"] == -10


def test_aceita_virgula_decimal(dados):
    _gravar_pr(dados, 600)

    assert sessao_service.editar_pr(ALUNO, CHAVE, "62,5", Ator.ALUNO.value)["carga"] == 62.5


# ── recusas ──────────────────────────────────────────────────────────────────

def test_editar_recorde_inexistente_da_404_e_nao_cria_item(dados):
    with pytest.raises(HTTPException) as e:
        sessao_service.editar_pr(ALUNO, "agachamento", 100, Ator.ALUNO.value)

    assert e.value.status_code == 404
    # Sem isso, uma chave qualquer inventaria recordes de exercícios jamais executados.
    assert _sks(dados, "STATS#PR#") == []


@pytest.mark.parametrize("valor", ["abc", "", None, "nan", "inf", "-inf", 10 ** 9, -10 ** 9])
def test_recusa_valor_invalido(dados, valor):
    """NaN é o pior deles: gravado, envenena a ConditionExpression do update_if_greater para
    sempre (comparação com NaN é sempre falsa) e o exercício nunca mais registra um recorde."""
    _gravar_pr(dados, 600)

    with pytest.raises(HTTPException) as e:
        sessao_service.editar_pr(ALUNO, CHAVE, valor, Ator.ALUNO.value)

    assert e.value.status_code == 400
    assert _pr_item(dados)["carga"] == 600


@pytest.mark.parametrize("valor", [0, -5])
def test_recusa_valor_nao_positivo_quando_menor_e_melhor(dados, valor):
    _gravar_pr(dados, 512.0, chave="wod#fran", direcao="MENOR", formato="FOR_TIME", unidade="s")

    with pytest.raises(HTTPException) as e:
        sessao_service.editar_pr(ALUNO, "wod#fran", valor, Ator.PERSONAL.value)

    assert e.value.status_code == 400


def test_chave_vazia_da_400(dados):
    with pytest.raises(HTTPException) as e:
        sessao_service.editar_pr(ALUNO, "   ", 60, Ator.ALUNO.value)

    assert e.value.status_code == 400


# ── exclusão ─────────────────────────────────────────────────────────────────

def test_excluir_some_com_o_recorde(dados):
    _gravar_pr(dados, 600)

    sessao_service.excluir_pr(ALUNO, CHAVE)

    assert _pr_item(dados) is None
    assert sessao_service.resumo_aluno(ALUNO)["prs"] == []


def test_excluir_inexistente_da_404(dados):
    with pytest.raises(HTTPException) as e:
        sessao_service.excluir_pr(ALUNO, CHAVE)

    assert e.value.status_code == 404


# ── corrigir não é bater recorde ─────────────────────────────────────────────

def test_edicao_nao_concede_ponto(dados):
    _gravar_pr(dados, 600)

    sessao_service.editar_pr(ALUNO, CHAVE, 60, Ator.ALUNO.value)

    assert _sks(dados, keys.PONTO_LOG_PREFIX) == []
    assert dados.get_item(PK, keys.SK_PONTOS) is None


def test_edicao_nao_conclui_meta(dados):
    """Meta de 100 kg com PR editado para 120: continua APROVADA. Concluir aqui daria +50 pts
    e duas notificações por um recorde que o aluno não bateu."""
    meta_service.criar(ALUNO, PERSONAL, {
        "tipo": "CARGA", "titulo": "Supino 100 kg", "valor_alvo": 100,
        "exercicio_id": EX_ID, "chave": CHAVE,
    })
    _gravar_pr(dados, 600)

    sessao_service.editar_pr(ALUNO, CHAVE, 120, Ator.PERSONAL.value)

    assert [m["status"] for m in meta_service.listar(ALUNO)] == ["APROVADA"]
    # Controle: um PR de verdade nesse mesmo valor concluiria — a diferença é a edição.
    meta_service.verificar_metas_carga(ALUNO, PERSONAL, EX_ID, 120.0, chave=CHAVE)
    assert [m["status"] for m in meta_service.listar(ALUNO)] == ["CONCLUIDA"]


def test_edicao_nao_gera_notificacao(dados):
    _gravar_pr(dados, 600)

    sessao_service.editar_pr(ALUNO, CHAVE, 60, Ator.ALUNO.value)

    assert _sks(dados, keys.ANOTIF_PREFIX) == []


# ── o recorde volta a subir normalmente depois da correção ───────────────────

def _registrar(tc, carga):
    return tc.post("/v1/aluno/registros",
                   json={"exercicio_id": EX_ID, "series": [{"carga": str(carga), "reps": 8}]})


def test_registro_acima_do_valor_corrigido_volta_a_ser_pr_e_pontua(cliente):
    """A ConditionExpression compara contra `carga`, não contra `editado_em`: corrigir para 60
    não impede que um 70 legítimo vire recorde — e aí sim vale ponto."""
    tc, fake = cliente
    _gravar_pr(fake, 600)
    sessao_service.editar_pr(ALUNO, CHAVE, 60, Ator.ALUNO.value)
    sessao_service.start_session(PERSONAL, ALUNO, TREINO, iniciado_pelo_aluno=True)

    r = _registrar(tc, 70)

    assert r.status_code == 201
    assert r.json()["pr_novo"] == 70
    assert _pr_item(fake)["carga"] == 70
    # Confere o saldo, não o log: `sk_ponto_log` é o próprio `now_iso()`, então os dois awards
    # do mesmo request (PR + SERIE) podem cair no mesmo timestamp e um sobrescrever o outro.
    serie_pts = max(1, floor(pontos_service.PONTOS["SERIE"] * pontos_service.multiplicador_streak(0)))
    assert fake.get_item(PK, keys.SK_PONTOS)["total"] == pontos_service.PONTOS["PR"] + serie_pts


def test_registro_abaixo_do_valor_corrigido_nao_vira_pr(cliente):
    tc, fake = cliente
    _gravar_pr(fake, 600)
    sessao_service.editar_pr(ALUNO, CHAVE, 200, Ator.ALUNO.value)
    sessao_service.start_session(PERSONAL, ALUNO, TREINO, iniciado_pelo_aluno=True)

    r = _registrar(tc, 100)

    assert "pr_novo" not in r.json()
    assert _pr_item(fake)["carga"] == 200


def test_a_marca_de_edicao_sobrevive_a_um_recorde_organico(cliente):
    """Não limpar `editado_em` é deliberado: o REG errado continua no histórico, então soltar o
    override faria a evolução voltar ao derivado e ressuscitar o valor corrigido."""
    tc, fake = cliente
    _gravar_pr(fake, 600)
    sessao_service.editar_pr(ALUNO, CHAVE, 60, Ator.ALUNO.value)
    sessao_service.start_session(PERSONAL, ALUNO, TREINO, iniciado_pelo_aluno=True)

    _registrar(tc, 70)

    assert _pr_item(fake)["editado_em"]


# ── o PR corrigido manda na evolução ─────────────────────────────────────────

def _gravar_reg(fake, carga, sessao_id="s-1", chave=CHAVE, ts="0001756000000000"):
    fake.put_item(PK, keys.sk_registro(sessao_id, EX_ID), {
        "sessao_id": sessao_id, "exercicio_id": EX_ID, "exercicio_nome": EX_NOME,
        "series_exec": [{"carga": str(carga), "reps": 8}],
        "data_hora": "2026-08-01T10:00:00+00:00",
        "GSI1PK": keys.gsi1_registro(ALUNO, chave), "GSI1SK": keys.gsi1sk_registro(ts),
    })


def test_evolucao_usa_o_pr_corrigido_e_mantem_a_serie_real(dados):
    _gravar_reg(dados, 600)
    _gravar_pr(dados, 600)
    sessao_service.editar_pr(ALUNO, CHAVE, 60, Ator.ALUNO.value)

    evo = sessao_service.evolucao_por_chave(ALUNO, CHAVE)

    assert evo["pr"]["carga"] == 60
    assert evo["pr"]["editado_por"] == Ator.ALUNO.value
    # A série é o que aconteceu de fato — corrigir o recorde não reescreve o histórico.
    assert evo["serie"][-1]["carga_max"] == 600


def test_evolucao_sem_edicao_mantem_o_pr_derivado(dados):
    _gravar_reg(dados, 600)
    _gravar_pr(dados, 600)

    evo = sessao_service.evolucao_por_chave(ALUNO, CHAVE)

    assert evo["pr"]["carga"] == 600
    assert "editado_em" not in evo["pr"]


def test_evolucao_por_exercicio_id_usa_o_mesmo_override(dados):
    _gravar_reg(dados, 600)
    _gravar_pr(dados, 600)
    sessao_service.editar_pr(ALUNO, CHAVE, 60, Ator.ALUNO.value)

    assert sessao_service.evolucao_exercicio(ALUNO, EX_ID)["pr"]["carga"] == 60


def test_evolucao_depois_de_excluir_volta_ao_derivado(dados):
    _gravar_reg(dados, 600)
    _gravar_pr(dados, 600)
    sessao_service.editar_pr(ALUNO, CHAVE, 60, Ator.ALUNO.value)
    sessao_service.excluir_pr(ALUNO, CHAVE)

    assert sessao_service.evolucao_por_chave(ALUNO, CHAVE)["pr"]["carga"] == 600


def test_o_resumo_expoe_a_marca_de_edicao(dados):
    """Sem isso a aba Recordes não consegue desenhar o selo — a projeção do resumo é whitelist."""
    _gravar_pr(dados, 600)
    sessao_service.editar_pr(ALUNO, CHAVE, 60, Ator.PERSONAL.value)

    pr = sessao_service.resumo_aluno(ALUNO)["prs"][0]

    assert (pr["carga"], pr["chave"], pr["editado_por"]) == (60, CHAVE, Ator.PERSONAL.value)
    assert pr["editado_em"]


# ── HTTP ─────────────────────────────────────────────────────────────────────

def test_aluno_edita_pelo_proprio_endpoint(cliente):
    tc, fake = cliente
    _gravar_pr(fake, 600)

    r = tc.put("/v1/aluno/exercicios/pr", json={"chave": CHAVE, "carga": "60"})

    assert r.status_code == 200
    assert r.json()["carga"] == 60
    assert r.json()["editado_por"] == Ator.ALUNO.value


def test_personal_edita_pelo_endpoint_do_portal(cliente):
    tc, fake = cliente
    _gravar_pr(fake, 600)

    r = tc.put(f"/v1/alunos/{ALUNO}/exercicios/pr", json={"chave": CHAVE, "carga": 60})

    assert r.status_code == 200
    assert r.json()["editado_por"] == Ator.PERSONAL.value


def test_editado_por_vem_da_rota_e_nao_do_body(cliente):
    """O aluno não consegue assinar a correção como se fosse o personal."""
    tc, fake = cliente
    _gravar_pr(fake, 600)

    r = tc.put("/v1/aluno/exercicios/pr",
               json={"chave": CHAVE, "carga": 60, "editado_por": Ator.PERSONAL.value})

    assert r.json()["editado_por"] == Ator.ALUNO.value


def test_delete_responde_204(cliente):
    tc, fake = cliente
    _gravar_pr(fake, 600)

    r = tc.delete("/v1/aluno/exercicios/pr", params={"chave": CHAVE})

    assert r.status_code == 204
    assert _pr_item(fake) is None


def test_get_por_chave_alcanca_pr_de_wod(cliente):
    """`exercicio_nome` sozinho nunca produz "wod#…" — sem o parâmetro `chave`, o PR de WOD
    seria ineditável pelo app."""
    tc, fake = cliente
    _gravar_pr(fake, 512.0, chave="wod#fran", wod=True, formato="FOR_TIME", unidade="s")

    r = tc.get("/v1/aluno/exercicios/pr", params={"chave": "wod#fran"})

    assert r.status_code == 200
    assert r.json()["carga"] == 512


def test_portal_le_o_pr_por_chave(cliente):
    """A rota literal não pode ser engolida por `/exercicios/{exercicio_id}/…`."""
    tc, fake = cliente
    _gravar_pr(fake, 600)

    r = tc.get(f"/v1/alunos/{ALUNO}/exercicios/pr", params={"chave": CHAVE})

    assert r.status_code == 200
    assert r.json()["carga"] == 600


def test_personal_de_outro_aluno_nao_edita(cliente):
    tc, fake = cliente
    _gravar_pr(fake, 600)

    r = tc.put("/v1/alunos/aluno-de-outro/exercicios/pr", json={"chave": CHAVE, "carga": 60})

    assert r.status_code == 404
    assert _pr_item(fake)["carga"] == 600


def test_edicao_do_aluno_nao_alcanca_outra_particao(dados):
    outro = "a-2"
    dados.put_item(keys.pk_aluno(outro), keys.sk_stats_pr(CHAVE),
                   {"carga": 300, "exercicio_nome": EX_NOME})
    _gravar_pr(dados, 600)

    sessao_service.editar_pr(ALUNO, CHAVE, 60, Ator.ALUNO.value)

    assert dados.get_item(keys.pk_aluno(outro), keys.sk_stats_pr(CHAVE))["carga"] == 300


def test_pontos_service_nao_tem_gancho_de_edicao():
    """Guarda de regressão: se alguém acrescentar um award na edição, a tabela de pontos é o
    lugar onde isso apareceria primeiro."""
    assert "PR_EDITADO" not in pontos_service.PONTOS
