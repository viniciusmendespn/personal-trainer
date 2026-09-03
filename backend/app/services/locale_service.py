"""Fuso horário por usuário — resolução em cascata e conversão de instante para calendário.

Ponto ÚNICO de leitura do fuso. Regras completas em `docs/TIMEZONE.md`; o essencial:

  • Instante é sempre UTC no banco. O fuso só entra para responder "de que DIA isso é?".
  • Fuso é **nome IANA** (`America/Sao_Paulo`), nunca offset. Offset fixo quebra no horário de
    verão — irrelevante no Brasil, obrigatório nos EUA e na Europa.
  • Agrupamento usa o fuso do SUJEITO (de quem o dado é); exibir hora usa o do LEITOR.
  • Data civil (vencimento, nascimento) não é instante: compara-se com `hoje()` no fuso de
    quem é dono da data, nunca com `date.today()` (que na Lambda é UTC).
"""
import logging
from datetime import datetime, timezone, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.utils import tz_valido  # noqa: F401  — reexport: quem valida entrada usa daqui

logger = logging.getLogger(__name__)

TZ_PADRAO = "America/Sao_Paulo"


def _zona(tz: str | None) -> tzinfo:
    """Nunca levanta: fuso ausente ou inválido cai no padrão. Um valor corrompido no perfil
    não pode derrubar o dashboard inteiro — degradar para o padrão é melhor que erro 500.

    O segundo `except` cobre o PADRÃO também falhar, o que só acontece se a base IANA sumir do
    pacote (`tzdata` fora do requirements). Aí a data sai em UTC — errada por até 14h, mas a
    tela abre: a diferença entre um gráfico torto e o portal inteiro fora do ar."""
    try:
        return ZoneInfo(tz or TZ_PADRAO)
    except (ZoneInfoNotFoundError, ValueError):
        pass
    try:
        return ZoneInfo(TZ_PADRAO)
    except (ZoneInfoNotFoundError, ValueError):
        logger.error("[locale] base IANA indisponível — tzdata saiu do requirements?")
        return timezone.utc


# ── Resolução em cascata ─────────────────────────────────────────────────────

def tz_do_personal(personal_id: str | None) -> str:
    if not personal_id:
        return TZ_PADRAO
    item = repo.get_item(keys.pk_personal(personal_id), keys.SK_PROFILE) or {}
    return item.get("timezone") or TZ_PADRAO


def tz_do_aluno(aluno_id: str | None, personal_id: str | None = None) -> str:
    """Cascata: fuso do aluno → fuso do personal → padrão.

    O aluno tem fuso próprio porque treino remoto é o caso de uso, não a exceção: o aluno
    mora onde mora, independente de onde o personal está."""
    if not aluno_id:
        return tz_do_personal(personal_id)
    item = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE) or {}
    if item.get("timezone"):
        return item["timezone"]
    return tz_do_personal(personal_id or item.get("personal_id"))


def tzs_da_dupla(aluno_id: str, personal_id: str) -> tuple[str, str]:
    """(tz_aluno, tz_personal) com uma leitura de cada perfil.

    Existe para o `start_session`, que precisa dos dois: chamar `tz_do_aluno` e
    `tz_do_personal` em sequência resolveria a cascata duas vezes e leria o perfil do
    personal duas vezes."""
    tz_p = tz_do_personal(personal_id)
    item = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE) or {}
    return (item.get("timezone") or tz_p), tz_p


# ── Instante → calendário local ──────────────────────────────────────────────

def _dt(iso: str, tz: str | None) -> datetime:
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(_zona(tz))


def dia(iso: str | None, tz: str | None) -> str | None:
    """'YYYY-MM-DD' do dia LOCAL de um instante. None se `iso` for vazio/inválido."""
    if not iso:
        return None
    try:
        return _dt(iso, tz).date().isoformat()
    except (ValueError, AttributeError):
        return None


def hoje(tz: str | None) -> str:
    """'YYYY-MM-DD' de hoje no fuso dado. Substitui `date.today()` para data civil."""
    return datetime.now(_zona(tz)).date().isoformat()


def semana_iso(iso: str | None, tz: str | None) -> str | None:
    """'YYYY-Www' da semana ISO LOCAL de um instante (segunda como primeiro dia)."""
    if not iso:
        return None
    try:
        y, w, _ = _dt(iso, tz).isocalendar()
    except (ValueError, AttributeError):
        return None
    return f"{y}-W{w:02d}"


def semana_iso_agora(tz: str | None) -> str:
    y, w, _ = datetime.now(_zona(tz)).isocalendar()
    return f"{y}-W{w:02d}"


def dow(iso: str | None, tz: str | None) -> int | None:
    """Dia da semana LOCAL (0 = segunda), como `datetime.weekday()`."""
    if not iso:
        return None
    try:
        return _dt(iso, tz).weekday()
    except (ValueError, AttributeError):
        return None


def ja_passou(data_iso: str, tz: str | None, hora_local: int = 0) -> bool:
    """No fuso dado, já é `data_iso` às `hora_local`h (ou depois)?

    É o gatilho dos jobs agendados: o item é gravado na partição da DATA CIVIL em que deve
    disparar, e quem decide se chegou a hora é isto — assim a mesma entrada serve para
    qualquer fuso, sem uma partição por região (docs/TIMEZONE.md §7, Passo 5)."""
    z = _zona(tz)
    try:
        # `.replace(tzinfo=...)` com ZoneInfo é o jeito correto de fixar hora de PAREDE:
        # a zona resolve sozinha o offset vigente naquele dia, horário de verão incluso.
        alvo = datetime.fromisoformat(data_iso).replace(hour=hora_local, tzinfo=z)
    except (ValueError, TypeError):
        return True   # data corrompida: não segurar o disparo para sempre
    return datetime.now(z) >= alvo


def hora(iso: str | None, tz: str | None) -> str:
    """'HH:MM' no fuso dado — para texto exibido ao usuário (push, notificação).
    Substitui o `TZ_OFFSET_HOURS` global, que não conseguia variar por destinatário."""
    if not iso:
        return "—"
    try:
        return _dt(iso, tz).strftime("%H:%M")
    except (ValueError, AttributeError):
        return "—"
