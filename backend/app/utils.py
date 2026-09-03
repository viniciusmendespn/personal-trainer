import uuid
from calendar import monthrange
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

# Namespace fixo para IDs determinísticos de itens importados de pacote.
# Mesmo (pacote_id, ref) → mesmo ID → reimport sobrescreve (upsert), nunca duplica.
NAMESPACE_PACOTE = uuid.UUID("6f1d3c2a-9b47-5e88-a1f0-2c4e7d9b1a55")


def new_id() -> str:
    return str(uuid.uuid4())


def det_id(*parts: str) -> str:
    """ID determinístico a partir de partes estáveis (ex.: pacote_id + ref).
    Estável entre importações → permite upsert idempotente sem duplicar."""
    return str(uuid.uuid5(NAMESPACE_PACOTE, ":".join(parts)))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def tz_valido(tz: str | None) -> bool:
    """True se `tz` é um nome IANA que este runtime conhece (ex.: 'America/Sao_Paulo').

    Mora aqui, e não em `services/locale_service`, para que os models possam validar entrada
    sem importar services — `utils` é folha, não cria ciclo."""
    if not tz or not isinstance(tz, str):
        return False
    try:
        ZoneInfo(tz)
        return True
    except (ZoneInfoNotFoundError, ValueError):
        return False


def epoch_ms() -> str:
    """Epoch em ms, zero-padded — ordenável lexicograficamente em SK (ESPEC §2)."""
    return f"{int(datetime.now(timezone.utc).timestamp() * 1000):013d}"


def add_meses(base: date, meses: int, dia_ancora: int | None = None) -> date:
    """Avança `meses` meses de calendário mantendo `dia_ancora` (padrão: o dia de `base`),
    com clamp para o último dia do mês quando o dia não existe (31/01 + 1 mês = 28/02).

    Quem chama é responsável por GUARDAR a âncora e passá-la de volta na chamada seguinte:
    é isso que impede a degradação permanente do dia. Sem âncora persistida, o clamp de
    fevereiro contamina todos os ciclos futuros (31/01 → 28/02 → 28/03 → 28/04); com ela,
    28/02 + 1 mês volta para 31/03.

    Mesmo padrão `min(dia, monthrange(...))` de `financeiro_service._proximo_periodo`, que
    faz o vencimento das cobranças do aluno."""
    dia = dia_ancora or base.day
    total = base.year * 12 + (base.month - 1) + meses
    ano, mes = divmod(total, 12)
    mes += 1
    return date(ano, mes, min(dia, monthrange(ano, mes)[1]))


def treinos_validos(items: list[dict]) -> list[dict]:
    """Descarta item de TREINO# sem `treino_id` — não é treino, é lixo.

    Existiu por um bug de upsert (agregado de sessão recriando um treino apagado, ver
    `dynamo_repo.add_and_set(if_exists=)`), e o estrago não foi o item em si: foi um
    `t["treino_id"]` estourando KeyError no meio de `GET /v1/aluno/hoje` e deixando o app
    do aluno sem nenhum treino. Filtrar na leitura mantém um item torto local em vez de
    derrubar a tela inteira — vale para qualquer causa futura, não só aquele bug.
    """
    return [t for t in items if t.get("treino_id")]


def treino_vigente(t: dict, hoje_str: str) -> bool:
    """True se o treino está ativo e dentro do período (campos opcionais)."""
    if not t.get("ativo", True):
        return False
    if t.get("data_inicio") and hoje_str < t["data_inicio"]:
        return False
    if t.get("data_fim") and hoje_str > t["data_fim"]:
        return False
    return True


def init_series_prescritas(
    series_prescritas: list[dict] | None,
    series: int | None,
    reps_prescritas: str | None,
    carga_prescrita: str | None,
) -> list[dict]:
    """Normaliza prescrição flat (legado) pra lista estruturada — espelha
    initSeriesPrescritas do frontend (SeriesPrescritasEditor.tsx)."""
    if series_prescritas:
        return series_prescritas
    if series:
        return [{"series": series, "reps": reps_prescritas or "", "carga": carga_prescrita}]
    return [{"series": 1, "reps": "", "carga": None}]
