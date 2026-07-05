"""Migração única: indexa os itens de feed (POST#/DOR#/DUVIDA#/CORRECAO#/MIDIA#) no GSI1
pelo nome canônico (`AL#{aluno}#FEED#{chave}`) e semeia o catálogo permanente de exercícios
do aluno (`EXCAT#{chave}`).

Contexto: a identidade pública do exercício nas telas de evolução/feed passou a ser a chave
canônica do nome (o `exercicio_id` muda toda vez que o programa é recriado). Itens novos já
nascem com `GSI1PK`/`GSI1SK` e o EXCAT é alimentado pelos hooks (criação de exercício,
finalize de sessão, postagens); este script cobre apenas o passado.

Passo 1 — Itens de feed: deriva a chave (atributo `chave` → `exercicio_nome` → resolve o
`exercicio_id` embutido na SK contra os EX# vivos) e carimba `chave` + `GSI1PK` + `GSI1SK`
via UpdateItem. Itens irresolvíveis (sem nome em nenhuma fonte) são logados e pulados — só
ficam acessíveis pelas rotas legadas por id.

Passo 2 — EXCAT#: semeia a partir de STATS#PR# (nome), dos itens de feed do passo 1 e dos
EX# vivos (com metadados tipo/unidades/direção). Usa if_not_exists: valores já gravados
pelos hooks (pós-deploy) vencem.

Uso:
  # Dry-run (lista o que seria alterado, não escreve nada):
  python scripts/backfill_feed_chave_gsi.py --profile pessoal-hotmail

  # Executa a migração:
  python scripts/backfill_feed_chave_gsi.py --profile pessoal-hotmail --execute
"""
import argparse
import unicodedata
from datetime import datetime

import boto3
from boto3.dynamodb.conditions import Attr

TABLE_DEFAULT = "personal-trainer-prod"
REGION = "us-east-1"

FEED_PREFIXES = ("POST#", "DOR#", "DUVIDA#", "CORRECAO#", "MIDIA#")
EXCAT_META = ("tipo_exercicio", "grupo", "unidade_carga", "unidade_reps", "metrica_direcao", "rm_kg")


def chave_exercicio(nome: str | None) -> str:
    """Mesma normalização de app.services.sessao_service.chave_exercicio — duplicada aqui
    para manter o script standalone (sem depender do app FastAPI)."""
    if not nome:
        return ""
    sem_acento = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode()
    return " ".join(sem_acento.lower().split())


def gsi1_feed(aluno_pk: str, chave: str) -> str:
    return f"{aluno_pk}#FEED#{chave}"          # aluno_pk já é "AL#{id}"


def scan_all(table, filtro, projection: str, names: dict | None = None) -> list[dict]:
    items: list[dict] = []
    kwargs: dict = {"FilterExpression": filtro, "ProjectionExpression": projection}
    if names:
        kwargs["ExpressionAttributeNames"] = names
    while True:
        resp = table.scan(**kwargs)
        items.extend(resp.get("Items", []))
        last = resp.get("LastEvaluatedKey")
        if not last:
            break
        kwargs["ExclusiveStartKey"] = last
    return items


def _ts_do_item(sk: str, data_hora: str | None) -> str:
    """Epoch ms p/ a GSI1SK (F#{ts}): POST/DOR/DUVIDA/CORRECAO embutem o ts na SK
    (segmento 2); MIDIA não tem ts na SK — cai no data_hora ISO."""
    parts = sk.split("#")
    if len(parts) >= 3 and parts[2].isdigit():
        return parts[2]
    if data_hora:
        try:
            dt = datetime.fromisoformat(data_hora.replace("Z", "+00:00"))
            return str(int(dt.timestamp() * 1000))
        except ValueError:
            pass
    return "0"


def coletar(table):
    """Uma passada de scan por família. Retorna (feed_items, exs_por_aluno, prs, excat_existentes)."""
    filtro_feed = Attr("SK").begins_with(FEED_PREFIXES[0])
    for p in FEED_PREFIXES[1:]:
        filtro_feed = filtro_feed | Attr("SK").begins_with(p)
    feed = scan_all(
        table, filtro_feed & Attr("PK").begins_with("AL#"),
        "PK, SK, chave, exercicio_nome, exercicio_id, GSI1PK, data_hora",
    )
    # begins_with("EX#") não captura EXCAT# (3º char 'C' ≠ '#') — só a prescrição viva.
    exs = scan_all(
        table, Attr("SK").begins_with("EX#") & Attr("PK").begins_with("AL#"),
        "PK, SK, exercicio_id, nome, tipo_exercicio, grupo, unidade_carga, unidade_reps, metrica_direcao, rm_kg",
    )
    prs = scan_all(table, Attr("SK").begins_with("STATS#PR#") & Attr("PK").begins_with("AL#"),
                   "PK, SK, exercicio_nome")
    excat = scan_all(table, Attr("SK").begins_with("EXCAT#"), "PK, SK")
    exs_por_aluno: dict[str, dict[str, dict]] = {}
    for e in exs:
        if e.get("exercicio_id"):
            exs_por_aluno.setdefault(e["PK"], {})[e["exercicio_id"]] = e
    return feed, exs_por_aluno, prs, {(i["PK"], i["SK"]) for i in excat}


