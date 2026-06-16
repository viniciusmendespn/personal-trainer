import uuid
from datetime import datetime, timezone


def new_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def epoch_ms() -> str:
    """Epoch em ms, zero-padded — ordenável lexicograficamente em SK (ESPEC §2)."""
    return f"{int(datetime.now(timezone.utc).timestamp() * 1000):013d}"
