"""`GET /v1/aluno/hoje` — a primeira tela do app do aluno, exercitada de ponta a ponta.

Existe por uma regressão de produção: o Passo 5 do fuso horário trocou `date.today()` por
`locale_service.hoje(tz)` dentro de `agent_service.treino_de_hoje` e, junto, apagou o
`from datetime import date` que era LOCAL da função — deixando `date.fromisoformat()` sem
nome definido. `NameError` em produção, 500 na rota, e todo aluno de todo personal ficou
sem ver treino nenhum, com os dados intactos no banco.

O que faltava não era um teste de fuso: era alguém CHAMAR a rota. `treino_de_hoje` não
tinha nenhuma cobertura, então o import morto passou pela suíte inteira. Daí o formato
daqui — request HTTP de verdade, sem mock do serviço, para que qualquer nome indefinido no
caminho vire teste vermelho em vez de tela vazia.
"""
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_current_aluno
from app.main import app
from app.repositories import keys

PERSONAL = "personal-1"
ALUNO = "aluno-1"
TREINO = "t-1"


@pytest.fixture
def cliente(repo_fake):
    repo_fake.put_item(keys.pk_aluno(ALUNO), keys.SK_PROFILE, {
        "aluno_id": ALUNO, "personal_id": PERSONAL, "nome": "Marina",
        "status": "ATIVO", "timezone": "America/Sao_Paulo",
    })
    repo_fake.put_item(keys.pk_aluno(ALUNO), keys.sk_treino(TREINO), {
        "treino_id": TREINO, "aluno_id": ALUNO, "nome": "Treino A",
        "foco": "LPO", "ordem": 0, "ativo": True,
    })
    # dia_semana=None → exercício diário, entra em `hoje` seja qual for o dia em que a
    # suíte rodar (o teste não pode depender do dia da semana da execução).
    repo_fake.put_item(keys.pk_aluno(ALUNO), keys.sk_exercicio(TREINO, "e-1"), {
        "exercicio_id": "e-1", "treino_id": TREINO, "nome": "Snatch",
        "ordem": 0, "dia_semana": None,
    })
    app.dependency_overrides[get_current_aluno] = lambda: {
        "aluno_id": ALUNO, "personal_id": PERSONAL,
    }
    yield TestClient(app), repo_fake
    app.dependency_overrides.clear()


def test_hoje_responde_com_os_treinos_do_aluno(cliente):
    tc, _ = cliente

    r = tc.get("/v1/aluno/hoje")

    assert r.status_code == 200, r.text
    body = r.json()
    assert [t["treino_id"] for t in body["treinos"]] == [TREINO]
    # `hoje` vem de agent_service.treino_de_hoje — o caminho que quebrou em produção.
    assert [t["id"] for t in body["hoje"]] == [TREINO]
    assert body["hoje"][0]["num_ex"] == 1


def test_hoje_ignora_treino_fora_do_periodo(cliente):
    """Vigência é data civil no fuso do ALUNO, e as duas listas têm que concordar."""
    tc, repo = cliente
    repo.put_item(keys.pk_aluno(ALUNO), keys.sk_treino("t-velho"), {
        "treino_id": "t-velho", "aluno_id": ALUNO, "nome": "Bloco anterior",
        "ordem": 1, "ativo": True, "data_fim": "2020-01-01",
    })
    repo.put_item(keys.pk_aluno(ALUNO), keys.sk_exercicio("t-velho", "e-9"), {
        "exercicio_id": "e-9", "treino_id": "t-velho", "nome": "Clean", "dia_semana": None,
    })

    body = tc.get("/v1/aluno/hoje").json()

    assert [t["treino_id"] for t in body["treinos"]] == [TREINO]
    assert [t["id"] for t in body["hoje"]] == [TREINO]


def _outros_treinos(repo):
    """Mais dois treinos na rotação, depois do `TREINO` da fixture (ordem 0)."""
    for tid, nome, ordem in (("t-2", "Treino B", 1), ("t-3", "Treino C", 2)):
        repo.put_item(keys.pk_aluno(ALUNO), keys.sk_treino(tid), {
            "treino_id": tid, "aluno_id": ALUNO, "nome": nome, "ordem": ordem, "ativo": True,
        })


def _feito_agora(repo, treino_id, sessao_id="s-1", seq=0):
    """Sessão concluída neste instante — vira a `ultima` da rotação e marca a semana do treino.
    Usa `now` de propósito: a semana ISO da execução é sempre a semana corrente, rode quando rodar.
    `seq` só desempata o SK (o relógio pode dar o mesmo ms para duas chamadas seguidas)."""
    agora = datetime.now(timezone.utc)
    iso, ts = agora.isoformat(), int(agora.timestamp() * 1000) + seq
    repo.put_item(keys.pk_aluno(ALUNO), keys.sk_sessao_hist(f"{ts:013d}", sessao_id), {
        "sessao_id": sessao_id, "treino_id": treino_id, "status": "FINALIZADA",
        "treino_nome": treino_id, "data_hora_fim": iso,
    })
    repo.update_item(keys.pk_aluno(ALUNO), keys.sk_treino(treino_id), {"ultima_execucao": iso})


def test_proximo_pula_treino_ja_feito_nesta_semana(cliente):
    """Regressão: terminar um treino cujo sucessor da rotação já foi feito na semana apagava o
    marcador de próximo da tela (o app esconde o selo em treino feito). Ele tem que andar até
    o primeiro ainda pendente."""
    tc, repo = cliente
    _outros_treinos(repo)
    _feito_agora(repo, "t-2", "s-b", seq=0)   # B já foi nesta semana…
    _feito_agora(repo, TREINO, "s-a", seq=1)  # …e agora o aluno termina o A

    body = tc.get("/v1/aluno/hoje").json()

    assert body["proximo"]["treino_id"] == "t-3"


def test_proximo_da_a_volta_quando_o_pendente_esta_atras(cliente):
    tc, repo = cliente
    _outros_treinos(repo)
    _feito_agora(repo, "t-3", "s-c", seq=0)
    _feito_agora(repo, "t-2", "s-b", seq=1)   # último é o B → sucessor é o C, já feito

    body = tc.get("/v1/aluno/hoje").json()

    assert body["proximo"]["treino_id"] == TREINO


def test_semana_completa_mantem_o_proximo_da_rotacao(cliente):
    """Nada pendente: devolve o sucessor normal em vez de `None` — o app já mostra
    'semana completa' e esconde o selo sozinho."""
    tc, repo = cliente
    _outros_treinos(repo)
    for seq, (tid, sid) in enumerate(((TREINO, "s-a"), ("t-3", "s-c"), ("t-2", "s-b"))):
        _feito_agora(repo, tid, sid, seq=seq)

    body = tc.get("/v1/aluno/hoje").json()

    assert body["proximo"]["treino_id"] == "t-3"


def test_treino_sem_id_nao_derruba_a_tela(cliente):
    """Casca de agregado sem `treino_id` (ver test_treino_com_sessao_aberta) — some da
    leitura em vez de estourar KeyError nas duas listas."""
    tc, repo = cliente
    repo.put_item(keys.pk_aluno(ALUNO), keys.sk_treino("fantasma"), {"total_execucoes": 1})

    r = tc.get("/v1/aluno/hoje")

    assert r.status_code == 200, r.text
    assert [t["treino_id"] for t in r.json()["treinos"]] == [TREINO]
