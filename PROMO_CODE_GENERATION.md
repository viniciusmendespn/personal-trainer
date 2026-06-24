# Geração de Códigos Promocionais — Especificação para Implementação

Este documento é uma especificação **autocontida e linguagem-agnóstica** para
implementar, em qualquer outra aplicação/linguagem, a geração de códigos
promocionais que o Gerenciador Financeiro aceita para conceder **1 mês
grátis** de assinatura.

Se você é uma LLM implementando isso em outro projeto: siga este documento
ao pé da letra, implemente a função `generate_code`, e **valide sua
implementação contra o vetor de teste na seção 5** antes de gerar qualquer
código real. Se o seu output não bater byte a byte com o vetor de teste,
a implementação está incorreta — não gere códigos de produção até bater.

---

## 1. Pré-requisito: o segredo

Existe um segredo compartilhado, `PROMO_CODE_SECRET`, gerado uma única vez
com `openssl rand -hex 32` (uma string hexadecimal de 64 caracteres) e
configurado:

- Neste backend: env var `PROMO_CODE_SECRET` (`.env.local` em dev, parâmetro
  SAM `PromoCodeSecret` em produção).
- Na(s) aplicação(ões) geradora(s) externa(s): o **mesmo valor exato**,
  colado como configuração/segredo lá.

Trate esse valor como uma senha — qualquer aplicação que o conheça pode
gerar códigos válidos. **Nunca** exponha esse segredo em código client-side,
em apps públicas, ou em repositórios.

O segredo é usado como string UTF-8 na chave do HMAC (ex: em Python,
`secret.encode("utf-8")`).

---

## 2. Estrutura do payload (21 bytes)

Antes de qualquer codificação para texto, o código é montado como uma
sequência binária de 21 bytes:

| Offset | Tamanho | Campo             | Descrição                                                                 |
|--------|---------|-------------------|----------------------------------------------------------------------------|
| 0      | 1 byte  | `version`         | `uint8`, valor fixo `0x01`                                                  |
| 1      | 8 bytes | `code_id`         | Bytes aleatórios criptograficamente seguros (ex: `os.urandom(8)`)          |
| 9      | 4 bytes | `expires_at`      | `uint32` **big-endian** — timestamp Unix (segundos) de quando o código expira para resgate |
| 13     | 8 bytes | `hmac_tag`        | `HMAC-SHA256(secret, bytes[0:13])`, **truncado para os primeiros 8 bytes**  |

Observações:
- `expires_at` é a validade do **código** (prazo para resgatar), não tem
  relação com a duração do benefício concedido — o benefício é **sempre
  fixo em 1 mês**, decidido pelo backend no momento do resgate, não
  embutido no código.
- `hmac_tag` é calculado sobre os primeiros 13 bytes (`version + code_id +
  expires_at`), nunca sobre o payload completo (o tag não assina a si
  mesmo).
- O HMAC usa SHA-256 e o tag completo (32 bytes) é truncado para os
  primeiros 8 bytes (64 bits) — suficiente para este caso de uso (não há
  oráculo de verificação irrestrito exposto: o endpoint de resgate exige
  JWT autenticado e força um único uso por código).

---

## 3. Codificação para texto: Base32 Crockford (sem padding)

Os 21 bytes do payload são codificados em uma string usando o alfabeto de
**Crockford's Base32** (32 caracteres, exclui `I`, `L`, `O`, `U` para evitar
ambiguidade visual):

```
0123456789ABCDEFGHJKMNPQRSTVWXYZ
```

Cada caractere representa 5 bits. Não há caracteres de padding (`=`).

### Algoritmo de encode (pseudocódigo)

```
function base32_encode(bytes):
    value = 0
    bits = 0
    output = ""
    for byte in bytes:
        value = (value << 8) | byte
        bits += 8
        while bits >= 5:
            bits -= 5
            output += ALPHABET[(value >> bits) & 0b11111]
    if bits > 0:
        # bits restantes (< 5) são deslocados à esquerda e preenchidos com zero à direita
        output += ALPHABET[(value << (5 - bits)) & 0b11111]
    return output
```

Para 21 bytes (168 bits), o resultado tem `ceil(168 / 5) = 34` caracteres.

### Algoritmo de decode (pseudocódigo)

```
function base32_decode(text):
    value = 0
    bits = 0
    output = bytes()
    for char in text:
        idx = ALPHABET.index_of(char)  # erro se char não está no alfabeto
        value = (value << 5) | idx
        bits += 5
        if bits >= 8:
            bits -= 8
            output += byte((value >> bits) & 0xFF)
    return output
```

Para 34 caracteres (170 bits processados), o decode produz exatamente os
21 bytes originais (os 2 bits finais — padding de zeros do encode — são
descartados naturalmente, pois só emitem byte quando há 8 bits completos
acumulados).

