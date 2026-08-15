"""A validação no caminho do MCP: conferir de graça, bloquear o que estraga, avisar o resto.

O que importa aqui, mais que a mensagem: um programa recusado não pode deixar rastro nenhum —
nem snapshot, nem chave de idempotência, nem meia gravação.
"""
import pytest

from app.mcp import tools as mcp_tools
from app.mcp.tokens import SCOPE_READ, SCOPE_TREINOS_WRITE, Tenant, usando_tenant
from app.repositories import keys

PERSONAL = "personal-1"
ALUNO = "aluno-1"
TENANT = Tenant(personal_id=PERSONAL, conn_id="c1",
                scopes=frozenset({SCOPE_READ, SCOPE_TREINOS_WRITE}),
                client_name="ChatGPT", jti="j1")

BOM = {"version": "1", "treinos": [{"nome": "Treino A", "exercicios": [
    {"nome": "Supino reto", "series_prescritas": [{"series": 3, "reps": "8-12"}]}]}]}

# `bloco_id` que não existe: aplicado assim, o vínculo some em silêncio e o exercício sai do bloco.
COM_ERRO = {"version": "1", "treinos": [{"nome": "Treino C", "blocos": [], "exercicios": [
    {"nome": "Wall Ball", "bloco_id": "c",
     "series_prescritas": [{"series": 1, "reps": "12"}]}]}]}


@pytest.fixture
def carteira(mcp_env, monkeypatch):
    repo = mcp_env
    repo.put_item(keys.pk_personal(PERSONAL), keys.sk_aluno_pointer(ALUNO),
                  {"aluno_id": ALUNO, "nome": "Marina", "status": "ATIVO"})
    repo.put_item(keys.pk_aluno(ALUNO), keys.sk_treino("t1"),
                  {"treino_id": "t1", "aluno_id": ALUNO, "nome": "Treino Original",
                   "ordem": 0, "ativo": True})
    repo.put_item(keys.pk_personal(PERSONAL), keys.sk_exlib("e1"),
                  {"nome": "Agachamento livre", "grupo": "Pernas",
                   "video_url": "https://youtu.be/DA-BIBLIOTECA"})
    monkeypatch.setattr(mcp_tools.notif_service, "_disparar_push_personal", lambda *a, **k: None)
    return repo


def _chamar(nome, args):
    with usando_tenant(TENANT):
        return mcp_tools.chamar_tool(nome, args, TENANT)


# ── a tool de validação ──────────────────────────────────────────────────────

def test_validar_programa_bom_libera_a_aplicacao(carteira):
    r = _chamar("validar_programa_treino", {"aluno_id": ALUNO, "programa": BOM})
    saida = r["structuredContent"]
    assert saida["ok"] is True
    assert saida["contagem"] == {"treinos": 1, "exercicios": 1, "erros": 0, "avisos": 0}
    assert "aplicar_programa_treino" in saida["proximo_passo"]


def test_validar_aponta_o_campo_e_a_correcao(carteira):
    r = _chamar("validar_programa_treino", {"aluno_id": ALUNO, "programa": COM_ERRO})
    saida = r["structuredContent"]
    assert saida["ok"] is False
    erro = saida["erros"][0]
    assert erro["codigo"] == "BLOCO_ID_ORFAO"
    assert erro["campo"] == "treinos[0].exercicios[0].bloco_id"
    assert erro["correcao"]


def test_validar_nao_escreve_nada(carteira):
    """É a promessa da tool: dry-run de verdade."""
    _chamar("validar_programa_treino", {"aluno_id": ALUNO, "programa": COM_ERRO})
    _chamar("validar_programa_treino", {"aluno_id": ALUNO, "programa": BOM})

    treinos = carteira.query_pk(keys.pk_aluno(ALUNO), keys.SK_TREINO_PREFIX)
    assert [t["nome"] for t in treinos] == ["Treino Original"]
    assert carteira.query_pk(keys.pk_aluno(ALUNO), keys.MCP_SNAP_PREFIX) == []
    assert carteira.query_pk(keys.pk_personal(PERSONAL), keys.MCP_AUDIT_PREFIX) == []


