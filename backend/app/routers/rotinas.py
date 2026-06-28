"""Rotinas (splits ABC/ABCDE) — partição PT# (pertencem ao personal). Aplicar uma rotina
em N alunos cria vários treinos por aluno, no mesmo padrão denormalizado de
`templates.aplicar_template` (1 lote de batch_write por aluno). Snapshot embutido: a rotina
guarda cópia dos treinos+exercícios, independente dos Templates de origem."""
from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import get_current_personal_id
from app.models.exercicio import Exercicio
from app.models.rotina import (
    AplicarRotinaBody, Rotina, RotinaCreate, RotinaFromAluno, RotinaFromTemplates, TreinoRotina,
)
from app.models.template import ExercicioTemplate, TreinoTemplate
from app.models.treino import Treino
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import authz
from app.utils import new_id, now_iso

router = APIRouter(prefix="/v1/rotinas", tags=["rotinas"])


def _touch_aluno_pointer(personal_id: str, aluno_id: str) -> None:
    repo.update_item_if_exists(
        keys.pk_personal(personal_id), keys.sk_aluno_pointer(aluno_id), {"updated_at": now_iso()}
    )


@router.get("")
def list_rotinas(
    include_inactive: bool = Query(False),
    personal_id: str = Depends(get_current_personal_id),
):
    items = repo.query_pk(keys.pk_personal(personal_id), sk_prefix=keys.ROTINA_PREFIX)
    if not include_inactive:
        items = [i for i in items if i.get("ativo", True) is not False]
    return repo.clean_all(items)


@router.post("", response_model=Rotina, status_code=201)
def create_rotina(body: RotinaCreate, personal_id: str = Depends(get_current_personal_id)):
    rot = Rotina(
        rotina_id=new_id(), personal_id=personal_id, created_at=now_iso(), **body.model_dump()
    )
    item_dict = rot.model_dump()
    item_dict["pacote_id"] = "manual"
    repo.put_item(keys.pk_personal(personal_id), keys.sk_rotina(rot.rotina_id), item_dict)
    return rot


@router.post("/from-aluno", status_code=201)
def create_rotina_from_aluno(
    body: RotinaFromAluno, personal_id: str = Depends(get_current_personal_id)
):
    """Salva a rotina completa de um aluno: monta a Rotina com todos os treinos (snapshot) e,
    se `salvar_templates`, também cria 1 Template por treino."""
    authz.authorize_aluno(personal_id, body.aluno_id)
    pk_aluno = keys.pk_aluno(body.aluno_id)
    treinos = repo.query_pk(pk_aluno, sk_prefix=keys.SK_TREINO_PREFIX)
    if not treinos:
        raise HTTPException(400, "Aluno sem treinos não pode virar rotina.")
    treinos.sort(key=lambda t: t.get("ordem", 0))

    treinos_rotina: list[TreinoRotina] = []
    templates_criados = 0
    now = now_iso()
    pk_pt = keys.pk_personal(personal_id)
    puts_templates = []

    for ordem, t in enumerate(treinos):
        tc = repo.clean(t)
        exs = repo.query_pk(pk_aluno, sk_prefix=keys.sk_exercicio_prefix(tc["treino_id"]))
        exs.sort(key=lambda e: e.get("ordem", 0))
        exercicios = [ExercicioTemplate(**repo.clean(e)) for e in exs]
        if not exercicios:
            continue
        treinos_rotina.append(TreinoRotina(
            nome=tc["nome"], foco=tc.get("foco"), ordem=ordem, exercicios=exercicios,
        ))
        if body.salvar_templates:
            tpl = TreinoTemplate(
                template_id=new_id(), personal_id=personal_id, created_at=now,
                nome=tc["nome"], foco=tc.get("foco"), exercicios=exercicios,
            )
            puts_templates.append(
                {"PK": pk_pt, "SK": keys.sk_template(tpl.template_id), **tpl.model_dump(), "pacote_id": "manual"}
            )

    if not treinos_rotina:
        raise HTTPException(400, "Nenhum treino do aluno tem exercícios para salvar.")

    nome = body.nome or f"Rotina de {_aluno_nome(personal_id, body.aluno_id) or 'aluno'}"
    rot = Rotina(
        rotina_id=new_id(), personal_id=personal_id, created_at=now,
        nome=nome, treinos=treinos_rotina,
    )
    puts = [{"PK": pk_pt, "SK": keys.sk_rotina(rot.rotina_id), **rot.model_dump(), "pacote_id": "manual"}, *puts_templates]
    repo.batch_write(puts=puts)
    templates_criados = len(puts_templates)
    return {"rotina": rot.model_dump(), "templates_criados": templates_criados}


