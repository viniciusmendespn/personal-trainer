"""Coordenação comum a portal e MCP: revisão + itens essenciais no mesmo commit."""
import hashlib
import json
import logging
import time

from fastapi import HTTPException

from app.config import settings
from app.repositories import dynamo_repo as repo, keys
from app.utils import now_iso, new_id

log = logging.getLogger(__name__)
REV_SK = "PROGRAMA#REVISAO"
PENDING_PREFIX = "PROGRAMA_EFEITO#"


def revisao(aluno_id: str) -> int:
    item = repo.get_item(keys.pk_aluno(aluno_id), REV_SK, consistent=True)
    return int((item or {}).get("revisao", 0))


def put(item: dict, **condition) -> dict:
    return {"Put": {"Item": item, **condition}}


def delete(pk: str, sk: str) -> dict:
    return {"Delete": {"Key": {"PK": pk, "SK": sk}}}


def proteger_sessao(aluno_id: str, treino_id: str | None = None) -> dict:
    body = {"Key": {"PK": keys.pk_aluno(aluno_id), "SK": keys.SK_SESSION_ACTIVE},
            "ConditionExpression": "attribute_not_exists(PK)"}
    if treino_id is not None:
        body.update({"ConditionExpression": "attribute_not_exists(PK) OR #t <> :t",
                     "ExpressionAttributeNames": {"#t": "treino_id"},
                     "ExpressionAttributeValues": {":t": treino_id}})
    return {"ConditionCheck": body}


def proteger_revisao(aluno_id: str, base: int) -> dict:
    return {"ConditionCheck": {
        "Key": {"PK": keys.pk_aluno(aluno_id), "SK": REV_SK},
        "ConditionExpression": "attribute_not_exists(#r) OR #r = :base" if base == 0 else "#r = :base",
        "ExpressionAttributeNames": {"#r": "revisao"}, "ExpressionAttributeValues": {":base": base},
    }}


def op_sk(operation_id: str) -> str:
    return f"PROGRAMA_OP#{operation_id}"


def obter_operacao(personal_id: str, aluno_id: str, operation_id: str) -> dict | None:
    from app.services import authz
    authz.authorize_aluno(personal_id, aluno_id)
    item = repo.get_item(keys.pk_personal(personal_id), op_sk(operation_id), consistent=True)
    if item and item.get("aluno_id") == aluno_id:
        return {**repo.clean(item), "expires_at": int(item.get("ttl", 0))}
    return None


