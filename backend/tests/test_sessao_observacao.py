"""Comentário curto do aluno ao finalizar o treino.

O aluno precisava de um canal para justificar um exercício pulado ("pulei perna, joelho
doendo") ou comentar o dia. O campo entra no item da sessão sem write extra — o `snap` do
finish copia tudo — e o personal recebe o trecho na notificação, com botão para a sessão exata.
"""
import pytest

from app.models.sessao import FinishBody
from app.repositories import keys
from app.services import notif_service, sessao_service

# Capturado antes de qualquer fixture emudecer o disparo — o teste de deep link precisa da
# função de verdade para verificar a URL que ela monta.
_DISPARAR_PUSH_REAL = notif_service._disparar_push_personal

PERSONAL = "p-1"
ALUNO = "a-1"
TREINO = "t-1"


def _historica(fake) -> dict:
    hist = [i for (pk, sk), i in fake.itens.items()
            if pk == keys.pk_aluno(ALUNO) and sk.startswith("SESSION#")
            and sk != keys.SK_SESSION_ACTIVE]
    assert len(hist) == 1
    return hist[0]


def _notifs(fake) -> list[dict]:
    return [i for (pk, sk), i in fake.itens.items()
            if pk == keys.pk_personal(PERSONAL) and sk.startswith(keys.NOTIF_PREFIX)]


@pytest.fixture
def sessao(repo_fake, monkeypatch):
    from app.services import notif_service
    monkeypatch.setattr(notif_service, "_disparar_push_personal", lambda *a, **k: None)
    repo_fake.put_item(keys.pk_aluno(ALUNO), keys.sk_treino(TREINO),
                       {"treino_id": TREINO, "nome": "Treino A"})
    repo_fake.put_item(keys.pk_aluno(ALUNO), keys.sk_exercicio(TREINO, "e-1"),
                       {"exercicio_id": "e-1", "nome": "Supino reto", "ordem": 0, "grupos": ["Peito"]})
    repo_fake.put_item(keys.pk_personal(PERSONAL), keys.sk_aluno_pointer(ALUNO), {"nome": "João"})
    sessao_service.start_session(PERSONAL, ALUNO, TREINO, iniciado_pelo_aluno=True)
    return repo_fake


def test_observacao_vai_para_a_sessao_historica(sessao):
    sessao_service.finish(ALUNO, FinishBody(observacao="Pulei perna, joelho doendo"))
    assert _historica(sessao)["observacao"] == "Pulei perna, joelho doendo"


def test_observacao_e_aparada(sessao):
    sessao_service.finish(ALUNO, FinishBody(observacao="  treino puxado  \n"))
    assert _historica(sessao)["observacao"] == "treino puxado"


@pytest.mark.parametrize("body", [None, FinishBody(), FinishBody(observacao="   ")])
def test_sem_observacao_o_campo_nao_existe(sessao, body):
    """Sessão sem comentário não ganha campo vazio: o front decide exibir pela presença."""
    sessao_service.finish(ALUNO, body)
    assert "observacao" not in _historica(sessao)


def test_observacao_longa_e_recusada_no_modelo(sessao):
    """Teto de 500: o campo é um comentário curto, não um diário — e vai junto na notificação."""
    with pytest.raises(Exception):
        FinishBody(observacao="x" * 501)


def test_detalhe_da_sessao_devolve_a_observacao(sessao):
    sessao_service.finish(ALUNO, FinishBody(observacao="Ombro incomodou no supino"))
    sid = _historica(sessao)["sessao_id"]

    itens, _ = sessao_service.list_sessoes(ALUNO)

    assert [s["observacao"] for s in itens if s["sessao_id"] == sid] == ["Ombro incomodou no supino"]


# ── Notificação do personal ──────────────────────────────────────────────────

def test_notificacao_carrega_o_trecho_do_comentario(sessao):
    sessao_service.finish(ALUNO, FinishBody(observacao="Pulei perna, joelho doendo"))

    notifs = _notifs(sessao)
    assert [n["tipo"] for n in notifs] == ["TREINO_CONCLUIDO"]
    assert '💬 "Pulei perna, joelho doendo"' in notifs[0]["mensagem"]
    # O `sessao_id` é o que leva o personal à sessão exata (e não a data, que é UTC).
    assert notifs[0]["sessao_id"] == _historica(sessao)["sessao_id"]


def test_comentario_longo_e_truncado_na_notificacao(sessao):
    texto = "a" * 200
    sessao_service.finish(ALUNO, FinishBody(observacao=texto))

    mensagem = _notifs(sessao)[0]["mensagem"]
    assert "…\"" in mensagem
    assert len(mensagem) < len(texto)


def test_sem_comentario_a_notificacao_fica_como_era(sessao):
    sessao_service.finish(ALUNO)
    assert "💬" not in _notifs(sessao)[0]["mensagem"]


def test_push_do_treino_concluido_aponta_para_a_sessao(sessao, monkeypatch):
    from app.services import push_service

    enviados: list[dict] = []
    monkeypatch.setattr(notif_service, "_disparar_push_personal", _DISPARAR_PUSH_REAL)
    monkeypatch.setattr(push_service, "send_push_personal",
                        lambda pid, t, m, url=None, tag=None: enviados.append({"url": url, "tag": tag}))

    sessao_service.finish(ALUNO, FinishBody(observacao="feito"))

    sid = _historica(sessao)["sessao_id"]
    assert enviados == [{"url": f"/alunos/{ALUNO}?tab=historico&sessao={sid}", "tag": "TREINO_CONCLUIDO"}]
