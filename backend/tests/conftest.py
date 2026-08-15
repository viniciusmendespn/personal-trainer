"""Fixtures compartilhadas.

`mcp_env` troca o DynamoDB real por um fake e configura os segredos que só existem em
runtime. O patch é feito nas funções do próprio módulo `dynamo_repo`, não em cada módulo
que o importa: como todos fazem `from app.repositories import dynamo_repo as repo`, eles
compartilham o mesmo objeto de módulo, e um serviço novo entrando na cadeia de chamadas
não vira falha misteriosa de boto3.
"""
import pytest

from fake_repo import FakeRepo

_FUNCOES = [
    "get_item", "query_pk", "query_pk_last_n", "query_between", "query_pk_page",
    "batch_get_items", "put_item", "put_item_if_absent", "update_item",
    "update_item_if_exists", "add_and_set", "increment_counter", "delete_item",
    "delete_item_if_exists", "batch_write", "clean", "clean_all",
]


@pytest.fixture
def repo_fake(monkeypatch):
    from app.repositories import dynamo_repo
    from app.services import authz

    fake = FakeRepo()
    for nome in _FUNCOES:
        monkeypatch.setattr(dynamo_repo, nome, getattr(fake, nome))

    # O cache de autorização é global e sobrevive entre testes.
    authz._cache.clear()
    monkeypatch.setattr(authz.assinatura_service, "get_alunos_bloqueados", lambda _pid: set())
    return fake


@pytest.fixture
def mcp_env(monkeypatch, repo_fake):
    from app.config import settings

    monkeypatch.setattr(settings, "mcp_token_secret", "segredo-de-teste")
    monkeypatch.setattr(settings, "mcp_server_url", "https://mcp.exemplo.test")
    monkeypatch.setattr(settings, "frontend_url", "https://portal.exemplo.test")
    return repo_fake
