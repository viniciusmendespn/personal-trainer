"""Rascunhos por tenant; diff da prescrição normalizada, sem heurística por posição."""
import time

from fastapi import HTTPException
from pydantic import ValidationError

from app.config import settings
from app.models.proposta_programa import PropostaPrograma
from app.models.treino_export import ProgramaTreinoFile
from app.repositories import dynamo_repo as repo, keys
from app.services import authz, biblioteca_service, programa_service, validacao_programa
from app.services import programa_commit_service as commits
from app.utils import now_iso, new_id


def _sk(pid):
    return f"PROPOSTA#{pid}"


def _flag(aplicar=False):
    if settings.mcp_compat_mode or not settings.mcp_propostas_enabled or (aplicar and not settings.mcp_aplicacao_enabled):
        raise HTTPException(403, "Fluxo de propostas desabilitado nesta implantação")


def normalizar(personal_id: str, bruto: dict) -> tuple[dict, dict]:
    try:
        programa = ProgramaTreinoFile(**bruto)
    except ValidationError as exc:
        raise HTTPException(400, {"code": "FORMATO_INVALIDO",
                                  "mensagem": validacao_programa.formatar_erros_pydantic(exc)}) from exc
    ctx = validacao_programa.carregar_contexto(personal_id)
    erros, avisos = validacao_programa.validar(programa, ctx, bruto=bruto)
    if not programa.treinos:
        report = {"ok": False, "erros": [{"caminho": "treinos", "mensagem": "Inclua pelo menos um treino"}], "avisos": []}
    else:
        report = {"ok": not erros, "erros": validacao_programa.achados_json(erros, limite=len(erros)),
                  "avisos": validacao_programa.achados_json(avisos, limite=len(avisos))}
    videos = biblioteca_service.mapa_videos(personal_id)
    for treino in programa.treinos:
        for exercicio in treino.exercicios:
            exercicio.video_url = biblioteca_service.resolver_video(exercicio.nome, exercicio.video_url, videos)
    return programa.model_dump(mode="json"), report


def _pares(antes, depois):
    """Origem explícita primeiro; nome único só nos dois conjuntos é alternativa segura.

    Homônimos sem origem são remoção/adição. IDs duplicados também não pareiam.
    """
    used = set()
    for ni, novo in enumerate(depois):
        origem = novo.get("origem_id")
        candidatos = [i for i, velho in enumerate(antes) if i not in used and origem and velho.get("origem_id") == origem]
        if not origem:
            nome = novo.get("nome")
            if sum(x.get("nome") == nome for x in depois) == 1:
                candidatos = [i for i, velho in enumerate(antes) if i not in used and velho.get("nome") == nome]
        if len(candidatos) == 1 and (not origem or sum(x.get("origem_id") == origem for x in depois) == 1):
            oi = candidatos[0]
            used.add(oi)
            yield oi, ni, antes[oi], novo
        else:
            yield None, ni, None, novo
    for oi, velho in enumerate(antes):
        if oi not in used:
            yield oi, None, velho, None


def diferencas(base: dict, proposta: dict) -> list[dict]:
    out = []
    def campos(velho, novo, path, nome, oi, ni, excluir=()):
        if velho is None or novo is None:
            out.append({"caminho": path, "nome": nome, "tipo": "adicionado" if velho is None else "removido",
                        "atual": velho, "proposto": novo})
            return
        for campo in sorted(set(velho) | set(novo)):
            if campo in {"origem_id", "ref", *excluir}:
                continue
            if velho.get(campo) != novo.get(campo):
                out.append({"caminho": f"{path}.{campo}", "nome": nome,
                            "campo": campo, "tipo": "alterado", "atual": velho.get(campo), "proposto": novo.get(campo)})
        if oi != ni:
            out.append({"caminho": f"{path}.ordem", "nome": nome, "campo": "ordem", "tipo": "alterado", "atual": oi, "proposto": ni})
    # Pydantic materializa defaults igualmente dos dois lados, evitando diff de null/default.
    base = ProgramaTreinoFile(**base).model_dump(mode="json")
    proposta = ProgramaTreinoFile(**proposta).model_dump(mode="json")
    for oi, ni, velho, novo in _pares(base["treinos"], proposta["treinos"]):
        path = f"treinos[{ni if ni is not None else oi}]"
        nome = (novo or velho)["nome"]
        campos(velho, novo, path, nome, oi, ni, ("exercicios",))
        if velho is not None and novo is not None:
            for ei, en, ev, ep in _pares(velho["exercicios"], novo["exercicios"]):
                campos(ev, ep, f"{path}.exercicios[{en if en is not None else ei}]", (ep or ev)["nome"], ei, en)
    return out


