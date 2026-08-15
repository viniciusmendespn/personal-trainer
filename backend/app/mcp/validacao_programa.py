"""Checagens semânticas do programa de treino — as que o Pydantic não pega.

O `ProgramaTreinoFile` valida tipos; ele não sabe que um `bloco_id` precisa existir nos
`blocos` do mesmo treino, nem que um exercício PERFORMANCE sem `unidade_reps` deixa o aluno
sem saber o que registrar. São regras escritas em prosa em `prompts/montar_treino.md`, e este
módulo é a versão executável delas.

Por que bloquear em vez de gravar e avisar: o estrago é **silencioso**. Um `bloco_id` órfão é
descartado sem erro na hora de aplicar, e `reps: "30s"` num exercício medido em calorias
renderiza "30s cal" no app do aluno. O personal olha a tela e acha que está certo. O LLM, no
mesmo turno, corrige de graça — desde que a mensagem diga onde, por quê e o que escrever.

Regra editorial: nenhum achado pode existir se o LLM não conseguir corrigi-lo lendo só a
mensagem. Se for preciso reler o guia, a mensagem está incompleta.
"""
import re
from dataclasses import dataclass, field
from typing import Any

from app.models.enums import MAIOR, MENOR, FormatoBloco, TipoExercicio, normalizar_tipo_exercicio
from app.models.treino_export import ProgramaTreinoFile
from app.services import biblioteca_service
from app.services.sessao_service import chave_exercicio

# Teto por balde: o retorno vai direto para o contexto do LLM, e 200 achados iguais não
# ensinam mais que 20.
LIMITE_ACHADOS = 20

MAX_UNIDADE_REPS = 7
FORMATOS_CRONOMETRADOS = {FormatoBloco.FOR_TIME.value, FormatoBloco.AMRAP.value,
                          FormatoBloco.EMOM.value}

# Só estes sufixos contam como "unidade grudada no reps". Whitelist em vez de "qualquer
# letra" é o que mantém `"até a falha"`, `"8-12"`, `"AMRAP"` e `"10 cada lado"` fora do radar.
_SUFIXOS_DE_UNIDADE = {"s", "seg", "min", "m", "km", "cal", "kcal", "rep", "reps",
                       "kg", "lb", "%"}
_REPS_COM_SUFIXO = re.compile(r"^\s*[\d.,]+\s*([a-zA-Zç%]{1,4})\s*$")

# Palavras que caracterizam "o que registrar" na observação de um exercício PERFORMANCE.
_FALA_DE_REGISTRO = ("registr", "anot", "marque", "informe")

# Campos que o LLM costuma inventar porque existem em OUTROS modelos do sistema.
_CAMPOS_INEXISTENTES = {
    "recomendacoes": "observacoes",
    "descricao": "observacoes",
    "reps_prescritas": "series_prescritas",
    "carga_prescrita": "series_prescritas",
    "dia_semana": None,
    "rpe": None,
}


@dataclass(frozen=True)
class Achado:
    codigo: str
    campo: str        # caminho navegável: treinos[2].exercicios[0].unidade_reps
    onde: str         # 'Treino C — Cross › "Bike Erg"' — o LLM relocaliza por nome melhor que por índice
    mensagem: str     # o que está errado, o valor recebido e a consequência
    correcao: str     # o que escrever no lugar

    def to_dict(self) -> dict:
        return {"codigo": self.codigo, "campo": self.campo, "onde": self.onde,
                "mensagem": self.mensagem, "correcao": self.correcao}


@dataclass
class Contexto:
    """Tudo que a validação precisa do banco, resolvido de uma vez pelo chamador."""
    # chave_exercicio(nome) -> {"nome": grafia canônica, "video_url": vídeo real ou None}
    biblioteca: dict[str, dict] = field(default_factory=dict)

    @staticmethod
    def vazio() -> "Contexto":
        return Contexto()


def carregar_contexto(personal_id: str) -> Contexto:
    """Uma Query na biblioteca do personal — nunca uma por exercício."""
    biblioteca = {}
    for item in biblioteca_service.listar_para_ia(personal_id):
        chave = chave_exercicio(item["nome"])
        if chave:
            biblioteca.setdefault(chave, item)
    return Contexto(biblioteca=biblioteca)


# ── Regras ──────────────────────────────────────────────────────────────────

