"""Migração única: unifica os tipos legados CARDIO e PESO_CORPORAL no novo tipo PERFORMANCE.

Reescreve `tipo_exercicio` em todos os itens que o carregam (direto ou aninhado), define a
unidade da métrica (`unidade_reps`) quando vazia e a direção (`metrica_direcao = "MAIOR"`):

  - CARDIO        -> PERFORMANCE ; unidade_reps padrão "min"
  - PESO_CORPORAL -> PERFORMANCE ; unidade_reps padrão "reps"

Alcance dos itens:
  - EX#     (exercícios do aluno)          → `tipo_exercicio` no topo do item
  - EXLIB#  (biblioteca, vinda de pacotes) → `tipo_exercicio` no topo do item
  - TEMPLATE# (templates do personal)      → lista aninhada `exercicios[]`
  - SESSION# / SESSION#ACTIVE (sessões)    → listas aninhadas `exercicios[]`, `exercicios_exec[]` e `ex_atual{}`

Idempotente: rodar 2× não muda nada na 2ª vez (já estão em PERFORMANCE). O backend também
normaliza CARDIO/PESO_CORPORAL na leitura, então a app funciona mesmo antes desta migração —
o script só limpa o dado em repouso e fixa a unidade padrão.

Uso:
  # Dry-run (não escreve nada):
  python scripts/migrar_resistencia.py --profile pessoal-hotmail
  # Executa:
  python scripts/migrar_resistencia.py --profile pessoal-hotmail --execute
"""
import argparse

import boto3
from boto3.dynamodb.conditions import Attr

TABLE_DEFAULT = "personal-trainer-prod"
REGION = "us-east-1"

LEGADOS = ("CARDIO", "PESO_CORPORAL")
UNIDADE_PADRAO = {"CARDIO": "min", "PESO_CORPORAL": "reps"}


def migrar_ex(ex: dict) -> bool:
    """Normaliza UM dict de exercício in-place. Retorna True se mudou."""
    tipo = ex.get("tipo_exercicio")
    if tipo not in LEGADOS:
        return False
    ex["tipo_exercicio"] = "PERFORMANCE"
    if not ex.get("unidade_reps"):
        ex["unidade_reps"] = UNIDADE_PADRAO[tipo]
    if not ex.get("metrica_direcao"):
        ex["metrica_direcao"] = "MAIOR"
    return True


def scan_all(table) -> list[dict]:
    """Varre a tabela trazendo só os atributos que podem conter tipo_exercicio."""
    proj = "PK, SK, tipo_exercicio, unidade_reps, metrica_direcao, exercicios, exercicios_exec, ex_atual"
    items: list[dict] = []
    kwargs = {"ProjectionExpression": proj}
    while True:
        resp = table.scan(**kwargs)
        items.extend(resp.get("Items", []))
        last = resp.get("LastEvaluatedKey")
        if not last:
            break
        kwargs["ExclusiveStartKey"] = last
    return items


def run(table_name: str, profile: str, execute: bool) -> None:
    session = boto3.Session(profile_name=profile, region_name=REGION)
    table = session.resource("dynamodb").Table(table_name)

    items = scan_all(table)
    plano = []  # (pk, sk, update_expr, values)

    for it in items:
        pk, sk = it["PK"], it["SK"]
        sets: dict[str, object] = {}

        # 1) Exercício direto no topo (EX#, EXLIB#)
        if it.get("tipo_exercicio") in LEGADOS:
            topo = {k: it.get(k) for k in ("tipo_exercicio", "unidade_reps", "metrica_direcao")}
            migrar_ex(topo)
            sets.update(topo)

        # 2) Listas/objetos aninhados (TEMPLATE#, SESSION#)
        for attr in ("exercicios", "exercicios_exec"):
            lista = it.get(attr)
            if isinstance(lista, list):
                mudou = False
                for e in lista:
                    if isinstance(e, dict):
                        mudou = migrar_ex(e) or mudou
                if mudou:
                    sets[attr] = lista

        ex_atual = it.get("ex_atual")
        if isinstance(ex_atual, dict) and migrar_ex(ex_atual):
            sets["ex_atual"] = ex_atual

        if sets:
            names = {f"#a{i}": k for i, k in enumerate(sets)}
            values = {f":a{i}": v for i, (k, v) in enumerate(sets.items())}
            expr = "SET " + ", ".join(f"#a{i} = :a{i}" for i in range(len(sets)))
            plano.append((pk, sk, expr, names, values, list(sets.keys())))

    print(f"\n== {len(plano)} item(ns) a migrar (de {len(items)} varridos) ==")
    for pk, sk, _expr, _n, _v, campos in plano[:25]:
        print(f"  {pk} / {sk}: {', '.join(campos)}")
    if len(plano) > 25:
        print(f"  ... e mais {len(plano) - 25}")

    if execute and plano:
        print("\nAplicando...")
        for pk, sk, expr, names, values, _campos in plano:
            table.update_item(
                Key={"PK": pk, "SK": sk},
                UpdateExpression=expr,
                ExpressionAttributeNames=names,
                ExpressionAttributeValues=values,
            )
        print(f"{len(plano)} item(ns) migrado(s).")
    elif not execute:
        print("\nRode com --execute para aplicar as mudanças.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", default="pessoal-hotmail")
    parser.add_argument("--table", default=TABLE_DEFAULT)
    parser.add_argument("--execute", action="store_true", help="Aplica a migração (default: dry-run)")
    args = parser.parse_args()
    run(args.table, args.profile, args.execute)
