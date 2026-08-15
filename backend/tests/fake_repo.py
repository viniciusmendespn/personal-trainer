"""DynamoDB em memória para os testes do MCP.

Os testes do projeto não usam moto — patcham o `repo` do módulo sob teste. O servidor MCP
toca em muitas chaves (clientes OAuth, códigos, grants, snapshots), então vale um fake com
a mesma superfície de `dynamo_repo` em vez de dezenas de mocks soltos.
"""
import base64
import json

_INTERNAL = {"PK", "SK", "GSI1PK", "GSI1SK", "ttl"}


class FakeRepo:
    def __init__(self):
        self.itens: dict[tuple[str, str], dict] = {}

    # ── leitura ────────────────────────────────────────────────────────────
    def get_item(self, pk, sk, consistent=False):
        item = self.itens.get((pk, sk))
        return dict(item) if item else None

    def _da_particao(self, pk, sk_prefix=None):
        return [dict(v) for (p, s), v in sorted(self.itens.items())
                if p == pk and (sk_prefix is None or s.startswith(sk_prefix))]

    def query_pk(self, pk, sk_prefix=None, consistent=False):
        return self._da_particao(pk, sk_prefix)

    def query_pk_last_n(self, pk, sk_prefix, limit):
        return list(reversed(self._da_particao(pk, sk_prefix)))[:limit]

    def query_between(self, pk, sk_low, sk_high):
        return [dict(v) for (p, s), v in sorted(self.itens.items())
                if p == pk and sk_low <= s <= sk_high]

    def query_pk_page(self, pk, sk_prefix, limit, cursor=None, forward=True,
                      filters=None, max_scans=8):
        itens = self._da_particao(pk, sk_prefix)
        if not forward:
            itens.reverse()
        for k, v in (filters or {}).items():
            itens = [i for i in itens if i.get(k) == v]
        if cursor:
            alvo = json.loads(base64.urlsafe_b64decode(cursor.encode()).decode())["SK"]
            itens = [i for i in itens if (i["SK"] > alvo if forward else i["SK"] < alvo)]
        pagina, resto = itens[:limit], itens[limit:]
        prox = None
        if resto and pagina:
            prox = base64.urlsafe_b64encode(
                json.dumps({"PK": pk, "SK": pagina[-1]["SK"]}).encode()).decode()
        return pagina, prox

    def batch_get_items(self, keys_list):
        return {k: dict(self.itens[k]) for k in keys_list if k in self.itens}

    # ── escrita ────────────────────────────────────────────────────────────
    def put_item(self, pk, sk, data):
        self.itens[(pk, sk)] = {**data, "PK": pk, "SK": sk}

    def put_item_if_absent(self, pk, sk, data):
        if (pk, sk) in self.itens:
            return False
        self.put_item(pk, sk, data)
        return True

    def update_item(self, pk, sk, fields, return_values=False):
        item = self.itens.setdefault((pk, sk), {"PK": pk, "SK": sk})
        for k, v in fields.items():
            if v is None:
                item.pop(k, None)
            else:
                item[k] = v
        return dict(item)

    def update_item_if_exists(self, pk, sk, fields):
        if (pk, sk) not in self.itens:
            return None
        return self.update_item(pk, sk, fields)

    def add_and_set(self, pk, sk, add=None, set_=None, return_values=False):
        item = self.itens.setdefault((pk, sk), {"PK": pk, "SK": sk})
        for k, v in (set_ or {}).items():
            item[k] = v
        for k, v in (add or {}).items():
            item[k] = item.get(k, 0) + v
        return dict(item)

    def increment_counter(self, pk, sk, field, amount=1):
        self.add_and_set(pk, sk, add={field: amount})

    def delete_item(self, pk, sk):
        self.itens.pop((pk, sk), None)

    def delete_item_if_exists(self, pk, sk):
        return self.itens.pop((pk, sk), None) is not None

    def batch_write(self, puts=None, deletes=None):
        for p in puts or []:
            self.itens[(p["PK"], p["SK"])] = dict(p)
        for pk, sk in deletes or []:
            self.itens.pop((pk, sk), None)

    # ── serialização ───────────────────────────────────────────────────────
    def clean(self, item):
        if item is None:
            return None
        return {k: v for k, v in item.items() if k not in _INTERNAL}

    def clean_all(self, items):
        return [self.clean(i) for i in items]
