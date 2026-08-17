"""Checagens semânticas do pacote (.cpkg) gerado por IA — o que o Pydantic não pega.

O `.cpkg` é **ref-based**: `templates[].exercicios[].ex_ref` aponta para `exercicios[].ref`, e
`rotinas[].treinos[]` aponta para `templates[].ref`. Nenhuma dessas referências é validada na
instalação, e as duas falham em **silêncio**, produzindo estrago visível para o aluno:

- `ex_ref` órfão → `pacote_service._instalar` resolve `exlib_id = ""` e usa a própria ref como
  nome do exercício: o aluno abre o treino e vê "ex_supino_reto", sem grupo e sem vídeo.
- `tmpl_ref` órfão → o treino é omitido da rotina com um `continue`, sem erro nenhum.

Por isso são erros, não avisos: reimportar depois de corrigir é barato; descobrir semanas
depois que a rotina do aluno tem quatro treinos em vez de cinco, não.

As regras por-exercício (série, unidade grudada em reps, PERFORMANCE, FORCA) são as MESMAS do
programa de treino e vêm de `validacao_programa` — aqui só muda a montagem, porque no `.cpkg`
`tipo_exercicio`/`unidade_reps` moram no catálogo e `series_prescritas` mora no template.
"""
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

from app.models.pacote import PacoteFile
from app.models.enums import TipoExercicio, normalizar_tipo_exercicio
from app.services import validacao_programa as vp
from app.services.validacao_programa import Achado


@dataclass
class _ExercicioJuntado:
    """Catálogo + template no formato que as regras de `validacao_programa` esperam."""
    nome: str
    tipo_exercicio: Any = TipoExercicio.FORCA
    unidade_reps: Optional[str] = None
    metrica_direcao: Optional[str] = "MAIOR"
    bloco_id: Optional[str] = None
    observacoes: Optional[str] = None
    series_prescritas: list = field(default_factory=list)


def _duplicadas(refs: list[str]) -> list[str]:
    vistas, repetidas = set(), []
    for ref in refs:
        if ref in vistas and ref not in repetidas:
            repetidas.append(ref)
        vistas.add(ref)
    return repetidas


def _validar_refs(pacote: PacoteFile, erros: list, avisos: list) -> None:
    for rotulo, itens, campo in (
        ("exercício", pacote.exercicios, "exercicios"),
        ("template", pacote.templates, "templates"),
        ("rotina", pacote.rotinas, "rotinas"),
    ):
        for ref in _duplicadas([i.ref for i in itens]):
            erros.append(Achado(
                "REF_DUPLICADA", campo, f'{rotulo} "{ref}"',
                f'a ref "{ref}" aparece mais de uma vez em {campo}; como o id instalado é '
                f"derivado da ref, o segundo item sobrescreve o primeiro e um deles desaparece.",
                f"dê uma ref única a cada {rotulo} do arquivo."))


def _validar_exercicios(pacote: PacoteFile, erros: list, avisos: list) -> None:
    for ie, ex in enumerate(pacote.exercicios):
        ce = f"exercicios[{ie}]"
        if not (ex.nome or "").strip():
            erros.append(Achado(
                "EXERCICIO_SEM_NOME", f"{ce}.nome", f'exercício "{ex.ref}"',
                "exercício sem nome não aparece para o aluno, e é o nome que casa com a "
                "biblioteca do personal na instalação.",
                'preencha "nome" com o nome do exercício.'))


