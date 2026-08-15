"""Isolamento de tenant no servidor MCP — o teste que mais importa aqui.

Os argumentos de uma tool são preenchidos pelo LLM, e o LLM lê conteúdo escrito por
terceiros (mensagem de aluno, anamnese, descrição de pacote da loja). Um `aluno_id`
chegando bem formado não é prova de nada: precisa ser conferido contra o personal do token
em toda tool, sempre. Estes testes garantem que o personal A nunca enxerga nem escreve
dado do personal B.
"""
import pytest

from app.mcp import tools as mcp_tools
from app.mcp.tokens import SCOPE_READ, SCOPE_TREINOS_WRITE, Tenant, usando_tenant
from app.repositories import keys

TODOS = frozenset({SCOPE_READ, SCOPE_TREINOS_WRITE})

PERSONAL_A = "personal-a"
PERSONAL_B = "personal-b"
ALUNO_DE_A = "aluno-do-a"
ALUNO_DE_B = "aluno-do-b"


def _tenant(personal_id, scopes=TODOS):
    return Tenant(personal_id=personal_id, conn_id="c1", scopes=scopes,
                  client_name="Claude", jti="j1")


@pytest.fixture
def carteiras(mcp_env):
    """Dois personais, um aluno cada, com um treino no aluno do A."""
    repo = mcp_env
    repo.put_item(keys.pk_personal(PERSONAL_A), keys.sk_aluno_pointer(ALUNO_DE_A),
                  {"aluno_id": ALUNO_DE_A, "nome": "Marina", "status": "ATIVO"})
    repo.put_item(keys.pk_personal(PERSONAL_B), keys.sk_aluno_pointer(ALUNO_DE_B),
                  {"aluno_id": ALUNO_DE_B, "nome": "Rafael", "status": "ATIVO"})
    repo.put_item(keys.pk_aluno(ALUNO_DE_A), keys.sk_treino("t1"),
                  {"treino_id": "t1", "aluno_id": ALUNO_DE_A, "nome": "Treino A", "ordem": 0})
    repo.put_item(keys.pk_personal(PERSONAL_A), keys.sk_exlib("e1"),
                  {"nome": "Agachamento", "video_url": "https://video.a"})
    repo.put_item(keys.pk_personal(PERSONAL_B), keys.sk_exlib("e2"),
                  {"nome": "Supino", "video_url": "https://video.b"})
    return repo


# ── tools com aluno_id: nenhuma aceita aluno de outro personal ──────────────

CHAMADAS_COM_ALUNO = [
    ("detalhar_aluno", {"aluno_id": ALUNO_DE_A}),
    ("exportar_programa_treino", {"aluno_id": ALUNO_DE_A}),
    ("historico_sessoes", {"aluno_id": ALUNO_DE_A}),
    ("evolucao_exercicio", {"aluno_id": ALUNO_DE_A, "chave": "agachamento"}),
    ("atualizar_treino", {"aluno_id": ALUNO_DE_A, "treino_id": "t1", "nome": "Invadido"}),
    ("desfazer_alteracao_treino", {"aluno_id": ALUNO_DE_A}),
    ("aplicar_programa_treino", {"aluno_id": ALUNO_DE_A, "resumo_da_mudanca": "x",
                                 "programa": {"version": "1", "treinos": [
                                     {"nome": "T", "exercicios": []}]}}),
]


@pytest.mark.parametrize("nome,args", CHAMADAS_COM_ALUNO)
def test_personal_b_nao_alcanca_aluno_de_a(carteiras, nome, args):
    with usando_tenant(_tenant(PERSONAL_B)):
        resposta = mcp_tools.chamar_tool(nome, args, _tenant(PERSONAL_B))
    assert resposta.get("isError") is True
    assert "não encontrado" in resposta["content"][0]["text"]


