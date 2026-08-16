# Hardening do OAuth do servidor MCP — plano adiado

**Status: congelado até a aprovação do app na OpenAI** (decisão de 2026-08-15).
Origem: análise externa (`analise-mcp.txt`, gerada pelo ChatGPT) revisada contra o código.
Implementação atual em `MCP_SERVER.md`; submissão em `MCP_SUBMISSAO_CHATGPT.md`.

## Por que está congelado

Não existe artefato congelado numa submissão de conector — o que a OpenAI revisa é o
`mcp.coachpilot.com.br` que está no ar. Todo deploy durante a revisão mexe no que o revisor
testa. O critério para retomar cada item foi, então: **essa mudança altera algo que o fluxo de
revisão exercita?**

O único achado com peso de segurança (fase 1) é DoS do fluxo de conexão — não vaza dado nem
burla PKCE. Nada aqui justifica pressa contra a janela de revisão.

**Retomar quando:** a submissão do ChatGPT for aprovada ou rejeitada (qualquer desfecho encerra
a janela). Ordem: fase 1 → 4 → 2 → 3 → 5.

---

## Veredito da análise externa

| # da análise | Alegação | Veredito |
|---|---|---|
| 1, 2 | `resgatar_code` / `rotacionar_refresh` queimam o token antes de validar | **Procede** — bug real, fase 1 |
| 4, 5 | `resource` não é validado nem propagado | **Procede** — campo morto, fase 2 |
| 7 | Falta `iss` no redirect (RFC 9207) | **Procede** — fase 3 |
| 3, 22 | Faltam testes dos dois ataques | **Procede em parte** — fase 4 |
| 6 | Audience do access token | Já funciona; há folga a apertar (fase 2) |
| 8, 9, 12–17, 19, 20, 21 | Metadata, DCR, tenant via token, hash dos tokens, match exato de redirect, `WWW-Authenticate`, transporte | **Já implementado** — são "não quebrar", não "corrigir" |
| 10 | Client ID Metadata Documents (CIMD) | **Não implementar** — ver "Fora de escopo" |

---

## Fase 1 — consumo atômico do code e do refresh

O bug. `app/services/mcp_service.py:207-220`:

```python
item = repo.get_item(pk, "META")            # busca
if not repo.delete_item_if_exists(pk, ...): # QUEIMA
    raise ValueError("código já utilizado")
if item["client_id"] != client_id:          # só então valida
```

Mesmo padrão em `rotacionar_refresh` (`:244-255`). Quem souber o `code` mas não o
`code_verifier` apaga o código legítimo e derruba a conexão do cliente honesto.

**Correção:** mover o `delete_item_if_exists` para **depois** de todas as validações
(client_id, redirect_uri, PKCE, resource quando a fase 2 entrar). Em `rotacionar_refresh`,
depois de client_id e do estado da conexão.

A garantia one-shot continua intacta: o delete condicional segue sendo o desempate em corrida
— dois requests válidos simultâneos leem o mesmo item, ambos validam, só um deleta e o outro
recebe `invalid_grant`. Não trocar por `delete` com `ReturnValues=ALL_OLD`: economiza uma
operação mas devolve o problema, porque a validação voltaria a rodar depois da remoção.

Manter os erros genéricos (`invalid_grant` no `/token`), sem revelar qual validação falhou.

**Risco de deploy: baixo.** Só muda o comportamento de quem apresenta credencial errada —
cliente legítimo, ChatGPT, Claude e revisor humano nunca passam por esse caminho.

## Fase 2 — `resource` de ponta a ponta (RFC 8707)

Hoje `criar_authreq` grava `resource` (`mcp_service.py:86`) e **nada nunca lê**. O `/authorize`
aceita qualquer string, `aprovar()` não copia o valor para o authorization code e o `/token`
sequer parseia o campo.

- `app/mcp/tokens.py`: `resource_aceito(valor)` normalizando barra final. Aceita
  `https://mcp.coachpilot.com.br/mcp` e a raiz — a raiz fica por compatibilidade com clientes
  que mandam `resource` sem path, e isso é intencional, não descuido.
- `/authorize`: `resource` fora do conjunto → `invalid_target` pela redirect_uri **já
  validada** (nunca antes de validar a redirect).