def _validar_template(tmpl, it: int, catalogo: dict, indices: dict,
                      erros: list, avisos: list) -> None:
    ct = f"templates[{it}]"
    onde_tmpl = tmpl.nome or f"template {it}"

    if not (tmpl.nome or "").strip():
        erros.append(Achado(
            "TEMPLATE_SEM_NOME", f"{ct}.nome", f'template "{tmpl.ref}"',
            "template sem nome não é identificável na biblioteca do personal.",
            'preencha "nome". Ex.: "Treino A — Peito/Tríceps".'))

    blocos_por_id = vp.validar_blocos(tmpl, ct, erros, avisos)

    if not tmpl.exercicios:
        avisos.append(Achado(
            "TEMPLATE_SEM_EXERCICIOS", f"{ct}.exercicios", onde_tmpl,
            "o template não tem nenhum exercício; ele é instalado vazio.",
            'preencha "exercicios" com ao menos um item apontando para uma ref de exercicios[].'))

    for ie, item in enumerate(tmpl.exercicios):
        ce = f"{ct}.exercicios[{ie}]"
        do_catalogo = catalogo.get(item.ex_ref)

        if not do_catalogo:
            disponiveis = ", ".join(f'"{r}"' for r in list(catalogo)[:8]) or "nenhuma"
            erros.append(Achado(
                "EX_REF_ORFAO", f"{ce}.ex_ref", f'{onde_tmpl} › "{item.ex_ref}"',
                f'ex_ref "{item.ex_ref}" não existe em exercicios[] (refs disponíveis: '
                f"{disponiveis}); instalado assim, o aluno vê a própria ref como nome do "
                "exercício, sem grupo e sem vídeo.",
                "use uma das refs acima, ou declare o exercício em exercicios[] com essa ref."))
            continue

        onde = f'{onde_tmpl} › "{do_catalogo.nome}"'

        if item.bloco_id:
            if not blocos_por_id:
                erros.append(Achado(
                    "BLOCO_ID_ORFAO", f"{ce}.bloco_id", onde,
                    f'bloco_id "{item.bloco_id}" mas este template não declara nenhum bloco; o '
                    "vínculo é descartado em silêncio na instalação.",
                    f'ou declare o bloco em {ct}.blocos, ou use "bloco_id": null '
                    "(musculação clássica)."))
            elif item.bloco_id not in blocos_por_id:
                disponiveis = ", ".join(f'"{i}"' for i in blocos_por_id)
                erros.append(Achado(
                    "BLOCO_ID_ORFAO", f"{ce}.bloco_id", onde,
                    f'bloco_id "{item.bloco_id}" não existe nos blocos deste template '
                    f"(disponíveis: {disponiveis}); instalado assim, o exercício sai do bloco.",
                    "use um dos ids acima, ou declare o bloco que falta em blocos[]."))

        juntado = _ExercicioJuntado(
            nome=do_catalogo.nome,
            tipo_exercicio=do_catalogo.tipo_exercicio,
            unidade_reps=do_catalogo.unidade_reps,
            metrica_direcao=do_catalogo.metrica_direcao,
            bloco_id=item.bloco_id,
            observacoes=item.observacoes,
            series_prescritas=item.series_prescritas or [],
        )

        if not juntado.series_prescritas:
            erros.append(Achado(
                "SEM_SERIES_PRESCRITAS", f"{ce}.series_prescritas", onde,
                "exercício sem nenhuma série prescrita: o aluno abre o treino e não tem o que fazer.",
                'informe ao menos um bloco. Ex.: [{"series": 3, "reps": "8-12", "carga": null}]'))
        else:
            for i_s, serie in enumerate(juntado.series_prescritas):
                cs = f"{ce}.series_prescritas[{i_s}]"
                vp.validar_serie(serie, cs, onde, erros)
                vp.validar_unidade_em_reps(serie, juntado, cs, onde, erros)

        # Série se corrige no template, mas `unidade_reps`/`metrica_direcao` moram no catálogo:
        # o caminho tem de apontar para `exercicios[i]`, senão o LLM edita o lugar errado.
        c_cat = f"exercicios[{indices[item.ex_ref]}]"
        if normalizar_tipo_exercicio(juntado.tipo_exercicio) == TipoExercicio.PERFORMANCE.value:
            vp.validar_performance(juntado, c_cat, onde, tmpl, blocos_por_id, erros, avisos)
        else:
            vp.validar_forca(juntado, c_cat, onde, avisos)