def test_escrita_cross_tenant_nao_altera_nada(carteiras):
    """Não basta responder erro: o dado do outro personal tem que ficar intacto."""
    antes = dict(carteiras.get_item(keys.pk_aluno(ALUNO_DE_A), keys.sk_treino("t1")))
    with usando_tenant(_tenant(PERSONAL_B)):
        mcp_tools.chamar_tool("atualizar_treino",
                              {"aluno_id": ALUNO_DE_A, "treino_id": "t1", "nome": "Invadido"},
                              _tenant(PERSONAL_B))
    assert carteiras.get_item(keys.pk_aluno(ALUNO_DE_A), keys.sk_treino("t1")) == antes


def test_dono_alcanca_o_proprio_aluno(carteiras):
    with usando_tenant(_tenant(PERSONAL_A)):
        resposta = mcp_tools.chamar_tool("exportar_programa_treino",
                                         {"aluno_id": ALUNO_DE_A, "incluir_contexto": False},
                                         _tenant(PERSONAL_A))
    assert not resposta.get("isError")
    assert resposta["structuredContent"]["treinos"][0]["nome"] == "Treino A"


# ── tools sem aluno_id: só enxergam a própria partição ───────────────────────

def test_listar_alunos_so_traz_a_propria_carteira(carteiras):
    with usando_tenant(_tenant(PERSONAL_A)):
        r = mcp_tools.chamar_tool("listar_alunos", {}, _tenant(PERSONAL_A))
    nomes = [a["nome"] for a in r["structuredContent"]["items"]]
    assert nomes == ["Marina"]


def test_biblioteca_so_traz_os_proprios_exercicios(carteiras):
    with usando_tenant(_tenant(PERSONAL_B)):
        r = mcp_tools.chamar_tool("listar_biblioteca_exercicios", {}, _tenant(PERSONAL_B))
    assert [e["nome"] for e in r["structuredContent"]["items"]] == ["Supino"]


def test_resumo_carteira_nao_conta_alunos_alheios(carteiras):
    with usando_tenant(_tenant(PERSONAL_A)):
        r = mcp_tools.chamar_tool("resumo_carteira", {}, _tenant(PERSONAL_A))
    assert r["structuredContent"]["total_alunos"] == 1


def test_agenda_so_traz_a_propria_agenda(carteiras):
    carteiras.put_item(keys.pk_personal(PERSONAL_B),
                       keys.sk_agenda("2026-08-20T10:00", "ag1"), {"titulo": "Aula do B"})
    with usando_tenant(_tenant(PERSONAL_A)):
        r = mcp_tools.chamar_tool("agenda_periodo",
                                  {"data_inicio": "2026-08-01", "data_fim": "2026-08-31"},
                                  _tenant(PERSONAL_A))
    assert r["structuredContent"]["items"] == []


# ── escopos ─────────────────────────────────────────────────────────────────

def test_conexao_so_leitura_nao_escreve(carteiras):
    somente_leitura = _tenant(PERSONAL_A, frozenset({SCOPE_READ}))
    with usando_tenant(somente_leitura):
        r = mcp_tools.chamar_tool("atualizar_treino",
                                  {"aluno_id": ALUNO_DE_A, "treino_id": "t1", "nome": "X"},
                                  somente_leitura)
    assert r["isError"] is True
    assert "permissão" in r["content"][0]["text"]
    assert carteiras.get_item(keys.pk_aluno(ALUNO_DE_A),
                              keys.sk_treino("t1"))["nome"] == "Treino A"


def test_conexao_so_leitura_nem_ve_as_tools_de_escrita(carteiras):
    anunciadas = {t["name"] for t in
                  mcp_tools.listar_tools(_tenant(PERSONAL_A, frozenset({SCOPE_READ})))}
    assert "aplicar_programa_treino" not in anunciadas
    assert "listar_alunos" in anunciadas


def test_tool_sem_contexto_de_tenant_estoura(mcp_env):
    """Rede de segurança: executar uma tool fora do contexto tem que quebrar, nunca
    silenciosamente usar um tenant vazio."""
    with pytest.raises(RuntimeError):
        mcp_tools.listar_alunos(mcp_tools.ListarAlunosArgs())
