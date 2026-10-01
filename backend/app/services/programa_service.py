"""Programa de treino do aluno: exportar para IA e aplicar de volta.

Este miolo morava em `routers/treinos.py`. Saiu de lá quando o servidor MCP passou a
precisar do mesmo caminho — o MCP chama os services direto, sem passar por HTTP, e
duplicar a lógica de import/export (que apaga e recria o programa inteiro) seria pedir
para as duas versões divergirem. O router agora é casca em cima destas funções.
"""
from app.models.exercicio import Exercicio, ExercicioCreate
from app.models.treino import Treino
from app.models.treino_export import (
    ExercicioTreinoFile,
    ImportarProgramaResponse,
    ProgramaTreinoExportFile,
    ProgramaTreinoFile,
    TreinoFileItem,
)
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import authz, biblioteca_service, contexto_aluno_service, locale_service, sessao_service
from app.services.sessao_service import chave_exercicio, upsert_excat
from app.utils import init_series_prescritas, new_id, now_iso, treinos_validos
from app.services import programa_commit_service as commits


def aluno_nome(personal_id: str, aluno_id: str) -> str | None:
    ptr = repo.get_item(keys.pk_personal(personal_id), keys.sk_aluno_pointer(aluno_id))
    return (ptr or {}).get("nome")


def upsert_excat_lote(aluno_id: str, exercicios: list[dict]) -> None:
    """Semeia o catálogo permanente do aluno (1 upsert por nome canônico distinto)."""
    vistos: set[str] = set()
    for e in exercicios:
        ch = chave_exercicio(e.get("nome") or "")
        if ch and ch not in vistos:
            vistos.add(ch)
            upsert_excat(aluno_id, e.get("nome"), e)


def sync_due(personal_id: str, aluno_id: str, treino_id: str, treino_nome: str,
             data_fim: str | None, old_data_fim: str | None = None, *, revisao_esperada: int | None = None) -> None:
    """Mantém a agenda de vencimento do treino (o scheduler diário lê e notifica) — 1
    partição por dia (`SCHED#{data_fim}`), distribuída em vez de uma única partição global."""
    actions = []
    if old_data_fim and old_data_fim != data_fim:
        actions.append(commits.delete(keys.pk_sched(old_data_fim), keys.sk_due(treino_id)))
    if data_fim:
        actions.append(commits.put({"PK": keys.pk_sched(data_fim), "SK": keys.sk_due(treino_id),
            "personal_id": personal_id, "aluno_id": aluno_id, "treino_id": treino_id,
            "treino_nome": treino_nome, "aluno_nome": aluno_nome(personal_id, aluno_id),
            "data_fim": data_fim, "tipo": "TREINO_FIM",
            # Fuso do personal congelado aqui: é ele quem decide em que manhã o aviso
            # "vence amanhã" dispara (docs/TIMEZONE.md §7, Passo 5).
            "tz": locale_service.tz_do_personal(personal_id),
        }))
    if actions:
        if revisao_esperada is not None:
            actions.append(commits.proteger_revisao(aluno_id, revisao_esperada))
        repo.transact_write(actions)


def touch_aluno_pointer(personal_id: str, aluno_id: str) -> None:
    """Atualiza updated_at + o resumo de vigência do ponteiro (PT#{personal}/ALUNO#{aluno}) —
    a tela de Alunos lê o ponteiro pra mostrar 'última atualização' e a pendência "sem treino
    vigente" sem precisar varrer os treinos de cada aluno (seria N+1 na listagem).

    Guarda as *janelas* dos treinos ativos, não um booleano: vigência depende da data de hoje,
    um booleano congelado no write estaria errado no dia seguinte. Query consistente porque
    roda logo após o write do treino — uma leitura eventual pode não enxergá-lo."""
    base = commits.revisao(aluno_id)
    treinos = treinos_validos(repo.query_pk(keys.pk_aluno(aluno_id),
                                            sk_prefix=keys.SK_TREINO_PREFIX, consistent=True))
    vigencias = [
        {k: v for k, v in (("i", t.get("data_inicio")), ("f", t.get("data_fim"))) if v}
        for t in treinos if t.get("ativo", True)
    ]
    repo.transact_write([commits.proteger_revisao(aluno_id, base),
        commits.update_action(keys.pk_personal(personal_id), keys.sk_aluno_pointer(aluno_id),
                              {"updated_at": now_iso(), "vigencias": vigencias})])


