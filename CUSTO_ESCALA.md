# Estimativa de Custo em Escala — Personal Trainer

> Documento gerado por investigação de código (sem alterações no sistema). Objetivo: dar uma
> **ideia de ordem de grandeza** do custo mensal em 3 patamares de escala (10 / 100 / 1.000
> personal trainers ativos), separando **infra AWS** (custo real, descontando free tier) de
> **LLM do agente** (3 cenários de uso: leve / médio / intenso).
>
> **Isto não é uma fatura.** É um modelo construído a partir do código real (`backend/app/`),
> com premissas de volume explícitas — ajuste-as se a realidade dos seus personais for diferente.
>
> **Revisão (pesquisa na documentação oficial AWS):** a versão anterior deste documento assumia
> free tier perpétuo para DynamoDB, API Gateway e S3. Isso está **errado** para este projeto —
> ver §7. DynamoDB on-demand (o modo usado aqui) não recebe o crédito de requests do free tier
> (só Provisioned recebe); API Gateway e S3 só têm free tier nos **primeiros 12 meses de uma
> conta nova**, e esta conta (`421219980792`) já está em uso há tempo com `gerenciador-financeiro`.
> Os números de infra abaixo foram **recalculados sem esse free tier**.
>
> **Revisão (pós-implementação das correções de `PERFORMANCE_ESCALA.md`):** as Fases 1–7 do plano
> de correção foram implementadas. As que mudam os números deste documento: (1) `notif_service`
> agora lê um contador agregado (1 `get_item`) em vez de varrer a partição inteira a cada poll de
> 60s — recalculado em §3/§4.1/§4.2; (2) o agente agora tem rate limiting (10 msgs/aluno/min) — §6.1
> foi reescrita, deixou de ser um risco em aberto. `SYSTEM#SCHED` particionado por dia (§1.2 do doc
> de performance) não muda nenhum número deste documento (já era cobrado como write normal), só
> remove um risco operacional. S3 sem lifecycle policy (§4.5) **continua** em aberto — não foi
> endereçado nesta rodada de correções.

---

## 1. Premissas de volume

| Premissa | Valor assumido | Base |
|---|---|---|
| Alunos ativos por personal | **25** | Roster típico de um personal trainer individual. Ajuste linear se for diferente. |
| Treinos ativos por aluno | 3 | Rotação A/B/C — comum no domínio |
| Exercícios por treino | 8 | Ordem de grandeza típica de uma ficha |
| Sessões de treino por aluno/semana | 4 (~17/mês) | Frequência de treino padrão |
| Personal com o portal aberto | ~3h/dia útil, ~21 dias/mês | Para modelar polling do frontend (§4) |
| Mensagens WhatsApp por aluno/mês | **Leve: 10 · Médio: 60 · Intenso: 200** | Conforme solicitado — médio ≈ 1 sessão/semana com troca de mensagens completa |

A arquitetura é **single-table DynamoDB + Lambda monolambda (FastAPI) + Cognito + Function URL
para o webhook**, confirmada em `backend/template.yaml` e `backend/app/main.py:6-38`. O agente
LLM roda **dentro da mesma Lambda** que atende o portal (sem fila, sem Lambda separada — ver
`PERFORMANCE_ESCALA.md` §2.3 para a implicação disso).

---

## 2. Modelo de operações DynamoDB por mensagem do agente

Lido em `backend/app/routers/webhook.py`, `backend/app/services/llm_agent.py` e
`backend/app/services/agent_service.py`. Cada mensagem **de texto** recebida do aluno no
WhatsApp dispara, em média:

| Operação | Onde | Ops DynamoDB |
|---|---|---|
| Dedup por `messageId` | `webhook.py:111-116` | 1 write condicional |
| Resolver telefone → aluno | `webhook.py:119` | 1 read |
| Montar contexto (`_context`) | `llm_agent.py:150-195` | 2–4 reads (sessão ativa, GSI1 último registro, registro atual) |
| Execução da(s) tool(s) chamada(s) | `agent_service.py` (`registrar`, `avancar`, `finalizar`, etc.) | 1–8 ops, variável conforme a tool (ver tabela abaixo) |
| Log da troca no histórico durável | `agent_service.py:44-51` (`log_turn`) | 1–2 writes |
| Salvar memória de trabalho (8 últimos turnos) | `agent_service.py:26-28` (`save_chat`) | 1 write |

