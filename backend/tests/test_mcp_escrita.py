"""Escrita de treino pelo MCP: snapshot, desfazer, idempotência e auditoria.

`aplicar_programa_treino` substitui o programa inteiro — é destrutivo por natureza. Como o
LLM costuma repetir chamadas e pode devolver um programa incompleto, as salvaguardas
importam tanto quanto a escrita em si.
"""
import pytest

from app.mcp import tools as mcp_tools
from app.mcp.tokens import SCOPE_READ, SCOPE_TREINOS_WRITE, Tenant, usando_tenant
from app.repositories import keys

PERSONAL = "personal-1"
ALUNO = "aluno-1"
TENANT = Tenant(personal_id=PERSONAL, conn_id="c1",
                scopes=frozenset({SCOPE_READ, SCOPE_TREINOS_WRITE}),
                client_name="Claude", jti="j1")

PROGRAMA_NOVO = {
    "version": "1",
    "treinos": [{"nome": "Treino B — Superiores", "foco": "Peito", "exercicios": [
        {"nome": "Supino reto", "series_prescritas": [{"series": 3, "reps": "10"}]},
    ]}],
}


@pytest.fixture
def carteira(mcp_env, monkeypatch):
    repo = mcp_env
    repo.put_item(keys.pk_personal(PERSONAL), keys.sk_aluno_pointer(ALUNO),
                  {"aluno_id": ALUNO, "nome": "Marina", "status": "ATIVO"})
    repo.put_item(keys.pk_aluno(ALUNO), keys.sk_treino("t1"),
                  {"treino_id": "t1", "aluno_id": ALUNO, "nome": "Treino A", "ordem": 0,
                   "ativo": True})
    repo.put_item(keys.pk_aluno(ALUNO), keys.sk_exercicio("t1", "e1"),
                  {"exercicio_id": "e1", "treino_id": "t1", "aluno_id": ALUNO,
                   "nome": "Agachamento", "ordem": 0})
    # push real bateria em rede; a notificação em si é verificada pelo item gravado.
    monkeypatch.setattr(mcp_tools.notif_service, "_disparar_push_personal",
                        lambda *a, **k: None)
    return repo


def _chamar(nome, args):
    with usando_tenant(TENANT):
        return mcp_tools.chamar_tool(nome, args, TENANT)


def test_aplicar_substitui_o_programa_inteiro(carteira):
    r = _chamar("aplicar_programa_treino",
                {"aluno_id": ALUNO, "programa": PROGRAMA_NOVO,
                 "resumo_da_mudanca": "trocou o foco para superiores"})
    assert r["structuredContent"]["status"] == "aplicado"

    treinos = carteira.query_pk(keys.pk_aluno(ALUNO), keys.SK_TREINO_PREFIX)
    assert [t["nome"] for t in treinos] == ["Treino B — Superiores"]
    # O treino antigo e seus exercícios saíram junto.
    assert carteira.get_item(keys.pk_aluno(ALUNO), keys.sk_treino("t1")) is None
    assert carteira.get_item(keys.pk_aluno(ALUNO), keys.sk_exercicio("t1", "e1")) is None


def test_desfazer_restaura_o_programa_anterior(carteira):
    _chamar("aplicar_programa_treino",
            {"aluno_id": ALUNO, "programa": PROGRAMA_NOVO, "resumo_da_mudanca": "mudou"})
    r = _chamar("desfazer_alteracao_treino", {"aluno_id": ALUNO})

    assert r["structuredContent"]["status"] == "restaurado"
    treinos = carteira.query_pk(keys.pk_aluno(ALUNO), keys.SK_TREINO_PREFIX)
    assert [t["nome"] for t in treinos] == ["Treino A"]
    exercicios = carteira.query_pk(keys.pk_aluno(ALUNO), "EX#")
    assert [e["nome"] for e in exercicios] == ["Agachamento"]


def test_desfazer_sem_alteracao_recente_avisa(carteira):
    r = _chamar("desfazer_alteracao_treino", {"aluno_id": ALUNO})
    assert r["isError"] is True
    assert "desfazer" in r["content"][0]["text"]


def test_chamada_repetida_nao_reescreve(carteira):
    args = {"aluno_id": ALUNO, "programa": PROGRAMA_NOVO, "resumo_da_mudanca": "mudou"}
    _chamar("aplicar_programa_treino", args)
    r = _chamar("aplicar_programa_treino", args)
    assert r["structuredContent"]["status"] == "ja_aplicado"
    # Só existe um snapshot: a segunda chamada não chegou a apagar nada.
    assert len(carteira.query_pk(keys.pk_aluno(ALUNO), keys.MCP_SNAP_PREFIX)) == 1


