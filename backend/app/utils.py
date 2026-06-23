import uuid
from datetime import datetime, timezone


def new_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def epoch_ms() -> str:
    """Epoch em ms, zero-padded — ordenável lexicograficamente em SK (ESPEC §2)."""
    return f"{int(datetime.now(timezone.utc).timestamp() * 1000):013d}"


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
