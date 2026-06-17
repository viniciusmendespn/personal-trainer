"""Posts de correção do personal — texto livre + mídias vinculadas a um exercício.
Aparecem no feed do exercício para personal e aluno."""
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import anotif_service, media_service
from app.utils import epoch_ms, new_id, now_iso


def criar_correcao(personal_id: str, aluno_id: str, exercicio_id: str,
                   exercicio_nome: str | None, texto: str,
                   midias: list[dict]) -> dict:
    """midias = [{s3_key, tipo}] — arquivos já enviados via presigned URL."""
    ts = epoch_ms()
    correcao_id = new_id()
    item = {
        "correcao_id": correcao_id, "personal_id": personal_id,
        "exercicio_id": exercicio_id, "exercicio_nome": exercicio_nome,
        "texto": texto, "midias": midias, "data_hora": now_iso(),
    }
    repo.put_item(keys.pk_aluno(aluno_id),
                  keys.sk_correcao_ex(exercicio_id, ts, correcao_id), item)
    ex_nome = exercicio_nome or "um exercício"
    anotif_service.criar(aluno_id, "CORRECAO_EXERCICIO", "Correção do personal",
                         f"Seu personal postou uma correção em {ex_nome}.",
                         ref_id=correcao_id)
    return item


def _enrich_midias(midias: list[dict]) -> list[dict]:
    return [{**m, "url": media_service.gerar_presigned_view_url(m["s3_key"])} for m in midias]


def feed_exercicio(aluno_id: str, exercicio_id: str) -> list[dict]:
    """Retorna DORs + DÚVIDAs + CORREÇÕEs do exercício, ordenados por data_hora desc."""
    dores = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=f"DOR#{exercicio_id}#")
    duvidas = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=f"DUVIDA#{exercicio_id}#")
    correcoes = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=f"CORRECAO#{exercicio_id}#")

    feed: list[dict] = []
    for i in dores:
        c = repo.clean(i)
        c["tipo"] = "DOR"
        feed.append(c)
    for i in duvidas:
        c = repo.clean(i)
        c["tipo"] = "DUVIDA"
        feed.append(c)
    for i in correcoes:
        c = repo.clean(i)
        c["tipo"] = "CORRECAO"
        c["midias"] = _enrich_midias(c.get("midias") or [])
        feed.append(c)

    feed.sort(key=lambda r: r.get("data_hora", ""), reverse=True)
    return feed


def relatos_sessao(aluno_id: str, exercicio_id: str, sessao_id: str) -> list[dict]:
    """DORs e DÚVIDAs de um exercício filtrando pela sessão — para session detail."""
    dores = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=f"DOR#{exercicio_id}#")
    duvidas = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=f"DUVIDA#{exercicio_id}#")

    relatos: list[dict] = []
    for i in dores:
        if i.get("sessao_id") == sessao_id:
            c = repo.clean(i)
            c["tipo"] = "DOR"
            relatos.append(c)
    for i in duvidas:
        if i.get("sessao_id") == sessao_id:
            c = repo.clean(i)
            c["tipo"] = "DUVIDA"
            relatos.append(c)

    relatos.sort(key=lambda r: r.get("data_hora", ""))
    return relatos