def obter(personal_id: str, aluno_id: str, proposta_id: str) -> dict:
    _flag()
    authz.authorize_aluno(personal_id, aluno_id)
    item = repo.get_item(keys.pk_personal(personal_id), _sk(proposta_id), consistent=True)
    if not item or item.get("aluno_id") != aluno_id:
        raise HTTPException(404, "Proposta não encontrada")
    p = repo.clean(item)
    p.pop("personal_id", None)
    if p["expires_at"] <= int(time.time()) and p["estado"] != "aplicada":
        p["estado"] = "expirada"
    elif p["estado"] in {"valida", "invalida", "rascunho"} and commits.revisao(aluno_id) != p["revisao_base"]:
        p["estado"] = "desatualizada"
    return p


def salvar(personal_id: str, aluno_id: str, bruto: dict, resumo: str, revisao_base: int,
           proposta_id: str | None = None, revisao_proposta: int | None = None) -> dict:
    _flag()
    authz.authorize_aluno(personal_id, aluno_id)
    atual = obter(personal_id, aluno_id, proposta_id) if proposta_id else None
    if atual:
        if atual["estado"] not in {"valida", "invalida", "rascunho"}:
            raise HTTPException(409, "Esta proposta não pode ser editada; crie uma nova a partir do programa atual")
        if revisao_proposta != atual["revisao"] or revisao_base != atual["revisao_base"]:
            raise HTTPException(409, "A proposta mudou; recarregue antes de editar")
        base = atual["programa_base"]
    else:
        base = programa_service.exportar(personal_id, aluno_id, com_contexto=False).model_dump(mode="json")
        if base["revisao"] != revisao_base:
            raise HTTPException(409, "Programa desatualizado; exporte novamente")
    programa, report = normalizar(personal_id, bruto)
    ts = now_iso()
    proposta_id = proposta_id or new_id()
    p = PropostaPrograma(proposta_id=proposta_id, personal_id=personal_id, aluno_id=aluno_id,
        revisao=(atual["revisao"] + 1 if atual else 1), revisao_base=revisao_base,
        programa=programa, programa_base=base, resumo_da_mudanca=resumo[:1000],
        diferencas=diferencas(base, programa), validacao=report,
        created_at=atual["created_at"] if atual else ts, updated_at=ts,
        expires_at=atual["expires_at"] if atual else int(time.time()) + settings.mcp_proposta_ttl_s,
        estado="valida" if report["ok"] else "invalida")
    item = {"PK": keys.pk_personal(personal_id), "SK": _sk(proposta_id), **p.model_dump(mode="json"), "ttl": p.expires_at}
    condition = {"ConditionExpression": "#r = :r", "ExpressionAttributeNames": {"#r": "revisao"},
                 "ExpressionAttributeValues": {":r": revisao_proposta}} if atual else {"ConditionExpression": "attribute_not_exists(PK)"}
    try:
        repo.transact_write([commits.put(item, **condition)])
    except repo.TransactionConflict as exc:
        raise HTTPException(409, "A proposta mudou; recarregue") from exc
    except repo.TransactionTooLarge as exc:
        raise HTTPException(413, "Proposta muito grande; reduza o programa") from exc
    return obter(personal_id, aluno_id, proposta_id)


