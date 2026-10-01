import unicodedata
from datetime import date, timedelta

from app.repositories import dynamo_repo as repo, keys
from app.services import pendencia_service as pend


def normalizar(texto):
    return "".join(c for c in unicodedata.normalize("NFD", (texto or "").casefold()) if not unicodedata.combining(c))


def pagina(personal_id, *, busca=None, status=None, filtro=None, limit=50, cursor=None):
    hoje = pend.hoje_iso(personal_id)
    proximo = (date.fromisoformat(hoje) + timedelta(days=7)).isoformat()
    out = []
    examinados = 0
    for _ in range(8):
        items, cursor = repo.query_pk_page(keys.pk_personal(personal_id), "ALUNO#",
            limit - len(out), cursor, filters={"status": status} if status else None, max_scans=1)
        examinados += len(items)
        for item in items:
            if normalizar((busca or "").strip()) not in normalizar(item.get("nome")):
                continue
            pendencias = pend.avaliar(status=item.get("status"), bloqueado=False,
                created_at=item.get("created_at"), vigencias=item.get("vigencias"),
                ultimo_treino_em=item.get("ultimo_treino_em"), vencidas=0, hoje=hoje)
            vigencias = item.get("vigencias")
            tags = [p["tipo"] for p in pendencias]
            if item.get("status") != "INATIVO" and vigencias:
                if all(v.get("f") and v["f"] < hoje for v in vigencias):
                    tags.append("VENCIDOS")
                if any(pend.janela_vigente(v, hoje) and v.get("f") and hoje <= v["f"] <= proximo for v in vigencias):
                    tags.append("PROXIMOS")
            if filtro and filtro not in tags:
                continue
            out.append({"aluno_id": item.get("aluno_id"), "nome": item.get("nome") or "",
                "status": item.get("status"), "objetivos": item.get("objetivos"),
                "ultimo_treino_em": item.get("ultimo_treino_em"), "updated_at": item.get("updated_at"),
                "pendencias": pendencias, "filtros": tags,
                "vigencia_informada": vigencias is not None,
                "urgencia": 0 if "SEM_TREINO_VIGENTE" in tags else 1 if "PROXIMOS" in tags else 2 if "SEM_TREINAR" in tags else 3})
        if len(out) >= limit or not cursor:
            break
    return {"items": out, "next_cursor": cursor,
        "cobertura": {"completa": not bool(cursor), "alunos_examinados": examinados},
        "criterios": {"proximos_dias": 7, "sem_treinar_dias": pend.DIAS_SEM_TREINAR, "hoje": hoje}}
