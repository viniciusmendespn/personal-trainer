"""Posts de correção do personal — texto livre + mídias vinculadas a um exercício.
Aparecem no feed do exercício para personal e aluno."""
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import anotif_service, media_service
from app.services.sessao_service import chave_exercicio, upsert_excat
from app.utils import epoch_ms, new_id, now_iso


def criar_correcao(personal_id: str, aluno_id: str, exercicio_id: str,
                   exercicio_nome: str | None, texto: str,
                   midias: list[dict]) -> dict:
    """midias = [{s3_key, tipo}] — arquivos já enviados via presigned URL."""
    ts = epoch_ms()
    correcao_id = new_id()
    chave = chave_exercicio(exercicio_nome or "")
    item = {
        "correcao_id": correcao_id, "personal_id": personal_id,
        "exercicio_id": exercicio_id, "exercicio_nome": exercicio_nome,
        "chave": chave,
        "texto": texto, "midias": midias, "data_hora": now_iso(),
        **({"GSI1PK": keys.gsi1_feed(aluno_id, chave), "GSI1SK": keys.gsi1sk_feed(ts)} if chave else {}),
    }
    repo.put_item(keys.pk_aluno(aluno_id),
                  keys.sk_correcao_ex(exercicio_id, ts, correcao_id), item)
    upsert_excat(aluno_id, exercicio_nome)
    ex_nome = exercicio_nome or "um exercício"
    anotif_service.criar(aluno_id, "CORRECAO_EXERCICIO", "Correção do personal",
                         f"Seu personal postou uma correção em {ex_nome}.",
                         ref_extra={"ref_id": correcao_id, "exercicio_id": exercicio_id,
                                    "chave": chave, "exercicio_nome": exercicio_nome})
    return item


def _enrich_midias(midias: list[dict]) -> list[dict]:
    return [{**m, "url": media_service.gerar_presigned_view_url(m["s3_key"])} for m in midias]


def _enrich_comentarios(comentarios: list[dict]) -> list[dict]:
    result = []
    for c in comentarios:
        nc = {**c}
        if nc.get("midias"):
            nc["midias"] = _enrich_midias(nc["midias"])
        result.append(nc)
    return result


def _exercicio_ids_canonicos(pk: str, exercicio_id: str) -> tuple[list[str], str | None]:
    """Retorna (ids, chave_target): todos os exercicio_ids que compartilham o mesmo nome
    canônico do exercício dado, mais a própria chave canônica alvo.
    Permite agregar feed de exercícios homônimos criados em treinos diferentes."""
    all_exs = repo.query_pk(pk, sk_prefix="EX#")
    nome_target = next((i.get("nome") for i in all_exs if i.get("exercicio_id") == exercicio_id), None)
    chave_target = chave_exercicio(nome_target) if nome_target else None
    if not chave_target:
        return [exercicio_id], None
    ids = [
        i.get("exercicio_id") for i in all_exs
        if chave_exercicio(i.get("nome") or "") == chave_target and i.get("exercicio_id")
    ]
    return ids, chave_target


def _item_chave(item: dict) -> str | None:
    """Nome canônico registrado no próprio item de feed. Usa a `chave` carimbada na escrita
    e cai no `exercicio_nome` para itens legados. None quando o item não tem nome algum."""
    ch = item.get("chave")
    if ch:
        return ch
    nome = item.get("exercicio_nome")
    return chave_exercicio(nome) if nome else None


def _format_feed_item(i: dict) -> dict:
    """Normaliza um item bruto (DOR#/DUVIDA#/CORRECAO#/MIDIA#/POST#) para o shape do feed,
    decidindo pelo prefixo da SK — compartilhado entre o feed por chave e o legado por id."""
    sk = i.get("SK") or ""
    c = repo.clean(i)
    if sk.startswith("DOR#") or sk.startswith("DUVIDA#"):
        c["tipo"] = "DOR" if sk.startswith("DOR#") else "DUVIDA"
        c["relato_sk"] = sk
        if c.get("comentarios"):
            c["comentarios"] = _enrich_comentarios(c["comentarios"])
    elif sk.startswith("CORRECAO#"):
        c["tipo"] = "CORRECAO"
        c["midias"] = _enrich_midias(c.get("midias") or [])
        c["descricao"] = c.get("texto")
        if c.get("comentarios"):
            c["comentarios"] = _enrich_comentarios(c["comentarios"])
    elif sk.startswith("MIDIA#"):
        # Itens MIDIA legacy viram EXECUCAO no feed (sem thread de comentários)
        midia_tipo_original = c.get("tipo", "foto_exercicio")
        c["midias"] = _enrich_midias([{"s3_key": c["s3_key"], "tipo": midia_tipo_original}])
        c["tipo"] = "EXECUCAO"
    else:  # POST#
        c["midias"] = _enrich_midias(c.get("midias") or [])
        c["relato_sk"] = sk
        if c.get("comentarios"):
            c["comentarios"] = _enrich_comentarios(c["comentarios"])
    return c


def feed_por_chave(aluno_id: str, chave: str, limit: int = 50,
                   cursor: str | None = None) -> tuple[list[dict], str | None]:
    """Feed unificado pelo nome canônico do exercício — 1 Query no GSI1 (itens carimbam
    GSI1PK=AL#{aluno}#FEED#{chave} na escrita; legados são carimbados pelo backfill).
    Funciona mesmo quando o exercício já saiu do programa atual. Mais recente primeiro."""
    if not chave:
        return [], None
    items, next_cursor = repo.query_gsi1_page(keys.gsi1_feed(aluno_id, chave), limit, cursor)
    return [_format_feed_item(i) for i in items], next_cursor


def feed_exercicio(aluno_id: str, exercicio_id: str) -> list[dict]:
    """Compat (rota antiga por exercicio_id): DOR + DUVIDA + CORRECAO + MIDIA + POST, por
    data_hora desc. Agrega itens de todos os exercício-irmãos (mesmo nome canônico em treinos
    diferentes) e filtra pelo nome canônico atual: itens escritos sob um nome antigo (após
    renomear o exercício) NÃO aparecem no feed do nome novo — a identidade do feed é o nome."""
    pk = keys.pk_aluno(aluno_id)
    ids, chave_target = _exercicio_ids_canonicos(pk, exercicio_id)

    def _pertence(item: dict) -> bool:
        # Sem chave alvo (exercício removido) ou item sem nome (legado) → não descarta.
        if not chave_target:
            return True
        ick = _item_chave(item)
        return ick is None or ick == chave_target

    feed: list[dict] = []
    seen_sks: set[str] = set()
    for eid in ids:
        for prefix in ("DOR#", "DUVIDA#", "CORRECAO#", "MIDIA#", "POST#"):
            for i in repo.query_pk(pk, sk_prefix=f"{prefix}{eid}#"):
                if i.get("SK") in seen_sks or not _pertence(i):
                    continue
                seen_sks.add(i["SK"])
                feed.append(_format_feed_item(i))

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