- `aprovar()`: copiar `resource` da authreq para o item do code.
- `/token`: ler `resource` do corpo; se vier, precisa ser aceito **e** bater com o do code.
  **Ausente continua válido** — é o que a maioria dos clientes manda hoje, e exigir o campo
  derrubaria conexões vivas.
- `_audiences_aceitas()` (`tokens.py:96`) hoje aceita raiz **ou** recurso, enquanto
  `emitir_access_token` só emite o recurso. Apertar para só `resource_url()`.

**Risco de deploy: o mais alto do plano.** Passar a rejeitar `resource` significa que uma
variante não prevista quebra o consentimento. Por isso não entra durante revisão.

## Fase 3 — `iss` no redirect (RFC 9207)

O redirect com o code é montado em `app/routers/mcp_portal.py:56-62` e leva só `code` e `state`.

- `mcp_portal.aprovar`: acrescentar `iss=mcp_tokens.server_url()` ao `redirect_to`.
- `oauth._volta_com_erro` (`oauth.py:170-175`): `iss` também nos erros que voltam pela
  redirect_uri validada.
- O valor tem que ser idêntico ao `issuer` de `/.well-known/oauth-authorization-server`.
- Sem mudança no frontend — a tela de consentimento só segue o `redirect_to`.

**Risco de deploy: baixo, benefício imediato zero.** A RFC manda o cliente ignorar o que não
entende, mas mexe no callback — justamente o que o revisor exercita.

## Fase 4 — testes (`backend/tests/test_mcp_oauth.py`)

Já existem `test_code_verifier_errado_falha` e `test_code_de_outro_cliente_falha`, mas nenhum
verifica **que o code sobrevive** à tentativa falha — é exatamente o teste que teria pego o bug.

Novos casos:

- code sobrevive a PKCE errado, client_id errado e redirect_uri errada, e **depois funciona**
  com os dados corretos;
- refresh sobrevive a client_id errado e depois roda normalmente;
- `resource` correto passa; divergente do autorizado e arbitrário falham;
- `iss` presente no redirect e igual ao `issuer` do metadata.

Continuam valendo: one-shot, rotação do refresh, revogação, audience.

Estes testes podem ser escritos **agora**, durante o congelamento — ficam vermelhos até o
código entrar. Rodar a suíte MCP inteira ao retomar: `test_mcp_oauth`, `test_mcp_jsonrpc`,
`test_mcp_tenant`, `test_mcp_submissao`, `test_mcp_escrita`, `test_mcp_prompt_sync`.

## Fase 5 — documentação e deploy

- Atualizar `MCP_SERVER.md`: conjunto de `resource` aceito, `iss` no redirect, CIMD como
  pendência conhecida.
- Commit + deploy com changeset do CloudFormation revisado, conforme `CLAUDE.md`.

---

## Fora de escopo

**CIMD (item 10 da análise).** A spec do MCP está migrando descoberta de cliente de DCR para
Client ID Metadata Documents, com `client_id` sendo uma URL HTTPS. O custo aqui é específico e
alto: o authorization server passaria a fazer **fetch HTTP de uma URL escolhida pelo cliente**,
abrindo SSRF numa Lambda que hoje não faz nenhuma saída HTTP. Nenhum dos clientes-alvo
(ChatGPT, Claude, Gemini) exige isso — todos usam DCR, que continua funcionando e não deve ser
removido. Revisitar quando um cliente real pedir, e aí seguindo a spec oficial vigente, sem
inventar formato.

**Rate limit no `POST /register`.** Achado que a análise não levantou: o registro é anônimo e
ilimitado, gravando item com TTL de 30 dias. Não é falha de segurança — `client_id` sem
consentimento não dá acesso a nada — mas é gravação anônima em DynamoDB, então é questão de
custo. Fica fora inclusive da retomada imediata: um teto mal calibrado durante a revisão vira
rejeição se o revisor registrar cliente várias vezes.

---

## Pendência não relacionada, de prioridade maior

`CLAUDE.md` registra como pendência os **termos/privacidade cobrindo envio de dado de saúde**.
Numa revisão de app que lê anamnese e avaliação física, isso é motivo de rejeição bem mais
provável do que qualquer item deste plano. Resolver antes.
