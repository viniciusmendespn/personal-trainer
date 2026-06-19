from app.services.wa_format import markdown_to_whatsapp


def test_bold_double_asterisk_to_single():
    assert markdown_to_whatsapp("Isso é **importante**.") == "Isso é *importante*."


def test_bold_double_underscore_to_single_asterisk():
    assert markdown_to_whatsapp("Isso é __importante__.") == "Isso é *importante*."


def test_italic_single_asterisk_to_underscore():
    assert markdown_to_whatsapp("Vai com *calma*.") == "Vai com _calma_."


def test_italic_single_underscore_stays_underscore():
    assert markdown_to_whatsapp("Vai com _calma_.") == "Vai com _calma_."


def test_strikethrough():
    assert markdown_to_whatsapp("~~cancelado~~") == "~cancelado~"


def test_link_keeps_label_and_url():
    out = markdown_to_whatsapp("1. [Supino reto](https://ex.com/v1) — 4×10, 30 kg, 90s")
    assert out == "1. Supino reto: https://ex.com/v1 — 4×10, 30 kg, 90s"


def test_link_without_label_keeps_only_url():
    assert markdown_to_whatsapp("Veja [](https://ex.com/v1)") == "Veja https://ex.com/v1"


def test_header_becomes_bold():
    assert markdown_to_whatsapp("## Treino A") == "*Treino A*"


def test_bullet_star_normalized_to_dash():
    assert markdown_to_whatsapp("* item um\n* item dois") == "- item um\n- item dois"


def test_numbered_list_unchanged():
    text = "1. agachamento\n2. supino"
    assert markdown_to_whatsapp(text) == text


def test_inline_code_preserved():
    assert markdown_to_whatsapp("Use `registrar_dor`.") == "Use `registrar_dor`."


def test_code_block_preserved():
    text = "```\ncarga = 30\n```"
    assert markdown_to_whatsapp(text) == text


def test_plain_text_unchanged():
    text = "Olá, João! Acesse seu app de treino: https://app.exemplo.com/x"
    assert markdown_to_whatsapp(text) == text


def test_horizontal_rule_removed():
    out = markdown_to_whatsapp("Treino A\n---\nTreino B")
    assert "---" not in out
