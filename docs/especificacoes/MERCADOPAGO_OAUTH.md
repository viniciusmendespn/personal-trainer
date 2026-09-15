# Mercado Pago — conexão do personal por OAuth 2.0 + PKCE

> **Status: ✅ EM PRODUÇÃO (set/2026).** Substituiu o fluxo em que o personal criava uma
> aplicação no painel de desenvolvedores do MP e colava o Access Token em Configurações →
> Pagamentos. Desenho portado de `C:\ia\encomendou` e `C:\ia\presentou`.

## Por que trocou

O fluxo antigo pedia 14 passos de vocabulário de desenvolvedor (Checkout Transparente, API
de Orders, credenciais de produção) a quem é personal trainer. Além do atrito, deixava três
buracos: o token colado nunca era validado, um token revogado só aparecia como `503` para o
aluno, e não havia estado de "conexão quebrada" — ninguém era avisado.

O OAuth resolve os três de uma vez: a conta é conferida no ato (`/users/me`), o token se
renova sozinho, e a conexão tem estado explícito.

## Cadastro no painel do Mercado Pago

Aplicação criada como **Marketplace** (é o modelo que libera OAuth), com:

| Campo | Valor |
|---|---|
| Redirect URI | `https://coachpilot.com.br/v1/public/mp/oauth/callback` |
| PKCE | ativado (só emitimos `code_challenge_method=S256`) |

A Redirect URI precisa bater caractere a caractere: ela vai na autorização **e de novo** na
troca do code. Divergência de barra final derruba o fluxo com `invalid_grant`.

Ela funciona sem infra dedicada porque o CloudFront de `coachpilot.com.br` já roteia `/v1/*`
para o API Gateway, e a rota `PublicProxy` é `Authorizer: NONE` — necessário, porque quem
volta do MP não carrega o JWT do Cognito.

`MP_CLIENT_ID` / `MP_CLIENT_SECRET` entram na stack como parâmetros CFN (`NoEcho` no secret),
nos `Globals` — a `SchedulerFunction` também precisa delas para renovar tokens.

## Fluxo

```
GET /v1/config/mercadopago/oauth/iniciar          (JWT Cognito)
  grava MP_OAUTH#{state}/META {personal_id, code_verifier, ttl:+10min}
  devolve {url} → o frontend navega o DOCUMENTO (window.location.assign)
      ↓
https://auth.mercadopago.com.br/authorization?client_id&response_type=code
   &platform_id=mp&state&redirect_uri&code_challenge&code_challenge_method=S256
      ↓  personal autoriza
GET /v1/public/mp/oauth/callback?code&state        (ANÔNIMO)
  delete_item_if_exists(MP_OAUTH#{state}, retornar=True)  ← one-shot atômico
  confere ttl à mão                                       ← TTL do Dynamo é best-effort
  POST /oauth/token {authorization_code, code_verifier, client_id, client_secret}  (JSON)
  GET /users/me → exige site_id == "MLB" e id == user_id do token
  put_item PT#{personal_id}/CONFIG#MERCADOPAGO             ← item INTEIRO, um put só
      ↓
302 → /config?tab=pagamentos&mp=ok|recusado|expirado|erro
```

Host `auth.mercadopago.**com.br**` de propósito: o `.com` genérico abre um seletor de país
antes do login.

## Decisões que não são preferência

- **`_gravar_oauth` é o único escritor do item, com um `put_item` do item inteiro.** O
  refresh token do MP **rotaciona**: cada renovação devolve um par novo e mata o antigo.
  Gravar em dois updates é o que separa "renovado" de "perdemos o acesso para sempre".
- **O `state` é a PK** (`MP_OAUTH#{state}`), consumido com `delete_item_if_exists(retornar=True)`
  — um delete condicional que devolve o que apagou. É o que torna o state one-shot sem
  leitura prévia e sem corrida entre dois callbacks simultâneos.
- **O `ttl` é conferido em código**, não só pelo DynamoDB: a varredura do TTL é best-effort
  e pode levar horas, então um state velho continuaria aceito.
- **`_get_token` é a porta única do token** no `mp_service`. Ela renova se faltar menos de
  1 dia para vencer; por isso `criar_pix`, a loja, a consulta de status e o webhook herdam
  o refresh sem código próprio.
- **Retry de 401 reusa a mesma `X-Idempotency-Key`** (`_request_personal`). Trocar a chave
  no retry criaria uma segunda cobrança no MP.
- **Nunca `marketplace_fee` / `application_fee`.** O dinheiro cai 100% na conta do personal.
- **Desconectar apaga local, não revoga no MP** — a UI diz que o personal também pode
  revogar pelo painel dele.
- **`public_key` não é armazenada**: o checkout é server-side (`POST /v1/payments`), sem
  Brick/SDK JS.

## Estados da conexão

| `status` | Significa | Efeito |
|---|---|---|
| `ATIVO` | cobra normalmente | botão Pix aparece para o aluno |
| `REQUER_RECONEXAO` | refresh recusado, 401 na cobrança, ou legado migrado | `is_configured()` → `False`: o Pix some do app do aluno, da loja e do resumo; banner no portal + notificação/push |

`marcar_reconexao` é condicional (`status ausente OU ATIVO`) — é essa condição que impede
uma segunda notificação quando várias cobranças falham em sequência.

## Renovação

Token do MP vale 180 dias. O item é agendado no **GSI1 sparse** em `expira_em - 30 dias`
(`MP_REFRESH#{dia}`), e `mp_service.renovar_vencendo()` roda dentro do scheduler horário,
varrendo ontem/hoje/amanhã. Isso dá 5 meses de margem para o job falhar sem ninguém perder
a conexão.

Classificação do erro decide o destino:

```python
_ERROS_DEFINITIVOS = {"invalid_grant", "invalid_token", "invalid_client", "unauthorized_client"}
# transitória (sem status, >=500, 429) → segue ATIVO, +1 tentativa, reagenda p/ hoje+2
# definitiva (ou token já vencido)     → REQUER_RECONEXAO
```

⚠️ `renovar_vencendo` **desiste antes de tocar no índice** quando as credenciais não estão
na stack: sem esse guard, toda renovação falharia e reagendaria os itens, embaralhando o
agendamento de todo mundo.

## Onde está o quê

| Item | Arquivo |
|---|---|
| Serviço (OAuth, refresh, cobrança) | `backend/app/services/mp_service.py` |
| Rotas autenticadas | `backend/app/routers/config.py` |
| Callback anônimo | `backend/app/routers/webhook.py` (`mp_router`) |
| Chaves | `backend/app/repositories/keys.py` (`pk_mp_oauth`, `gsi1_mp_refresh_*`) |
| Job de renovação | `backend/app/scheduler.py` |
| Tela | `frontend/src/pages/SettingsPage.tsx` (`PagamentosTab`) |
| Banner | `frontend/src/components/ReconectarMpBanner.tsx` |
| Testes | `backend/tests/test_mp_oauth.py`, `frontend/src/pages/pagamentos.trava.test.ts` |
| Migração do legado | `backend/scripts/migrar_mp_oauth.py` |

`pagamentos.trava.test.ts` reprova o build se voltar campo de Access Token, a string
`APP_USR`, um link para `developers/panel`, ou uma função que envie `access_token` — é o que
impede o fluxo antigo de ressuscitar numa refatoração.