def _validar_blocos(treino, ct: str, erros: list, avisos: list) -> dict:
    """Confere os blocos do treino e devolve {id: bloco} para os exercícios apontarem."""
    por_id: dict[str, Any] = {}
    for ib, bloco in enumerate(treino.blocos or []):
        cb = f"{ct}.blocos[{ib}]"
        onde = f'{treino.nome} › bloco "{bloco.nome or bloco.id}"'

        if bloco.id in por_id:
            erros.append(Achado(
                "BLOCO_ID_DUPLICADO", f"{cb}.id", onde,
                f'já existe outro bloco com id "{bloco.id}" neste treino; os exercícios não '
                "teriam como dizer a qual dos dois pertencem.",
                "dê um id curto e único dentro do treino: \"aq\", \"a\", \"b\", \"c\"…"))
            continue
        por_id[bloco.id] = bloco

        formato = (bloco.formato or FormatoBloco.LIVRE.value).upper()
        if formato not in {f.value for f in FormatoBloco}:
            erros.append(Achado(
                "BLOCO_FORMATO_INVALIDO", f"{cb}.formato", onde,
                f'formato "{bloco.formato}" não existe.',
                'use "LIVRE" (força/skill/aquecimento), "FOR_TIME", "AMRAP" ou "EMOM".'))
            continue

        params = bloco.params
        if formato in {FormatoBloco.AMRAP.value, FormatoBloco.EMOM.value} and not params.duracao_s:
            erros.append(Achado(
                "BLOCO_SEM_DURACAO", f"{cb}.params.duracao_s", onde,
                f"bloco {formato} sem duração: o app não tem timer para contar e o aluno não "
                "consegue fechar o score.",
                'informe a duração total em segundos. AMRAP de 15 min = "duracao_s": 900; '
                'EMOM de 24 min = 1440.'))
        if formato == FormatoBloco.EMOM.value and not params.intervalo_s:
            erros.append(Achado(
                "BLOCO_EMOM_SEM_INTERVALO", f"{cb}.params.intervalo_s", onde,
                "EMOM sem intervalo: é o intervalo que define de quanto em quanto tempo o "
                "aluno recomeça a tarefa.",
                '"intervalo_s": 60 para "a cada minuto", 90 para "every 90s".'))
        if bloco.aquecimento and formato != FormatoBloco.LIVRE.value:
            avisos.append(Achado(
                "BLOCO_AQUECIMENTO_COM_FORMATO", f"{cb}.formato", onde,
                f"bloco de aquecimento com formato {formato}: aquecimento não gera score, "
                "então o timer não tem o que cronometrar.",
                'use "formato": "LIVRE" no bloco de aquecimento (params.rounds continua '
                "valendo para circuitos)."))
    return por_id


def _validar_serie(serie, cs: str, onde: str, erros: list) -> None:
    if serie.series is None or serie.series <= 0:
        erros.append(Achado(
            "SERIES_INVALIDA", f"{cs}.series", onde,
            f"series = {serie.series}; precisa ser um inteiro maior que zero.",
            '"series" é quantas séries daquele bloco de prescrição. Ex.: {"series": 3, '
            '"reps": "8-12", "carga": null}'))


def _validar_unidade_em_reps(serie, ex, cs: str, onde: str, erros: list) -> None:
    """`reps` carrega só o número; a unidade vive em `unidade_reps`. Escrever "30s" num
    exercício medido em calorias faz o app renderizar "30s cal"."""
    casou = _REPS_COM_SUFIXO.match(serie.reps or "")
    if not casou:
        return
    sufixo = casou.group(1).lower()
    if sufixo not in _SUFIXOS_DE_UNIDADE:
        return
    unidade = (ex.unidade_reps or "").lower()
    if sufixo == unidade:
        return
    erros.append(Achado(
        "UNIDADE_DENTRO_DE_REPS", f"{cs}.reps", onde,
        f'reps = "{serie.reps}" num exercício com unidade_reps = '
        f'{ex.unidade_reps!r} — o app mostraria "{serie.reps} {ex.unidade_reps or ""}".',
        f'escreva só o número em reps. Se o alvo é mesmo em "{sufixo}", este é OUTRO '
        f'exercício: crie um com "unidade_reps": "{sufixo}" e deixe a diferença explícita '
        "no nome e em observacoes."))