def sessao_em_andamento(aluno_id: str, treino_ids: set[str] | None = None) -> dict | None:
    """Sessão aberta do aluno, quando ela é de um dos treinos que estão prestes a sumir
    (`treino_ids=None` = qualquer treino). 1 GetItem na chave — o guard de "não apague o
    treino que estão executando agora".

    Não impede nada por si: a sessão carrega o próprio snapshot dos exercícios e o aluno
    termina o treino mesmo que ele seja apagado no meio. Serve para o personal decidir
    sabendo — ele não tem esse sinal na tela de treinos (o "treinando agora" do
    ATIVIDADE# só aparece no dashboard).
    """
    s = sessao_service.get_active(aluno_id, consistent=True)
    if not s:
        return None
    if treino_ids is not None and s.get("treino_id") not in treino_ids:
        return None
    return {"treino_id": s.get("treino_id"), "treino_nome": s.get("treino_nome"),
            "desde": s.get("data_hora_inicio")}


def ref_treino(i: int) -> str:
    """Ref legível p/ a IA: t_a, t_b … t_z, depois t_aa, t_ab… (só identifica no arquivo)."""
    letras = ""
    n = i
    while True:
        letras = chr(ord("a") + n % 26) + letras
        n = n // 26 - 1
        if n < 0:
            break
    return f"t_{letras}"


def exportar(personal_id: str, aluno_id: str,
             com_contexto: bool = True) -> ProgramaTreinoExportFile:
    """Programa completo do aluno (treinos + exercícios) + `contexto_aluno` (perfil,
    histórico, dores, avaliações…) no formato editável por IA."""
    authz.authorize_aluno(personal_id, aluno_id)
    base = commits.revisao(aluno_id)
    treinos = treinos_validos(repo.query_pk(keys.pk_aluno(aluno_id),
                                            sk_prefix=keys.SK_TREINO_PREFIX, consistent=True))
    treinos.sort(key=lambda t: t.get("ordem", 0))
    out: list[TreinoFileItem] = []
    nomes_exercicios: list[str] = []
    for i, t in enumerate(treinos):
        exs = repo.query_pk(keys.pk_aluno(aluno_id),
                            sk_prefix=keys.sk_exercicio_prefix(t["treino_id"]), consistent=True)
        exs.sort(key=lambda e: e.get("ordem", 0))
        exercicios = []
        for e in exs:
            ec = repo.clean(e)
            ec["origem_id"] = ec.get("exercicio_id")
            # normaliza prescrição legada (flat) p/ o formato estruturado — não perde dados
            ec["series_prescritas"] = init_series_prescritas(
                ec.get("series_prescritas"), ec.get("series"),
                ec.get("reps_prescritas"), ec.get("carga_prescrita"),
            )
            exercicios.append(ExercicioTreinoFile(**ec))
            if ec.get("nome"):
                nomes_exercicios.append(ec["nome"])
        tc = repo.clean(t)
        out.append(TreinoFileItem(
            origem_id=t["treino_id"],
            ref=ref_treino(i),
            nome=tc.get("nome") or "",
            foco=tc.get("foco"),
            observacoes=tc.get("observacoes"),
            ativo=tc.get("ativo", True),
            data_inicio=tc.get("data_inicio"),
            data_fim=tc.get("data_fim"),
            blocos=tc.get("blocos") or [],
            exercicios=exercicios,
        ))
    contexto = None
    if com_contexto:
        contexto = contexto_aluno_service.montar_contexto(
            personal_id, aluno_id, exercicios_programa=nomes_exercicios)
    if commits.revisao(aluno_id) != base:
        from fastapi import HTTPException
        raise HTTPException(409, "O programa mudou durante a leitura; consulte novamente")
    return ProgramaTreinoExportFile(treinos=out, contexto_aluno=contexto, revisao=base)


