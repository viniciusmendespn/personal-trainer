"""Forma única do erro de import por IA — a mesma para treino do aluno e para pacote.

O personal não escreve o JSON: uma LLM escreve. Então a mensagem de erro tem **dois leitores**,
e o segundo é uma máquina. Daí o `relatorio_ia`: um texto pronto para o personal colar de volta
na conversa, montado aqui e não no frontend, para os dois canais (portal e MCP) dizerem a mesma
coisa sobre o mesmo JSON.

Contrato do corpo de erro (dentro do `detail` do FastAPI):

    {"code": "PRESCRICAO_INVALIDA",
     "mensagem": "Encontrei 3 problemas no JSON. Nada foi alterado.",
     "problemas": [{codigo, campo, onde, mensagem, correcao}, ...],
     "total": 3,
     "relatorio_ia": "..."}

`code` continua sendo o que o frontend usa para decidir o texto de topo — os valores antigos
(`ARQUIVO_INVALIDO`, `ESTRUTURA_INVALIDA`) foram preservados porque já estão mapeados lá.
"""
from fastapi import HTTPException

from app.services import validacao_programa as vp
from app.services.validacao_programa import Achado

ARQUIVO_INVALIDO = "ARQUIVO_INVALIDO"          # não é JSON
ESTRUTURA_INVALIDA = "ESTRUTURA_INVALIDA"      # é JSON, mas não bate com o formato (Pydantic)
PRESCRICAO_INVALIDA = "PRESCRICAO_INVALIDA"    # formato ok, conteúdo errado (semântico)
PROGRAMA_VAZIO = "PROGRAMA_VAZIO"

_PREAMBULO = (
    "O CoachPilot recusou o JSON que você gerou e não alterou nada. "
    "Corrija exatamente os pontos abaixo e devolva o JSON COMPLETO novamente "
    "(todos os treinos, inclusive os que não mudaram)."
)

_PREAMBULO_AVISO = (
    "O CoachPilot aceitou o JSON, mas apontou o seguinte. "
    "Se fizer sentido, corrija e devolva o JSON COMPLETO novamente."
)


def relatorio_para_ia(erros: list[Achado], avisos: list[Achado] | None = None) -> str:
    """O texto que o personal cola na IA. Cabeçalho + achados no formato de `texto_dos_achados`,
    que é o mesmo que o MCP entrega ao LLM."""
    blocos = [_PREAMBULO if erros else _PREAMBULO_AVISO]
    if erros:
        blocos.append("PROBLEMAS QUE IMPEDEM A IMPORTAÇÃO:\n" + vp.texto_dos_achados(erros))
    if avisos:
        blocos.append("AVISOS (não impedem, mas confira):\n" + vp.texto_dos_achados(avisos))
    return "\n\n".join(blocos)


def _mensagem(code: str, total: int) -> str:
    if code == ARQUIVO_INVALIDO:
        return ("O conteúdo colado não é um JSON válido. Copie só o bloco JSON que a IA gerou, "
                "sem texto em volta.")
    if code == PROGRAMA_VAZIO:
        return ("O JSON não trouxe nenhum treino. Nada foi alterado — para apagar o programa do "
                "aluno, remova os treinos pela tela.")
    problema = "problema" if total == 1 else "problemas"
    return f"Encontrei {total} {problema} no JSON gerado pela IA. Nada foi alterado."


def erro(code: str, erros: list[Achado], *, avisos: list[Achado] | None = None) -> HTTPException:
    """400 com a lista de problemas e o relatório colável."""
    return HTTPException(400, detail={
        "code": code,
        "mensagem": _mensagem(code, len(erros)),
        "problemas": vp.achados_json(erros),
        "total": len(erros),
        "relatorio_ia": relatorio_para_ia(erros, avisos),
    })


def erro_de_json(exc: Exception) -> HTTPException:
    """JSON malformado. `exc` de `json.loads` já diz linha e coluna — é a dica mais útil aqui."""
    return erro(ARQUIVO_INVALIDO, [Achado(
        "JSON_MALFORMADO", "(arquivo)", "conteúdo colado",
        f"o texto não é um JSON válido: {exc}.",
        "cole apenas o bloco JSON, começando em { e terminando em } — sem a cerca ```json "
        "e sem comentários ou texto explicativo.")])


def erro_de_formato(exc) -> HTTPException:
    """`ValidationError` do Pydantic: é JSON, mas o tipo de algum campo não bate."""
    return erro(ESTRUTURA_INVALIDA, vp.achados_de_pydantic(exc))


def erro_programa_vazio() -> HTTPException:
    return erro(PROGRAMA_VAZIO, [Achado(
        "PROGRAMA_VAZIO", "treinos", "programa",
        "o programa veio sem nenhum treino, e importar assim apagaria todo o treino do aluno.",
        'devolva o programa COMPLETO em "treinos": [...], inclusive os treinos que não mudaram.')])
