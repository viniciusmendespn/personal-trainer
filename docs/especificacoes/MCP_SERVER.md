# Servidor MCP — ChatGPT, Claude e Gemini falando direto com o CoachPilot

## Por que existe

O fluxo já existia, manual: `frontend/public/prompt-treino-aluno.md` instrui o personal a baixar o
JSON do programa (`GET /v1/alunos/{id}/treinos/exportar`), colar numa LLM junto com as regras de
ouro e reimportar o resultado (`POST .../importar`). O servidor MCP **automatiza esse copia-e-cola**
— mesmo caminho de código, sem download nem upload.

Vantagem de custo: o token de LLM é do plano do próprio personal (ChatGPT Plus, Claude Pro, Gemini).
Para nós sobra Lambda + DynamoDB.

## Arquitetura

Duas superfícies HTTP, propositalmente separadas:

| Superfície | Lambda | Auth no gateway | Conteúdo |
|---|---|---|---|
| `mcp.coachpilot.com.br` | `McpFunction` (`McpApi` própria) | nenhuma | `/.well-known/*`, `/register`, `/authorize`, `/token`, `/mcp` |
| `coachpilot.com.br/v1/mcp/*` | `ApiFunction` | Cognito | consentimento e gestão de conexões |

**Subdomínio próprio** porque o OAuth exige `/.well-known/oauth-authorization-server` na *raiz* do
issuer, e no domínio principal a `SpaRouterFunction` manda qualquer path com ponto para o S3.
O certificado `SiteCertificate` já cobre `*.coachpilot.com.br`.

**API e Lambda separadas** porque a API principal tem `DefaultAuthorizer` Cognito e um catch-all
`/{proxy+}`; e porque o tráfego vindo de LLM (rajadas longas de leitura) tem perfil oposto ao do
portal. IAM do MCP: só `DynamoDBCrudPolicy` — sem S3, sem Cognito.

### Authorization server próprio

O Cognito do projeto não tem hosted UI nem domínio OAuth (login é 100% SRP via Amplify) e não
suporta Dynamic Client Registration, que os conectores hospedados do claude.ai e do ChatGPT
esperam. Então o AS é nosso, em FastAPI — mas o Cognito segue sendo a autoridade de identidade:
o consentimento roda no portal, autenticado pelo JWT que o front já injeta, e nunca vemos senha.

```
Cliente LLM → /.well-known → /register (DCR) → /authorize
                                                  ↓ 302
                            portal /oauth/consent?req=… (login Cognito + consentimento)
                                                  ↓ code
                                              /token → access 15 min + refresh rotativo
                                                  ↓
                                          POST /mcp  Bearer …
```

### Transporte

Streamable HTTP **stateless**, JSON-RPC escrito à mão (`app/mcp/jsonrpc.py`) — sem o SDK `mcp`,
cujo `StreamableHTTPSessionManager` exige task group no lifespan ASGI, incompatível com
`Mangum(lifespan="off")`. Responde `application/json` em vez de SSE, o que também evita o teto de
29 s do HTTP API. `GET`/`DELETE` em `/mcp` → 405. Nenhuma dependência nova.

## Isolamento de tenant

> Nenhuma tool aceita `personal_id`. Ele vem só do token.

Argumento de tool é preenchido pelo LLM, e o LLM lê conteúdo escrito por terceiros (mensagem de
aluno, anamnese, descrição de pacote da loja) — entrada não-confiável por definição.

1. `contextvars.ContextVar` preenchido apenas pelo validador do Bearer (`tokens.usando_tenant`).
2. Todo `aluno_id` vindo do LLM passa por `authz.authorize_aluno` — o mesmo guard dos routers.
   Lembrando que os dados do aluno vivem em `AL#{aluno_id}`, não sob a partição do personal:
   checar prefixo de PK não bastaria.
3. `X-Impersonate` não existe no caminho MCP.
4. `tokens.tenant_atual()` estoura se chamado fora do contexto — melhor quebrar do que servir
   dados sem saber de quem são.

Coberto por `tests/test_mcp_tenant.py`, que roda cada tool com o token do personal errado.

## Modelo de dados

