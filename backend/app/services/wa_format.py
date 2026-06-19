"""Converte Markdown (saída padrão de LLMs) pra formatação nativa do WhatsApp.

WhatsApp tem sintaxe própria, parcialmente sobreposta à Markdown: negrito é
*um* asterisco (não dois) e itálico é underscore. Cabeçalho e link com texto
âncora não existem — link no WhatsApp é só a URL crua, então preservamos o
texto do link como texto solto antes dela.
"""
import re

_CODE_BLOCK = re.compile(r"```.*?```", re.DOTALL)
_INLINE_CODE = re.compile(r"`[^`\n]+?`")
_LINK = re.compile(r"!?\[([^\]]*)\]\(([^)\s]+)\)")
_HEADER = re.compile(r"^#{1,6}[ \t]+(.*)$", re.MULTILINE)
_BULLET = re.compile(r"^([ \t]*)[*+][ \t]+", re.MULTILINE)
_BOLD = re.compile(r"\*\*(.+?)\*\*|__(.+?)__", re.DOTALL)
_ITALIC = re.compile(r"\*(.+?)\*|_(.+?)_", re.DOTALL)
_STRIKE = re.compile(r"~~(.+?)~~", re.DOTALL)
_HR = re.compile(r"^[ \t]*([*_-])(?:[ \t]*\1){2,}[ \t]*$\n?", re.MULTILINE)

_BOLD_MARK = "\x00B\x00"
_ITALIC_MARK = "\x00I\x00"


def markdown_to_whatsapp(text: str) -> str:
    if not text:
        return text

    code_spans: list[str] = []

    def _stash(m: re.Match) -> str:
        code_spans.append(m.group(0))
        return f"\x00C{len(code_spans) - 1}\x00"

    text = _CODE_BLOCK.sub(_stash, text)
    text = _INLINE_CODE.sub(_stash, text)

    def _link(m: re.Match) -> str:
        label, url = m.group(1), m.group(2)
        return f"{label}: {url}" if label else url

    text = _LINK.sub(_link, text)
    text = _HR.sub("", text)
    text = _HEADER.sub(lambda m: f"{_BOLD_MARK}{m.group(1)}{_BOLD_MARK}", text)
    text = _BULLET.sub(r"\1- ", text)

    def _bold(m: re.Match) -> str:
        return f"{_BOLD_MARK}{m.group(1) or m.group(2)}{_BOLD_MARK}"

    text = _BOLD.sub(_bold, text)

    def _italic(m: re.Match) -> str:
        return f"{_ITALIC_MARK}{m.group(1) or m.group(2)}{_ITALIC_MARK}"

    text = _ITALIC.sub(_italic, text)
    text = _STRIKE.sub(r"~\1~", text)

    text = text.replace(_BOLD_MARK, "*").replace(_ITALIC_MARK, "_")

    for i, span in enumerate(code_spans):
        text = text.replace(f"\x00C{i}\x00", span)

    return text