def test_validar_erro_de_formato_nao_estoura(carteira):
    r = _chamar("validar_programa_treino",
                {"aluno_id": ALUNO, "programa": {"treinos": "isso não é uma lista"}})
    saida = r["structuredContent"]
    assert saida["ok"] is False
    assert "treinos" in saida["erros_de_formato"]


def test_conexao_so_leitura_pode_validar(carteira):
    """Serve para propor um programa que o personal cola no portal."""
    so_leitura = Tenant(personal_id=PERSONAL, conn_id="c1", scopes=frozenset({SCOPE_READ}),
                        client_name="ChatGPT", jti="j1")
    anunciadas = {t["name"] for t in mcp_tools.listar_tools(so_leitura)}
    assert "validar_programa_treino" in anunciadas
    assert "guia_de_prescricao" in anunciadas
    assert "aplicar_programa_treino" not in anunciadas


# ── o bloqueio na escrita ────────────────────────────────────────────────────

def test_aplicar_recusa_erro_semantico_sem_gravar(carteira):
    r = _chamar("aplicar_programa_treino",
                {"aluno_id": ALUNO, "programa": COM_ERRO, "resumo_da_mudanca": "metcon"})
    assert r["isError"] is True
    texto = r["content"][0]["text"]
    assert "nada foi gravado" in texto
    assert "BLOCO_ID_ORFAO" in texto

    treinos = carteira.query_pk(keys.pk_aluno(ALUNO), keys.SK_TREINO_PREFIX)
    assert [t["nome"] for t in treinos] == ["Treino Original"]
    assert carteira.query_pk(keys.pk_aluno(ALUNO), keys.MCP_SNAP_PREFIX) == []


def test_recusa_nao_queima_a_chave_de_idempotencia(carteira):
    """A validação roda ANTES da idempotência de propósito. Se rodasse depois, a tentativa
    recusada gravaria a assinatura e o retry corrigido em menos de 60 s responderia
    'ja_aplicado' — dizendo que gravou sem ter gravado nada."""
    ruim = _chamar("aplicar_programa_treino",
                   {"aluno_id": ALUNO, "programa": COM_ERRO, "resumo_da_mudanca": "x"})
    assert ruim["isError"] is True

    corrigido = dict(COM_ERRO)
    corrigido["treinos"] = [{"nome": "Treino C", "blocos": [], "exercicios": [
        {"nome": "Wall Ball", "bloco_id": None,
         "series_prescritas": [{"series": 1, "reps": "12"}]}]}]
    r = _chamar("aplicar_programa_treino",
                {"aluno_id": ALUNO, "programa": corrigido, "resumo_da_mudanca": "x"})
    assert r["structuredContent"]["status"] == "aplicado"


def test_erro_de_formato_mantem_a_mensagem_de_sempre(carteira):
    """Contrato herdado de test_mcp_escrita: o branch do Pydantic continua dizendo
    'formato esperado', separado do branch semântico."""
    r = _chamar("aplicar_programa_treino",
                {"aluno_id": ALUNO, "programa": {"treinos": "não é lista"},
                 "resumo_da_mudanca": "x"})
    assert r["isError"] is True
    assert "formato esperado" in r["content"][0]["text"]


def test_aplicar_grava_e_devolve_avisos(carteira):
    """Aviso não bloqueia: o programa entra e o LLM conta o que houve ao personal."""
    programa = {"version": "1", "treinos": [{"nome": "Treino A", "exercicios": [
        {"nome": "Agachamento livre", "video_url": "https://youtu.be/OUTRO",
         "series_prescritas": [{"series": 3, "reps": "8-12"}]}]}]}
    r = _chamar("aplicar_programa_treino",
                {"aluno_id": ALUNO, "programa": programa, "resumo_da_mudanca": "trocou"})
    saida = r["structuredContent"]
    assert saida["status"] == "aplicado"
    assert "VIDEO_DIVERGE_BIBLIOTECA" in {a["codigo"] for a in saida["avisos"]}