def _validar_rotinas(pacote: PacoteFile, erros: list, avisos: list) -> None:
    refs_tmpl = {t.ref for t in pacote.templates}
    for ir, rot in enumerate(pacote.rotinas):
        cr = f"rotinas[{ir}]"
        onde = rot.nome or f"rotina {ir}"

        if not (rot.nome or "").strip():
            erros.append(Achado(
                "ROTINA_SEM_NOME", f"{cr}.nome", f'rotina "{rot.ref}"',
                "rotina sem nome não é identificável na biblioteca do personal.",
                'preencha "nome". Ex.: "Rotina ABCDE — Hipertrofia".'))

        if not rot.treinos:
            avisos.append(Achado(
                "ROTINA_SEM_TREINOS", f"{cr}.treinos", onde,
                "a rotina não lista nenhum treino; ela é instalada vazia.",
                '"treinos" é a lista de refs de templates em ordem. Ex.: ["tmpl_a", "tmpl_b"].'))

        for i_t, tmpl_ref in enumerate(rot.treinos):
            if tmpl_ref not in refs_tmpl:
                disponiveis = ", ".join(f'"{r}"' for r in list(refs_tmpl)[:8]) or "nenhuma"
                erros.append(Achado(
                    "TMPL_REF_ORFAO", f"{cr}.treinos[{i_t}]", onde,
                    f'"{tmpl_ref}" não existe em templates[] (refs disponíveis: {disponiveis}); '
                    "na instalação esse treino é omitido da rotina em silêncio, e o personal só "
                    "descobre olhando a rotina treino por treino.",
                    "use uma das refs acima, ou declare o template que falta em templates[]."))


def _validar_pacote_info(pacote: PacoteFile, erros: list, avisos: list) -> None:
    pid = (pacote.pacote.id or "").strip()
    if not pid:
        erros.append(Achado(
            "PACOTE_SEM_ID", "pacote.id", "pacote",
            "pacote.id vazio: é dele que sai o id de todo exercício, template e rotina "
            "instalados.",
            'gere um UUID v4 e use como "id". Ex.: "3f2b9c14-8d5e-4a71-9f02-6c1d84be5a37".'))
        return
    try:
        uuid.UUID(pid)
    except ValueError:
        # Aviso, não erro: pacote antigo com id fora do padrão continua reimportável.
        avisos.append(Achado(
            "PACOTE_ID_NAO_UUID", "pacote.id", "pacote",
            f'pacote.id "{pid}" não é um UUID; como todos os ids instalados derivam dele, um id '
            "genérico pode colidir com outro pacote e sobrescrever conteúdo.",
            'gere um UUID v4. Ex.: "3f2b9c14-8d5e-4a71-9f02-6c1d84be5a37".'))

    if not (pacote.pacote.nome or "").strip():
        erros.append(Achado(
            "PACOTE_SEM_NOME", "pacote.nome", "pacote",
            "pacote sem nome não é identificável na lista de pacotes do personal.",
            'preencha "nome" com o nome comercial do pacote.'))


def validar(pacote: PacoteFile) -> tuple[list[Achado], list[Achado]]:
    """Devolve (erros, avisos) completos — o corte de exibição é de quem serializa.

    Não recebe `Contexto`: as comparações contra a biblioteca do personal (nome/vídeo parecido)
    não valem aqui, porque um pacote é conteúdo de terceiro e a instalação já resolve o vídeo
    por nome canônico (`biblioteca_service.resolver_video`).
    """
    erros: list[Achado] = []
    avisos: list[Achado] = []

    _validar_pacote_info(pacote, erros, avisos)
    _validar_refs(pacote, erros, avisos)
    _validar_exercicios(pacote, erros, avisos)

    catalogo = {ex.ref: ex for ex in pacote.exercicios}
    indices = {ex.ref: i for i, ex in enumerate(pacote.exercicios)}
    for it, tmpl in enumerate(pacote.templates):
        _validar_template(tmpl, it, catalogo, indices, erros, avisos)

    _validar_rotinas(pacote, erros, avisos)

    if not pacote.templates and not pacote.exercicios:
        erros.append(Achado(
            "PACOTE_VAZIO", "(raiz)", "pacote",
            "o pacote não traz exercício nem template: não há nada para instalar.",
            'devolva o pacote completo com "exercicios" e "templates" preenchidos.'))

    return erros, avisos
