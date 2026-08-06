"""Entrega de push e notificação TREINO_CONCLUIDO.

O ponto crítico coberto aqui: 401/403 é problema da NOSSA chave VAPID, não do dispositivo.
Apagar a subscription nesse caso zerava o registro de todo mundo e o cliente nunca se
re-inscrevia — usuário via "notificações ativadas" e não recebia mais nada.
"""
from unittest.mock import patch

import pytest
from pywebpush import WebPushException

from app.services import push_service, sessao_service

SUB = {"endpoint": "https://fcm.googleapis.com/fcm/send/abc", "p256dh": "p", "auth": "a"}


class _Resp:
    def __init__(self, status_code):
        self.status_code = status_code


def _erro(status):
    return WebPushException("falhou", response=_Resp(status))


@pytest.mark.parametrize("status", [401, 403])
def test_nao_remove_subscription_em_erro_de_vapid(status):
    with patch.object(push_service, "webpush", side_effect=_erro(status)), \
         patch.object(push_service.repo, "delete_item") as del_item:
        resumo = push_service._send_to_subs([SUB], lambda s: "PT#x", {"title": "t"})
    del_item.assert_not_called()
    assert resumo == {"enviados": 0, "removidos": 0, "falhas": 1}


@pytest.mark.parametrize("status", [404, 410])
def test_remove_subscription_em_endpoint_morto(status):
    with patch.object(push_service, "webpush", side_effect=_erro(status)), \
         patch.object(push_service.repo, "delete_item") as del_item:
        resumo = push_service._send_to_subs([SUB], lambda s: "PT#x", {"title": "t"})
    del_item.assert_called_once()
    assert resumo == {"enviados": 0, "removidos": 1, "falhas": 0}


def test_falha_em_um_dispositivo_nao_impede_os_demais():
    outro = {**SUB, "endpoint": "https://web.push.apple.com/xyz"}
    with patch.object(push_service, "webpush", side_effect=[_erro(500), None]), \
         patch.object(push_service.repo, "delete_item"):
        resumo = push_service._send_to_subs([SUB, outro], lambda s: "PT#x", {"title": "t"})
    assert resumo == {"enviados": 1, "removidos": 0, "falhas": 1}


# ── TREINO_CONCLUIDO ────────────────────────────────────────────────────────

SNAP = {
    "sessao_id": "s1", "treino_nome": "Treino A", "duracao_segundos": 3900,
    "novos_prs": ["Supino"],
}


def _notificar(perfil, snap=SNAP):
    """Roda _notificar_treino_concluido com o perfil do personal mockado."""
    def fake_get(pk, sk, **kw):
        return perfil if sk == "PROFILE" else {"nome": "Ana"}

    with patch.object(sessao_service.repo, "get_item", side_effect=fake_get), \
         patch("app.services.notif_service.criar") as criar:
        sessao_service._notificar_treino_concluido("pt1", "al1", snap, 5, 6)
    return criar


def test_notifica_com_nome_treino_e_recordes():
    criar = _notificar({})
    criar.assert_called_once()
    args, kwargs = criar.call_args
    assert args[0] == "pt1"
    assert args[1] == "TREINO_CONCLUIDO"
    assert args[2] == "Ana concluiu um treino"
    assert args[3] == "Treino A · 5/6 exercícios · 1h05min · 1 novo recorde"
    assert kwargs["aluno_id"] == "al1"
    assert kwargs["ref_extra"] == {"sessao_id": "s1"}


def test_toggle_desligado_suprime_notificacao():
    _notificar({"notif_treino_concluido": False}).assert_not_called()


def test_toggle_ausente_significa_ligado():
    _notificar({"nome": "Personal"}).assert_called_once()


def test_sem_nome_do_aluno_usa_fallback():
    with patch.object(sessao_service.repo, "get_item", return_value=None), \
         patch("app.services.notif_service.criar") as criar:
        sessao_service._notificar_treino_concluido("pt1", "al1", SNAP, 5, 6)
    assert criar.call_args[0][2] == "Seu aluno concluiu um treino"


def test_falha_na_notificacao_nao_propaga():
    """finish() nunca pode quebrar porque a notificação falhou."""
    with patch.object(sessao_service.repo, "get_item", side_effect=RuntimeError("dynamo fora")):
        sessao_service._notificar_treino_concluido("pt1", "al1", SNAP, 5, 6)


@pytest.mark.parametrize("segundos,esperado", [
    (None, None), (30, None), (600, "10min"), (3900, "1h05min"), (7200, "2h00min"),
])
def test_formata_duracao(segundos, esperado):
    assert sessao_service._fmt_duracao(segundos) == esperado