def test_video_da_biblioteca_prevalece_de_fato(carteira):
    """O aviso diz que o vídeo do payload é descartado — este teste prova que é verdade."""
    programa = {"version": "1", "treinos": [{"nome": "Treino A", "exercicios": [
        {"nome": "Agachamento livre", "video_url": "https://youtu.be/OUTRO",
         "series_prescritas": [{"series": 3, "reps": "8-12"}]}]}]}
    _chamar("aplicar_programa_treino",
            {"aluno_id": ALUNO, "programa": programa, "resumo_da_mudanca": "x"})
    exercicios = carteira.query_pk(keys.pk_aluno(ALUNO), "EX#")
    assert exercicios[0]["video_url"] == "https://youtu.be/DA-BIBLIOTECA"


# ── o guia ───────────────────────────────────────────────────────────────────

def test_guia_traz_a_biblioteca_do_personal_renderizada(carteira):
    r = _chamar("guia_de_prescricao", {})
    texto = r["content"][0]["text"]
    assert "{{BIBLIOTECA}}" not in texto and "{{ENTREGA}}" not in texto
    assert "Agachamento livre → https://youtu.be/DA-BIBLIOTECA" in texto


def test_guia_nao_duplica_o_payload(carteira):
    """Devolve `str`: um dict viraria JSON no content E seria repetido em structuredContent,
    dobrando o custo de 20 KB de markdown."""
    r = _chamar("guia_de_prescricao", {})
    assert "structuredContent" not in r


def test_guia_manda_aplicar_pela_tool_e_nao_copiar_e_colar(carteira):
    texto = _chamar("guia_de_prescricao", {})["content"][0]["text"]
    assert "aplicar_programa_treino" in texto
    assert "copia da tela" not in texto


def test_guia_so_leitura_volta_a_mandar_copiar_e_colar(carteira):
    """Numa conexão sem escrita, mandar chamar `aplicar_programa_treino` seria apontar para
    uma tool que aquele `tools/list` nem anuncia."""
    so_leitura = Tenant(personal_id=PERSONAL, conn_id="c1", scopes=frozenset({SCOPE_READ}),
                        client_name="ChatGPT", jti="j1")
    with usando_tenant(so_leitura):
        texto = mcp_tools.chamar_tool("guia_de_prescricao", {}, so_leitura)["content"][0]["text"]
    assert "copia da tela" in texto


def test_guia_ensina_o_que_registrar_e_os_blocos(carteira):
    """Trava a regressão de fatiar: era exatamente este conteúdo que faltava ao LLM."""
    texto = _chamar("guia_de_prescricao", {})["content"][0]["text"]
    assert "unidade_reps" in texto and "metrica_direcao" in texto
    assert "Registre" in texto
    assert "AMRAP" in texto and "EMOM" in texto


def test_prompt_e_tool_servem_o_mesmo_texto(carteira):
    with usando_tenant(TENANT):
        do_prompt = mcp_tools.obter_prompt("montar_treino")["messages"][0]["content"]["text"]
    assert do_prompt == _chamar("guia_de_prescricao", {})["content"][0]["text"]


def test_biblioteca_nao_apresenta_busca_do_youtube_como_video(carteira):
    """URL de busca passando por vídeo faz o LLM concluir que a biblioteca não tem vídeos e
    sair usando os dele — o oposto da regra de ouro nº 1."""
    carteira.put_item(keys.pk_personal(PERSONAL), keys.sk_exlib("e2"),
                      {"nome": "Remada curvada",
                       "video_url": "https://www.youtube.com/results?search_query=remada"})
    carteira.put_item(keys.pk_personal(PERSONAL), keys.sk_exlib("e3"),
                      {"nome": "Exercício oculto", "ativo": False,
                       "video_url": "https://youtu.be/X"})
    itens = _chamar("listar_biblioteca_exercicios", {})["structuredContent"]["items"]
    por_nome = {i["nome"]: i for i in itens}
    assert por_nome["Remada curvada"]["video_url"] is None
    assert "Exercício oculto" not in por_nome
