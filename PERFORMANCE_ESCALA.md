# Problemas de Performance/Escala e Melhorias de Custo

> Documento gerado por investigação de código. Cobre backend (DynamoDB, Lambda, agente LLM),
> frontend (portal + app do aluno) e infraestrutura. Achados classificados por severidade —
> prioridade pensando em 10 → 100 → 1.000 personal trainers. Complementa `CUSTO_ESCALA.md`
> (estimativa de custo). Os achados abaixo permanecem como registro histórico da investigação;
> o status de implementação de cada um está em §5 e no resumo abaixo.

## Status de implementação (itens 1–6, 8, 9 de §5)

Implementados — ver `plans/zany-twirling-oasis.md` para o plano executado:
- ✅ **#1** Agregado de não-lidas + TTL em toda notificação (§1.1)
- ✅ **#2** Rate limiting do agente (10 msg/aluno/min) + dedup pós-resposta (§1.4)
- ✅ **#3** `SYSTEM#SCHED` particionado por dia + paginação no scheduler (§1.2)
- ✅ **#4** Logging de `cached_tokens` para confirmar prompt caching (`CUSTO_ESCALA.md` §5.4)
- ✅ **#5** Cache `instanceId→personal`/`telefone→aluno` no webhook + `foto_s3_key` denormalizada no ranking (§2.5, §2.6)
- ✅ **#6** Code-splitting do frontend + lazy loading de mídia (§3) — **paginação do ranking não foi implementada** (decisão: ordenação por pontos torna paginação cursor-based contraproducente; o N+1 real já foi resolvido pelo item #5)
- ✅ **#8** `deletar_post` direto por SK + contador agregado de alunos no dashboard (§2.2, §2.3)
- ✅ **#9** Streaming no download de mídia (S3), TTL no cache JWKS, TTL em `REG#` órfãos (§2.4, §2.7, §3)

**Não implementado nesta rodada (fora de escopo, por decisão do usuário):**
- ⬜ **#7** Lambda separada para webhook/agente (§1.3) — adiado, conforme a própria recomendação
  deste documento ("correção não preventiva — fazer quando o volume justificar").

Achados de baixa severidade não cobertos por nenhum item de §5 (mencionados em §3, sem ação):
S3 sem `LifecycleConfiguration` (armazenamento cresce sem limite — ver `CUSTO_ESCALA.md` §4.5).

---

## 0. Resumo executivo

A base arquitetural é **sólida**: single-table bem particionada (`PT#`/`AL#`), zero `Scan` no
código inteiro (não há sequer uma chamada `.scan(` em `backend/app/`), escrita condicional sem
read-before-write na maioria dos fluxos, paginação cursor-based onde precisa, agregados
pré-computados para a maior parte dos indicadores (sessões, volume, PRs). Os problemas reais não
estão na fundação — estão em **3 pontos específicos que fogem do padrão que o resto do código
segue rigorosamente**:

1. **Sistema de notificações não segue a própria regra do projeto** ("agregar na escrita, nunca
   varrer na leitura") — é o único módulo que faz `Query` completo da partição em todo path de
   leitura, e é polled a cada 60s pelo frontend.
2. **Agenda global de vencimentos (`SYSTEM#SCHED`)** é uma partição compartilhada por **todos os
   personais** — o único ponto do sistema que reintroduz o "hot partition" que o resto do design
   evita deliberadamente.
3. **Monolambda mistura 3 perfis de carga muito diferentes** (CRUD rápido, agente LLM com I/O
   externo de segundos, download/upload síncrono de mídia) na mesma função, mesma memória, mesmo
   pool de concorrência.
4. **Agente sem rate limiting**, combinado com um bug de correção (dedup marca a mensagem como
   "vista" antes de chamar a LLM) — é o maior vetor de custo descontrolado do sistema e pode fazer
   o aluno não receber resposta nenhuma se o turno estourar o timeout da Lambda.

Nenhum desses quatro é crítico a 10–100 personais. Os quatro **se tornam problema visível** entre
100 e 1.000 — o item 4, em particular, pode virar problema antes disso se um único aluno/bug gerar
tráfego anômalo.

---

## 1. Achados críticos

### 1.1 `notif_service`: indicador de não-lidas violando a própria regra do projeto

`ESPEC_TECNICA.md` §3.1 é explícito: *"Proibido somar registros via Scan/Query no caminho de
leitura"*. Esse módulo é a única exceção real no código:

- **`nao_lidas()`** (`backend/app/services/notif_service.py:35-37`) — `query_pk` de **toda** a
  partição `NOTIF#` do personal, conta não-lidas em Python. Chamado por
  `GET /v1/notificacoes/unread` (`notificacoes.py`) e **também duplicado inline** em
  `backend/app/routers/dashboard.py:16-18`.
- **`listar_recentes()`** (`notif_service.py:47-71`) — mesmo padrão: `query_pk` completo +
  filtro em Python por tipo/aluno/janela de tempo. Chamado **dentro do webhook**, no caminho
  síncrono de toda mensagem recebida com o agente pausado (`webhook.py:170-172`,
  `_notificar_msg_direta`).
- **`marcar_todas()`** (`notif_service.py:74-82`) — `query_pk` completo + loop de N
  `update_item` individuais (não usa `batch_write`).
- **`criar()`** (`notif_service.py:12-21`) **não seta `ttl`** na criação — só `marcar_lida()`
  seta TTL de 30 dias (linha 43). Notificação nunca lida **fica para sempre** na partição.

**Por que é crítico:** o frontend faz **polling de 60 em 60 segundos** desse exato endpoint, a
partir do layout raiz do portal (`frontend/src/components/layout/AppLayout.tsx`, hook
`useUnreadCount` em `frontend/src/hooks/useNotificacoes.ts:14-16`) — ou seja, **toda sessão de
personal com o portal aberto** gera uma query de partição completa a cada minuto. Combinado com o
bug de TTL, o custo **cresce com o tempo de vida da conta**, não com o uso atual — é o único item
deste documento que piora sozinho, mês a mês, mesmo sem crescimento de usuários.

**Correção (Nível A do `ARCHITECTURE.md` §5.5 — exatamente o padrão já usado em
`pontos_service`/`sessao_service` em outros lugares deste mesmo projeto):**
- Manter um contador `NAO_LIDAS` em `PT#{personal}/STATS#NOTIF` via `increment_counter` em
  `criar()` e `decrement` em `marcar_lida()`/`marcar_todas()`. `nao_lidas()` vira 1 `get_item`.
- Setar `ttl` em **todas** as notificações na criação (ex.: 90 dias), não só nas lidas.
- `marcar_todas()` trocar o loop de `update_item` por `batch_write` (ou aceitar que só zera o
  contador agregado, sem tocar cada item individualmente — mais barato ainda).
- `listar_recentes()` (dedup de "mensagem direta") pode usar uma chave dedicada com TTL curto
  (`DEDUP#MSGDIRETO#{aluno_id}`, TTL 1h) em vez de varrer todo o histórico de notificações a cada
  mensagem do webhook.

---

### 1.2 `SYSTEM#SCHED`: partição global compartilhada por todos os personais

`backend/app/repositories/keys.py:73` define `PK_SCHED = "SYSTEM#SCHED"` — **uma única
partição** onde **todo treino com `data_fim`, de todo aluno, de todo personal**, grava um item
`DUE#{data_fim}#{treino_id}` (`backend/app/routers/treinos.py:28-38`, `_sync_due`, chamado em
`create_treino`/`update_treino`/`delete_treino`).

Isso é exatamente o padrão que o `ESPEC_TECNICA.md` §2.1 identifica como risco e que o resto do
design evita deliberadamente: *"Particionar por personal concentraria tudo numa chave (limite
~1.000 WCU/partição)"* — aqui a concentração é **pior**, é por **sistema inteiro**, não por
personal.

**Impacto em escala:** com 1.000 personais × 25 alunos × 3 treinos com `data_fim` definido =
até ~75.000 itens nessa única partição, todos com a mesma `PK`. O `scheduler.py:14-18` lê essa
partição inteira (via `query_between`, **sem paginação** — `repo.query_between` em
`dynamo_repo.py:106-109` não trata `LastEvaluatedKey`) toda vez que roda (diariamente). Se o
resultado de um dia passar de 1MB (limite de página do DynamoDB Query), **a função processa só a
primeira página silenciosamente — vencimentos somem sem erro nem log de aviso**. Mesmo sem
estourar 1MB, é uma única invocação Lambda processando todos os vencimentos do dia **em loop
sequencial** (`scheduler.py:19-30`, 1 delete + 1 write de notificação por item, sem batching),
correndo contra os 29s de timeout herdados do `Globals` — com muitos personais vencendo treinos
no mesmo dia, o risco de timeout parcial é real.

