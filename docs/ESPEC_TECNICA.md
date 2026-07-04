# ESPEC_TECNICA.md — Personal Trainer (Diretrizes Técnicas)

> **O que é.** As **diretrizes técnicas transversais** da plataforma: tenancy, estratégia de dados
> single-table para escala, padrões de API (portal e agente) e as regras de custo/performance/tokens.
> Ponte entre o domínio (`FUNCIONAL.md`) e a stack genérica (`ARCHITECTURE.md`).
>
> **Nível de detalhe proposital:** aqui ficam **decisões e diretrizes**, não a especificação fechada.
> Nomes exatos de chaves, endpoints, payloads e YAML são definidos na implementação (vão mudar).
>
> **Hierarquia em conflito:** regra de negócio → `FUNCIONAL.md`; stack genérica → `ARCHITECTURE.md`;
> **modelo de dados / API / otimização deste produto → este doc**; conta/deploy → `CLAUDE.md`.

| Campo | Valor |
|---|---|
| Versão | 0.2 (diretrizes) |
| Status | Decisões estruturais propostas; confirmar itens do §8 |
| Última atualização | 2026-06-15 |

---

## 0. Princípios e prioridade

Diretrizes de otimização, da mais cara para a mais barata de errar:

1. **WRITE é o mais caro.** No DynamoDB, escrita custa ~5× a leitura e **cada GSI multiplica o write**
   do item indexado. Reduzir nº de writes e de GSIs.
2. **Sem read-before-write.** Escrita condicional (`update_item_if_exists`), nunca `get_item` + update.
3. **Uma chamada, um round-trip.** Denormalizar para colapsar N reads em 1, onde o read é quente.
4. **Token é custo do agente.** Payloads para a LLM são compactos (chaves curtas, sem nulos).
5. **Partição quente mata escala.** Distribuir writes por aluno, não por personal (§2).
6. **TTL limpa de graça.** Tudo efêmero tem `ttl`.

### 0.1 Guardrail — custo é o último critério, não o primeiro

> **Ordem de decisão: 1º correção e viabilidade → 2º performance e escala → 3º custo.**
> Otimização de custo só vale se não degrada as duas primeiras. Economia que vira latência ruim,
> leitura velha, `Scan` que não escala ou feature inviável é prejuízo.

Onde os princípios de custo **cedem**: índice necessário **recebe** índice (nunca vira `Scan`);
leitura **consistente** no read-after-write quente; Lambda no caminho do usuário dimensionada pela UX
(medir, não assumir); não denormalizar a ponto de criar atualização frágil.

---

## 1. Tenancy e identidade

### 1.1 Decisão: **Tenant = Personal** (aluno é dado, não usuário Cognito)

O **personal** é o único usuário autenticado (Cognito). O **aluno** não tem login: é entidade do
personal, identificado internamente por `aluno_id` (UUID) e externamente pelo WhatsApp.

**Por quê:** o canal real do aluno é WhatsApp sem login (Cognito seria peso morto e custo de MAU à
toa); o webhook não traz JWT, então `telefone → aluno` é a identificação natural; e "o personal libera
acesso" é nativo — ele **é** dono dos dados. *(Confirmar no §8 — é a fundação do modelo de dados.)*

### 1.2 Caminhos de autenticação

- **Portal do personal:** Cognito JWT → `personal_id` (do `sub`). Padrão de `ARCHITECTURE.md` §4.3.
- **Webhook W-API:** único endpoint público; autenticado por **token opaco na URL** (a W-API não
  assina o payload). `instanceId → personal_id` e telefone do remetente → `aluno_id` (§7). Identidade
  **nunca** vem do payload.
- **Portal do aluno `[FUTURO]`:** JWT escopado (magic-link via WhatsApp), acesso só ao próprio
  `aluno_id`. Fora do MVP.

### 1.3 Personal como administrador ("atuar como aluno")

O personal pode **ver e editar como qualquer aluno** (montar treino, corrigir registro/vínculo —
RN009/RN015/RN022). **Não muda o modelo de dados**: como os dados do aluno já vivem em partição que o
personal possui, isso é só uma **regra de autorização**. Exigência: rastreabilidade — escrita do
personal atuando como aluno grava `ator = personal` e `classificacao = manual`, para separar no
histórico o que o aluno fez do que o personal ajustou. O aluno nunca recebe esse privilégio.

---

## 2. Modelo de dados — estratégia de partição (o que importa)

> Substitui o rascunho de chaves do `FUNCIONAL.md` §5.3. Chaves exatas: na implementação.

### 2.1 Duas famílias de partição

- **`PT#{personal_id}`** — dados do personal e **visões cross-aluno** que ele consome: perfil, índice
  de alunos, feed de alertas, fila de pendências, config (inclui credenciais W-API), indicadores.
  Volume de escrita **baixo**.