def aplicar(personal_id: str, aluno_id: str,
            programa: ProgramaTreinoFile, *, revisao_base: int | None = None,
            operation_id: str | None = None, extras: list | None = None,
            origem: str = "portal", resumo: str = "Programa atualizado",
            client_name: str = "", jti: str = "", confirmar_sessao: bool = False,
            exigir_videos_revisados: bool = False) -> ImportarProgramaResponse:
    """Substituição TOTAL: o JSON vira o programa do aluno. Apaga treinos/exercícios atuais
    (e a agenda de vencimento) e recria a partir do arquivo. Histórico de sessões é
    preservado (vive em SK próprios)."""
    authz.authorize_aluno(personal_id, aluno_id)
    base = commits.revisao(aluno_id) if revisao_base is None else revisao_base
    if operation_id:
        op = commits.obter_operacao(personal_id, aluno_id, operation_id)
        if op:
            return ImportarProgramaResponse(treinos_importados=len(programa.treinos),
                exercicios_importados=sum(len(t.exercicios) for t in programa.treinos),
                operation_id=operation_id, revisao_resultante=op["revisao_resultante"])
    anterior = exportar(personal_id, aluno_id, com_contexto=False).model_dump(mode="json")
    pk = keys.pk_aluno(aluno_id)
    # Vídeo já cadastrado na biblioteca do personal tem prioridade sobre o do JSON — uma Query só.
    videos_lib = biblioteca_service.mapa_videos(personal_id)

    # 1) Apagar o programa atual (treinos + exercícios + agenda de vencimento)
    old_treinos = repo.query_pk(pk, sk_prefix=keys.SK_TREINO_PREFIX, consistent=True)
    old_exs = repo.query_pk(pk, sk_prefix="EX#", consistent=True)
    deletes = [(pk, t["SK"]) for t in old_treinos] + [(pk, e["SK"]) for e in old_exs]
    due_deletes = [(keys.pk_sched(t["data_fim"]), keys.sk_due(t["treino_id"]))
                   for t in old_treinos if t.get("data_fim")]
    extras = list(extras or [])
    if not confirmar_sessao:
        extras.append(commits.proteger_sessao(aluno_id))

    # 2) Montar o novo programa (canonical dentro do próprio conjunto importado)
    now = now_iso()
    puts: list[dict] = []
    all_dados: list[dict] = []
    canon_by_chave: dict[str, str] = {}
    due_syncs: list[tuple[str, str, str]] = []   # (treino_id, nome, data_fim)
    n_ex = 0
    for ordem_t, tf in enumerate(programa.treinos):
        tid = new_id()
        blocos_ids = {b.id for b in tf.blocos}
        treino = Treino(
            treino_id=tid, aluno_id=aluno_id, created_at=now, updated_at=now,
            nome=tf.nome, ordem=ordem_t, foco=tf.foco, observacoes=tf.observacoes,
            ativo=tf.ativo, data_inicio=tf.data_inicio, data_fim=tf.data_fim,
            blocos=tf.blocos,
        )
        puts.append({"PK": pk, "SK": keys.sk_treino(tid), **treino.model_dump()})
        if tf.data_fim:
            due_syncs.append((tid, tf.nome, tf.data_fim))
        for ordem_e, ef in enumerate(tf.exercicios):
            video = biblioteca_service.resolver_video(ef.nome, ef.video_url, videos_lib)
            if exigir_videos_revisados and video != ef.video_url:
                from fastapi import HTTPException
                raise HTTPException(409, "A biblioteca mudou o vídeo efetivo; salve e revise novamente antes de aplicar")
            eid = new_id()
            chave = chave_exercicio(ef.nome or "")
            canonical = canon_by_chave.get(chave) if chave else None
            if chave and chave not in canon_by_chave:
                canon_by_chave[chave] = eid   # primeira ocorrência vira canônico
            dados = ExercicioCreate(
                nome=ef.nome, grupos=ef.grupos, grupo=ef.grupo, ordem=ordem_e, tipo_exercicio=ef.tipo_exercicio,
                series_prescritas=ef.series_prescritas, intervalo_s=ef.intervalo_s,
                video_url=video,
                observacoes=ef.observacoes,
                unidade_carga=ef.unidade_carga, unidade_reps=ef.unidade_reps,
                metrica_direcao=ef.metrica_direcao,
                substitutos=ef.substitutos,
                # bloco_id órfão (IA pode alucinar referência) é descartado
                bloco_id=ef.bloco_id if ef.bloco_id in blocos_ids else None,
                aquecimento=ef.aquecimento,
            ).model_dump()
            ex = Exercicio(exercicio_id=eid, treino_id=tid, aluno_id=aluno_id,
                           canonical_exercicio_id=canonical, **dados)
            puts.append({"PK": pk, "SK": keys.sk_exercicio(tid, eid), **ex.model_dump()})
            all_dados.append(dados)
            n_ex += 1

    # 3) Revisão, programa, snapshot e operação: tudo ou nada.
    op = commits.commit(personal_id, aluno_id, base, puts=puts, deletes=deletes,
        extras=extras, operation_id=operation_id, snapshot=anterior,
        origem=origem, resumo=resumo, client_name=client_name, jti=jti,
        efeitos={"exercicios": all_dados, "agenda_remover": due_deletes,
                 "agenda": [[personal_id, aluno_id, tid, nome, fim] for tid, nome, fim in due_syncs]})

    return ImportarProgramaResponse(treinos_importados=len(programa.treinos),
        exercicios_importados=n_ex, operation_id=op["operation_id"],
        revisao_resultante=op["revisao_resultante"])
