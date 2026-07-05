# CLAUDE.md — Personal Trainer

## Projeto
SaaS serverless para gestão de personal training (alunos, treinos, avaliações, agenda).
Segue o mesmo padrão arquitetural de `wa-automation` e `gerenciador-financeiro`.
Arquitetura: **React 19 + FastAPI + DynamoDB + Cognito + AWS SAM**. Ver `docs/ARCHITECTURE.md`.

## Organização da documentação
- `docs/` — documentação técnica (ARCHITECTURE, ESPEC_TECNICA, FUNCIONAL, PERFORMANCE_ESCALA) e
  `docs/especificacoes/` (specs de features: PIX, promo codes, financeiro, pendências de push)
- `estrategia/` — negócio (CUSTO_ESCALA, CONTEXTO_MARKETING, planos, pitches, programa de
  divulgadores, `juridico/` com minutas, `comercial/` com kit do time, `kit-divulgador/` com
  material externo do divulgador)
- `frontend/public/*.md` — **arquivos do sistema servidos ao usuário** (ajuda-portal, ajuda-aluno,
  prompt-cpkg) — não mover nem renomear

## AWS Account
- **Mesma conta** do `gerenciador-financeiro` (conta pessoal).
- Account ID: `421219980792`
- Region: `us-east-1`
- **Profile AWS: `pessoal-hotmail`** — todos os comandos `aws`/`sam` usam `--profile pessoal-hotmail`
- Stack: `personal-trainer-prod`

> ⚠️ Não confundir com a conta do `wa-automation` (`651447471262` / profile `smartafiliado`).

## Separação de custos (requisito do projeto)
Esta conta hospeda **vários apps**. O custo deste app é rastreado de forma 100% isolada via:
- **Tag `Project: personal-trainer`** em todos os recursos (Lambda, DynamoDB, API GW, Cognito, S3, CloudFront)
- **AppRegistry Application** (`myApplications`) → dashboard de custo por app no console
- **Cost Allocation Tag `Project` ativada** em Billing (passo manual 1x — ver `docs/ARCHITECTURE.md` §12.5)

Conferir custo do mês:
```powershell
aws ce get-cost-and-usage `
  --time-period Start=2026-06-01,End=2026-07-01 --granularity MONTHLY --metrics "UnblendedCost" `
  --filter '{"Tags":{"Key":"Project","Values":["personal-trainer"]}}' `
  --group-by Type=DIMENSION,Key=SERVICE --profile pessoal-hotmail
```

Detalhes completos em **`docs/ARCHITECTURE.md` §12 — Separação de Custos**.

## Convenção de nomes (evita colisão na conta compartilhada)
| Recurso | Nome |
|---|---|
| Stack | `personal-trainer-prod` |
| DynamoDB | `personal-trainer-{stage}` |
| UserPool | `personal-trainer-users-{stage}` |
| Bucket frontend | `personal-trainer-frontend-{stage}-{accountId}` |
| Tag de custo | `Project = personal-trainer` |

## Deploy

### ⚠️ REGRA OBRIGATÓRIA — Quatro distribuições CloudFront, um bucket S3
O frontend usa **um único bucket S3** (`personal-trainer-frontend-prod-421219980792`) servido por
**quatro distribuições CloudFront separadas** (uma por app, cada uma com seu default root object
+ custom error pages 403/404 + CloudFront Function de SPA routing):

| Distribuição | ID | Domínio | HTML |
|---|---|---|---|
| Portal (personal) | `E3JZ6U88Q0GYGF` | `coachpilot.com.br` | `index.html` |
| App do aluno | `E2IHNZ34C3PI8V` | `app.coachpilot.com.br` | `aluno.html` |
| Loja (marketplace) | `EEN1FE9Z7MUEK` | `loja.coachpilot.com.br` | `loja.html` |
| Painel do divulgador | `E3T7YCMACS7AVL` | `divulgador.coachpilot.com.br` | `divulgador.html` |

O build (`npm run build`) gera os **quatro HTML** via Rollup multi-entry, cada um com seu próprio
manifest e bundle JS. **NÃO copiar index.html sobre os outros** — o build já gera cada um correto.
**Deploy de frontend: usar `.\deploy.ps1 frontend`** — ele troca os manifests, aplica as políticas
de cache corretas por tipo de arquivo e **invalida as QUATRO distribuições**. Nunca invalidar só
uma parte — as demais ficariam com cache stale.

### ⚠️ REGRA OBRIGATÓRIA — Commit antes do deploy
O SAM faz build a partir do disco local, não do git. Nunca rodar deploy com arquivos não commitados.
Sempre: `git status` → `git diff` → `git add <arquivos>` → `git commit` → `deploy`.
Nunca `git add -A` em backend/infra sem revisar o diff.

### Regra do usuário — comitar e deployar automaticamente ao final de cada tarefa
Confirmado pelo usuário (2026-06-17): ao concluir uma tarefa (backend e/ou frontend), **comitar
e fazer deploy automaticamente**, sem precisar perguntar a cada vez — o objetivo é manter tudo
sempre no ar. Isso substitui a exigência antiga de "perguntar antes de commitar backend/". Ainda
assim: sempre revisar o changeset do CloudFormation antes de executar (`--no-execute-changeset`
→ revisar → `execute-change-set`), nunca pular hooks, e pausar para perguntar se a mudança for
genuinamente arriscada/destrutiva (ex.: troca de parâmetro que apague infraestrutura).

## Regras obrigatórias (herdadas do padrão)
- `user_id` sempre via JWT (`Depends(get_current_user_id)`) — nunca do body
- Single-table DynamoDB: PK = `USER#{user_id}`, SK = `{TIPO}#{id}`
- TTL em todos os itens temporários
- Evitar `get_item` antes de `update_item` — usar `update_item_if_exists`
- Lambda arm64, `MemorySize: 256`, `Timeout: 29`, HTTP API v2
- Enums espelhados backend ↔ frontend
- Comandos AWS sempre com `--profile pessoal-hotmail`
- Backend alterado → oferecer deploy

