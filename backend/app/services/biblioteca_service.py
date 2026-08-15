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


def url_busca_youtube(nome: str) -> str:
    """URL de busca no YouTube pelo nome do exercício — o fallback exibido quando não há vídeo."""
    return f"https://www.youtube.com/results?search_query={urllib.parse.quote_plus(nome)}"


def eh_busca_youtube(url: str | None) -> bool:
    """True para a URL de busca acima (fallback gravado em versões anteriores), que NÃO é um vídeo.
    Tratá-la como vídeo faria a IA receber uma página de resultados rotulada como demonstração."""
    return bool(url) and "youtube.com/results" in url  # type: ignore[operator]


def mapa_videos(personal_id: str) -> dict[str, str]:
    """`chave_exercicio(nome)` → `video_url` REAL dos exercícios da biblioteca do personal.

    Exclui itens ocultos e os fallbacks de busca. Uma única Query por import — nunca chamar
    por exercício.
    """
    mapa: dict[str, str] = {}
    for item in repo.query_pk(keys.pk_personal(personal_id), sk_prefix=keys.EXLIB_PREFIX):
        if item.get("ativo") is False:
            continue
        video = item.get("video_url")
        chave = chave_exercicio(item.get("nome") or "")
        if not chave or not video or eh_busca_youtube(video):
            continue
        mapa.setdefault(chave, video)
    return mapa


def listar_para_ia(personal_id: str) -> list[dict]:
    """Biblioteca do personal enxuta, do jeito que uma IA precisa ver.

    Espelha `slimBiblioteca` do portal (`frontend/src/utils/arquivoIa.ts`): esconde os itens
    ocultos e **zera as URLs de busca** — apresentar uma página de resultados como se fosse a
    demonstração do exercício faz a IA concluir que a biblioteca não tem vídeo e sair usando
    os dela, que é justamente o que a regra de ouro nº 1 tenta evitar.
    Uma única Query; ordena por (grupo, nome) como o portal.
    """
    itens = []
    for item in repo.query_pk(keys.pk_personal(personal_id), sk_prefix=keys.EXLIB_PREFIX):
        if item.get("ativo") is False:
            continue
        video = item.get("video_url")
        itens.append({
            "nome": item.get("nome") or "",
            "grupo": item.get("grupo") or None,
            "video_url": None if (not video or eh_busca_youtube(video)) else video,
        })
    itens.sort(key=lambda e: ((e["grupo"] or "").lower(), e["nome"].lower()))
    return itens


def markdown_para_ia(itens: list[dict]) -> str:
    """A biblioteca como lista markdown agrupada por grupo muscular — ~1 linha por exercício,
    contra as ~6 do JSON indentado. Espelha `bibliotecaMarkdown` do portal: numa biblioteca de
    150 exercícios é a diferença entre ~900 e ~170 linhas dentro do prompt."""
    if not itens:
        return "_(o personal ainda não cadastrou exercícios — monte tudo do zero)_"
    linhas: list[str] = []
    grupo_atual = object()
    for ex in itens:
        grupo = (ex.get("grupo") or "").strip() or "Sem grupo"
        if grupo != grupo_atual:
            if linhas:
                linhas.append("")
            linhas.append(f"**{grupo}**")
            grupo_atual = grupo
        linhas.append(f"- {ex['nome']} → {ex.get('video_url') or '(sem vídeo cadastrado)'}")
    return "\n".join(linhas)


def resolver_video(nome: str, video_informado: str | None, mapa: dict[str, str]) -> str | None:
    """A biblioteca do personal tem prioridade sobre o vídeo que veio no arquivo/IA.

    1. Exercício já existe na biblioteca com vídeo real → vence o da biblioteca.
    2. Senão, o vídeo informado (a IA acha bons vídeos para exercícios novos) é mantido.
    3. Senão `None` — o app exibe a busca no YouTube pelo nome (`videoUrlComFallback`).

    O passo 1 ignora fallbacks de busca de propósito: se a biblioteca só tem a busca e a IA achou
    um vídeo de verdade, priorizar a biblioteca pioraria o resultado.
    """
    da_biblioteca = mapa.get(chave_exercicio(nome))
    if da_biblioteca and not eh_busca_youtube(da_biblioteca):
        return da_biblioteca
    if video_informado and not eh_busca_youtube(video_informado):
        return video_informado
    return None


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
        # Sem vídeo → grava None, e não a URL de busca. O app já cai na busca do YouTube na hora
        # de exibir (`videoUrlComFallback`), e assim a biblioteca distingue "tem vídeo" de "não tem"
        # — distinção que o arquivo gerado para a IA precisa para não passar busca como demonstração.
        video_url = ex.get("video_url")
        if eh_busca_youtube(video_url):
            video_url = None
        item = ExLib(
            exlib_id=new_id(),
            nome=nome,
            grupo=ex.get("grupo"),
            video_url=video_url,
            recomendacoes=ex.get("observacoes"),
            links_uteis=ex.get("links_uteis") or [],
            substitutos=ex.get("substitutos") or [],
            origem_licenciada=bool(ex.get("origem_licenciada")),  # proveniência segue o exercício de origem
        )
        puts.append({"PK": pk, "SK": keys.sk_exlib(item.exlib_id), **item.model_dump(), "pacote_id": "manual"})
        chaves.add(chave)

    if puts:
        repo.batch_write(puts=puts)
    return len(puts)
