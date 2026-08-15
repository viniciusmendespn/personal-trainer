"""As regras de montagem de treino não podem divergir entre os dois caminhos.

`frontend/public/prompt-treino-aluno.md` é servido ao personal para o fluxo manual (baixar
o JSON, colar na LLM, reimportar). `app/mcp/prompts/montar_treino.md` é a mesma coisa
servida via MCP. A cópia existe porque o pacote da Lambda só leva `backend/` — mas o corpo
das regras (tudo depois do primeiro separador) tem que ser idêntico, senão a IA passa a
prescrever com regras diferentes dependendo do caminho.
"""
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
PROMPT_MCP = BACKEND / "app" / "mcp" / "prompts" / "montar_treino.md"
PROMPT_PORTAL = BACKEND.parent / "frontend" / "public" / "prompt-treino-aluno.md"


def _corpo(caminho: Path) -> str:
    return caminho.read_text(encoding="utf-8").split("\n---\n", 1)[1]


def test_regras_identicas_nos_dois_caminhos():
    assert _corpo(PROMPT_MCP) == _corpo(PROMPT_PORTAL), (
        "as regras divergiram — copie o corpo de frontend/public/prompt-treino-aluno.md "
        "para backend/app/mcp/prompts/montar_treino.md (só o cabeçalho difere)"
    )


def test_cabecalho_do_mcp_fala_de_tools():
    """O cabeçalho é o único trecho que muda: no MCP não há arquivo para anexar."""
    cabecalho = PROMPT_MCP.read_text(encoding="utf-8").split("\n---\n", 1)[0]
    assert "aplicar_programa_treino" in cabecalho
    assert "exportar_programa_treino" in cabecalho