def _validar_exercicio(ex, ce: str, treino, blocos_por_id: dict, ctx: Contexto,
                       erros: list, avisos: list) -> None:
    onde = f'{treino.nome} › "{ex.nome}"'

    if not (ex.nome or "").strip():
        erros.append(Achado(
            "EXERCICIO_SEM_NOME", f"{ce}.nome", f"{treino.nome} › (sem nome)",
            "exercício sem nome não aparece para o aluno.",
            'preencha "nome" com o nome do exercício, idêntico ao da biblioteca quando existir lá.'))
        return

    # ── vínculo com o bloco
    if ex.bloco_id:
        if not blocos_por_id:
            erros.append(Achado(
                "BLOCO_ID_ORFAO", f"{ce}.bloco_id", onde,
                f'bloco_id "{ex.bloco_id}" mas este treino não declara nenhum bloco; o '
                "vínculo é descartado em silêncio ao aplicar.",
                f'ou declare o bloco em {ce.rsplit(".exercicios", 1)[0]}.blocos, ou use '
                '"bloco_id": null (musculação clássica).'))
        elif ex.bloco_id not in blocos_por_id:
            disponiveis = ", ".join(f'"{i}"' for i in blocos_por_id) or "nenhum"
            erros.append(Achado(
                "BLOCO_ID_ORFAO", f"{ce}.bloco_id", onde,
                f'bloco_id "{ex.bloco_id}" não existe nos blocos deste treino '
                f"(disponíveis: {disponiveis}); aplicado assim, o exercício sai do bloco.",
                f"use um dos ids acima, ou declare o bloco que falta em blocos[]."))

    # ── séries
    if not ex.series_prescritas:
        erros.append(Achado(
            "SEM_SERIES_PRESCRITAS", f"{ce}.series_prescritas", onde,
            "exercício sem nenhuma série prescrita: o aluno abre o treino e não tem o que fazer.",
            'informe ao menos um bloco. Ex.: [{"series": 3, "reps": "8-12", "carga": null}]'))
    else:
        for i_s, serie in enumerate(ex.series_prescritas):
            cs = f"{ce}.series_prescritas[{i_s}]"
            _validar_serie(serie, cs, onde, erros)
            _validar_unidade_em_reps(serie, ex, cs, onde, erros)

    # ── tipo / unidades
    tipo = normalizar_tipo_exercicio(ex.tipo_exercicio)
    if tipo == TipoExercicio.PERFORMANCE.value:
        _validar_performance(ex, ce, onde, treino, blocos_por_id, erros, avisos)
    else:
        _validar_forca(ex, ce, onde, avisos)

    _validar_contra_biblioteca(ex, ce, onde, ctx, avisos)


def _validar_performance(ex, ce, onde, treino, blocos_por_id, erros, avisos) -> None:
    if not (ex.unidade_reps or "").strip():
        erros.append(Achado(
            "PERF_SEM_UNIDADE", f"{ce}.unidade_reps", onde,
            "tipo_exercicio é PERFORMANCE mas unidade_reps veio vazio: sem unidade o app não "
            "rotula o que o aluno registra e o gráfico de evolução fica sem eixo.",
            'informe a unidade da métrica (até 7 caracteres): "cal", "m", "km", "min", "s", '
            '"reps", "voltas".'))
    elif len(ex.unidade_reps) > MAX_UNIDADE_REPS:
        erros.append(Achado(
            "PERF_UNIDADE_LONGA", f"{ce}.unidade_reps", onde,
            f'unidade_reps "{ex.unidade_reps}" tem {len(ex.unidade_reps)} caracteres; o app '
            f"trunca acima de {MAX_UNIDADE_REPS}.",
            'abrevie: "minutos" → "min", "metros" → "m", "calorias" → "cal".'))

    if ex.metrica_direcao not in (MAIOR, MENOR):
        erros.append(Achado(
            "PERF_DIRECAO_INVALIDA", f"{ce}.metrica_direcao", onde,
            f"metrica_direcao = {ex.metrica_direcao!r}; sem ela o app não sabe se o aluno "
            "melhorou ou piorou.",
            f'"{MAIOR}" quando mais é melhor (reps, km, calorias) ou "{MENOR}" quando menos '
            "é melhor (tempo, pace)."))

    # Dentro de um bloco cronometrado quem pontua é o bloco, não o exercício — cobrar "o que
    # registrar" ali seria contrariar o próprio guia.
    bloco = blocos_por_id.get(ex.bloco_id or "")
    em_bloco_com_score = bool(
        bloco and not bloco.aquecimento
        and (bloco.formato or "").upper() in FORMATOS_CRONOMETRADOS
    )
    obs = (ex.observacoes or "").lower()
    if not em_bloco_com_score and not any(p in obs for p in _FALA_DE_REGISTRO):
        avisos.append(Achado(
            "PERF_SEM_O_QUE_REGISTRAR", f"{ce}.observacoes", onde,
            "exercício PERFORMANCE cujo observacoes não diz o que o aluno deve registrar — é "
            "a dúvida mais comum na hora de executar.",
            f'termine observacoes dizendo o que registrar. Ex.: "Registre a distância '
            f'percorrida em {ex.unidade_reps or "m"}."'))


