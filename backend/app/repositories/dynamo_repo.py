"""Acesso ao DynamoDB single-table. Cliente singleton (reuso entre invocações
quentes). Primitivos genéricos — sem read-before-write (ESPEC §3 / ARCHITECTURE §4.4).

Sanitização: DynamoDB (boto3 resource) não aceita float — convertemos float->Decimal na
escrita e Decimal->int/float na leitura."""
import base64
import json
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from app.config import settings

_table = None
_INTERNAL = {"PK", "SK", "GSI1PK", "GSI1SK", "ttl"}


def _get_table():
    global _table
    if _table is None:
        dynamodb = boto3.resource("dynamodb", region_name=settings.cognito_region)
        _table = dynamodb.Table(settings.table_name)
    return _table


def _san(v):
    """float -> Decimal (recursivo) para escrita."""
    if isinstance(v, float):
        return Decimal(str(v))
    if isinstance(v, dict):
        return {k: _san(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_san(x) for x in v]
    return v


def _undec(v):
    """Decimal -> int/float (recursivo) para leitura."""
    if isinstance(v, Decimal):
        return int(v) if v % 1 == 0 else float(v)
    if isinstance(v, dict):
        return {k: _undec(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_undec(x) for x in v]
    return v


def clean(item: dict | None) -> dict | None:
    """Remove chaves internas e converte Decimals — para devolver via API."""
    if item is None:
        return None
    return {k: _undec(v) for k, v in item.items() if k not in _INTERNAL}


def clean_all(items: list[dict]) -> list[dict]:
    return [clean(i) for i in items]


# ── Leitura ──────────────────────────────────────────────────────────────────
def get_item(pk: str, sk: str, consistent: bool = False) -> dict | None:
    resp = _get_table().get_item(Key={"PK": pk, "SK": sk}, ConsistentRead=consistent)
    return resp.get("Item")


def query_pk(pk: str, sk_prefix: str | None = None) -> list[dict]:
    cond = Key("PK").eq(pk)
    if sk_prefix:
        cond &= Key("SK").begins_with(sk_prefix)
    resp = _get_table().query(KeyConditionExpression=cond)
    return resp.get("Items", [])


def query_pk_last_n(pk: str, sk_prefix: str, limit: int) -> list[dict]:
    cond = Key("PK").eq(pk) & Key("SK").begins_with(sk_prefix)
    resp = _get_table().query(KeyConditionExpression=cond, ScanIndexForward=False, Limit=limit)
    return resp.get("Items", [])


def _encode_cursor(key: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(key).encode()).decode()


def _decode_cursor(cursor: str) -> dict:
    return json.loads(base64.urlsafe_b64decode(cursor.encode()).decode())


def query_pk_page(
    pk: str, sk_prefix: str, limit: int, cursor: str | None = None, forward: bool = True
) -> tuple[list[dict], str | None]:
    """Paginação cursor-based — usar em coleções que crescem sem limite por usuário
    (séries temporais como chat/notificações, ou listas que escalam com a carteira do
    personal). `cursor` é opaco (carrega o LastEvaluatedKey codificado); coleções pequenas/
    limitadas por aluno ou personal continuam usando `query_pk` sem paginação."""
    cond = Key("PK").eq(pk) & Key("SK").begins_with(sk_prefix)
    kwargs: dict = {"KeyConditionExpression": cond, "ScanIndexForward": forward, "Limit": limit}
    if cursor:
        kwargs["ExclusiveStartKey"] = _decode_cursor(cursor)
    resp = _get_table().query(**kwargs)
    last_key = resp.get("LastEvaluatedKey")
    next_cursor = _encode_cursor(last_key) if last_key else None
    return resp.get("Items", []), next_cursor


def query_between(pk: str, sk_low: str, sk_high: str) -> list[dict]:
    cond = Key("PK").eq(pk) & Key("SK").between(sk_low, sk_high)
    resp = _get_table().query(KeyConditionExpression=cond)
    return resp.get("Items", [])


def query_gsi1_last(gsi1pk: str, limit: int = 1) -> list[dict]:
    """Último(s) registro(s) de um exercício — "quanto peguei?" (ESPEC §4.1)."""
    resp = _get_table().query(
        IndexName="GSI1",
        KeyConditionExpression=Key("GSI1PK").eq(gsi1pk),
        ScanIndexForward=False,
        Limit=limit,
    )
    return resp.get("Items", [])


# ── Escrita ──────────────────────────────────────────────────────────────────
def put_item(pk: str, sk: str, data: dict) -> None:
    _get_table().put_item(Item={"PK": pk, "SK": sk, **_san(data)})


def put_item_if_absent(pk: str, sk: str, data: dict) -> bool:
    """Put condicional — False se o item já existe (dedup, unicidade)."""
    try:
        _get_table().put_item(
            Item={"PK": pk, "SK": sk, **_san(data)},
            ConditionExpression=Attr("PK").not_exists(),
        )
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise


def update_item(pk: str, sk: str, fields: dict, return_values: bool = False) -> dict:
    set_fields = {k: v for k, v in fields.items() if v is not None}
    remove_keys = [k for k, v in fields.items() if v is None]
    parts, names = [], {f"#{k}": k for k in fields}
    values = {f":{k}": _san(v) for k, v in set_fields.items()}
    if set_fields:
        parts.append("SET " + ", ".join(f"#{k} = :{k}" for k in set_fields))
    if remove_keys:
        parts.append("REMOVE " + ", ".join(f"#{k}" for k in remove_keys))
    kwargs: dict = {
        "Key": {"PK": pk, "SK": sk},
        "UpdateExpression": " ".join(parts),
        "ExpressionAttributeNames": names,
        "ReturnValues": "ALL_NEW" if return_values else "NONE",
    }
    if values:
        kwargs["ExpressionAttributeValues"] = values
    return _get_table().update_item(**kwargs).get("Attributes", {})


def update_item_if_exists(pk: str, sk: str, fields: dict) -> dict | None:
    """1 operação condicional em vez de get + update (ARCHITECTURE §10.2). None se não existe."""
    expr = "SET " + ", ".join(f"#{k} = :{k}" for k in fields)
    names = {f"#{k}": k for k in fields}
    values = {f":{k}": _san(v) for k, v in fields.items()}
    try:
        resp = _get_table().update_item(
            Key={"PK": pk, "SK": sk},
            UpdateExpression=expr,
            ConditionExpression=Attr("PK").exists(),
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
            ReturnValues="ALL_NEW",
        )
        return resp.get("Attributes", {})
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return None
        raise


def put_series(pk: str, sk: str, series: list, on_insert: dict, set_always: dict | None = None) -> dict:
    """Substitui `series_exec` (edição). Metadados de criação via if_not_exists;
    `set_always` sobrescreve incondicionalmente a cada chamada (ex.: qual variante/substituto
    foi executada — precisa mudar a cada edição, ao contrário dos metadados de criação)."""
    names = {"#se": "series_exec"}
    values = {":new": _san(series)}
    parts = ["#se = :new"]
    for i, (k, v) in enumerate(on_insert.items()):
        names[f"#k{i}"] = k
        values[f":v{i}"] = _san(v)
        parts.append(f"#k{i} = if_not_exists(#k{i}, :v{i})")
    for i, (k, v) in enumerate((set_always or {}).items()):
        names[f"#a{i}"] = k
        values[f":a{i}"] = _san(v)
        parts.append(f"#a{i} = :a{i}")
    resp = _get_table().update_item(
        Key={"PK": pk, "SK": sk}, UpdateExpression="SET " + ", ".join(parts),
        ExpressionAttributeNames=names, ExpressionAttributeValues=values, ReturnValues="ALL_NEW")
    return resp.get("Attributes", {})


def append_series(pk: str, sk: str, new_series: list, on_insert: dict) -> dict:
    """Cria o registro (campos de `on_insert`) ou faz append em `series_exec` (ESPEC §3.2).
    1 write, sem read prévio. `on_insert` só é aplicado na criação (if_not_exists)."""
    names = {"#se": "series_exec"}
    values = {":new": _san(new_series), ":empty": []}
    set_parts = ["#se = list_append(if_not_exists(#se, :empty), :new)"]
    for i, (k, v) in enumerate(on_insert.items()):
        names[f"#k{i}"] = k
        values[f":v{i}"] = _san(v)
        set_parts.append(f"#k{i} = if_not_exists(#k{i}, :v{i})")
    resp = _get_table().update_item(
        Key={"PK": pk, "SK": sk},
        UpdateExpression="SET " + ", ".join(set_parts),
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
        ReturnValues="ALL_NEW",
    )
    return resp.get("Attributes", {})


def increment_counter(pk: str, sk: str, field: str, amount: int = 1) -> None:
    """Contador atômico p/ indicadores Nível A (ESPEC §3.1)."""
    _get_table().update_item(
        Key={"PK": pk, "SK": sk},
        UpdateExpression=f"ADD #{field} :a",
        ExpressionAttributeNames={f"#{field}": field},
        ExpressionAttributeValues={":a": amount},
    )


def add_and_set(pk: str, sk: str, add: dict | None = None, set_: dict | None = None,
                return_values: bool = False) -> dict:
    """ADD (contadores) + SET (rótulos) num único write — agregação na escrita (ESPEC §3.1).
    `return_values=True` devolve o item pós-write (ALL_NEW) — opt-in, evita 1 read extra
    quando o chamador precisa do valor atualizado (ex.: rate limit)."""
    names: dict = {}
    values: dict = {}
    parts: list[str] = []
    if set_:
        for k, v in set_.items():
            names[f"#s{k}"] = k
            values[f":s{k}"] = _san(v)
        parts.append("SET " + ", ".join(f"#s{k} = :s{k}" for k in set_))
    if add:
        for k, v in add.items():
            names[f"#a{k}"] = k
            values[f":a{k}"] = _san(v)
        parts.append("ADD " + ", ".join(f"#a{k} :a{k}" for k in add))
    resp = _get_table().update_item(
        Key={"PK": pk, "SK": sk}, UpdateExpression=" ".join(parts),
        ExpressionAttributeNames=names, ExpressionAttributeValues=values,
        ReturnValues="ALL_NEW" if return_values else "NONE",
    )
    return resp.get("Attributes", {})


def update_if_greater(pk: str, sk: str, field: str, value, extra: dict | None = None) -> bool:
    """Grava o item só se `value` superar o atual (ou não existir) — recordes/PR.
    Retorna True se foi um novo recorde."""
    names = {f"#{field}": field}
    values = {":v": _san(value)}
    sets = [f"#{field} = :v"]
    for i, (k, v) in enumerate((extra or {}).items()):
        names[f"#e{i}"] = k
        values[f":e{i}"] = _san(v)
        sets.append(f"#e{i} = :e{i}")
    try:
        _get_table().update_item(
            Key={"PK": pk, "SK": sk},
            UpdateExpression="SET " + ", ".join(sets),
            ConditionExpression=f"attribute_not_exists(#{field}) OR #{field} < :v",
            ExpressionAttributeNames=names, ExpressionAttributeValues=values,
        )
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise


def list_append_item(pk: str, sk: str, field: str, item: dict) -> bool:
    """Appends one dict to a list field. Returns False if the parent item does not exist."""
    try:
        _get_table().update_item(
            Key={"PK": pk, "SK": sk},
            UpdateExpression="SET #f = list_append(if_not_exists(#f, :empty), :new)",
            ConditionExpression=Attr("PK").exists(),
            ExpressionAttributeNames={"#f": field},
            ExpressionAttributeValues={":empty": [], ":new": [_san(item)]},
        )
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise


def delete_item(pk: str, sk: str) -> None:
    _get_table().delete_item(Key={"PK": pk, "SK": sk})


def delete_item_if_exists(pk: str, sk: str) -> bool:
    try:
        _get_table().delete_item(Key={"PK": pk, "SK": sk}, ConditionExpression=Attr("PK").exists())
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise


def batch_write(puts: list[dict] | None = None, deletes: list[tuple] | None = None) -> None:
    """Criação/remoção em massa (ex.: treino com N exercícios em 1 lote). ESPEC §3."""
    table = _get_table()
    with table.batch_writer() as writer:
        for item in puts or []:
            writer.put_item(Item=_san(item))
        for pk, sk in deletes or []:
            writer.delete_item(Key={"PK": pk, "SK": sk})
