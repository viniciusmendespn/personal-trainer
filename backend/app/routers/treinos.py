"""CRUD de treinos e exercícios, aninhados sob o aluno (ESPEC §2). Tudo na partição
AL#{aluno}. `ordem` é atributo (ordenação em app); SK por id facilita o CRUD."""
import json

from fastapi import APIRouter, Depends, HTTPException

from pydantic import BaseModel, ValidationError

from app.dependencies import get_current_personal_id
from app.models.exercicio import Exercicio, ExercicioCreate
from app.models.treino import Treino, TreinoCreate
from app.models.treino_export import (
    ImportarProgramaResponse,
    ProgramaTreinoExportFile,
    ProgramaTreinoFile,
)
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import (
    authz,
    biblioteca_service,
    import_erros,
    programa_service,
    validacao_programa,
)
from app.services.sessao_service import chave_exercicio, list_exercicios_aluno, upsert_excat
from app.utils import new_id, now_iso

router = APIRouter(prefix="/v1/alunos/{aluno_id}/treinos", tags=["treinos"])


class CopiarBody(BaseModel):
    from_aluno_id: str
    treino_id: str


class ImportarProgramaRequest(BaseModel):
    conteudo: str


# Helpers compartilhados com o servidor MCP — definição única em programa_service.
_upsert_excat_lote = programa_service.upsert_excat_lote
_sync_due = programa_service.sync_due
_touch_aluno_pointer = programa_service.touch_aluno_pointer


def _guard(personal_id: str, aluno_id: str) -> None:
    authz.authorize_aluno(personal_id, aluno_id)


@router.get("/exportar", response_model=ProgramaTreinoExportFile)
def exportar_programa(aluno_id: str, personal_id: str = Depends(get_current_personal_id)):
    """Programa completo do aluno (treinos + exercícios) + `contexto_aluno` (perfil, histórico,
    dores, avaliações…) no formato editável por IA. O personal baixa, pede ajustes a uma LLM
    e reimporta em /importar (substituição total — o contexto é ignorado na volta)."""
    return programa_service.exportar(personal_id, aluno_id)


def _validar_conteudo(personal_id: str, conteudo: str):
    """Parse + Pydantic + checagens semânticas, na ordem em que o personal consegue corrigir.

    Levanta 400 com a lista de problemas e o relatório colável na IA (`import_erros`). As
    mesmas checagens do MCP (`validar_programa_treino`): quem cola o JSON na tela não tem
    por que receber uma validação pior do que quem conecta o ChatGPT.
    """
    try:
        data = json.loads(conteudo)
    except (json.JSONDecodeError, TypeError) as exc:
        raise import_erros.erro_de_json(exc)
    if not isinstance(data, dict):
        raise import_erros.erro_de_json(
            TypeError(f"esperava um objeto JSON na raiz, recebi {type(data).__name__}"))
    try:
        # extra='ignore' (default Pydantic): `contexto_aluno` presente no JSON colado
        # (arquivo do export colado de volta sem edição) é descartado sem erro.
        programa = ProgramaTreinoFile(**data)
    except ValidationError as exc:
        raise import_erros.erro_de_formato(exc)
    if not programa.treinos:
        raise import_erros.erro_programa_vazio()

    ctx = validacao_programa.carregar_contexto(personal_id)
    erros, avisos = validacao_programa.validar(programa, ctx, bruto=data)
    if erros:
        raise import_erros.erro(import_erros.PRESCRICAO_INVALIDA, erros, avisos=avisos)
    return programa, avisos


@router.post("/importar", response_model=ImportarProgramaResponse, status_code=201)
def importar_programa(aluno_id: str, body: ImportarProgramaRequest,
                      personal_id: str = Depends(get_current_personal_id)):
    """Substituição TOTAL: o JSON vira o programa do aluno. Apaga treinos/exercícios atuais
    (e a agenda de vencimento) e recria a partir do arquivo. Histórico de sessões é preservado
    (vive em SK próprios). Erro bloqueia; aviso volta junto do 201."""
    _guard(personal_id, aluno_id)
    programa, avisos = _validar_conteudo(personal_id, body.conteudo)
    resultado = programa_service.aplicar(personal_id, aluno_id, programa)
    resultado.avisos = validacao_programa.achados_json(avisos)
    resultado.relatorio_ia = (import_erros.relatorio_para_ia([], avisos) if avisos else None)
    return resultado