def _validar_forca(ex, ce, onde, avisos) -> None:
    if (ex.unidade_reps or "").strip():
        avisos.append(Achado(
            "FORCA_COM_UNIDADE_REPS", f"{ce}.unidade_reps", onde,
            f'exercício FORCA com unidade_reps "{ex.unidade_reps}": em FORCA as reps já são '
            "repetições, e a unidade apareceria duplicada.",
            'deixe "unidade_reps": null. Se a métrica é tempo/distância/calorias, o tipo é '
            'PERFORMANCE.'))
    # `metrica_direcao` nasce "MAIOR" por default no modelo, então praticamente todo exercício
    # de força já gravado carrega esse valor — cobrar null aqui reprovaria qualquer re-import.
    # Só "MENOR" é semanticamente absurdo em força.
    if ex.metrica_direcao == MENOR:
        avisos.append(Achado(
            "FORCA_COM_DIRECAO_MENOR", f"{ce}.metrica_direcao", onde,
            'exercício FORCA com metrica_direcao "MENOR" diz que levantar menos é evoluir.',
            f'em FORCA use "{MAIOR}" (ou deixe como veio). "{MENOR}" só faz sentido em '
            "PERFORMANCE medido por tempo."))


def _parecido_na_biblioteca(chave: str, ctx: Contexto) -> dict | None:
    """O mesmo exercício com nome mais curto ou mais qualificado — "agachamento" para
    "agachamento livre", "supino reto com barra" para "supino reto".

    Usa **contenção de palavras**, não similaridade de string: medindo por `difflib`,
    "remada baixa"/"remada alta" (exercícios diferentes) pontuam igual a
    "agachamento"/"agachamento livre" (o mesmo exercício), então nenhum limiar separa os dois
    casos. Já a contenção separa: nomes diferentes divergem no qualificador, e nenhum contém
    o outro.
    """
    palavras = set(chave.split())
    if not palavras:
        return None
    melhor, melhor_extra = None, None
    for chave_lib, item in ctx.biblioteca.items():
        da_lib = set(chave_lib.split())
        if not (palavras <= da_lib or da_lib <= palavras):
            continue
        extra = abs(len(palavras) - len(da_lib))
        if melhor is None or extra < melhor_extra:
            melhor, melhor_extra = item, extra
    return melhor


def _validar_contra_biblioteca(ex, ce, onde, ctx: Contexto, avisos: list) -> None:
    if not ctx.biblioteca:
        return
    chave = chave_exercicio(ex.nome)
    da_lib = ctx.biblioteca.get(chave)
    if not da_lib:
        # Nome que não casa por chave canônica mas é quase igual a um cadastrado: o exercício
        # entra como novo e o vídeo que o personal cadastrou fica para trás sem ninguém notar.
        vizinho = _parecido_na_biblioteca(chave, ctx)
        if vizinho:
            avisos.append(Achado(
                "NOME_PARECIDO_BIBLIOTECA", f"{ce}.nome", onde,
                f'"{ex.nome}" é muito parecido com "{vizinho["nome"]}", que o personal já tem '
                "cadastrado. Como os nomes não são iguais, entra como exercício novo e o vídeo "
                "da biblioteca não é aproveitado.",
                f'se for o mesmo exercício, use o nome exato "{vizinho["nome"]}" e o video_url '
                f'{vizinho.get("video_url") or "null"} (regra de ouro nº 1). Se for mesmo outro '
                "exercício, ignore este aviso."))
        return

    if da_lib["nome"] != ex.nome:
        avisos.append(Achado(
            "NOME_DIVERGE_BIBLIOTECA", f"{ce}.nome", onde,
            f'"{ex.nome}" e "{da_lib["nome"]}" (cadastrado na biblioteca do personal) são o '
            "mesmo exercício com grafias diferentes.",
            f'copie o nome idêntico ao da biblioteca: "{da_lib["nome"]}".'))

    video_lib = da_lib.get("video_url")
    if video_lib and ex.video_url and ex.video_url != video_lib:
        avisos.append(Achado(
            "VIDEO_DIVERGE_BIBLIOTECA", f"{ce}.video_url", onde,
            "o vídeo enviado é diferente do que o personal cadastrou na biblioteca; ao aplicar, "
            "o da biblioteca prevalece e o seu é descartado.",
            f'copie o video_url da biblioteca: "{video_lib}" (regra de ouro nº 1).'))