def aplicar(personal_id: str, aluno_id: str, proposta_id: str, revisao: int,
            confirmar_sessao=False, *, client_name="", jti="") -> dict:
    _flag(aplicar=True)
    p = obter(personal_id, aluno_id, proposta_id)
    if p["revisao"] != revisao:
        raise HTTPException(409, "A proposta mudou; revise novamente")
    if p["estado"] == "aplicada":
        op = commits.obter_operacao(personal_id, aluno_id, p["operation_id"])
        if not op:
            raise HTTPException(409, "O resultado desta operação expirou. Consulte o programa atual; não reaplique a proposta antiga.")
        return op
    if p["estado"] != "valida":
        raise HTTPException(409, {"code": "PROPOSTA_NAO_APLICAVEL", "estado": p["estado"],
                                  "mensagem": "Revise uma proposta válida e atual antes de aplicar"})
    if programa_service.sessao_em_andamento(aluno_id) and not confirmar_sessao:
        raise HTTPException(409, {"code": "SESSAO_EM_ANDAMENTO", "mensagem":
            "O aluno está treinando. Ele termina normalmente, mas a execução não será contabilizada no programa substituído. Confirme para continuar."})
    normalizado, report = normalizar(personal_id, p["programa"])
    if not report["ok"]:
        raise HTTPException(409, "As regras de validação mudaram; salve e revise novamente")
    if normalizado != p["programa"]:
        raise HTTPException(409, "A biblioteca mudou o vídeo efetivo; salve e revise novamente antes de aplicar")
    operation_id = commits.idempotencia(personal_id, aluno_id, proposta_id, revisao)
    action = commits.update_action(keys.pk_personal(personal_id), _sk(proposta_id),
                                  {"estado": "aplicada", "operation_id": operation_id, "updated_at": now_iso()})
    action["Update"].update({"ConditionExpression": "#r = :r AND #estado = :valida AND #exp > :now",
        "ExpressionAttributeNames": {**action["Update"]["ExpressionAttributeNames"], "#r": "revisao", "#estado": "estado", "#exp": "expires_at"},
        "ExpressionAttributeValues": {**action["Update"]["ExpressionAttributeValues"], ":r": revisao, ":valida": "valida", ":now": int(time.time())}})
    programa_service.aplicar(personal_id, aluno_id, ProgramaTreinoFile(**normalizado),
        revisao_base=p["revisao_base"], operation_id=operation_id, extras=[action],
        origem="aplicar_proposta_programa", resumo=p["resumo_da_mudanca"], client_name=client_name, jti=jti,
        confirmar_sessao=confirmar_sessao, exigir_videos_revisados=True)
    return commits.obter_operacao(personal_id, aluno_id, operation_id)


def restaurar(personal_id: str, aluno_id: str, operation_id: str, confirmar_sessao=False,
              *, client_name="", jti="") -> dict:
    authz.authorize_aluno(personal_id, aluno_id)
    restore_id = commits.idempotencia(personal_id, aluno_id, "restaurar", operation_id)
    previous = commits.obter_operacao(personal_id, aluno_id, restore_id)
    if previous:
        return previous
    op = commits.obter_operacao(personal_id, aluno_id, operation_id)
    if not op or op["expires_at"] <= int(time.time()):
        raise HTTPException(409, "Operação indisponível ou janela de sete dias expirada")
    if commits.revisao(aluno_id) != op["revisao_resultante"]:
        raise HTTPException(409, "O programa mudou depois desta operação. Crie uma proposta de restauração para comparar.")
    snap = repo.get_item(keys.pk_aluno(aluno_id), keys.sk_mcp_snap(op["aplicado_em"]), consistent=True)
    if not snap or snap["ttl"] <= int(time.time()) or snap.get("personal_id") != personal_id:
        raise HTTPException(409, "Snapshot indisponível ou expirado")
    if programa_service.sessao_em_andamento(aluno_id) and not confirmar_sessao:
        raise HTTPException(409, {"code": "SESSAO_EM_ANDAMENTO", "mensagem": "Aluno treinando; confirme o efeito da restauração antes de continuar"})
    import json
    programa = ProgramaTreinoFile(**json.loads(snap["programa"]))
    programa_service.aplicar(personal_id, aluno_id, programa, revisao_base=op["revisao_resultante"],
        operation_id=restore_id, origem="restaurar_operacao_programa", resumo="Programa anterior restaurado",
        client_name=client_name, jti=jti, confirmar_sessao=confirmar_sessao)
    return commits.obter_operacao(personal_id, aluno_id, restore_id)
