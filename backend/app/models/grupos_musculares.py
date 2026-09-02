"""Grupo muscular de um exercício — vocabulário canônico e leitura tolerante ao legado.

Um exercício atinge mais de um grupo (supino = peito + tríceps), então o dado verdadeiro é
`grupos: list[str]`. O campo antigo `grupo: str` continua sendo gravado como `", ".join(grupos)`
para não quebrar os leitores legados (export .cpkg, markdown da biblioteca para a IA,
agrupamento do PacotesPage, busca).

`grupos_do_item` é o ÚNICO ponto de leitura: quando só existe o `grupo` legado, ele quebra a
string composta ("Peito, Tríceps") na lista que ela sempre quis ser. É isso que faz o gráfico de
volume ficar correto para o histórico já gravado, sem migração e sem reescrever nenhum item.

Espelhado em `frontend/src/constants/gruposMusculares.ts` e `frontend/src/utils/grupos.ts`
(CLAUDE.md: enums espelhados backend ↔ frontend).
"""
import re
import unicodedata

SEM_GRUPO = "Sem grupo"

# Vocabulário sugerido no portal e nos prompts. NÃO é uma lista fechada — o personal pode digitar
# um grupo próprio ("Core", "Adutores", "Full body"). Unifica as três listas divergentes que
# existiam em prompt-cpkg.md, prompt-treino-aluno.md e ImportarExerciciosModal.tsx.
VOCABULARIO: tuple[str, ...] = (
    "Peito",
    "Costas",
    "Ombros",
    "Trapézio",
    "Bíceps",
    "Tríceps",
    "Antebraço",
    "Quadríceps",
    "Posteriores de coxa",
    "Glúteos",
    "Panturrilhas",
    "Abdômen",
    "Core",
    "Full body",
    "Cardio",
)

# Separadores que aparecem num campo composto digitado à mão ou vindo de import.
# O " e " precisa de fronteira de palavra para não picar "Peito e..." dentro de outra palavra.
_SEPARADORES = re.compile(r"\s*(?:[,/+;&]|\be\b)\s*", re.IGNORECASE)


def normalizar_grupo(grupo: str | None) -> str:
    """Chave canônica do grupo para SK do DynamoDB (lowercase, sem acento, sem espaço extra)."""
    if not grupo:
        return SEM_GRUPO.lower()
    sem_acento = unicodedata.normalize("NFKD", grupo).encode("ascii", "ignore").decode()
    return " ".join(sem_acento.lower().split())


def separar_grupos(grupo: str | None) -> list[str]:
    """Quebra um campo `grupo` legado composto em grupos individuais, preservando a grafia
    original de cada um. "Peito, Tríceps" → ["Peito", "Tríceps"]. Dedup por chave normalizada."""
    if not grupo or not grupo.strip():
        return []
    vistos: set[str] = set()
    saida: list[str] = []
    for parte in _SEPARADORES.split(grupo):
        nome = parte.strip()
        if not nome:
            continue
        chave = normalizar_grupo(nome)
        if chave in vistos:
            continue
        vistos.add(chave)
        saida.append(nome)
    return saida


def grupos_do_item(item: dict | None) -> list[str]:
    """Os grupos musculares de um exercício/snapshot. `grupos` quando existe; senão o `grupo`
    legado quebrado em partes. Nunca vazio — sem informação, devolve ["Sem grupo"]."""
    if not item:
        return [SEM_GRUPO]
    lista = item.get("grupos")
    if isinstance(lista, list) and lista:
        vistos: set[str] = set()
        saida: list[str] = []
        for g in lista:
            nome = str(g).strip()
            if not nome:
                continue
            chave = normalizar_grupo(nome)
            if chave in vistos:
                continue
            vistos.add(chave)
            saida.append(nome)
        if saida:
            return saida
    return separar_grupos(item.get("grupo")) or [SEM_GRUPO]


def grupo_legado(grupos: list[str] | None) -> str | None:
    """A string que vai no campo `grupo` para os leitores que ainda esperam texto."""
    limpos = [str(g).strip() for g in (grupos or []) if str(g).strip()]
    return ", ".join(limpos) if limpos else None


def sincronizar_grupo_legado(model):
    """Validator compartilhado pelos modelos que têm `grupo`/`grupos` (biblioteca, exercício,
    template, pacote, export de programa). Com `grupos` preenchido, reescreve `grupo` como a
    string equivalente, para que todo leitor legado siga funcionando sem alteração.

    NÃO faz o inverso: um item antigo que só tem `grupo` continua sem `grupos` gravado — a
    quebra acontece na leitura (`grupos_do_item`), então nada já persistido é reescrito."""
    if getattr(model, "grupos", None):
        model.grupos = grupos_do_item({"grupos": model.grupos})
        model.grupo = grupo_legado(model.grupos)
    return model
