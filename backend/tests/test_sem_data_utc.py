"""Trava de regressão: nenhum código novo pode derivar data civil do relógio UTC.

Estes três padrões geraram TODOS os bugs de fuso do sistema (docs/TIMEZONE.md). O código
nasceu com eles porque nada impedia — é isso que este teste conserta. Sem a trava, "resolvido"
depende de alguém lembrar; com ela, depende do teste.

  • `date.today()`                    → dia UTC na Lambda. Use `locale_service.hoje(tz)`.
  • `datetime.now(timezone.utc).date()` → idem.
  • `datetime.utcnow()`               → naive e deprecado.
  • `ZoneInfo(...)` espalhado          → resolução de fuso mora num lugar só.

Comentário e docstring são ignorados: o texto que EXPLICA o padrão errado é justamente o que
não pode disparar o alarme. A varredura usa `tokenize`, então isso é exato, não heurística.
"""
import io
import tokenize
from pathlib import Path

import pytest

APP = Path(__file__).resolve().parent.parent / "app"

# Único ponto autorizado a construir fuso. `utils` guarda só o validador `tz_valido`, que
# precisa de ZoneInfo para dizer se um nome é válido — e mora lá para os models validarem
# entrada sem importar services (evita ciclo).
ARQUIVOS_DE_FUSO = {"locale_service.py", "utils.py"}

PROIBIDOS = {
    "date.today()": "data civil a partir do relógio UTC — use locale_service.hoje(tz)",
    "datetime.utcnow()": "naive e deprecado — use utils.now_iso() ou locale_service",
    "datetime.now(timezone.utc).date()": "dia UTC — use locale_service.hoje(tz)",
    "now(timezone.utc).date()": "dia UTC — use locale_service.hoje(tz)",
}


# Escape para o caso legítimo: índice/janela de partição, que é UTC de propósito e não é a
# data civil de ninguém. Exige a justificativa escrita ao lado — é o ponto do marcador.
MARCADOR = "fuso-ok:"


def _codigo_sem_comentarios(caminho: Path) -> str:
    """Fonte com comentários e strings removidos, preservando as linhas."""
    fonte = caminho.read_text(encoding="utf-8")
    linhas = fonte.splitlines()
    try:
        tokens = list(tokenize.generate_tokens(io.StringIO(fonte).readline))
    except (tokenize.TokenError, IndentationError, SyntaxError):
        return fonte
    for tok in tokens:
        if tok.type not in (tokenize.COMMENT, tokenize.STRING):
            continue
        (l1, c1), (l2, c2) = tok.start, tok.end
        for i in range(l1 - 1, min(l2, len(linhas))):
            linha = linhas[i]
            ini = c1 if i == l1 - 1 else 0
            fim = c2 if i == l2 - 1 else len(linha)
            linhas[i] = linha[:ini] + " " * (fim - ini) + linha[fim:]
    return "\n".join(linhas)


def _ocorrencias(padrao: str, so_fora_de: set[str] | None = None) -> list[str]:
    achados = []
    for py in sorted(APP.rglob("*.py")):
        if "__pycache__" in py.parts:
            continue
        if so_fora_de and py.name in so_fora_de:
            continue
        originais = py.read_text(encoding="utf-8").splitlines()
        codigo = _codigo_sem_comentarios(py)
        for n, linha in enumerate(codigo.splitlines(), 1):
            if padrao not in linha:
                continue
            # O padrão é procurado no código sem comentários; o marcador, nas linhas originais —
            # senão o próprio escape seria apagado antes de ser visto. Vale na mesma linha ou
            # nas duas acima, que é onde o comentário justificando naturalmente cai.
            vizinhas = originais[max(0, n - 3):n]
            if any(MARCADOR in v for v in vizinhas):
                continue
            rel = py.relative_to(APP.parent)
            achados.append(f"{rel}:{n}: {linha.strip()}")
    return achados


@pytest.mark.parametrize("padrao,motivo", sorted(PROIBIDOS.items()))
def test_nao_deriva_data_civil_do_utc(padrao, motivo):
    achados = _ocorrencias(padrao)
    assert not achados, (
        f"\n`{padrao}` — {motivo}.\n"
        f"Data civil (vencimento, prazo, 'hoje') pertence ao calendário de alguém; o dia UTC\n"
        f"não é o dia de ninguém. Ver docs/TIMEZONE.md §1.2.\n\n" + "\n".join(achados)
    )


def test_fuso_e_construido_num_lugar_so():
    achados = _ocorrencias("ZoneInfo(", so_fora_de=ARQUIVOS_DE_FUSO)
    assert not achados, (
        "\nZoneInfo fora de locale_service/utils: a resolução de fuso mora num ponto só, "
        "senão a cascata (aluno → personal → padrão) passa a ter versões divergentes.\n\n"
        + "\n".join(achados)
    )


def test_offset_fixo_nao_volta():
    """`TZ_OFFSET_HOURS` era uma env var global com default -3: não variava por usuário e
    quebrava no horário de verão. Foi removida — não pode voltar por conveniência."""
    achados = _ocorrencias("TZ_OFFSET")
    assert not achados, "\nOffset fixo de novo. Use nome IANA.\n\n" + "\n".join(achados)
