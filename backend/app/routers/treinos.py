"""CRUD de treinos e exercícios, aninhados sob o aluno (ESPEC §2). Tudo na partição
AL#{aluno}. `ordem` é atributo (ordenação em app); SK por id facilita o CRUD."""
import json

from fastapi import APIRouter, Depends, HTTPException

from pydantic import BaseModel

from app.dependencies import get_current_personal_id
from app.models.exercicio import Exercicio, ExercicioCreate
from app.models.treino import Treino, TreinoCreate
from app.models.treino_export import (
    ExercicioTreinoFile,
    ImportarProgramaResponse,
    ProgramaTreinoFile,
    TreinoFileItem,
)
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import authz, biblioteca_service
from app.services.sessao_service import chave_exercicio, list_exercicios_aluno
from app.utils import init_series_prescritas, new_id, now_iso

router = APIRouter(prefix="/v1/alunos/{aluno_id}/treinos", tags=["treinos"])


class CopiarBody(BaseModel):
    from_aluno_id: str
    treino_id: str


class ImportarProgramaRequest(BaseModel):
    conteudo: str


def _aluno_nome(personal_id: str, aluno_id: str) -> str | None:
    ptr = repo.get_item(keys.pk_personal(personal_id), keys.sk_aluno_pointer(aluno_id))
    return (ptr or {}).get("nome")


def _sync_due(personal_id: str, aluno_id: str, treino_id: str, treino_nome: str,
              data_fim: str | None, old_data_fim: str | None = None) -> None:
    """Mantém a agenda de vencimento do treino (o scheduler diário lê e notifica) — 1
    partição por dia (`SCHED#{data_fim}`), distribuída em vez de uma única partição global."""
    if old_data_fim and old_data_fim != data_fim:
        repo.delete_item(keys.pk_sched(old_data_fim), keys.sk_due(treino_id))
    if data_fim:
        repo.put_item(keys.pk_sched(data_fim), keys.sk_due(treino_id), {
            "personal_id": personal_id, "aluno_id": aluno_id, "treino_id": treino_id,
            "treino_nome": treino_nome, "aluno_nome": _aluno_nome(personal_id, aluno_id),
            "data_fim": data_fim, "tipo": "TREINO_FIM",
        })


def _guard(personal_id: str, aluno_id: str) -> None:
    authz.authorize_aluno(personal_id, aluno_id)


def _touch_aluno_pointer(personal_id: str, aluno_id: str) -> None:
    """Atualiza só o updated_at do ponteiro (PT#{personal}/ALUNO#{aluno}) — a tela de
    Alunos lê o ponteiro pra mostrar 'última atualização' sem precisar varrer treinos."""
    repo.update_item_if_exists(
        keys.pk_personal(personal_id), keys.sk_aluno_pointer(aluno_id), {"updated_at": now_iso()}
    )


# ── Exportar / importar o PROGRAMA do aluno (IA) ─────────────────────────────
def _ref_treino(i: int) -> str:
    """Ref legível p/ a IA: t_a, t_b … t_z, depois t_aa, t_ab… (só identifica no arquivo)."""
    letras = ""
    n = i
    while True:
        letras = chr(ord("a") + n % 26) + letras
        n = n // 26 - 1
        if n < 0:
            break
    return f"t_{letras}"


@router.get("/exportar", response_model=ProgramaTreinoFile)
def exportar_programa(aluno_id: str, personal_id: str = Depends(get_current_personal_id)):
    """Programa completo do aluno (todos os treinos + exercícios) no formato editável por IA.
    O personal baixa, pede ajustes a uma LLM e reimporta em /importar (substituição total)."""
    _guard(personal_id, aluno_id)
    treinos = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.SK_TREINO_PREFIX)
    treinos.sort(key=lambda t: t.get("ordem", 0))
    out: list[TreinoFileItem] = []
    for i, t in enumerate(treinos):
        exs = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.sk_exercicio_prefix(t["treino_id"]))
        exs.sort(key=lambda e: e.get("ordem", 0))
        exercicios = []
        for e in exs:
            ec = repo.clean(e)
            # normaliza prescrição legada (flat) p/ o formato estruturado — não perde dados
            ec["series_prescritas"] = init_series_prescritas(
                ec.get("series_prescritas"), ec.get("series"),
                ec.get("reps_prescritas"), ec.get("carga_prescrita"),
            )
            exercicios.append(ExercicioTreinoFile(**ec))
        tc = repo.clean(t)
        out.append(TreinoFileItem(
            ref=_ref_treino(i),
            nome=tc.get("nome") or "",
            foco=tc.get("foco"),
            observacoes=tc.get("observacoes"),
            ativo=tc.get("ativo", True),
            data_inicio=tc.get("data_inicio"),
            data_fim=tc.get("data_fim"),
            exercicios=exercicios,
        ))
    return ProgramaTreinoFile(treinos=out)