**Correção:**
- Particionar a agenda de vencimento por dia (`PK = SCHED#{data_fim}`) em vez de uma partição
  única — distribui a escrita e torna a leitura diária um `query_pk` de uma partição menor e
  previsível, sem o limite de WCU compartilhado.
- Adicionar paginação ao `scheduler.py` (loop com `query_between` + `ExclusiveStartKey`) e/ou
  trocar o processamento sequencial por `batch_write` para os deletes.
- Aumentar o timeout/memória dedicados da `SchedulerFunction` no `template.yaml` (hoje herda os
  29s/256MB do `Globals` pensados para CRUD, não para processamento em lote).

---

### 1.3 Monolambda: CRUD + webhook + agente LLM + download de mídia na mesma função

Confirmado em `backend/app/main.py:6-38` (todos os routers, incluindo `webhook.router`, no mesmo
app) e `backend/template.yaml:176-222` (uma única `ApiFunction`, `MemorySize: 256`, atendendo
`HealthCheck`, `PublicProxy` — webhook —, `AlunoProxy` e `AuthProxy` no mesmo recurso Lambda).
Não há SQS, não há segunda Lambda, não há fila — confirmado por ausência de qualquer
`AWS::SQS::Queue` no template e qualquer import de boto3 `sqs` no backend.

Três perfis de carga muito diferentes competem pelo mesmo pool de concorrência e pela mesma
configuração de 256MB:
- **CRUD do portal**: rápido (<200ms), I/O-bound em DynamoDB — o perfil para o qual 256MB foi
  dimensionado (`template.yaml:71`, comentário confirma isso).
- **Webhook + agente**: 1–5 chamadas síncronas a uma API LLM externa (`llm_agent.py:251`, timeout
  de 25s por chamada `httpx`), podendo levar **vários segundos** de wall-clock por mensagem.
- **Mídia/áudio**: download HTTP completo do arquivo (`media_service.py:122-130`, `_bytes()` —
  carrega o arquivo inteiro em memória) + upload S3, tudo síncrono **dentro do mesmo request**
  que o WhatsApp espera resposta (`webhook.py:127-153`); para áudio, ainda inclui uma chamada ao
  Whisper (`media_service.py:133-155`, timeout de 60s) **antes** de chamar o agente.

**Por que importa em escala:** com 256MB, a banda de rede e CPU disponíveis para a Lambda são
proporcionalmente baixas — um vídeo de alguns MB enviado por um aluno empurra essa função para
perto do limite de memória/tempo, **na mesma configuração** usada para um simples `GET
/v1/alunos`. Em pico de uso (ex.: muitos alunos malhando entre 18h–20h, vários enviando
fotos/vídeos ao mesmo tempo), essas invocações mais pesadas e mais lentas consomem uma fatia
desproporcional da concorrência disponível da conta (1.000 invocações simultâneas, default,
**compartilhadas com outros apps na mesma conta AWS pessoal-hotmail** — não há
`ReservedConcurrency` configurado para nenhuma função no template). Isso não é um problema de
custo, é um problema de **latência percebida pelo aluno no WhatsApp** sob carga.

**Correção (não preventiva — fazer quando o volume justificar, conforme `ARCHITECTURE.md` §10.0):**
- Separar a Lambda do webhook/agente da Lambda do CRUD do portal (o `ESPEC_TECNICA.md` §5 já
  prevê isso: *"a função do webhook/agente é separada e dimensionada pela UX"* — ainda não foi
  implementado). Isola cold start e permite memória diferente para cada perfil.
- Desacoplar download/upload de mídia do caminho síncrono de resposta ao WhatsApp: responder
  "recebi, processando" imediatamente e mover o download+S3+Whisper para uma 2ª invocação
  (SQS ou invocação assíncrona da própria Lambda) — o `ESPEC_TECNICA.md` §7 já antecipa isso:
  *"Só desacoplar (fila/2ª Lambda) se a latência incomodar — não preventivamente"*. Vale revisitar
  quando houver dado real de latência em produção.

---

### 1.4 Sem rate limiting no agente + mensagem marcada como "vista" antes de chamar a LLM