def test_programa_vazio_e_recusado(carteira):
    """Um programa sem treinos apagaria tudo — é erro de geração, não intenção."""
    r = _chamar("aplicar_programa_treino",
                {"aluno_id": ALUNO, "programa": {"version": "1", "treinos": []},
                 "resumo_da_mudanca": "limpar"})
    assert r["isError"] is True
    assert carteira.query_pk(keys.pk_aluno(ALUNO), keys.SK_TREINO_PREFIX)


def test_programa_malformado_devolve_erro_corrigivel(carteira):
    r = _chamar("aplicar_programa_treino",
                {"aluno_id": ALUNO, "programa": {"treinos": "isso não é uma lista"},
                 "resumo_da_mudanca": "x"})
    assert r["isError"] is True
    assert "formato esperado" in r["content"][0]["text"]


def test_escrita_gera_auditoria_e_notificacao(carteira):
    _chamar("aplicar_programa_treino",
            {"aluno_id": ALUNO, "programa": PROGRAMA_NOVO,
             "resumo_da_mudanca": "aumentou volume de peito"})

    auditoria = carteira.query_pk(keys.pk_personal(PERSONAL), keys.MCP_AUDIT_PREFIX)
    assert len(auditoria) == 1
    assert auditoria[0]["client_name"] == "Claude"
    assert auditoria[0]["resumo"] == "aumentou volume de peito"
    assert auditoria[0]["alvo"] == ALUNO

    notificacoes = carteira.query_pk(keys.pk_personal(PERSONAL), keys.NOTIF_PREFIX)
    assert notificacoes[0]["tipo"] == "MCP_ESCRITA"
    assert "Marina" in notificacoes[0]["titulo"]


def _abrir_sessao(repo):
    repo.put_item(keys.pk_aluno(ALUNO), keys.SK_SESSION_ACTIVE, {
        "sessao_id": "s-1", "aluno_id": ALUNO, "personal_id": PERSONAL, "treino_id": "t1",
        "treino_nome": "Treino A", "status": "EM_ANDAMENTO",
        "data_hora_inicio": "2026-08-23T19:28:46+00:00",
    })


def test_aluno_treinando_agora_volta_para_o_personal_decidir(carteira):
    """Espelho do 409 do portal: o LLM não decide sozinho apagar o treino em execução."""
    _abrir_sessao(carteira)

    r = _chamar("aplicar_programa_treino",
                {"aluno_id": ALUNO, "programa": PROGRAMA_NOVO,
                 "resumo_da_mudanca": "deload"})

    assert r["isError"] is True
    texto = r["content"][0]["text"]
    assert "Treino A" in texto and "confirmar_sessao_em_andamento" in texto
    # Nada foi gravado — e a assinatura de idempotência não foi queimada.
    assert [t["nome"] for t in carteira.query_pk(keys.pk_aluno(ALUNO), keys.SK_TREINO_PREFIX)] \
        == ["Treino A"]


def test_confirmado_pelo_personal_aplica(carteira):
    _abrir_sessao(carteira)

    r = _chamar("aplicar_programa_treino",
                {"aluno_id": ALUNO, "programa": PROGRAMA_NOVO,
                 "resumo_da_mudanca": "deload", "confirmar_sessao_em_andamento": True})

    assert r["structuredContent"]["status"] == "aplicado"
    assert [t["nome"] for t in carteira.query_pk(keys.pk_aluno(ALUNO), keys.SK_TREINO_PREFIX)] \
        == ["Treino B — Superiores"]


def test_atualizar_treino_altera_so_o_campo_pedido(carteira):
    r = _chamar("atualizar_treino",
                {"aluno_id": ALUNO, "treino_id": "t1", "foco": "Posterior"})
    assert r["structuredContent"]["status"] == "atualizado"
    treino = carteira.get_item(keys.pk_aluno(ALUNO), keys.sk_treino("t1"))
    assert treino["foco"] == "Posterior"
    assert treino["nome"] == "Treino A"       # intacto


def test_atualizar_treino_inexistente_orienta_o_llm(carteira):
    r = _chamar("atualizar_treino",
                {"aluno_id": ALUNO, "treino_id": "nao-existe", "foco": "X"})
    assert r["isError"] is True
    assert "exportar_programa_treino" in r["content"][0]["text"]


def test_conteudo_de_aluno_vem_marcado_como_dado(carteira):
    """Anamnese e relatos são texto de terceiro; o LLM precisa ser avisado de que aquilo
    é dado, não instrução — é a mitigação de prompt injection no nível da resposta."""
    r = _chamar("exportar_programa_treino", {"aluno_id": ALUNO, "incluir_contexto": True})
    assert "não instruções" in r["structuredContent"]["aviso_seguranca"]