@router.post("/validar", status_code=200)
def validar_programa(aluno_id: str, body: ImportarProgramaRequest,
                     personal_id: str = Depends(get_current_personal_id)):
    """Confere o JSON SEM gravar nada — o "conferir antes de sobrescrever" da tela, e o
    espelho da tool `validar_programa_treino` do MCP. Erro de conteúdo sai como 400 igual ao
    do import, para a tela ter um caminho só de renderização."""
    _guard(personal_id, aluno_id)
    programa, avisos = _validar_conteudo(personal_id, body.conteudo)
    return {
        "ok": True,
        "contagem": {
            "treinos": len(programa.treinos),
            "exercicios": sum(len(t.exercicios) for t in programa.treinos),
            "avisos": len(avisos),
        },
        "avisos": validacao_programa.achados_json(avisos),
        "relatorio_ia": import_erros.relatorio_para_ia([], avisos) if avisos else None,
    }


# ── Treinos ──────────────────────────────────────────────────────────────────
@router.get("")
def list_treinos(aluno_id: str, personal_id: str = Depends(get_current_personal_id)):
    _guard(personal_id, aluno_id)
    items = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.SK_TREINO_PREFIX)
    items.sort(key=lambda t: t.get("ordem", 0))
    return repo.clean_all(items)


@router.post("", response_model=Treino, status_code=201)
def create_treino(aluno_id: str, body: TreinoCreate, personal_id: str = Depends(get_current_personal_id)):
    _guard(personal_id, aluno_id)
    treino_id = new_id()
    now = now_iso()
    treino = Treino(treino_id=treino_id, aluno_id=aluno_id, created_at=now, updated_at=now, **body.model_dump())
    repo.put_item(keys.pk_aluno(aluno_id), keys.sk_treino(treino_id), treino.model_dump())
    if body.data_fim:
        _sync_due(personal_id, aluno_id, treino_id, body.nome, body.data_fim)
    _touch_aluno_pointer(personal_id, aluno_id)
    return treino


@router.post("/copiar", status_code=201)
def copiar_treino(aluno_id: str, body: CopiarBody, personal_id: str = Depends(get_current_personal_id)):
    """Copia um treino (e seus exercícios) de outro aluno para este — templates."""
    _guard(personal_id, aluno_id)
    _guard(personal_id, body.from_aluno_id)
    src = repo.get_item(keys.pk_aluno(body.from_aluno_id), keys.sk_treino(body.treino_id))
    if not src:
        raise HTTPException(404, "Treino de origem não encontrado")
    exs = repo.query_pk(keys.pk_aluno(body.from_aluno_id), sk_prefix=keys.sk_exercicio_prefix(body.treino_id))
    now = now_iso()
    new_tid = new_id()
    dest_pk = keys.pk_aluno(aluno_id)
    t = repo.clean(src)
    # Agregados de execução são do aluno de origem — o treino copiado nasce zerado, senão o
    # destino apareceria como "feito nesta semana" sem nunca ter treinado.
    for campo in ("total_execucoes", "ultima_execucao", "soma_duracao_segundos",
                  "soma_total_series", "sessoes_com_metrica"):
        t.pop(campo, None)
    t.update({"treino_id": new_tid, "aluno_id": aluno_id, "created_at": now, "updated_at": now})
    puts = [{"PK": dest_pk, "SK": keys.sk_treino(new_tid), **t}]
    for e in exs:
        ne = repo.clean(e)
        new_eid = new_id()
        ne.update({"exercicio_id": new_eid, "treino_id": new_tid, "aluno_id": aluno_id})
        puts.append({"PK": dest_pk, "SK": keys.sk_exercicio(new_tid, new_eid), **ne})
    repo.batch_write(puts=puts)
    _upsert_excat_lote(aluno_id, [repo.clean(e) for e in exs])
    _touch_aluno_pointer(personal_id, aluno_id)
    return {"treino_id": new_tid, "exercicios": len(exs)}