**Custo por tool** (quando chamada):
- `registrar` → `sessao_service.record()`: 1 write (append) + até 2 writes de agregado (stats
  aluno/semana) + 1 write condicional de PR = **até 4 writes** (`sessao_service.py:151-190`).
- `avancar` → 1 write (`sessao_service.py:79-80`).
- `finalizar` → 1 query + 2 puts + 1 delete + 3 agregados + `pontos_service.award` (2 reads + 3
  writes) = **~8 writes + 3 reads** (`sessao_service.py:85-139`).
- `iniciar_sessao`, `consultar_historico`, `buscar_exercicio`, `listar_treinos`,
  `detalhar_treino`, `treino_de_hoje` → 1–2 reads cada.

**Média ponderada usada neste modelo: ~12 operações DynamoDB por mensagem de texto** (mistura de
mensagens simples — 1-2 tools leves — com mensagens de registro/finalização de sessão, mais
pesadas). Proporção estimada: ~60% writes / ~40% reads.

> Mídia (foto/vídeo) e áudio (transcrição Whisper) custam adicionalmente 1 download HTTP + 1
> upload S3 (e 1 chamada Whisper para áudio) — fora do DynamoDB, tratado em
> `PERFORMANCE_ESCALA.md` §2.4.

---

## 3. Polling do frontend — carga "invisível" que não aparece em nenhuma métrica de produto

Achado relevante: o portal e o app do aluno fazem **polling automático** via React Query, e isso
gera tráfego à API **independente de qualquer ação do usuário**:

| Hook | Intervalo | Onde é montado | Endpoint batido |
|---|---|---|---|
| `useUnreadCount` | **60s, sempre que o portal está aberto** | `AppLayout.tsx` (layout raiz — toda página autenticada) | `notif_service.nao_lidas()` |
| `useAlunoChat` | 15s, enquanto a tela de chat do app do aluno está aberta | `AlunoApp.tsx` | listagem de chat (paginada, ok) |
| `usePersonalChat` | 15s, enquanto o personal vê a conversa de 1 aluno no portal | `personal_chat`/painel de chat | listagem de chat (paginada, ok) |

**Corrigido (Fase 1 do `PERFORMANCE_ESCALA.md`):** `notif_service.nao_lidas()` lia toda a partição
de notificações do personal e contava em Python a cada chamada — O(N) com o histórico acumulado,
rodando a cada 60s o tempo todo que o portal está aberto. Agora lê um contador agregado
(`STATS#NOTIF`, mantido por `increment_counter` na criação/leitura de notificação) — **1 `get_item`
por poll, O(1), não cresce mais com o histórico**. Reflete em §4.1/§4.2 abaixo.

**Volume estimado**: ~3h/dia × 21 dias/mês × (3600s/60s) ≈ **3.780 polls/mês por personal**, só
deste hook. Em 1.000 personais: **3,78 milhões de polls/mês**, cada um agora 1 RRU fixo — não mais
um risco de custo crescente com o tempo de operação.

---

## 4. Custo de Infra AWS por escala (recalculado sem free tier indevido)

Preços oficiais confirmados na documentação AWS (fontes em §7):
- **DynamoDB on-demand** (`us-east-1`): $1,25/milhão WRU + $0,25/milhão RRU — **sem free tier de
  requests neste modo** (o crédito de 25 WCU/25 RCU só vale no modo *Provisioned*; este projeto usa
  `BillingMode: PAY_PER_REQUEST`). Resta só o free tier de armazenamento (25GB, "always free",
  independe do modo) — irrelevante no volume de itens deste sistema.
- **Lambda arm64**: $0,20/milhão requests + $0,0000133334/GB-s — **mantém** free tier perpétuo
  (1M requests + 400.000 GB-s/mês, "Always Free", não depende da idade da conta).
- **API Gateway HTTP**: $1,00/milhão requests — **sem free tier**: o crédito de 1M requests/mês só
  vale nos primeiros 12 meses de uma conta **nova**; esta conta já hospeda `gerenciador-financeiro`.
- **S3 Standard**: $0,023/GB-mês + $0,005/1.000 PUT + $0,0004/1.000 GET — **sem free tier**, mesmo
  motivo do API Gateway.