Busca por `QUOTA`/`rate_limit` em todo o backend não retorna nenhum resultado
(`backend/app/services/llm_agent.py`, `agent_service.py`, `webhook.py`) — não há throttle, cooldown
nem limite por janela de tempo para mensagens de um mesmo aluno. Um aluno (ou um bug no app)
mandando mensagens em sequência rápida dispara o loop completo do agente (até `_MAX_STEPS = 5`
chamadas LLM, `llm_agent.py:21`) **sem nenhuma barreira** — é o maior vetor de custo descontrolado
do sistema, maior até que qualquer ineficiência de DynamoDB, porque o custo marginal de cada
chamada LLM é ordens de grandeza maior que uma operação DynamoDB.

Combinado com isso, há um bug latente de **correção**, não só de custo: o dedup por `messageId`
(`webhook.py:110-116`) marca a mensagem como processada **antes** de chamar o agente. Como cada
chamada LLM tem timeout de 25s (`llm_agent.py:251`) e o loop permite até 5 chamadas no mesmo turno,
um turno com múltiplos tool calls pode facilmente ultrapassar os 29s de timeout da Lambda
(`Globals.Timeout`, `template.yaml:70`) — derrubando a função **depois** de já ter marcado o
`messageId` como visto. Resultado: a W-API reentrega o webhook (delivery at-least-once), mas a
reentrega é descartada pelo dedup, e **o aluno nunca recebe resposta nenhuma**, sem log de erro
visível além do timeout da Lambda.

**Correção:**
- Rate limiting simples por aluno (ex.: `QUOTA#{aluno_id}#{minuto}` com `ADD` atômico + TTL,
  exatamente o padrão de contador já usado em `pontos_service`) — rejeitar ou enfileirar mensagens
  acima de N/minuto.
- Mover o registro de dedup para **depois** da resposta do agente (ou usar um estado intermediário
  "em processamento" com TTL curto), para que um timeout real permita reentrega em vez de silenciar
  a mensagem.

---

## 2. Achados médios

### 2.1 `pontos_service.award`: 5 operações DynamoDB por evento de gamificação, escrevendo na partição do personal

`backend/app/services/pontos_service.py:32-84`. Cada vez que um aluno finaliza uma sessão, posta,
curte ou comenta, `award()` executa: 1 `get_item` (ler contador atual p/ reset semanal/mensal) +
1 `add_and_set` (pontos do aluno) + 1 `put_item` (log do evento) + 1 `get_item` (nome do perfil) +
1 `add_and_set` **na partição `PT#{personal_id}`** (ranking). Chamado em
`sessao_service.py:138` (toda sessão finalizada) e em `feed_global_service.py:64` (toda curtida).

Isso **contradiz parcialmente** a premissa de `ESPEC_TECNICA.md` §2.1 de que `PT#` recebe só
"escrita leve" — o ranking (`RANKING#{aluno_id}` dentro de `PT#`) recebe 1 write por evento de
gamificação de **cada um** dos alunos do personal. Com muitos alunos ativos simultaneamente
(turma cheia numa academia, todos terminando treino na mesma janela de horário), os writes de
ranking convergem na mesma partição do personal — não é um hot partition no sentido crítico (o
volume por personal ainda é baixo, dezenas de eventos/dia), mas é a única violação identificável
dessa regra de design no código, e vale monitorar se a gamificação crescer (badges, streaks etc.).