def commit(personal_id: str, aluno_id: str, base: int, *, puts=None, deletes=None,
           updates=None, extras=None, operation_id=None, snapshot=None, efeitos=None,
           origem="portal", resumo="Programa atualizado", client_name="", jti="") -> dict:
    if settings.mcp_compat_mode:
        raise HTTPException(503, "Escrita transacional desabilitada no modo de compatibilidade")
    from app.services import authz
    authz.authorize_aluno(personal_id, aluno_id)
    operation_id = operation_id or new_id()
    previous = obter_operacao(personal_id, aluno_id, operation_id)
    if previous:
        return previous
    pk = keys.pk_aluno(aluno_id)
    ts = now_iso()
    ttl = int(time.time()) + 7 * 86400
    efeitos = dict(efeitos or {})
    efeitos.setdefault("exercicios", [repo.clean(i) for i in (puts or []) if i["SK"].startswith("EX#")])
    efeitos.setdefault("agenda", [[personal_id, aluno_id, i["treino_id"], i.get("nome"), i["data_fim"]]
                                for i in (puts or []) if i["SK"].startswith("TREINO#") and i.get("data_fim")])
    resultado = {"operation_id": operation_id, "aluno_id": aluno_id,
                 "revisao_base": base, "revisao_resultante": base + 1,
                 "status": "aplicado", "aplicado_em": ts, "ttl": ttl,
                 "efeitos": efeitos}
    actions = [{"Update": {
        "Key": {"PK": pk, "SK": REV_SK},
        "UpdateExpression": "SET #r = :next, #at = :at, #op = :op",
        "ConditionExpression": "attribute_not_exists(#r) OR #r = :base" if base == 0 else "#r = :base",
        "ExpressionAttributeNames": {"#r": "revisao", "#at": "updated_at", "#op": "ultima_operacao"},
        "ExpressionAttributeValues": {":next": base + 1, ":base": base, ":at": ts, ":op": operation_id},
    }}]
    actions.extend(put(i) for i in (puts or []))
    actions.extend(delete(p, s) for p, s in (deletes or []))
    actions.extend(updates or [])
    actions.extend(extras or [])
    actions.append({"ConditionCheck": {
        "Key": {"PK": keys.pk_personal(personal_id), "SK": keys.sk_aluno_pointer(aluno_id)},
        "ConditionExpression": "attribute_exists(PK)",
    }})
    actions.append(put({"PK": keys.pk_personal(personal_id), "SK": op_sk(operation_id), **resultado},
                       ConditionExpression="attribute_not_exists(PK)"))
    actions.append(put({"PK": keys.pk_sched(ts[:10]), "SK": PENDING_PREFIX + operation_id,
                        "personal_id": personal_id, "aluno_id": aluno_id, "operation_id": operation_id,
                        "ttl": ttl}))
    if snapshot is not None:
        actions.append(put({"PK": pk, "SK": keys.sk_mcp_snap(ts),
                            "programa": json.dumps(snapshot, ensure_ascii=False),
                            "ts": ts, "ttl": ttl, "operation_id": operation_id,
                            "revisao_resultante": base + 1, "personal_id": personal_id,
                            "tool": origem, "client_name": client_name}))
    if origem != "portal":
        from app.services import mcp_service, notif_service
        # Auditoria e notificação existem mesmo quando os efeitos derivados falham.
        actions.append(put({"PK": keys.pk_personal(personal_id),
                            "SK": keys.sk_mcp_audit(ts, operation_id),
                            "tool": origem, "client_name": client_name, "jti": jti,
                            "resumo": resumo[:500], "alvo": aluno_id,
                            "resultado": "ok", "ts": ts, "ttl": int(time.time()) + mcp_service.AUDIT_TTL_S}))
        actions.append(put({"PK": keys.pk_personal(personal_id),
                            "SK": keys.sk_notif(int(time.time() * 1000), operation_id),
                            "notif_id": operation_id, "tipo": "MCP_ESCRITA",
                            "titulo": f"Treino de {client_aluno_nome(personal_id, aluno_id)} atualizado",
                            "mensagem": resumo[:500], "aluno_id": aluno_id,
                            "lida": False, "data_hora": ts, "ttl": int(time.time()) + notif_service.NOTIF_TTL_S}))
        actions.append({"Update": {
            "Key": {"PK": keys.pk_personal(personal_id), "SK": keys.SK_STATS_NOTIF},
            "UpdateExpression": "ADD #n :one", "ExpressionAttributeNames": {"#n": "nao_lidas"},
            "ExpressionAttributeValues": {":one": 1},
        }})
    try:
        repo.transact_write(actions)
    except repo.TransactionConflict as exc:
        previous = obter_operacao(personal_id, aluno_id, operation_id)
        if previous:
            return previous
        for action in actions:
            guard = action.get("ConditionCheck", {})
            if guard.get("Key", {}).get("SK") != keys.SK_SESSION_ACTIVE:
                continue
            from app.services import programa_service
            tid = guard.get("ExpressionAttributeValues", {}).get(":t")
            if programa_service.sessao_em_andamento(aluno_id, {tid} if tid else None):
                raise HTTPException(409, {"code": "SESSAO_EM_ANDAMENTO", "mensagem": "Aluno treinando; confirme a sessão antes de aplicar"}) from exc
        raise HTTPException(409, {"code": "REVISAO_DESATUALIZADA",
                                  "mensagem": "O programa ou a proposta mudou. Recarregue e revise novamente."}) from exc
    except repo.TransactionTooLarge as exc:
        raise HTTPException(413, {"code": "PROGRAMA_MUITO_GRANDE", "mensagem": str(exc)}) from exc
    try:
        retomar_efeitos(personal_id, aluno_id, operation_id)
    except Exception:
        log.warning("retomada pendente operation=%s", operation_id)
    return resultado


def client_aluno_nome(personal_id, aluno_id):
    ptr = repo.get_item(keys.pk_personal(personal_id), keys.sk_aluno_pointer(aluno_id)) or {}
    return ptr.get("nome") or "aluno"