def _campos_inexistentes(bruto: dict, erros: list, avisos: list) -> None:
    """Chaves que o Pydantic descarta em silêncio (extra='ignore'). O texto que o LLM escreveu
    ali some sem nenhum erro — vale avisar exatamente onde."""
    for it, treino in enumerate(bruto.get("treinos") or []):
        if not isinstance(treino, dict):
            continue
        for ie, ex in enumerate(treino.get("exercicios") or []):
            if not isinstance(ex, dict):
                continue
            for campo, correto in _CAMPOS_INEXISTENTES.items():
                if campo not in ex:
                    continue
                alvo = (f'mova o conteúdo para "{correto}".' if correto
                        else "remova o campo; ele não existe no programa de treino.")
                avisos.append(Achado(
                    "CAMPO_DESCONHECIDO", f"treinos[{it}].exercicios[{ie}].{campo}",
                    f'{treino.get("nome") or f"treino {it}"} › "{ex.get("nome") or ie}"',
                    f'"{campo}" não existe no formato do programa e é descartado sem erro — '
                    "o que você escreveu ali seria perdido.", alvo))


def validar(programa: ProgramaTreinoFile, ctx: Contexto | None = None, *,
            bruto: dict | None = None) -> tuple[list[Achado], list[Achado]]:
    """Devolve (erros, avisos). Erros impedem a gravação; avisos só informam.

    `bruto` é o dict cru do LLM, usado para flagrar chaves que o Pydantic descartou.
    """
    ctx = ctx or Contexto.vazio()
    erros: list[Achado] = []
    avisos: list[Achado] = []

    for it, treino in enumerate(programa.treinos):
        ct = f"treinos[{it}]"
        if not (treino.nome or "").strip():
            erros.append(Achado(
                "TREINO_SEM_NOME", f"{ct}.nome", f"treino {it}",
                "treino sem nome não é identificável pelo aluno.",
                'preencha "nome". Ex.: "Treino A — Peito/Tríceps".'))

        blocos_por_id = _validar_blocos(treino, ct, erros, avisos)
        usados = {e.bloco_id for e in treino.exercicios if e.bloco_id}
        for bloco_id, bloco in blocos_por_id.items():
            # Bloco de descanso é o único que existe legitimamente sem exercício algum.
            if bloco_id not in usados and not bloco.descanso:
                avisos.append(Achado(
                    "BLOCO_SEM_EXERCICIOS", f"{ct}.blocos", f'{treino.nome} › "{bloco.nome}"',
                    f'o bloco "{bloco_id}" foi declarado mas nenhum exercício aponta para ele; '
                    "ele aparece vazio para o aluno.",
                    f'aponte os exercícios com "bloco_id": "{bloco_id}", ou remova o bloco. '
                    'Bloco de descanso deve ter "descanso": true.'))

        for ie, ex in enumerate(treino.exercicios):
            _validar_exercicio(ex, f"{ct}.exercicios[{ie}]", treino, blocos_por_id,
                               ctx, erros, avisos)

    if bruto:
        if "contexto_aluno" in bruto or "biblioteca" in bruto:
            avisos.append(Achado(
                "RAIZ_COM_CONTEXTO", "(raiz)", "programa",
                "a raiz traz contexto_aluno/biblioteca; são dados de leitura e foram ignorados.",
                'a raiz do programa tem só "version" e "treinos".'))
        _campos_inexistentes(bruto, erros, avisos)

    return erros[:LIMITE_ACHADOS], avisos[:LIMITE_ACHADOS]


# ── Formatação para o LLM ───────────────────────────────────────────────────

def texto_dos_achados(achados: list[Achado]) -> str:
    return "\n".join(
        f"- [{a.codigo}] {a.campo} ({a.onde}): {a.mensagem} → {a.correcao}"
        for a in achados
    )


def formatar_erros_pydantic(exc, limite: int = 5) -> str:
    """O repr cru de `exc.errors()` é ilegível para o LLM. Aqui vira caminho de campo +
    o que chegou + o que era esperado."""
    todos = exc.errors(include_url=False)
    partes = []
    for e in todos[:limite]:
        caminho = _caminho_pydantic(e.get("loc") or ())
        recebido = repr(e.get("input"))
        if len(recebido) > 60:
            recebido = recebido[:57] + "..."
        partes.append(f"- `{caminho}`: {e.get('msg')} (recebi {recebido})")
    if len(todos) > limite:
        partes.append(f"- ...e mais {len(todos) - limite} erro(s)")
    return "\n".join(partes)


def _caminho_pydantic(loc: tuple) -> str:
    saida = ""
    for parte in loc:
        if isinstance(parte, int):
            saida += f"[{parte}]"
        else:
            saida = f"{saida}.{parte}" if saida else str(parte)
    return saida