---

## 4. Formato final do código

```
PROMO-<base32 em grupos de 5 caracteres, separados por hífen>
```

A string Base32 de 34 caracteres é dividida em grupos de 5 (o último grupo
tem 4 caracteres, já que `34 = 6×5 + 4`), unidos por hífen, com o prefixo
`PROMO-` na frente:

```
PROMO-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXX
```

Comprimento total: 46 caracteres (6 do prefixo + 34 do payload + 6 hífens).

Ao **validar** um código recebido, o backend:
1. Remove espaços nas pontas e converte para maiúsculas.
2. Remove o prefixo `PROMO-` se presente (aceita com ou sem).
3. Remove todos os hífens e espaços internos.
4. Decodifica o Base32 resultante.
5. Verifica se o payload decodificado tem exatamente 21 bytes e `version == 1`.
6. Recalcula o HMAC sobre os primeiros 13 bytes e compara com os últimos 8
   bytes usando comparação em tempo constante (nunca `==` direto).
7. Verifica se `expires_at` ainda não passou.

---

## 5. Vetor de teste (para validar sua implementação)

Use estes valores **fixos** (não aleatórios) para verificar que sua
implementação do encode produz exatamente a mesma string:

```
secret      = "test-secret"
code_id     = 0102030405060708   (hex, 8 bytes)
expires_at  = 2000000000          (uint32, decimal)
version     = 1
```

Passo a passo esperado:

```
header (13 bytes, hex) = 01 0102030405060708 77359400
                        = 01010203040506070877359400

hmac_tag (8 bytes, hex) = HMAC-SHA256("test-secret", header)[:8]
                         = baabc86ee53e0089

payload completo (21 bytes, hex) = 01010203040506070877359400baabc86ee53e0089

código final = PROMO-040G4-0R40M-30E23-Q6PA0-1ENBS-1QEAF-G0H4
```

Se a sua implementação, dado `secret="test-secret"`, `code_id` =
`0102030405060708` e `expires_at=2000000000`, não produzir exatamente
`PROMO-040G4-0R40M-30E23-Q6PA0-1ENBS-1QEAF-G0H4`, há um bug — revise a
ordem dos bytes (big-endian), o truncamento do HMAC (8 bytes, não 32), ou
o alfabeto Base32 (precisa ser o Crockford, não o RFC4648 padrão).

Esse vetor também serve para testar o **decode**: decodificar o código
acima com o segredo `"test-secret"` deve retornar `code_id =
0102030405060708` e `expires_at = 2000000000`, sem erro de assinatura.

---

## 6. Geração de um código real

Para gerar um código real (não o vetor de teste fixo), a única diferença é
que `code_id` deve ser aleatório (8 bytes de uma fonte criptograficamente
seria — `os.urandom`, `crypto.randomBytes`, etc.) e `expires_at` deve ser
`now + N dias` (o backend deste projeto usa um padrão de 90 dias de
validade para resgate, mas isso é decisão de quem gera o código).

Pseudocódigo completo:

```
function generate_code(secret, valid_for_days = 90):
    code_id = random_bytes(8)
    expires_at = unix_now() + valid_for_days * 86400
    header = uint8(1) + code_id + uint32_big_endian(expires_at)
    tag = hmac_sha256(secret, header)[:8]
    payload = header + tag
    encoded = base32_encode(payload)
    grouped = join(encoded split into chunks of 5, separator="-")
    return "PROMO-" + grouped
```

---

## 7. Resgate

O código gerado é colado pelo usuário na UI do app (botão "Tenho um código
promocional", disponível tanto na tela de bloqueio quanto no modal de
renovação) e enviado para:

```
POST /v1/payment/promo-code
Authorization: Bearer <JWT do usuário>
Content-Type: application/json

{ "code": "PROMO-XXXXX-..." }
```

Respostas:
- `200` — `{ "active": true, "expires_at": "...", "trial": false }` — o
  código foi resgatado e a assinatura foi estendida em 1 mês (cumulativo
  sobre a data de expiração atual, se ainda ativa).
- `400` — código inválido (assinatura não bate ou formato corrompido) ou
  expirado.
- `409` — código já foi resgatado anteriormente (cada código só pode ser
  usado uma vez).
- `503` — backend sem `PROMO_CODE_SECRET` configurado.

Cada código só pode ser resgatado **uma única vez**, controlado pelo
backend (não depende da aplicação geradora rastrear isso).

---

## 8. Implementação de referência

A implementação oficial em Python está em
`backend/app/services/promo_code.py` (funções `generate_code` e
`decode_and_verify`), e pode ser usada via CLI:

```bash
python backend/scripts/generate_promo_code.py --days 90 --count 5
```