def migrar_feed(table, feed: list[dict], exs_por_aluno: dict, execute: bool) -> dict[tuple[str, str], str]:
    """Carimba chave+GSI1 nos itens de feed. Retorna {(pk, chave): nome} p/ semear o EXCAT."""
    a_atualizar: list[tuple[str, str, str, str, str]] = []   # (pk, sk, chave, gsi1pk, gsi1sk)
    nomes_por_chave: dict[tuple[str, str], str] = {}
    pulados = 0
    for it in feed:
        pk, sk = it["PK"], it["SK"]
        nome = it.get("exercicio_nome")
        chave = it.get("chave") or chave_exercicio(nome)
        if not chave:
            # Último recurso: resolve o exercicio_id (atributo ou slot da SK) nos EX# vivos
            eid = it.get("exercicio_id") or (sk.split("#")[1] if len(sk.split("#")) > 1 else None)
            ex = exs_por_aluno.get(pk, {}).get(eid or "")
            if ex and ex.get("nome"):
                nome = ex["nome"]
                chave = chave_exercicio(nome)
        if not chave:
            pulados += 1
            continue
        if nome:
            nomes_por_chave.setdefault((pk, chave), nome)
        gsi1pk = gsi1_feed(pk, chave)
        if it.get("GSI1PK") == gsi1pk and it.get("chave") == chave:
            continue
        a_atualizar.append((pk, sk, chave, gsi1pk, f"F#{_ts_do_item(sk, it.get('data_hora'))}"))

    print(f"\n== Feed — {len(a_atualizar)} de {len(feed)} item(ns) a carimbar (chave+GSI1); {pulados} irresolvível(is) ==")
    for pk, sk, chave, *_ in a_atualizar[:20]:
        print(f"  {pk} / {sk} -> chave={chave!r}")
    if len(a_atualizar) > 20:
        print(f"  ... e mais {len(a_atualizar) - 20}")

    if execute and a_atualizar:
        print("\nCarimbando itens de feed...")
        for pk, sk, chave, gsi1pk, gsi1sk in a_atualizar:
            table.update_item(
                Key={"PK": pk, "SK": sk},
                UpdateExpression="SET chave = :c, GSI1PK = :p, GSI1SK = :s",
                ExpressionAttributeValues={":c": chave, ":p": gsi1pk, ":s": gsi1sk},
            )
        print(f"{len(a_atualizar)} item(ns) atualizado(s).")
    return nomes_por_chave


def semear_excat(table, exs_por_aluno: dict, prs: list[dict],
                 nomes_feed: dict[tuple[str, str], str], excat_existentes: set, execute: bool) -> None:
    # (pk, chave) -> {nome, meta...}; EX# vivo tem prioridade (traz metadados)
    catalogo: dict[tuple[str, str], dict] = {}
    for (pk, chave), nome in nomes_feed.items():
        catalogo[(pk, chave)] = {"nome": nome}
    for p in prs:
        chave = p["SK"].removeprefix("STATS#PR#")
        nome = p.get("exercicio_nome")
        if chave and nome:
            catalogo.setdefault((p["PK"], chave), {"nome": nome})
    for pk, por_id in exs_por_aluno.items():
        for ex in por_id.values():
            chave = chave_exercicio(ex.get("nome"))
            if not chave:
                continue
            entry = {"nome": ex.get("nome")}
            for k in EXCAT_META:
                if ex.get(k) is not None:
                    entry[k] = ex[k]
            catalogo[(pk, chave)] = {**catalogo.get((pk, chave), {}), **entry}

    novos = [(pk, chave, dados) for (pk, chave), dados in sorted(catalogo.items())
             if (pk, f"EXCAT#{chave}") not in excat_existentes]
    print(f"\n== EXCAT — {len(novos)} de {len(catalogo)} chave(s) a semear (restante já existe) ==")
    for pk, chave, dados in novos[:20]:
        print(f"  {pk} / EXCAT#{chave}: nome={dados.get('nome')!r}")
    if len(novos) > 20:
        print(f"  ... e mais {len(novos) - 20}")

    if execute and novos:
        print("\nSemeando catálogo...")
        for pk, chave, dados in novos:
            campos = {k: v for k, v in dados.items() if v is not None}
            if not campos.get("nome"):
                continue
            names = {f"#a{i}": k for i, k in enumerate(campos)}
            values = {f":v{i}": v for i, v in enumerate(campos.values())}
            # if_not_exists: se um hook do app já gravou (pós-deploy), o valor dele vence.
            expr = ", ".join(f"#a{i} = if_not_exists(#a{i}, :v{i})" for i in range(len(campos)))
            table.update_item(
                Key={"PK": pk, "SK": f"EXCAT#{chave}"},
                UpdateExpression=f"SET {expr}",
                ExpressionAttributeNames=names,
                ExpressionAttributeValues=values,
            )
        print(f"{len(novos)} item(ns) EXCAT gravado(s).")


def run(table_name: str, profile: str, execute: bool) -> None:
    session = boto3.Session(profile_name=profile, region_name=REGION)
    table = session.resource("dynamodb").Table(table_name)

    feed, exs_por_aluno, prs, excat_existentes = coletar(table)
    nomes_feed = migrar_feed(table, feed, exs_por_aluno, execute)
    semear_excat(table, exs_por_aluno, prs, nomes_feed, excat_existentes, execute)

    if not execute:
        print("\nRode com --execute para aplicar as mudanças.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", default="pessoal-hotmail")
    parser.add_argument("--table", default=TABLE_DEFAULT)
    parser.add_argument("--execute", action="store_true", help="Aplica a migração (default: dry-run)")
    args = parser.parse_args()
    run(args.table, args.profile, args.execute)