def retomar_efeitos(personal_id: str, aluno_id: str, operation_id: str) -> None:
    """Retomada por leitura/status: cada efeito é um upsert/delete idempotente.

    Nunca devolver falha do programa depois de seu commit ter sido confirmado.
    """
    from app.services import biblioteca_service, programa_service
    op = obter_operacao(personal_id, aluno_id, operation_id)
    if not op:
        return
    efeitos = op.get("efeitos", {})
    concluidos = set(op.get("efeitos_concluidos", []))
    tarefas = {
        "agenda": lambda: _agenda(efeitos, aluno_id, personal_id),
        "biblioteca": lambda: biblioteca_service.upsert_from_exercicios(personal_id, efeitos.get("exercicios", [])),
        "catalogo": lambda: programa_service.upsert_excat_lote(aluno_id, efeitos.get("exercicios", [])),
        "ponteiro": lambda: programa_service.touch_aluno_pointer(personal_id, aluno_id),
    }
    for nome, fn in tarefas.items():
        if nome in concluidos:
            continue
        try:
            fn()
            # ADD no set: retomadas concorrentes não apagam progresso umas das outras.
            repo.add_to_set(keys.pk_personal(personal_id), op_sk(operation_id), "efeitos_concluidos", {nome})
            concluidos.add(nome)
        except Exception:
            log.warning("efeito pendente operation=%s efeito=%s", operation_id, nome)
    if set(tarefas) <= concluidos:
        repo.delete_item(keys.pk_sched(op["aplicado_em"][:10]), PENDING_PREFIX + operation_id)


def _agenda(efeitos, aluno_id, personal_id):
    from app.services import programa_service
    for pk, sk in efeitos.get("agenda_remover", []):
        base = revisao(aluno_id)
        tid = sk.removeprefix("DUE#")
        atual = repo.get_item(keys.pk_aluno(aluno_id), keys.sk_treino(tid), consistent=True)
        if not atual or pk != keys.pk_sched(atual.get("data_fim") or ""):
            repo.transact_write([proteger_revisao(aluno_id, base), delete(pk, sk)])
    for args in efeitos.get("agenda", []):
        # Não ressuscitar agenda de um treino já removido por operação posterior.
        base = revisao(aluno_id)
        atual = repo.get_item(keys.pk_aluno(args[1]), keys.sk_treino(args[2]), consistent=True)
        if atual and atual.get("data_fim"):
            programa_service.sync_due(personal_id, aluno_id, args[2], atual.get("nome"), atual["data_fim"],
                                      revisao_esperada=base)


def update_action(pk: str, sk: str, fields: dict) -> dict:
    names = {f"#f{i}": k for i, k in enumerate(fields)}
    values = {f":v{i}": v for i, v in enumerate(fields.values()) if v is not None}
    setters = [f"#f{i} = :v{i}" for i, v in enumerate(fields.values()) if v is not None]
    removers = [f"#f{i}" for i, v in enumerate(fields.values()) if v is None]
    expression = ("SET " + ", ".join(setters) if setters else "")
    if removers:
        expression += " REMOVE " + ", ".join(removers)
    body = {"Key": {"PK": pk, "SK": sk}, "UpdateExpression": expression.strip(),
            "ConditionExpression": "attribute_exists(PK)", "ExpressionAttributeNames": names}
    if values:
        body["ExpressionAttributeValues"] = values
    return {"Update": body}


def atualizar(personal_id: str, aluno_id: str, sk: str, fields: dict, *, base: int, **metadata) -> dict:
    old = repo.get_item(keys.pk_aluno(aluno_id), sk, consistent=True) or {}
    efeitos = {}
    if sk.startswith("TREINO#"):
        merged = {**old, **fields}
        efeitos = {"agenda_remover": [[keys.pk_sched(old["data_fim"]), keys.sk_due(old["treino_id"])]] if old.get("data_fim") else [],
                   "agenda": [[personal_id, aluno_id, old["treino_id"], merged.get("nome"), merged["data_fim"]]] if merged.get("data_fim") else []}
    elif sk.startswith("EX#"):
        efeitos = {"exercicios": [{**old, **fields}]}
    commit(personal_id, aluno_id, base, efeitos=efeitos, **metadata,
           updates=[update_action(keys.pk_aluno(aluno_id), sk, fields)])
    return repo.clean(repo.get_item(keys.pk_aluno(aluno_id), sk, consistent=True))


def idempotencia(*parts) -> str:
    return hashlib.sha256(json.dumps(parts, sort_keys=True, ensure_ascii=False, default=str).encode()).hexdigest()[:40]
