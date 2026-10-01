"""HTML autocontido versionado, servido pelo mesmo MCP autenticado."""
from functools import lru_cache
from pathlib import Path

from app.config import settings

URI = "ui://coachpilot/workspace/v1.html"
MIME = "text/html;profile=mcp-app"
DIST = Path(__file__).parent / "ui_dist"


def disponivel():
    return settings.mcp_ui_enabled and (DIST / "v1.html").is_file()


def listar():
    return [{"uri": URI, "name": "coachpilot-workspace", "title": "CoachPilot",
             "mimeType": MIME}] if disponivel() else []


@lru_cache(maxsize=4)
def _html(uri):
    return (DIST / uri.rsplit("/", 1)[-1]).read_text(encoding="utf-8")


def ler(uri):
    if uri != URI or not disponivel():
        raise KeyError(uri)
    return {"contents": [{"uri": uri, "mimeType": MIME, "text": _html(uri),
        # `domain`: origem de isolamento do widget — tem que ser um site que existe (o portal).
        # O destino do botão "abrir no app" do host é outra coisa: a própria UI o define por
        # aluno com `setOpenInAppUrl` (host.ts → setOpenInApp), quando o host oferece.
        "_meta": {"ui": {"prefersBorder": True, "domain": settings.mcp_ui_domain,
                          "csp": {"connectDomains": [], "resourceDomains": []}}}}]}
