"""Geração de códigos promocionais compatíveis com o FinPilot.

Especificação completa em PROMO_CODE_GENERATION.md.
Resumo: payload de 21 bytes (version + code_id + expires_at + hmac_tag),
codificado em Base32 Crockford sem padding, formato PROMO-XXXXX-...-XXXX.
"""
import hmac
import hashlib
import os
import struct
import time

ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def _base32_encode(data: bytes) -> str:
    value = 0
    bits = 0
    output = []
    for byte in data:
        value = (value << 8) | byte
        bits += 8
        while bits >= 5:
            bits -= 5
            output.append(ALPHABET[(value >> bits) & 0x1F])
    if bits > 0:
        output.append(ALPHABET[(value << (5 - bits)) & 0x1F])
    return "".join(output)


def generate_code(secret: str, valid_for_days: int = 90) -> str:
    code_id = os.urandom(8)
    expires_at = int(time.time()) + valid_for_days * 86400
    header = bytes([0x01]) + code_id + struct.pack(">I", expires_at)
    tag = hmac.new(secret.encode("utf-8"), header, hashlib.sha256).digest()[:8]
    payload = header + tag
    encoded = _base32_encode(payload)
    groups = [encoded[i:i+5] for i in range(0, len(encoded), 5)]
    return "PROMO-" + "-".join(groups)


def validate_test_vector() -> bool:
    """Valida a implementação contra o vetor fixo do PROMO_CODE_GENERATION.md."""
    secret = "test-secret"
    code_id = bytes([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08])
    expires_at = 2000000000
    header = bytes([0x01]) + code_id + struct.pack(">I", expires_at)
    tag = hmac.new(secret.encode("utf-8"), header, hashlib.sha256).digest()[:8]
    payload = header + tag
    encoded = _base32_encode(payload)
    groups = [encoded[i:i+5] for i in range(0, len(encoded), 5)]
    result = "PROMO-" + "-".join(groups)
    return result == "PROMO-040G4-0R40M-30E23-Q6PA0-1ENBS-1QEAF-G0H4"