@router.post("/importar", response_model=ImportarProgramaResponse, status_code=201)
def importar_programa(aluno_id: str, body: ImportarProgramaRequest,
                      personal_id: str = Depends(get_current_personal_id)):
    """Substituição TOTAL: o JSON vira o programa do aluno. Apaga treinos/exercícios atuais
    (e a agenda de vencimento) e recria a partir do arquivo. Histórico de sessões é preservado
    (vive em SK próprios). Mesmos códigos de erro do import de pacotes (front já trata)."""
    _guard(personal_id, aluno_id)
    try:
        data = json.loads(body.conteudo)
    except (json.JSONDecodeError, TypeError) as exc:
        raise HTTPException(400, detail={"code": "ARQUIVO_INVALIDO", "detail": str(exc)})
    try:
        programa = ProgramaTreinoFile(**data)
    except Exception as exc:
        raise HTTPException(400, detail={"code": "ESTRUTURA_INVALIDA", "detail": str(exc)})

    pk = keys.pk_aluno(aluno_id)

    # 1) Apagar o programa atual (treinos + exercícios + agenda de vencimento)
    old_treinos = repo.query_pk(pk, sk_prefix=keys.SK_TREINO_PREFIX)
    old_exs = repo.query_pk(pk, sk_prefix="EX#")
    deletes = [(pk, t["SK"]) for t in old_treinos] + [(pk, e["SK"]) for e in old_exs]
    for t in old_treinos:
        if t.get("data_fim"):
            deletes.append((keys.pk_sched(t["data_fim"]), keys.sk_due(t["treino_id"])))

    # 2) Montar o novo programa (canonical dentro do próprio conjunto importado)
    now = now_iso()
    puts: list[dict] = []
    all_dados: list[dict] = []
    canon_by_chave: dict[str, str] = {}
    due_syncs: list[tuple[str, str, str]] = []   # (treino_id, nome, data_fim)
    n_ex = 0
    for ordem_t, tf in enumerate(programa.treinos):
        tid = new_id()
        treino = Treino(
            treino_id=tid, aluno_id=aluno_id, created_at=now, updated_at=now,
            nome=tf.nome, ordem=ordem_t, foco=tf.foco, observacoes=tf.observacoes,
            ativo=tf.ativo, data_inicio=tf.data_inicio, data_fim=tf.data_fim,
        )
        puts.append({"PK": pk, "SK": keys.sk_treino(tid), **treino.model_dump()})
        if tf.data_fim:
            due_syncs.append((tid, tf.nome, tf.data_fim))
        for ordem_e, ef in enumerate(tf.exercicios):
            eid = new_id()
            chave = chave_exercicio(ef.nome or "")
            canonical = canon_by_chave.get(chave) if chave else None
            if chave and chave not in canon_by_chave:
                canon_by_chave[chave] = eid   # primeira ocorrência vira canônico
            dados = ExercicioCreate(
                nome=ef.nome, grupo=ef.grupo, ordem=ordem_e, tipo_exercicio=ef.tipo_exercicio,
                series_prescritas=ef.series_prescritas, intervalo_s=ef.intervalo_s,
                video_url=ef.video_url, observacoes=ef.observacoes,
                unidade_carga=ef.unidade_carga, unidade_reps=ef.unidade_reps,
                metrica_direcao=ef.metrica_direcao,
                substitutos=ef.substitutos,
            ).model_dump()
            ex = Exercicio(exercicio_id=eid, treino_id=tid, aluno_id=aluno_id,
                           canonical_exercicio_id=canonical, **dados)
            puts.append({"PK": pk, "SK": keys.sk_exercicio(tid, eid), **ex.model_dump()})
            all_dados.append(dados)
            n_ex += 1

    # 3) Aplicar (apaga e recria), agenda e biblioteca
    if deletes:
        repo.batch_write(deletes=deletes)
    repo.batch_write(puts=puts)
    for tid, nome, data_fim in due_syncs:
        _sync_due(personal_id, aluno_id, tid, nome, data_fim)
    if all_dados:
        biblioteca_service.upsert_from_exercicios(personal_id, all_dados)
    _touch_aluno_pointer(personal_id, aluno_id)

    return ImportarProgramaResponse(treinos_importados=len(programa.treinos), exercicios_importados=n_ex)


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
    t.update({"treino_id": new_tid, "aluno_id": aluno_id, "created_at": now, "updated_at": now})
    puts = [{"PK": dest_pk, "SK": keys.sk_treino(new_tid), **t}]
    for e in exs:
        ne = repo.clean(e)
        new_eid = new_id()
        ne.update({"exercicio_id": new_eid, "treino_id": new_tid, "aluno_id": aluno_id})
        puts.append({"PK": dest_pk, "SK": keys.sk_exercicio(new_tid, new_eid), **ne})
    repo.batch_write(puts=puts)
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
    _touch_aluno_pointer(personal_id, aluno_id)
    return repo.clean(updated)


@router.delete("/{treino_id}/exercicios/{exercicio_id}", status_code=204)
def delete_exercicio(aluno_id: str, treino_id: str, exercicio_id: str,
                     personal_id: str = Depends(get_current_personal_id)):
    _guard(personal_id, aluno_id)
    repo.delete_item(keys.pk_aluno(aluno_id), keys.sk_exercicio(treino_id, exercicio_id))
    _touch_aluno_pointer(personal_id, aluno_id)