@router.post("/from-templates", response_model=Rotina, status_code=201)
def create_rotina_from_templates(
    body: RotinaFromTemplates, personal_id: str = Depends(get_current_personal_id)
):
    """Monta uma rotina do zero juntando vários Templates (copia os exercícios — snapshot)."""
    pk_pt = keys.pk_personal(personal_id)
    treinos_rotina: list[TreinoRotina] = []
    for ordem, template_id in enumerate(body.template_ids):
        item = repo.get_item(pk_pt, keys.sk_template(template_id))
        if not item:
            raise HTTPException(404, f"Template {template_id} não encontrado")
        tpl = TreinoTemplate(**repo.clean(item))
        treinos_rotina.append(TreinoRotina(
            nome=tpl.nome, foco=tpl.foco, ordem=ordem, exercicios=tpl.exercicios,
        ))
    rot = Rotina(
        rotina_id=new_id(), personal_id=personal_id, created_at=now_iso(),
        nome=body.nome, descricao=body.descricao, treinos=treinos_rotina,
    )
    item_dict = rot.model_dump()
    item_dict["pacote_id"] = "manual"
    repo.put_item(pk_pt, keys.sk_rotina(rot.rotina_id), item_dict)
    return rot


@router.get("/{rotina_id}", response_model=Rotina)
def get_rotina(rotina_id: str, personal_id: str = Depends(get_current_personal_id)):
    item = repo.get_item(keys.pk_personal(personal_id), keys.sk_rotina(rotina_id))
    if not item:
        raise HTTPException(404, "Rotina não encontrada")
    return Rotina(**repo.clean(item))


@router.put("/{rotina_id}", response_model=Rotina)
def update_rotina(
    rotina_id: str, body: RotinaCreate, personal_id: str = Depends(get_current_personal_id)
):
    updated = repo.update_item_if_exists(
        keys.pk_personal(personal_id), keys.sk_rotina(rotina_id), body.model_dump()
    )
    if updated is None:
        raise HTTPException(404, "Rotina não encontrada")
    return Rotina(**repo.clean(updated))


@router.delete("/{rotina_id}", status_code=204)
def delete_rotina(rotina_id: str, personal_id: str = Depends(get_current_personal_id)):
    ok = repo.delete_item_if_exists(keys.pk_personal(personal_id), keys.sk_rotina(rotina_id))
    if not ok:
        raise HTTPException(404, "Rotina não encontrada")


@router.post("/{rotina_id}/aplicar")
def aplicar_rotina(
    rotina_id: str, body: AplicarRotinaBody, personal_id: str = Depends(get_current_personal_id)
):
    rot_item = repo.get_item(keys.pk_personal(personal_id), keys.sk_rotina(rotina_id))
    if not rot_item:
        raise HTTPException(404, "Rotina não encontrada")
    rot = Rotina(**repo.clean(rot_item))

    aplicados = []
    for aluno_id in body.aluno_ids:
        authz.authorize_aluno(personal_id, aluno_id)
        dest_pk = keys.pk_aluno(aluno_id)

        deletes = []
        if body.modo == "substituir":
            for t in repo.query_pk(dest_pk, sk_prefix=keys.SK_TREINO_PREFIX):
                deletes.append((dest_pk, t["SK"]))
                if t.get("data_fim"):
                    deletes.append((keys.pk_sched(t["data_fim"]), keys.sk_due(t["treino_id"])))
                for e in repo.query_pk(dest_pk, sk_prefix=keys.sk_exercicio_prefix(t["treino_id"])):
                    deletes.append((dest_pk, e["SK"]))

        puts = []
        treino_ids = []
        for tr in rot.treinos:
            now = now_iso()
            treino_id = new_id()
            treino = Treino(
                treino_id=treino_id, aluno_id=aluno_id, nome=tr.nome, foco=tr.foco,
                ordem=tr.ordem, created_at=now, updated_at=now,
            )
            puts.append({"PK": dest_pk, "SK": keys.sk_treino(treino_id), **treino.model_dump()})
            for et in tr.exercicios:
                exercicio_id = new_id()
                ex = Exercicio(
                    exercicio_id=exercicio_id, treino_id=treino_id, aluno_id=aluno_id,
                    **et.model_dump(),
                )
                puts.append(
                    {"PK": dest_pk, "SK": keys.sk_exercicio(treino_id, exercicio_id), **ex.model_dump()}
                )
            treino_ids.append(treino_id)

        repo.batch_write(puts=puts, deletes=deletes or None)
        _touch_aluno_pointer(personal_id, aluno_id)
        aplicados.append({"aluno_id": aluno_id, "treinos": treino_ids})

    return {"aplicados": aplicados}


def _aluno_nome(personal_id: str, aluno_id: str) -> str | None:
    ptr = repo.get_item(keys.pk_personal(personal_id), keys.sk_aluno_pointer(aluno_id))
    return (ptr or {}).get("nome")