- **Cognito** (50k MAU) e **CloudFront** (1TB + 10M req/mês): mantêm free tier perpétuo — não
  afetados por esta revisão.

### 4.1 Volume mensal por personal, por cenário do agente

O tráfego do **agente** escala com mensagens/aluno/mês (§1); CRUD do portal + polling do frontend
é constante, independente do cenário — e **não passa pelo API Gateway** (webhook usa Function URL
direta da Lambda, confirmado em `template.yaml`/`FunctionUrlConfig`, sem custo de API Gateway).

| Fonte | Leve (10 msg/aluno) | Médio (60 msg/aluno) | Intenso (200 msg/aluno) |
|---|---|---|---|
| Agente — writes / reads | 1.800 / 1.200 | 10.800 / 7.200 | 36.000 / 24.000 |
| Agente — invocações / GB-s Lambda | 250 / 125 | 1.500 / 750 | 5.000 / 2.500 |
| CRUD + polling — writes / reads | 200 / ~6.080 | 200 / ~6.080 | 200 / ~6.080 |
| CRUD + polling — invocações / GB-s | 5.280 / ~199 | 5.280 / ~199 | 5.280 / ~199 |
| **Total writes / reads** | **~2.000 / ~7.280** | **~11.000 / ~13.280** | **~36.200 / ~30.080** |
| **Total invocações / GB-s Lambda** | **~5.530 / ~324** | **~6.780 / ~949** | **~10.280 / ~2.699** |

(reads de CRUD+polling = 300 do CRUD + **3.780** do polling de não-lidas a cada 60s — agora 1 RRU
fixo por poll, pós-Fase 1 — + ~2.000 do polling de chat a cada 15s. Antes da correção eram
~18.900 reads só no polling de não-lidas, hoje 3.780; é a maior redução deste recálculo.)

### 4.2 DynamoDB — `writes/1e6 × $1,25 + reads/1e6 × $0,25`, sem free tier de requests

Já reflete a Fase 1 (contador agregado de não-lidas, §3) — reads caem bastante vs. a versão
anterior deste documento, principalmente no cenário leve (onde o polling dominava o total de reads).

| Escala | Leve | Médio | Intenso |
|---|---|---|---|
| 10 personais | $0,04 | $0,17 | $0,53 |
| 100 personais | $0,43 | $1,71 | $5,28 |
| 1.000 personais | $4,32 | $17,07 | $52,77 |

### 4.3 Lambda — mantém free tier perpétuo (1M req + 400k GB-s/mês, por conta inteira)

| Escala | Leve | Médio | Intenso |
|---|---|---|---|
| 10 / 100 personais | $0 | $0 | $0 (~$0,01 a 100/intenso) |
| 1.000 personais | ~$0,91 | ~$8,47 | ~$32,51 |

### 4.4 API Gateway — `5.280 invocações/personal/mês ÷ 1e6 × $1,00`, sem free tier, mesmo nos 3 cenários (webhook não passa aqui)

| 10 personais | 100 personais | 1.000 personais |
|---|---|---|
| $0,05 | $0,53 | $5,28 |

### 4.5 S3 — sem free tier; armazenamento cresce com o tempo, não é flat

Sem contagem real de mídia no código — premissa explícita: **3 mídias/aluno/mês, ~2MB em média**
(mix foto/vídeo comprimido pelo WhatsApp), vistas ~3× cada. Requests (PUT+GET) são desprezíveis
(~$0,0005/personal/mês). O que importa é o **armazenamento acumulado**: `MediaBucket` no
`template.yaml` **não tem `LifecycleConfiguration`** — nada expira nem é arquivado, então o
armazenamento só cresce, mês a mês, mesmo sem crescer o nº de personais. T = meses de operação:

| Escala | T = 6 meses | T = 12 meses | T = 24 meses |
|---|---|---|---|
| 10 personais | $0,21 | $0,41 | $0,83 |
| 100 personais | $2,07 | $4,14 | $8,28 |
| 1.000 personais | $20,70 | $41,40 | $82,80 |

Este é o **único item de infra que cresce indefinidamente** mesmo com base de personais estável —
vale considerar lifecycle policy (mover para Infrequent Access ou expirar mídia antiga) se isso
não for desejado.