- **`AL#{aluno_id}`** — **tudo escopado a um aluno**: perfil, treinos, exercícios, sessões, registros,
  mídias, feedbacks. Volume de escrita **alto** — mas distribuído (1 partição por aluno).

**Por que escala:** os writes pesados (registros, avanço de sessão) são por aluno → caem em
partições diferentes. Milhares de alunos = milhares de partições, sem hot partition. Particionar por
personal concentraria tudo numa chave (limite ~1.000 WCU/partição) — risco real com muitos alunos.

**Carteira grande não vira gargalo.** O personal gerenciar muitos alunos é absorvido por construção:
a partição `PT#` só guarda dado leve (ponteiros, feeds, agregados); o write pesado vai para `AL#`
(distribuído); ler **um** aluno é O(1) em relação ao tamanho da carteira (vai direto à partição
dele); e dashboards leem **agregados** (§3.1), nunca varrem alunos. O único efeito de uma carteira
muito grande é o "listar alunos" paginar em mais páginas — itens minúsculos, resolvido com paginação.
Carteira na ordem de milhares por personal (academia multi-personal) seria outra discussão de tenancy
(sharding), fora do MVP.

### 2.2 Diretrizes de acesso

- **Listar/abrir alunos sem fan-out:** o personal lista por um **ponteiro leve** do aluno guardado em
  `PT#` (nome, status, resumo); abre o aluno indo direto à partição `AL#`.
- **Feeds cross-aluno** (alertas, pendências) são **gravados também em `PT#`** — assim o personal lê
  "tudo recente" numa query, sem varrer N alunos. (O dado-fonte também fica em `AL#` para o histórico
  do aluno.) Volume baixo justifica a duplicação.
- **Autorização de acesso ao aluno:** validar no servidor que o aluno pertence ao personal (membership
  cacheável em memória do container; `aluno_id` é UUID não adivinhável como defesa adicional). "Atuar
  como aluno" usa exatamente a mesma checagem.
- **Lookups diretos (sem GSI):** `instanceId → personal`, `telefone (por personal) → aluno`, sessão
  ativa, feeds — todos servidos por get/query direto.

### 2.3 GSI — minimalismo, não dogma

Cada GSI encarece o write do item indexado, então **nada de índice redundante**. Mas **access pattern
real que não é servível por query direta recebe GSI** — nunca forçar `Scan` para "economizar" índice
(§0.1). MVP precisa de pelo menos um índice "registros por exercício ao longo do tempo" (serve
"quanto peguei?" e a evolução). Demais índices: criar quando o padrão aparecer.

### 2.4 Entidades: atributos base + customização do personal

Começar **básico e extensível**. Cada entidade tem **campos base fixos** (tipados) + um mapa
**`custom`** livre. O personal declara uma vez os atributos extras que quer — por tipo de entidade
(aluno/treino/exercício) — numa config `CONFIG#CUSTOMFIELDS` na sua partição; o portal renderiza e
valida os inputs a partir dela, e cada entidade guarda os valores em `custom`. Como o DynamoDB é
schemaless, detalhar mais dados depois **não exige migração** — evoluem só os models e o portal.

Atributos concretos vivem no **código** (`backend/app/models/`), não aqui (specs enxutas).

---

## 3. Padrões de escrita (onde o custo mora)

- **Sessão ativa como item único denormalizado.** O hot path (cada mensagem do aluno) precisa de
  sessão + exercício atual + prescrição. Manter **um item** que embute isso → leitura do agente = **1
  GetItem**, avançar exercício = **1 update**. Ao finalizar, vira snapshot histórico.
- **Registro = 1 item por (sessão, exercício).** "Fiz 10/9/8" não vira 4 itens; as séries acumulam
  numa lista do mesmo item (1 write, normalmente). Evita 4× writes + 4× GSI.
- **Escrita condicional sempre** (sem read prévio); `ReturnValues` só quando o dado é usado;
  `batch_write` para criação em massa (treino com N exercícios = 1 lote).
- **Denormalização com dono único.** Cada cópia (ponteiro de aluno, sessão) tem um único ponto de
  escrita documentado. Só duplicar quando colapsa um read quente.
- **TTL em tudo efêmero** (sessão ativa, pendência, dedup de mensagem, magic-link).

### 3.1 Indicadores: agregar na escrita, nunca varrer na leitura

**Regra dura:** todo indicador (dashboard, evolução, volume, adesão, contadores) é lido de um
**agregado pré-computado** (1 GetItem/query curta). **Proibido** somar registros via `Scan`/`Query`
no caminho de leitura — não escala. Mantém-se o agregado **na escrita**:

- **Síncrono** (contador simples/imediato): incremento atômico (`ADD`), amarrado ao marcador de
  idempotência para não contar em dobro numa reentrega.