## ⚠️ REGRA OBRIGATÓRIA — DynamoDB: performance, escala e custo

Toda proposta de acesso ao DynamoDB deve seguir estes princípios **sem exceção**. Questionar qualquer padrão que os viole antes de implementar.

### Modelagem (acesso eficiente)
- **Single-table design**: uma tabela por stage, todos os tipos de item juntos.
- **Acesso por PK+SK sempre que possível** — `GetItem`/`UpdateItem` com chave completa (O(1), custo mínimo).
- **Query > Scan**: nunca usar `Scan` em produção. Se um acesso novo exige `Scan`, criar GSI ou reformular o modelo.
- **GSI só quando necessário**: cada GSI duplica storage e aumenta WCU. Criar apenas para padrões de acesso reais e frequentes.
- **Projeção de GSI**: usar `KEYS_ONLY` ou `INCLUDE` com atributos mínimos — nunca `ALL` sem justificativa.
- **Composite sort keys**: preferir SK composto (`TREINO#2026-06-30#abc123`) para suportar `begins_with` / `between` sem GSI extra.

### Capacidade e custo
- **Billing mode: PAY_PER_REQUEST** para todas as tabelas (sem provisioned capacity, sem desperdício em idle).
- **Itens pequenos**: manter itens abaixo de 4 KB sempre que possível — 1 WCU = 1 KB na escrita, itens maiores custam mais.
- **Evitar atributos grandes no item principal**: blobs, históricos longos e listas crescentes → armazenar em S3 com referência no item.
- **Listas que crescem indefinidamente** (ex.: log de sessões) → modelar como itens separados, não como atributo de lista.
- **TTL obrigatório** em itens temporários (sessões, tokens, cache) — expiração automática sem custo de `DeleteItem`.

### Operações de escrita
- **`UpdateItem` em vez de `PutItem`** para atualizações parciais — evita sobrescrever atributos não mencionados.
- **`update_item_if_exists`**: nunca fazer `GetItem` → lógica → `PutItem`; usar `ConditionExpression` no próprio `UpdateItem`.
- **Writes em batch**: para inserções em massa usar `BatchWriteItem` (até 25 itens/req); nunca loop de `PutItem` individual.
- **Evitar hot keys**: não usar chaves que concentrem todo o tráfego numa única partição (ex.: PK fixo global). Distribuir com prefixo de `user_id`.

### Leituras
- **`ProjectionExpression`** em toda query/scan que não precise de todos os atributos — reduz tamanho de resposta e RCU.
- **Consistent reads** (`ConsistentRead=True`) somente quando estritamente necessário — custa 2× RCU.
- **`BatchGetItem`** para buscar vários itens por chave em vez de N `GetItem` paralelos.
- **Paginação**: sempre tratar `LastEvaluatedKey` em Queries que possam retornar múltiplas páginas; nunca assumir resultado completo numa chamada só.

## Estado atual
**Produto completo em produção** (coachpilot.com.br), em fase de aquisição dos primeiros clientes
pagantes. Módulos no ar: portal do personal, app do aluno (PWA), loja/marketplace de pacotes
(.cpkg), agente IA no WhatsApp, financeiro PIX (Mercado Pago), gamificação, push notifications,
landing com SEO. Estratégia de negócio e go-to-market em `estrategia/` (ver README de lá).
Pendências técnicas conhecidas: lifecycle S3 (antes de 100 personais), itens de push em
`docs/especificacoes/PUSH_PENDENCIAS.md`, painel do divulgador (roadmap).