@router.put("/{treino_id}")
def update_treino(aluno_id: str, treino_id: str, body: TreinoCreate, personal_id: str = Depends(get_current_personal_id)):
    _guard(personal_id, aluno_id)
    old = repo.get_item(keys.pk_aluno(aluno_id), keys.sk_treino(treino_id))
    if not old:
        raise HTTPException(404, "Treino não encontrado")
    fields = {**body.model_dump(), "updated_at": now_iso()}
    updated = repo.update_item(keys.pk_aluno(aluno_id), keys.sk_treino(treino_id), fields, return_values=True)
    _sync_due(personal_id, aluno_id, treino_id, body.nome, body.data_fim, old.get("data_fim"))
    _touch_aluno_pointer(personal_id, aluno_id)
    return repo.clean(updated)


@router.delete("/{treino_id}", status_code=204)
def delete_treino(aluno_id: str, treino_id: str, personal_id: str = Depends(get_current_personal_id)):
    _guard(personal_id, aluno_id)
    # remove o treino + seus exercícios (+ agenda de vencimento) em lote
    treino = repo.get_item(keys.pk_aluno(aluno_id), keys.sk_treino(treino_id))
    exs = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.sk_exercicio_prefix(treino_id))
    deletes = [(keys.pk_aluno(aluno_id), keys.sk_treino(treino_id))]
    deletes += [(keys.pk_aluno(aluno_id), e["SK"]) for e in exs]
    if treino and treino.get("data_fim"):
        deletes.append((keys.pk_sched(treino["data_fim"]), keys.sk_due(treino_id)))
    repo.batch_write(deletes=deletes)
    _touch_aluno_pointer(personal_id, aluno_id)


# ── Exercícios (do treino) ───────────────────────────────────────────────────
@router.get("/{treino_id}/exercicios")
def list_exercicios(aluno_id: str, treino_id: str, personal_id: str = Depends(get_current_personal_id)):
    _guard(personal_id, aluno_id)
    items = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.sk_exercicio_prefix(treino_id))
    items.sort(key=lambda e: e.get("ordem", 0))
    return repo.clean_all(items)


@router.post("/{treino_id}/exercicios", response_model=Exercicio, status_code=201)
def create_exercicio(aluno_id: str, treino_id: str, body: ExercicioCreate,
                     personal_id: str = Depends(get_current_personal_id)):
    _guard(personal_id, aluno_id)
    chave_nova = chave_exercicio(body.nome)
    existentes = list_exercicios_aluno(aluno_id)
    primario = next(
        (e for e in existentes if chave_exercicio(e.get("nome") or "") == chave_nova),
        None,
    )
    exercicio_id = new_id()
    dados = body.model_dump()
    if primario:
        dados["canonical_exercicio_id"] = primario["exercicio_id"]
    ex = Exercicio(exercicio_id=exercicio_id, treino_id=treino_id, aluno_id=aluno_id, **dados)
    repo.put_item(keys.pk_aluno(aluno_id), keys.sk_exercicio(treino_id, exercicio_id), ex.model_dump())
    biblioteca_service.upsert_from_exercicios(personal_id, [dados])
    upsert_excat(aluno_id, body.nome, dados)
    _touch_aluno_pointer(personal_id, aluno_id)
    return ex


@router.put("/{treino_id}/exercicios/{exercicio_id}")
def update_exercicio(aluno_id: str, treino_id: str, exercicio_id: str, body: ExercicioCreate,
                     personal_id: str = Depends(get_current_personal_id)):
    _guard(personal_id, aluno_id)
    updated = repo.update_item_if_exists(
        keys.pk_aluno(aluno_id), keys.sk_exercicio(treino_id, exercicio_id), body.model_dump()
    )
    if updated is None:
        raise HTTPException(404, "Exercício não encontrado")
    # Renomear = tratar como exercício novo: o nome (identidade de feed/carga/PR) passa a valer,
    # então cadastra o nome no catálogo do personal para buscas seguintes (first-write-wins).
    biblioteca_service.upsert_from_exercicios(personal_id, [body.model_dump()])
    upsert_excat(aluno_id, body.nome, body.model_dump())
    _touch_aluno_pointer(personal_id, aluno_id)
    return repo.clean(updated)


@router.delete("/{treino_id}/exercicios/{exercicio_id}", status_code=204)
def delete_exercicio(aluno_id: str, treino_id: str, exercicio_id: str,
                     personal_id: str = Depends(get_current_personal_id)):
    _guard(personal_id, aluno_id)
    repo.delete_item(keys.pk_aluno(aluno_id), keys.sk_exercicio(treino_id, exercicio_id))
    _touch_aluno_pointer(personal_id, aluno_id)