- **Assíncrono via DynamoDB Streams** (métrica analítica/série temporal): uma Lambda agregadora
  consome os eventos e atualiza os buckets por período — o write quente continua mínimo.

Detalhe do padrão (agnóstico) em `ARCHITECTURE.md` §5.5. Lista de indicadores e o nível de cada: §8.

---

## 4. Padrões de API — superfície dupla (portal vs agente)

A mesma lógica serve dois consumidores opostos:

- **Portal (humano):** Cognito JWT, payload rico e legível, paginação normal. Dashboards leem
  **agregados** (§3.1), nunca registros crus.
- **Agente (LLM):** acionado pelo webhook (a LLM roda no backend e usa funções internas como
  ferramentas; identidade já resolvida). Payload **compacto** (chaves curtas, sem nulos, listas
  capadas) porque **todo resultado entra no contexto do modelo** = tokens. Diretriz, não contrato
  fechado — o vocabulário curto é congelado na implementação (§8).

**Transversais:** versionar por prefixo (`/v1`); erros estruturados no portal, curtos no agente;
escrita do agente **idempotente** pelo `messageId` da W-API; rastreabilidade (`canal_origem`,
`data_hora`, `classificacao`, `personal_id`, `aluno_id`) em todo item.

---

## 5. Performance e latência

- **Lambda arm64.** 256 MB para o CRUD do portal (I/O-bound). A **função do webhook/agente é separada
  e dimensionada pela UX** (orquestra LLM + W-API) — medir memória/cold start visando resposta rápida
  no WhatsApp. Separar funções isola o cold start do agente do portal.
- **Consistência:** eventual por padrão; **forte no read-after-write quente** (sessão ativa entre duas
  mensagens seguidas) — ler estado velho ali confunde o agente, e o custo extra é irrelevante.
- **Cache em memória do container quente** para lookups (JWKS, instância→personal, telefone→aluno,
  membership) com **TTL curto** — preferir revalidar a servir autorização velha.
- **Frontend:** React Query (`staleTime`, sem refetch no foco), token em memória, invalidação
  cirúrgica de CloudFront. Tudo conforme `ARCHITECTURE.md` §7/§10.

---

## 6. Custo e escala (alvo)

Manter o uso dentro do free tier permanente o máximo possível: estimativa é **$0** até ~centenas de
alunos ativos, entrando na casa de poucos dólares/mês só na escala de milhares. O multiplicador a
vigiar é **write × (1 + nº de GSIs no item)** — daí a disciplina de não criar índice redundante (mas
criar o necessário, §2.3).

---

## 7. Integração WhatsApp (W-API)

> Provedor: **W-API**, mesmo padrão do `wa-automation` (`C:\ia\wa-automation`) — reaproveitar o
> `WAPIClient` e o fluxo de instância. Endpoints/payloads exatos: na implementação.

- **Uma instância W-API por personal.** Cada personal informa `instanceId` + `token` (salvos na sua
  partição `PT#`, token tratado como credencial) e **conecta o próprio número** via **QR code ou
  pairing-code no portal**. O aluno conversa com o número do personal.
- **Roteamento de entrada:** ao conectar, registrar o ponteiro `instanceId → personal_id`. O webhook
  (único endpoint público) resolve, em ordem: valida o token da URL → `instanceId → personal` →
  telefone do remetente → `aluno` (escopado ao personal) → **dedup por `messageId`** → monta contexto
  → orquestra a LLM → responde via `WAPIClient`.
- **Telefone com escopo por personal:** o mesmo número pode treinar com dois personais; o `instanceId`
  desambigua.
- **Mídia recebida:** baixar da W-API (link expira) e **repassar ao S3** antes de vincular; mídia sem
  contexto vira pendência.
- **Latência:** processar inline (cabe no timeout). Só desacoplar (fila/2ª Lambda) se a latência
  incomodar — não preventivamente.

---

## 8. Decisões em aberto (precisam de você)

1. **Confirmar Tenant = Personal** (§1.1) — libera o scaffold.
2. **MVP agente-first ou portal-first** (`FUNCIONAL.md` §6) — ordem de construção.
3. **Provisionamento das instâncias W-API** (§7) — você cria e entrega ao personal, ou autoatendimento?
   Onde guardar o `token` (DynamoDB cifrado vs Secrets Manager)?
4. **Aluno desconhecido no webhook** (§7) — telefone não cadastrado: boas-vindas, ignorar ou pendência?
5. ~~Atributos das entidades~~ — **direção decidida** (§2.4): base + `custom`. Models básicos em
   `backend/app/models/`; refinar campos conforme o uso.
6. **Lista de indicadores** (§3.1) — quais métricas, e quais síncronas vs via Streams.
7. **Portal do aluno** (§1.2) — confirmar que fica para `[FUTURO]`.
