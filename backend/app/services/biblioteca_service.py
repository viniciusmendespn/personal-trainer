"""Auto-cadastro na biblioteca de exercícios (catálogo reutilizável do personal).

Toda criação de exercício — num treino de aluno ou num template — alimenta a biblioteca,
para que o personal nunca precise popular o catálogo manualmente. Estratégia first-write-wins:
o primeiro a cadastrar um nome vira o item canônico; cadastros seguintes do mesmo nome NÃO
sobrescrevem (o exercício no treino é uma cópia; editar a cópia não muda a biblioteca).
Para alterar o item canônico, edita-se a Biblioteca diretamente.
"""
import urllib.parse

from app.models.biblioteca import ExLib
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services.sessao_service import chave_exercicio
from app.utils import new_id


def upsert_from_exercicios(personal_id: str, exercicios: list[dict]) -> int:
    """Cria itens EXLIB para os nomes ainda ausentes na biblioteca do personal.

    `exercicios` são dicts no shape de ExercicioCreate/ExercicioTemplate. Dedup por
    `chave_exercicio(nome)` (mesma normalização usada na detecção de canônico). Retorna
    quantos itens novos foram criados. Nunca toca itens existentes.
    """
    pk = keys.pk_personal(personal_id)
    existentes = repo.query_pk(pk, sk_prefix=keys.EXLIB_PREFIX)
    chaves = {chave_exercicio(e.get("nome") or "") for e in existentes}

    puts = []
    for ex in exercicios:
        nome = (ex.get("nome") or "").strip()
        chave = chave_exercicio(nome)
        if not chave or chave in chaves:
            continue
        # Sem vídeo informado → padrão é uma busca no YouTube pelo nome do exercício,
        # para o personal nunca cair num item sem link de referência na biblioteca.
        video_url = ex.get("video_url")
        if not video_url:
            video_url = f"https://www.youtube.com/results?search_query={urllib.parse.quote_plus(nome)}"
        item = ExLib(
            exlib_id=new_id(),
            nome=nome,
            grupo=ex.get("grupo"),
            video_url=video_url,
            recomendacoes=ex.get("observacoes"),
            links_uteis=ex.get("links_uteis") or [],
            substitutos=ex.get("substitutos") or [],
        )
        puts.append({"PK": pk, "SK": keys.sk_exlib(item.exlib_id), **item.model_dump()})
        chaves.add(chave)

    if puts:
        repo.batch_write(puts=puts)
    return len(puts)
