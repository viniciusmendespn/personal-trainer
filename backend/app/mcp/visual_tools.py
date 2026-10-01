"""Consulta visual (somente leitura) ao lado das 13 tools publicadas; nunca grava nem
altera contratos. Ações de escrita acontecem pela conversa, com as tools publicadas."""
import json

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.mcp import tools as legacy
from app.mcp import resumo_modelo, tokens, ui_resources
from app.services import carteira_visual_service, contexto_aluno_service, locale_service, programa_service, sessao_service


class CarteiraArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    busca: str | None = None
    status: str | None = None
    filtro: str | None = None
    limit: int = Field(50, ge=1, le=200)
    cursor: str | None = None


class AbrirArgs(CarteiraArgs):
    aluno_id: str | None = None


class AlunoArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    aluno_id: str


class Resumo(BaseModel):
    version: str = "1"
    tela: str
    aluno_id: str | None = None
    nome: str | None = None
    somente_leitura: bool = True
    propostas_disponiveis: bool = False
    aplicacao_disponivel: bool = False
    carteira_tool: str = "consultar_carteira_visual"


DEFINICOES = {
    "abrir_coachpilot": ("Abrir CoachPilot", AbrirArgs,
        "Abre a carteira ou a ficha de um aluno para consulta visual, sem alterar dados."),
    "mostrar_aluno": ("Abrir aluno", AlunoArgs,
        "Consulta programa, restrições informadas e evolução do aluno. A interface é somente leitura."),
    "consultar_carteira_visual": ("Consultar carteira visual", CarteiraArgs,
        "Consulta alunos com filtros, pendências e paginação para a carteira visual, sem alterar dados."),
}


def listar_tools(tenant):
    if not tenant.pode(tokens.SCOPE_READ) or not ui_resources.disponivel():
        return []
    out = []
    for nome, (titulo, args, descricao) in DEFINICOES.items():
        descriptor = {"name": nome, "title": titulo, "description": descricao,
            "inputSchema": args.model_json_schema(),
            "annotations": {"title": titulo, "readOnlyHint": True,
                "destructiveHint": False, "idempotentHint": True, "openWorldHint": False}}
        if nome != "consultar_carteira_visual":
            descriptor["outputSchema"] = Resumo.model_json_schema()
            descriptor["_meta"] = {"ui": {"resourceUri": ui_resources.URI,
                "visibility": ["model", "app"]}, "openai/widgetAccessible": True}
            if nome == "abrir_coachpilot":
                descriptor["_meta"]["openai/ui"] = {"entrypoints": [{"type": "global"}, {"type": "thread"}]}
        out.append(descriptor)
    return out


def _carteira(args, tenant):
    return carteira_visual_service.pagina(tenant.personal_id,
        **args.model_dump(exclude={"aluno_id"}))


def _aluno(aluno_id, tenant):
    legacy._guard(aluno_id)
    programa = programa_service.exportar(tenant.personal_id, aluno_id, com_contexto=False).model_dump(mode="json")
    for treino in programa["treinos"]:
        for exercicio in treino["exercicios"]:
            exercicio["chave_historico"] = sessao_service.chave_exercicio(exercicio["nome"])
    contexto = contexto_aluno_service.montar_contexto(tenant.personal_id, aluno_id,
        exercicios_programa=[e["nome"] for t in programa["treinos"] for e in t["exercicios"]],
        compacto=True).model_dump(mode="json")
    nome = contexto["perfil"].get("nome") or programa_service.aluno_nome(tenant.personal_id, aluno_id)
    return Resumo(tela="aluno", aluno_id=aluno_id, nome=nome), {
        "programa": programa, "contexto_aluno": contexto,
        "sessao_em_andamento": programa_service.sessao_em_andamento(aluno_id),
        "aviso_seguranca": legacy.AVISO_CONTEUDO_DE_TERCEIROS}


def chamar_tool(nome, argumentos, tenant):
    if nome not in DEFINICOES or not ui_resources.disponivel():
        return legacy._erro("consulta visual desabilitada nesta implantação")
    if not tenant.pode(tokens.SCOPE_READ):
        return legacy._erro("esta conexão não tem permissão de leitura")
    try:
        args = DEFINICOES[nome][1].model_validate(argumentos or {})
        if nome == "consultar_carteira_visual":
            dados = _carteira(args, tenant)
            return {"content": [{"type": "text", "text": json.dumps(dados, ensure_ascii=False)}],
                "structuredContent": dados}
        if getattr(args, "aluno_id", None):
            resumo, dados = _aluno(args.aluno_id, tenant)
        else:
            resumo, dados = Resumo(tela="carteira"), _carteira(args, tenant)
        texto = f"CoachPilot: {resumo.nome or 'carteira de alunos'}. Consulta visual somente leitura."
        if resumo.tela == "aluno":
            texto = resumo_modelo.ficha_aluno(resumo.nome, dados["contexto_aluno"], dados["programa"],
                hoje=locale_service.hoje(locale_service.tz_do_personal(tenant.personal_id))) + " Consulta visual somente leitura."
        if resumo.tela == "carteira":
            texto += " " + "; ".join(f"{a['nome']} (aluno_id={a['aluno_id']})" for a in dados["items"])
            if dados.get("next_cursor"):
                texto += " Busca parcial; continue com consultar_carteira_visual e o cursor disponibilizado."
        return {"content": [{"type": "text", "text": texto}],
            "structuredContent": resumo.model_dump(mode="json"), "_meta": {"coachpilot": dados}}
    except ValidationError as exc:
        return legacy._erro(f"argumentos inválidos: {exc.errors(include_url=False)[:5]}")
    except legacy.ToolErro as exc:
        return legacy._erro(str(exc))
    except HTTPException as exc:
        return legacy._erro(f"consulta recusada: {exc.detail}")
