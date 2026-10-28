"""Contador de visitas da aba Campanhas do admin (`campanha_service` + `/v1/public/telemetry/visita`)."""
import pytest
from fastapi.testclient import TestClient

from app.services import campanha_service


@pytest.fixture
def client(repo_fake, monkeypatch):
    monkeypatch.setattr(campanha_service, "_dia", lambda: "2026-10-28")
    from app.main import app
    return TestClient(app)


@pytest.mark.parametrize("bruta,esperada", [
    ("instagram", "instagram"),
    (" Google-Ads ", "google-ads"),
    ("", None),
    ("-x", None),
    ("a" * 25, None),
    ("PAGINA#x", None),
])
def test_normalizar_origem(bruta, esperada):
    assert campanha_service.normalizar(bruta) == esperada


@pytest.mark.parametrize("bruta,esperada", [
    ("/", "/"),
    ("/precos/", "/precos"),
    ("/blog/como-cobrar", "/blog/como-cobrar"),
    ("/@demo", None),          # captação do personal: não é aquisição
    ("/dashboard", None),      # portal
    ("/alunos/abc", None),
    ("/a/b/c", None),
    ("precos", None),
])
def test_normalizar_pagina(bruta, esperada):
    assert campanha_service.normalizar_pagina(bruta) == esperada


def test_visitas_somam_e_resumo_agrega(client, repo_fake):
    for corpo in [
        {"origem": "instagram", "pagina": "/"},
        {"origem": "instagram", "pagina": "/precos"},
        {"origem": "direto", "pagina": "/"},
        {"pagina": "/"},
        {"origem": "lixo#", "pagina": "/dashboard"},   # nada válido: 204 sem gravar
    ]:
        assert client.post("/v1/public/telemetry/visita", json=corpo).status_code == 204

    r = campanha_service.resumo("2026-10")
    assert r["total"] == 3
    assert [(o["origem"], o["visitas"]) for o in r["origens"]] == [("instagram", 2), ("direto", 1)]
    assert r["origens"][0]["por_dia"] == {"2026-10-28": 2}
    assert [(p["pagina"], p["visitas"]) for p in r["paginas"]] == [("/", 3), ("/precos", 1)]
    assert r["total_paginas"] == 4
    assert campanha_service.resumo("2026-09")["total"] == 0


def test_rate_limit_nao_vira_erro(client, repo_fake, monkeypatch):
    monkeypatch.setattr(campanha_service, "LIMITE_POR_JANELA", 2)
    h = {"x-forwarded-for": "1.2.3.4, 10.0.0.1"}
    for _ in range(4):
        assert client.post("/v1/public/telemetry/visita", json={"origem": "meta"}, headers=h).status_code == 204
    assert campanha_service.resumo("2026-10")["total"] == 2
    # Outro IP tem o próprio balde.
    client.post("/v1/public/telemetry/visita", json={"origem": "meta"}, headers={"x-forwarded-for": "5.6.7.8"})
    assert campanha_service.resumo("2026-10")["total"] == 3


def test_corpo_vazio_ou_invalido_responde_204(client):
    assert client.post("/v1/public/telemetry/visita", json={}).status_code == 204
    assert client.post("/v1/public/telemetry/visita", json={"origem": "x" * 64}).status_code == 204