**Correção, se o volume crescer:** mover o ranking para um agregado assíncrono via DynamoDB
Streams (Nível B do `ARCHITECTURE.md` §5.5) em vez de escrita síncrona a cada evento — a tabela
não tem Streams habilitado ainda (`template.yaml:245`, comentário confirma "habilitar quando
precisar").

### 2.2 `feed_global_service.deletar_post`: varre a partição inteira para achar 1 item

`backend/app/services/feed_global_service.py:68-75`. Para deletar um post pelo `post_id`, faz
`query_pk` de **toda** a partição `FEED#` do personal e itera em Python até achar o `SK`
correspondente — em vez de reconstruir o `SK` diretamente (o post_sk já é conhecido/derivável e é
usado em outros endpoints, ex. `aluno.py:451` recebe `post_sk` do cliente). Baixo impacto
individual (posts globais não são um volume alto), mas é um padrão O(N) que não precisa existir.

**Correção:** receber/derivar o `post_sk` no router de delete (como já é feito em
`toggle_curtida`) e usar `delete_item_if_exists` direto.

### 2.3 `dashboard.py`: contadores recomputados a cada load, sem agregado

`backend/app/routers/dashboard.py:16-18`. `alunos = query_pk(..., "ALUNO#")` traz **todos** os
ponteiros de aluno do personal só para fazer `len()` e contar quantos estão `ATIVO` — e duplica a
lógica de `nao_lidas` já criticada em §1.1. Para um personal com centenas de alunos, isso é uma
query maior que o necessário a cada abertura do dashboard. Bounded pela carteira do personal (não
escala mal globalmente), mas é facilmente substituível por um contador mantido na escrita
(incrementado em `create_aluno`/decrementado em `delete_aluno`, atualizado no toggle de status).

### 2.4 Download/transcrição de mídia 100% síncrono e em memória

`backend/app/services/media_service.py:122-130` (`_bytes`) baixa o arquivo inteiro do link
temporário da W-API para memória (`r.content`) antes de subir ao S3 — sem streaming. Para vídeos
maiores, isso consome memória proporcional ao tamanho do arquivo na mesma Lambda de 256MB
(ver §1.3). `transcrever_audio` (linhas 133-155) encadeia **3 chamadas HTTP síncronas**
(W-API download-media → download do arquivo → Whisper) antes de sequer chamar o agente — tudo
dentro do tempo que o aluno espera a resposta no WhatsApp.

**Correção:** usar `httpx.stream()` para upload direto ao S3 sem materializar o arquivo inteiro
em memória; considerar mover transcrição de áudio para fora do caminho síncrono se a latência
incomodar (ver §1.3).

### 2.5 Ranking e feed: N+1 de leitura por item da lista

- `backend/app/routers/aluno.py:469-480` (`get_ranking`) — loop sobre o ranking inteiro do personal
  fazendo `get_item(PROFILE)` por aluno só para pegar `foto_s3_key`. Cresce linear com o tamanho da
  carteira, executado toda vez que a tela de Ranking é aberta. `pontos_service.award()` já
  denormaliza `nome` no item de ranking — denormalizar `foto_s3_key` junto eliminaria o N+1.
- `backend/app/services/feed_global_service.py:41-48` (`listar_posts_global`) — para cada post da
  página (até `limit`, default 20), faz `get_item` extra para checar `curtido_por_mim`. Bounded pelo
  tamanho da página, mas é 1 GetItem a mais por item exibido, toda vez que o feed é aberto.
- No frontend, `frontend/src/api/feedGlobal.ts:40-41` (`ranking()`) e
  `frontend/src/pages/RankingPage.tsx:32-35` reforçam o problema: a chamada busca a lista **completa**
  de ranking, sem `cursor`/`limit` (diferente de alunos/chat/notificações, que já usam
  `useInfiniteQuery`) — o payload e o N+1 do backend crescem juntos com o tamanho da carteira.

**Correção:** denormalizar `foto_s3_key` no item de ranking (mesmo padrão já usado para `nome`);
paginar `ranking()` no frontend com `useInfiniteQuery`, igual às demais listas.

### 2.6 Lookups de webhook sem cache, ao contrário do que o próprio ESPEC recomenda

`ESPEC_TECNICA.md` §5 lista explicitamente `instanceId → personal` e `telefone → aluno` como
candidatos a cache em memória do container quente (TTL curto), no mesmo espírito do cache de
membership que `authz.py` já implementa (§3). No código, porém:
- `backend/app/routers/webhook.py:51` (`_resolve_personal`, lookup `instanceId → personal`) — `get_item`
  direto, sem cache.
- `backend/app/routers/webhook.py:119` (lookup `telefone → aluno`) — `get_item` direto, sem cache.

Como o webhook roda na mesma Lambda que pode ficar "quente" entre invocações, isso é uma melhoria de
baixo esforço e retorno proporcional ao volume de tráfego do WhatsApp: 2 GetItems evitáveis por
mensagem recebida, em todo personal, em toda escala.

**Correção:** aplicar o mesmo padrão de cache em memória + TTL curto (ex.: 120s, igual a
`authz.py`) para esses dois lookups.

### 2.7 JWKS em cache permanente sem TTL — não é custo, é correção

`backend/app/dependencies.py:15-22`. `@lru_cache(maxsize=1)` em `_get_jwks()` nunca expira
dentro do tempo de vida do container. Se o Cognito rotacionar as chaves de assinatura (acontece
ocasionalmente, fora do controle do projeto), **containers já quentes continuam usando a JWKS
antiga** até reciclarem (cold start) — pode causar uma janela de 401s incorretos logo após uma
rotação de chave. Baixo risco prático (rotação é rara), mas é um bug latente fácil de evitar.

**Correção:** TTL manual no cache (ex.: invalidar após 1h) ou usar uma lib com cache + TTL nativo.

---

## 3. Achados baixos (não bloqueiam nada, vale anotar)

- **`authz.py` — cache de membership por container** (`backend/app/services/authz.py:11-24`,
  TTL 120s): implementado exatamente como o `ESPEC_TECNICA.md` §2.2 promete. Em cold start, o
  cache começa vazio (1 read extra na primeira autorização de cada container) — esperado, sem
  ação necessária. `invalidate()` é chamado corretamente em `delete_aluno`
  (`alunos.py:174`); não há invalidação cross-container em updates de vínculo, mas o TTL curto
  (120s) já limita a janela de inconsistência — comportamento aceitável pelo próprio guardrail
  do projeto ("preferir revalidar a servir autorização velha").
- **Frontend: bundle único de 1,82MB sem code-splitting.** `frontend/src/App.tsx:8-26` importa
  as 17 páginas do portal **e** o `AlunoApp` (app do aluno) eagerly no mesmo `createBrowserRouter`
  — sem `React.lazy`/`Suspense`. O build atual (`frontend/dist/assets/index-DQfcKK1e.js`) já tem
  **1.818.918 bytes** (não-comprimido) num único chunk, incluindo dependências pesadas usadas só
  em telas específicas (`jspdf` + `html2canvas` para exportar PDF, `recharts` para gráficos de
  evolução) carregadas mesmo por um aluno que só quer abrir o chat. Isso afeta o aluno
  desproporcionalmente — ele entra via link do WhatsApp, provavelmente em rede móvel, e baixa o
  app inteiro do personal (CRUD de treinos, biblioteca, agenda etc.) que ele nunca vai usar. Sem
  custo direto de infra relevante (CloudFront serve estático, barato), mas é o maior risco de
  performance percebida pelo usuário final, e só piora conforme o portal ganha mais telas.
  **Correção:** `React.lazy` por rota, no mínimo separando claramente o bundle do `/aluno` do
  bundle do portal autenticado (são públicos completamente diferentes).
- **Polling de chat (15s)** em `useAlunoChat.ts:13` e a referência equivalente em
  `usePersonalChat.ts:13` — aceitável (só ativo com a tela de chat aberta, query paginada e
  bounded), mas é mais um candidato a virar WebSocket/SSE se o produto crescer e quiser reduzir
  ainda mais o número de invocações Lambda por usuário ativo.
- **Mídia sem lazy loading.** Nenhum `<img>`/`<video>` no frontend usa `loading="lazy"` ou
  `IntersectionObserver` (`frontend/src/components/feed/FeedGlobalTab.tsx:61-65`,
  `components/media/MediaTimeline.tsx:30-32`, `components/exercicio/ExercicioFeedCard.tsx:39-42`,
  `components/chat/ChatThread.tsx:66-68`). Toda foto/vídeo de uma timeline ou feed carrega
  imediatamente ao montar, mesmo fora da viewport — soma banda ao CloudFront proporcional ao nº de
  itens de mídia, não ao que o usuário realmente rolou até ver.
- **`REG#{sessao_id}#{ex_id}` sem TTL.** Se uma sessão ativa for abandonada sem `finalizar` (o item
  `SESSION#ACTIVE` expira em 6h via TTL — `sessao_service.py`), os itens de registro já gravados
  (`REG#...`) **não** têm TTL e ficam órfãos permanentemente na partição do aluno. Volume baixo por
  aluno, mas é um pequeno gap na cobertura de TTL que o resto do projeto aplica consistentemente.

---

## 4. O que já está bem feito (não mexer)

Para não gerar trabalho desnecessário em cima do que já segue o padrão certo:

- **Zero `Scan`** em todo o backend — confirmado por busca textual no código inteiro.
- **GSI1 minimalista e correto**: único índice do sistema, usado exatamente para o access pattern
  que precisa (`registros por exercício no tempo`), padrão sparse (só itens de registro carregam
  `GSI1PK`/`GSI1SK`), evita inflar custo de write de itens que não precisam de índice.
  `evolucao_exercicio`/`historico_exercicio`/`consultar_historico` usam o GSI corretamente.
  
- **Indicadores principais (sessões, volume, PRs, dashboard diário)** são agregados na escrita via
  `add_and_set`/`update_if_greater` (`sessao_service.py`), lidos com 1 `get_item`/query curta — é
  exatamente o padrão Nível A do `ARCHITECTURE.md` §5.5, e é a maioria dos indicadores do
  sistema (a exceção é notificações, §1.1).
- **Escrita condicional sem read-before-write** em praticamente todo o CRUD
  (`update_item_if_exists`, `put_item_if_absent`, `delete_item_if_exists`) — `treinos.py`,
  `alunos.py`, `sessoes.py` seguem o padrão à risca.
- **Paginação cursor-based** onde a coleção cresce sem limite (alunos, notificações, mensagens de
  chat, sessões históricas) via `query_pk_page` — implementado consistentemente.
- **Sessão ativa como item único denormalizado** (`SESSION#ACTIVE`) — o agente lê o estado inteiro
  da conversa em 1 `GetItem`, exatamente o padrão prescrito em `ESPEC_TECNICA.md` §3.
- **Agenda de vencimento do scheduler não usa `Scan`** — usa `query_between` numa partição
  dedicada; o problema (§1.2) é que essa partição é **global** em vez de particionada por dia, não
  que o acesso seja ineficiente.
- **Webhook responde sempre 200 rápido e ignora `fromMe`** — evita loop de mensagens e reentrega
  infinita da W-API.
- **Dedup idempotente por `messageId`** com TTL — evita reprocessamento em retry do provedor.

---

## 5. Recomendações priorizadas (esforço × impacto)

| # | Ação | Esforço | Impacto em escala | Referência | Status |
|---|---|---|---|---|---|
| 1 | Agregado pré-computado de não-lidas + TTL em toda notificação na criação | Baixo | Alto (cresce sozinho com o tempo) | §1.1 | ✅ Implementado |
| 2 | Rate limiting por aluno no agente + mover dedup para depois da resposta | Baixo-Médio | Alto (maior vetor de custo descontrolado + bug de mensagem perdida) | §1.4 | ✅ Implementado |
| 3 | Particionar `SYSTEM#SCHED` por dia + paginar `scheduler.py` | Médio | Alto (hot partition + risco de timeout) | §1.2 | ✅ Implementado |
| 4 | Verificar/ativar prompt caching no provider LLM ativo | Baixo (investigação) | Alto (~25-30% do maior custo do sistema) | `CUSTO_ESCALA.md` §5.4 | ✅ Logging adicionado (confirmação de uso real pendente) |
| 5 | Cache de `instanceId→personal`/`telefone→aluno` no webhook; denormalizar `foto_s3_key` no ranking | Baixo | Médio (2 GetItems evitáveis por mensagem; N+1 do ranking) | §2.5, §2.6 | ✅ Implementado |
| 6 | Code-splitting do bundle frontend (separar `/aluno` do portal) + paginar ranking + lazy loading de mídia | Médio | Médio (UX do aluno, não custo direto) | §3 | ✅ Code-splitting + lazy loading; paginação do ranking descartada (decisão deliberada) |
| 7 | Lambda separada para webhook/agente | Médio-Alto | Médio (só relevante com tráfego concorrente real) | §1.3 | ⬜ Adiado (fora de escopo, por decisão do usuário) |
| 8 | `deletar_post` direto por SK, contador de alunos no dashboard | Baixo | Baixo | §2.2, §2.3 | ✅ Implementado |
| 9 | Streaming no download de mídia, TTL no cache JWKS, TTL em `REG#` órfão | Baixo | Baixo (correção, não custo) | §2.4, §2.7, §3 | ✅ Implementado |

Os itens 1–4 têm a melhor relação esforço/impacto e devem vir antes de qualquer otimização de
infra mais estrutural (itens 6–7), seguindo o guardrail do próprio projeto: corrigir o que já
foge do padrão antes de redesenhar o que já funciona. **Itens 1–6, 8–9 implementados** (ver
`CUSTO_ESCALA.md` para o impacto recalculado no modelo de custo); item 7 permanece em aberto.