### 4.6 Total de infra por escala e cenário (S3 calculado em T=12 meses de operação)

| Escala | Cenário | DynamoDB | Lambda | API GW | S3 (12m) | Cognito | CloudFront | **Total/mês** |
|---|---|---|---|---|---|---|---|---|
| 10 | Leve | $0,04 | $0 | $0,05 | $0,41 | $0 | $0 | **~$0,50** |
| 10 | Médio | $0,17 | $0 | $0,05 | $0,41 | $0 | $0 | **~$0,63** |
| 10 | Intenso | $0,53 | $0 | $0,05 | $0,41 | $0 | $0 | **~$0,99** |
| 100 | Leve | $0,43 | $0 | $0,53 | $4,14 | $0 | $0 | **~$5,10** |
| 100 | Médio | $1,71 | $0 | $0,53 | $4,14 | $0 | $0 | **~$6,38** |
| 100 | Intenso | $5,28 | $0,01 | $0,53 | $4,14 | $0 | $0 | **~$9,96** |
| 1.000 | Leve | $4,32 | $0,91 | $5,28 | $41,40 | $0 | ~$1–2 | **~$52–53** |
| 1.000 | Médio | $17,07 | $8,47 | $5,28 | $41,40 | $0 | ~$1–2 | **~$72–73** |
| 1.000 | Intenso | $52,77 | $32,51 | $5,28 | $41,40 | $0 | ~$1–2 | **~$132–133** |

**Leitura do resultado, corrigida (free tier + Fase 1 já aplicados):** a infra deixa de ser
"praticamente grátis", mas o fix do contador agregado de não-lidas (Fase 1) já recupera boa parte
da folga perdida com o fim do free tier indevido — soma **~$0,5–1/mês a 10 personais, ~$5–10/mês a
100, e ~$52–133/mês a 1.000** (varia com o cenário do agente e o tempo de operação — o
armazenamento S3 sem lifecycle policy, ainda não endereçado, é o que mais empurra o número para
cima ao longo do tempo). Ainda é pequena perto do LLM (§5), mas não é mais um arredondamento para
zero.

---

## 5. Custo do agente LLM — 3 cenários × 3 escalas

### 5.1 Tokens por mensagem (medido no código)

`backend/app/services/llm_agent.py`:
- **Prompt de sistema** (`_SYSTEM`, linhas 40–81): 2.751 caracteres ≈ **~800 tokens**.
- **Definição das 12 tools** (`_TOOLS`, linhas 83–147): 4.051 caracteres ≈ **~1.100 tokens**.
- Esses ~1.900 tokens são **reenviados em toda chamada à API** — a Chat Completions API é
  stateless; não há truncamento nem resumo do prompt de sistema/tools no código.
- **Contexto da sessão** (`_context()`): ~150–300 tokens (sessão ativa + último registro via GSI1).
- **Histórico de conversa** (`CHAT_MAX_TURNS = 8`, `agent_service.py:18`): ~300–400 tokens.
- **Loop de tool-calling** (`_MAX_STEPS = 5`, `llm_agent.py:21`): cada chamada de ferramenta
  reenvia a mensagem inteira acumulada (system + tools + contexto + histórico + tool calls
  anteriores) — o custo de input **cresce a cada iteração** dentro da mesma mensagem do aluno.

**Estimativa por mensagem do aluno** (média de ~2 chamadas LLM por mensagem — 1 para decidir/
chamar tool, 1 para responder; varia de 1 a 5 conforme `_MAX_STEPS`):

| | Por chamada LLM | Por mensagem (≈2 chamadas) |
|---|---|---|
| Tokens de input | ~2.500–2.600 | **~5.100** |
| Tokens de output | ~50–70 | **~120** |

### 5.2 Preço do modelo

`OPENAI_MODEL=gpt-5.4-nano` (`backend/template.yaml:39`, `backend/app/config.py:15`).
Confirmado via busca externa (OpenRouter, junho/2026): **$0,20 / milhão tokens de input** e
**$1,25 / milhão tokens de output**, contexto de 400k tokens, com suporte a **prompt caching**
(60–80% mais barato no trecho repetido do prompt — relevante aqui porque ~1.900 dos ~2.500 tokens
de input por chamada são o system+tools **idênticos** a cada vez). Não foi possível confirmar
neste levantamento se o caching está ativo automaticamente no seu uso (depende do provider —
ver nota sobre `fusion` abaixo).

