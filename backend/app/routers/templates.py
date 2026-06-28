"""Templates de treino reutilizáveis — partição PT# (pertencem ao personal, não a
um aluno específico). Aplicar um template em N alunos usa o mesmo padrão denormalizado
de `treinos.copiar_treino`: 1 lote de batch_write por aluno."""
from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import get_current_personal_id
from app.models.exercicio import Exercicio
from app.models.template import (
    AplicarTemplateBody, ExercicioTemplate, TreinoTemplate, TreinoTemplateCreate,
    TreinoTemplateFromTreino,
)
from app.models.treino import Treino
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import authz, biblioteca_service
from app.utils import new_id, now_iso

router = APIRouter(prefix="/v1/templates", tags=["templates"])


@router.get("")
def list_templates(
    include_inactive: bool = Query(False),
    personal_id: str = Depends(get_current_personal_id),
):
    items = repo.query_pk(keys.pk_personal(personal_id), sk_prefix=keys.TEMPLATE_PREFIX)
    if not include_inactive:
        items = [i for i in items if i.get("ativo", True) is not False]
    return repo.clean_all(items)


@router.post("", response_model=TreinoTemplate, status_code=201)
def create_template(body: TreinoTemplateCreate, personal_id: str = Depends(get_current_personal_id)):
    tpl = TreinoTemplate(
        template_id=new_id(), personal_id=personal_id, created_at=now_iso(), **body.model_dump()
    )
    item_dict = tpl.model_dump()
    item_dict["pacote_id"] = "manual"
    repo.put_item(keys.pk_personal(personal_id), keys.sk_template(tpl.template_id), item_dict)
    biblioteca_service.upsert_from_exercicios(personal_id, [e.model_dump() for e in tpl.exercicios])
    return tpl


@router.post("/from-treino", response_model=TreinoTemplate, status_code=201)
def create_template_from_treino(
    body: TreinoTemplateFromTreino, personal_id: str = Depends(get_current_personal_id)
):
    authz.authorize_aluno(personal_id, body.aluno_id)
    treino = repo.get_item(keys.pk_aluno(body.aluno_id), keys.sk_treino(body.treino_id))
    if not treino:
        raise HTTPException(404, "Treino não encontrado")
    exs = repo.query_pk(keys.pk_aluno(body.aluno_id), sk_prefix=keys.sk_exercicio_prefix(body.treino_id))
    if not exs:
        raise HTTPException(400, "Treino sem exercícios não pode ser salvo como template.")
    exs.sort(key=lambda e: e.get("ordem", 0))
    treino_clean = repo.clean(treino)
    exercicios = [ExercicioTemplate(**repo.clean(e)) for e in exs]
    # Proveniência: se o treino do aluno (ou qualquer exercício) veio de conteúdo licenciado,
    # o template derivado nasce licenciado — fecha a lavagem aplicar→salvar→reempacotar.
    taint = bool(treino_clean.get("origem_licenciada")) or any(e.origem_licenciada for e in exercicios)
    tpl = TreinoTemplate(
        template_id=new_id(),
        personal_id=personal_id,
        created_at=now_iso(),
        nome=body.nome or treino_clean["nome"],
        foco=treino_clean.get("foco"),
        exercicios=exercicios,
        origem_licenciada=taint,
    )
    item_dict = tpl.model_dump()
    item_dict["pacote_id"] = "manual"
    repo.put_item(keys.pk_personal(personal_id), keys.sk_template(tpl.template_id), item_dict)
    biblioteca_service.upsert_from_exercicios(personal_id, [e.model_dump() for e in exercicios])
    return tpl


@router.get("/{template_id}", response_model=TreinoTemplate)
def get_template(template_id: str, personal_id: str = Depends(get_current_personal_id)):
    item = repo.get_item(keys.pk_personal(personal_id), keys.sk_template(template_id))
    if not item:
        raise HTTPException(404, "Template não encontrado")
    return TreinoTemplate(**repo.clean(item))


@router.put("/{template_id}", response_model=TreinoTemplate)
def update_template(
    template_id: str, body: TreinoTemplateCreate, personal_id: str = Depends(get_current_personal_id)
):
    updated = repo.update_item_if_exists(
        keys.pk_personal(personal_id), keys.sk_template(template_id), body.model_dump()
    )
    if updated is None:
        raise HTTPException(404, "Template não encontrado")
    biblioteca_service.upsert_from_exercicios(personal_id, [e.model_dump() for e in body.exercicios])
    return TreinoTemplate(**repo.clean(updated))


@router.delete("/{template_id}", status_code=204)
def delete_template(template_id: str, personal_id: str = Depends(get_current_personal_id)):
    ok = repo.delete_item_if_exists(keys.pk_personal(personal_id), keys.sk_template(template_id))
    if not ok:
        raise HTTPException(404, "Template não encontrado")


@router.post("/{template_id}/aplicar")
def aplicar_template(
    template_id: str, body: AplicarTemplateBody, personal_id: str = Depends(get_current_personal_id)
):
    tpl_item = repo.get_item(keys.pk_personal(personal_id), keys.sk_template(template_id))
    if not tpl_item:
        raise HTTPException(404, "Template não encontrado")
    tpl = TreinoTemplate(**repo.clean(tpl_item))

    aplicados = []
    for aluno_id in body.aluno_ids:
        authz.authorize_aluno(personal_id, aluno_id)
        now = now_iso()
        treino_id = new_id()
        dest_pk = keys.pk_aluno(aluno_id)
        treino = Treino(
            treino_id=treino_id, aluno_id=aluno_id, nome=tpl.nome, foco=tpl.foco,
            created_at=now, updated_at=now, origem_licenciada=tpl.origem_licenciada,
        )
        puts = [{"PK": dest_pk, "SK": keys.sk_treino(treino_id), **treino.model_dump()}]
        for et in tpl.exercicios:
            exercicio_id = new_id()
            et_data = et.model_dump()
            et_data["origem_licenciada"] = et.origem_licenciada or tpl.origem_licenciada
            ex = Exercicio(exercicio_id=exercicio_id, treino_id=treino_id, aluno_id=aluno_id, **et_data)
            puts.append({"PK": dest_pk, "SK": keys.sk_exercicio(treino_id, exercicio_id), **ex.model_dump()})
        repo.batch_write(puts=puts)
        aplicados.append({"aluno_id": aluno_id, "treino_id": treino_id})

    return {"aplicados": aplicados}