| Item | PK | SK | TTL |
|---|---|---|---|
| Cliente OAuth | `MCPCLIENT#{id}` | `META` | 30 d se nunca usado |
| Requisição de autorização | `MCPAUTHREQ#{id}` | `META` | 10 min |
| Authorization code (hash) | `MCPCODE#{sha256}` | `META` | 60 s |
| Refresh token (hash) | `MCPREFRESH#{sha256}` | `META` | 30 d |
| Conexão (grant) | `PT#{personal}` | `MCPCONN#{id}` | — |
| Auditoria de escrita | `PT#{personal}` | `MCPAUDIT#{ts}#{jti}` | 180 d |
| Snapshot pré-escrita | `AL#{aluno}` | `MCPSNAP#{ts}` | 7 d |
| Quota por minuto | `PT#{personal}` | `MCPQUOTA#{minuto}` | 2 min |
| Dedup de escrita | `MCPIDEM#{sha256}` | `META` | 60 s |

Códigos e refresh tokens são guardados como SHA-256: se a tabela vazar, os tokens em trânsito não
são reutilizáveis.

**Access token**: JWT HS256 com `MCP_TOKEN_SECRET`, 15 min, `aud` = `https://mcp.…/mcp` (RFC 8707 —
é o que impede confused deputy). Sem `GetItem` no caminho quente além da checagem de revogação.

**Revogação**: o item `MCPCONN` guarda `revoked_at`, comparado com o `iat` do token — mesmo padrão
de `session_revoked_before` do `aluno_auth.py`. Refresh bloqueia na hora; o access token vive no
máximo 15 min.

## Tools

Escopos: `read` (tudo de leitura, inclusive anamnese e avaliações) e `treinos:write`. Uma conexão
só-leitura nem enxerga as tools de escrita em `tools/list`.

Leitura: `listar_alunos`, `detalhar_aluno`, `exportar_programa_treino`,
`listar_biblioteca_exercicios`, `historico_sessoes`, `evolucao_exercicio`, `resumo_carteira`,
`agenda_periodo`.

Escrita: `aplicar_programa_treino`, `atualizar_treino`, `desfazer_alteracao_treino`.

`aplicar_programa_treino` é substituição total (mesmo caminho de `POST /importar`), então:
snapshot antes de escrever, `resumo_da_mudanca` obrigatório, dedup por hash do payload em 60 s,
auditoria com o nome do cliente OAuth, notificação `MCP_ESCRITA` ao personal, e recusa de programa
vazio. Não há tool destrutiva além dessas — sem deletar aluno, sem operação em massa, sem tocar em
plano ou cobrança.

`prompts/get montar_treino` serve as regras de prescrição a partir de
`app/mcp/prompts/montar_treino.md`, cujo corpo é mantido idêntico ao arquivo do portal por
`tests/test_mcp_prompt_sync.py`.

## Decisões de produto

- **Sem gate de plano**: qualquer personal conecta, inclusive no gratuito. O controle de custo é a
  quota por minuto (`QUOTA_LIMITE_POR_MIN`, hoje 60) e o teto de `limit` das tools.
- **Escrita aplica direto**, sem fila de aprovação no portal — a revisão acontece na conversa com
  a LLM, e o `desfazer` é a rede de segurança.
- **Anamnese e avaliações são expostas** ao LLM. Isso transfere dado pessoal sensível de saúde de
  terceiro (o aluno) para operador estrangeiro: a tela de consentimento diz isso explicitamente, e
  **Termos e Política de Privacidade precisam cobrir a hipótese** (pendente — alinhar com
  `estrategia/juridico/`).

## Testar

```bash
cd backend && pytest tests/test_mcp_*.py -q
npx @modelcontextprotocol/inspector          # fecha o OAuth no navegador e lista as tools
claude mcp add --transport http coachpilot https://mcp.coachpilot.com.br/mcp
```

Depois: claude.ai → Settings → Connectors; ChatGPT → Connectors (modo desenvolvedor); Gemini CLI →
`mcpServers` no `settings.json`. No app consumidor do Gemini o suporte a conector de terceiro ainda
é limitado — o caminho suportado hoje é CLI/Vertex.