[GPT-5.4 Nano API Pricing — OpenRouter](https://openrouter.ai/openai/gpt-5.4-nano)

> **Provider alternativo `fusion`** (`LLM_PROVIDER=fusion`, gateway interno BRQ,
> `FUSION-LLM.txt`): é um gateway corporativo formato Azure OpenAI. O arquivo não contém tabela de
> preços — se for infraestrutura já paga pelo empregador, o custo marginal pode ser efetivamente
> $0 para este projeto, mas isso **precisa ser confirmado com a BRQ** (cota, política de uso,
> faturamento) antes de assumir como garantido em produção a 1.000 personais.

### 5.3 Tokens e custo mensal por aluno

| Cenário | Msgs/aluno/mês | Tokens input/aluno/mês | Tokens output/aluno/mês | Custo/aluno/mês (sem cache) |
|---|---|---|---|---|
| Leve | 10 | 51.000 | 1.200 | $0,0117 |
| Médio | 60 | 306.000 | 7.200 | $0,0702 |
| Intenso | 200 | 1.020.000 | 24.000 | $0,234 |

### 5.4 Custo total por escala (25 alunos/personal)

| Cenário | 10 personais | 100 personais | 1.000 personais |
|---|---|---|---|
| **Leve** | $2,93/mês | $29,30/mês | **$293/mês** |
| **Médio** | $17,55/mês | $175,50/mês | **$1.755/mês** |
| **Intenso** | $58,50/mês | $585/mês | **$5.850/mês** |

**Com prompt caching efetivo** (assumindo ~50% dos tokens de input cacheáveis com ~70% de
desconto — faixa conservadora, só aplicável se o provider em uso suportar e o caching estiver de
fato sendo aplicado): redução de **~25–30% no custo total**, ex. cenário médio a 1.000 personais
cairia de ~$1.755 para **~$1.220–1.300/mês**. Isso por si só justifica investigar se o caching
está ativo (§ recomendações no `PERFORMANCE_ESCALA.md`).

---

## 6. Sumário executivo — custo total estimado (infra + LLM, sem caching, S3 a T=12 meses)

| Escala | Cenário | Infra AWS/mês | LLM/mês | **Total/mês** |
|---|---|---|---|---|
| 10 personais (250 alunos) | Leve | ~$0,5 | ~$2,9 | **~$3,4** |
| | Médio | ~$0,6 | ~$17,6 | **~$18,2** |
| | Intenso | ~$1,0 | ~$58,5 | **~$59,5** |
| 100 personais (2.500 alunos) | Leve | ~$5,1 | ~$29,3 | **~$34,4** |
| | Médio | ~$6,4 | ~$175,5 | **~$181,9** |
| | Intenso | ~$10,0 | ~$585 | **~$595,0** |
| 1.000 personais (25.000 alunos) | Leve | ~$51,9 | ~$293 | **~$344,9** |
| | Médio | ~$72,2 | ~$1.755 | **~$1.827,2** |
| | Intenso | ~$131,9 | ~$5.850 | **~$5.981,9** |

**Conclusão central (revisada, pós Fase 1):** sem o free tier indevido de API Gateway/S3/DynamoDB
on-demand, a infra deixa de ser "~$0" — mas o fix do contador agregado de não-lidas já reduz boa
parte desse aumento, principalmente no cenário leve (onde o polling era a maior fatia de reads).
Resultado: **~$0,5–1/mês a 10 personais e ~$52–132/mês a 1.000** (varia com cenário e tempo de
operação — o armazenamento S3 sem lifecycle policy, ainda não endereçado, é o item que mais
empurra o número para cima com o tempo, independente do nº de personais). **A conclusão estrutural
se mantém: o LLM é, de longe, o maior componente de custo em qualquer escala não-trivial**,
dominado pelo overhead fixo de ~1.900 tokens (system + 12 tools) reenviado em toda chamada — não
pelo conteúdo real da conversa. Reduzir esse overhead (ou confirmar que prompt caching está ativo)
continua tendo retorno proporcionalmente maior que qualquer otimização de infra.

---

## 6.1 Rate limiting do agente — risco mitigado

**Corrigido (Fase 2 do `PERFORMANCE_ESCALA.md` §1.4).** Os 3 cenários (leve/médio/intenso) eram
uma média de uso saudável sem teto real — agora há um limite de **10 mensagens/aluno/minuto**
(`llm_agent._check_rate_limit`, contador atômico com TTL na partição do aluno). Acima do limite, o
agente responde um aviso curto em vez de chamar a LLM — **sem custo de chamada LLM** acima do teto.

Isso transforma os números deste documento num teto real: mesmo um aluno testando o bot
repetidamente, ou um bug no app reenviando mensagens, é limitado a no máximo 10 chamadas/minuto —
600/hora — por aluno. No pior caso teórico (1 aluno batendo o limite o tempo todo, 24h/dia), isso
ainda é um cenário extremo bem acima do "intenso" (200 msg/mês ≈ 6,7 msg/dia), mas agora é um
**limite superior técnico**, não apenas estatístico.

---

## 7. Free tier — confirmado na documentação oficial da AWS (pesquisa direta, esta revisão)

A versão anterior deste documento tratava DynamoDB, API Gateway e S3 como praticamente grátis até
1.000 personais. Pesquisa direta na documentação oficial da AWS mostra que isso estava
**errado** para este projeto, nas condições reais de uso:

- **DynamoDB on-demand (`PAY_PER_REQUEST`, o modo usado neste projeto)** — confirmado: o free tier
  de requisições (créditos equivalentes a 25 WCU + 25 RCU, ~200M requests/mês) **só existe no modo
  Provisioned**. On-demand não recebe esse crédito — só resta o free tier de **armazenamento**
  (25GB, esse sim "always free" e independente do modo), irrelevante no volume de itens deste
  sistema. **Recalculado em §4.2 sem free tier de requests.**
- **API Gateway** — confirmado: o free tier de 1M chamadas/mês (REST e HTTP API) vale **só por 12
  meses a partir da criação da conta, e só para contas novas** ("These free tier offers are only
  available to new AWS customers"). A conta deste projeto (`421219980792`, `pessoal-hotmail`) já
  hospeda `gerenciador-financeiro` há tempo — não é uma conta nova. **Recalculado em §4.4 sem free
  tier.**
- **S3** — confirmado: mesma lógica do API Gateway (free tier histórico de 5GB/20k GET/2k PUT era
  de 12 meses para contas novas; desde 15/jul/2025 a AWS mudou para um crédito de $200 válido por
  6 meses, também só para contas novas). Não se aplica a uma conta já existente. **Recalculado em
  §4.5 sem free tier**, e considerando que o armazenamento cresce com o tempo (sem lifecycle
  policy no `MediaBucket`).
- **Lambda** — confirmado: mantém free tier **"Always Free"** perpétuo (1M requests + 400.000
  GB-s/mês), independente da idade da conta. Não afetado por esta revisão.
- **Cognito** — mantém free tier perpétuo de 50.000 MAU. Irrelevante aqui (só o personal
  autentica, `ESPEC_TECNICA.md` §1.1).
- **CloudFront** — mantém free tier perpétuo de 1TB + 10M requests/mês (permanente desde 2021).
  Não verificado nesta rodada de pesquisa (fora do escopo pedido), sem indício de mudança.

**Ação recomendada:** `ARCHITECTURE.md` §2.1 deste projeto também trata API Gateway e S3 como
"free tier permanente" — vale corrigir essa tabela genérica também, não só este documento de
estimativa (fora do escopo desta tarefa, que pediu só o recálculo de custo).

Sources:
- [Amazon DynamoDB On-Demand Pricing](https://aws.amazon.com/dynamodb/pricing/on-demand/)
- [Is there a free tier for DynamoDB On-Demand? — AWS re:Post](https://repost.aws/questions/QULYTitlzWR3yD1fZ7OAjrtQ/is-there-a-free-tier-for-dynamo-db-on-demand)
- [Amazon API Gateway Pricing](https://aws.amazon.com/api-gateway/pricing/)
- [Amazon S3 Pricing](https://aws.amazon.com/s3/pricing/)
- [AWS Free Tier](https://aws.amazon.com/free/)
