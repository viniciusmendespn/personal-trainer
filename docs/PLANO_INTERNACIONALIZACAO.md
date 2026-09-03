# Plano de Internacionalização — CoachPilot

> Status: **proposta**. Nada implementado. Escrito em 2026-09-02 a partir de varredura do código
> atual (`frontend/src` 279 arquivos / 41.727 linhas; `backend/app` 121 arquivos / 19.914 linhas).
> Objetivo: sair de um produto pt-BR/Brasil-only para um produto multi-idioma e multi-fuso,
> começando por **en-US** e com um terceiro idioma logo em seguida.

---

## 1. Resumo executivo

Internacionalizar o CoachPilot são **sete eixos independentes**, não um só:

| Eixo | Situação hoje | Dificuldade |
|---|---|---|
| **Idioma da interface** | 100% pt-BR hardcoded, sem lib de i18n | Alta (volume) |
| **Fuso horário por usuário** | Tudo UTC; recorte local só no navegador; agregados diários em dia UTC | **Alta (é onde tem bug real)** |
| **Unidades** | kg/cm/km cravados no modelo e na UI | Média |
| **Moeda e pagamento** | BRL + PIX/Mercado Pago — trilho exclusivo do Brasil | Alta (é bloqueante comercial) |
| **Formatos** (data, número, telefone) | `toLocaleString('pt-BR')` em 44 arquivos | Baixa (mecânico) |
| **Conteúdo público / SEO** | Landing, blog, 6 páginas SEO, 2 manuais — tudo pt-BR, slugs pt, domínio `.com.br` | Média (é redação, não código) |
| **IA / MCP / prompts** | Instruções, tools e guia de prescrição em português | Média |

A ordem correta **não** é "traduzir primeiro". A ordem correta é:

1. **Fuso e formatos primeiro** — corrigem bugs que já existem hoje em produção no Brasil e são
   pré-requisito de qualquer outro país. Entregável sozinho, sem mudança visível de idioma.
2. **Infraestrutura de i18n depois** — extrair as strings com pt-BR como único idioma. Zero
   mudança visual, mas é o passo que trava o código para não voltar a nascer hardcoded.
3. **Inglês por último** — quando as duas camadas acima existem, o inglês vira trabalho de
   tradução + conteúdo, não de refatoração.

O motivo de não inverter: se traduzirmos antes de extrair, cada string traduzida terá que ser
tocada duas vezes; se extrairmos antes de arrumar fuso, teremos que reabrir os mesmos arquivos.

### Decisões que precisam ser tomadas antes da Fase 0

Estas quatro decisões mudam o desenho e não dá para adiar até a Fase 4:

| # | Decisão | Recomendação |
|---|---|---|
| D1 | **Domínio internacional** — `coachpilot.com.br` é ccTLD, não ranqueia fora do Brasil | Comprar `coachpilot.com` e servir pt em `/` do `.com.br` e en em `/` do `.com`, ambos apontando para o mesmo bucket S3 com distribuições novas. Alternativa mais barata: `coachpilot.com/pt` + `/en` com `hreflang`, e o `.com.br` redirecionando. |
| D2 | **Quem paga o CoachPilot lá fora** — PIX não existe fora do Brasil | Stripe para assinatura internacional (cartão + Apple/Google Pay). Manter Mercado Pago/PIX só para BR. Ver §6. |
| D3 | **Cobrança personal→aluno lá fora** — hoje o personal pluga o próprio Mercado Pago | Fase 5 lança **só o modo MANUAL** fora do Brasil (o personal registra o pagamento à mão, que o sistema já suporta). Stripe Connect é um projeto próprio, depois. |
| D4 | **Residência de dados** | Manter `us-east-1`. Serve BR e US bem. Para a UE isso exige base legal de transferência (SCC) e vira decisão de quando, não de agora — ver §8. |

---

## 2. Diagnóstico — o que já ajuda e o que trava

### 2.1 A favor (não precisa mexer)

- **O backend já grava tudo em UTC.** `utils.now_iso()` usa `datetime.now(timezone.utc)`. Não
  existe nenhum `America/Sao_Paulo` no código. Não há offset fixo gravado em lugar nenhum.
  Isso é enorme: significa que o dado histórico **não precisa de migração de fuso**.
- **Enums são códigos, não texto.** `models/enums.py` usa `ATIVO`, `PENDENTE`, `FOR_TIME`. O
  texto exibido já está separado do valor persistido.
- **`PhoneInput.tsx` já é multi-país** (BR, US, PT, AR, MX, CO, CL, ES) com E.164.
- **Já existe o padrão certo de erro em alguns pontos**: `routers/personal.py` devolve
  `{"code": "SLUG_INVALIDO", "message": "..."}`. É exatamente o modelo a generalizar (§5.2).
- **Agendamentos são instantes reais** (`data_hora_inicio` é ISO com `Z`, gerado por
  `new Date(...).toISOString()`). O lembrete de aula (`agenda_scheduler.py`) é offset-relativo e
  já é correto em qualquer fuso.
- **A sessão de treino já é fechada por instante**, não por dia (`sessao_scheduler.py` faz
  `query_between` até `agora_iso`). Esse é o padrão a copiar para o scheduler diário (§4.3).
- **Nenhuma lib de i18n instalada** — campo limpo, dá para escolher sem legado.

### 2.2 Contra (o trabalho real)

**Idioma**
- 4 HTMLs com `<html lang="pt-BR">`; 3 webmanifests com nome/descrição em português.
- ~1.100 linhas com texto português visível só pela heurística de acentuação — a contagem real
  de strings distintas na UI deve ficar entre **2.500 e 3.500**, distribuídas assim:
  `pages/` (539 linhas), `components/` (257), `utils/` (55), `calc/` (114), `auth/` (29),
  `api/` (28), `hooks/` (23), `loja/` (24), `divulgador/` (8).
- Backend: **116 dos 121 arquivos .py** têm string acentuada; 59 `detail=` de `HTTPException`
  e 76 chamadas de criação de notificação, todas com texto pronto em português.
- Conteúdo longo: `blogData.js` (1.216 linhas), `publicSeoData.js` (815), `ajuda-portal.md`
  (928), `ajuda-aluno.md` (459), `prompt-treino-aluno.md` (433), `prompt-cpkg.md` (378).

**Formatos**
- 83 ocorrências literais de `'pt-BR'` em 44 arquivos; 68 chamadas `toLocale*`; **zero** uso de
  `Intl.*`. `utils/currency.ts` tem BRL cravado.

**Unidades**
- `models/avaliacao.py` grava `altura_cm` — a unidade está **no nome do campo**. `peso` é kg por
  convenção. 139 ocorrências de `kg` no frontend.

**Moeda**
- 54 ocorrências de `R$`. `models/loja.py` valida `preco_centavos` com teto `500000` comentado
  como "R$ 5.000,00" — o limite é em reais mas o campo não diz qual moeda.
- `assinatura_service.py`: `{"preco": "39.90", "preco_anual": "399.00"}` sem código de moeda.
- `mp_service.py` cria pagamento com `payment_method_id: "pix"` — Brasil-only por construção.

**Fuso — os pontos concretos que quebram fora do Brasil** (detalhe em §4):

| Onde | O que acontece |
|---|---|
| `sessao_service.py:502` `STATS#D#{fim_iso[:10]}` | Agregado diário do dashboard usa **dia UTC**. Em UTC+9, treino das 08h local cai no dia anterior no gráfico. |
| `sessao_service.py:466` streak por `_isoweek()` UTC | Sessão de segunda de manhã em UTC+12 conta na semana anterior — quebra streak e badge. |
| `sessao_service.py:486` `dow_{weekday}` | "Dias que o aluno treina" calculado em UTC. |
| `routers/dashboard.py:34-42` | Janelas de 7/14 dias em dia UTC. |
| `services/pendencia_service.py:41` `date.today()` | Roda em UTC na Lambda. O próprio docstring assume "no máximo 1 dia de diferença em BRT". Em UTC+13 a diferença vira sempre. |
| `services/financeiro_service.py` (`date.today()` em 5 pontos) | Vencimento/atraso de mensalidade em dia UTC. |
| `template.yaml:387` `cron(0 9 * * ? *)` | Job diário às 09:00 UTC = 06:00 BRT. Para o Japão isso é 18:00 — o aviso de "vence amanhã" chega no fim do dia. |
| `AgendaPage.tsx:71` `data_hora_inicio.slice(0, 10)` | **Bug que já existe hoje**: agrupa a agenda por dia UTC enquanto o calendário é local. Compromisso de 21h+ em BRT aparece no dia seguinte. |

O último merece destaque: **não é um problema futuro, é um bug de produção hoje**. Corrigi-lo
faz parte da Fase 0 e se paga sozinho.

---

## 3. Modelo de dados — onde mora locale, fuso e unidade

Princípio que atravessa tudo: **o armazenamento é canônico e único; a conversão é sempre na
apresentação.**

- Instantes: **sempre UTC ISO-8601 com `Z`**. Nunca gravar offset fixo, nunca gravar hora local.
- Medidas: **sempre métrico** (kg, cm, km). `lb`/`in`/`mi` são camada de exibição.
- Dinheiro: **sempre inteiro em centavos + código ISO-4217** ao lado. Nunca float, nunca moeda
  implícita.
- Datas "de calendário" que não são instantes (vencimento de mensalidade, data de avaliação,
  data de nascimento, `data_inicio`/`data_fim` de treino) continuam `YYYY-MM-DD` — mas passam a
  ser interpretadas **no fuso do dono do dado**, não em UTC.

### 3.1 Novos campos

**Perfil do personal** (`PT#{personal_id}` / `PROFILE`, modelo em `routers/personal.py`):

| Campo | Tipo | Default | Nota |
|---|---|---|---|
| `locale` | `str` | `"pt-BR"` | BCP-47. Idioma da interface **e** dos textos que o sistema gera para ele (notificação, push, e-mail, instruções MCP). |
| `timezone` | `str` | `"America/Sao_Paulo"` | **Nome IANA, nunca offset.** DST existe nos EUA e na UE; offset fixo quebra duas vezes por ano. |
| `unidades` | `"METRICO" \| "IMPERIAL"` | `"METRICO"` | Só exibição. |
| `moeda` | `str` | `"BRL"` | ISO-4217. Moeda em que ele cobra os alunos e anuncia na loja. |
| `pais` | `str` | `"BR"` | ISO-3166-1 alfa-2. Decide trilho de pagamento, jurisdição dos termos e catálogo de preço. |

**Perfil do aluno** (`AL#{aluno_id}` / `PROFILE`, `models/aluno.py`):

| Campo | Tipo | Default | Nota |
|---|---|---|---|
| `locale` | `str \| None` | `None` → herda do personal | O aluno pode ser estrangeiro do personal. |
| `timezone` | `str \| None` | `None` → herda do personal | **Necessário separado**: aluno que mora/viaja em outro fuso é caso real, e é o fuso dele que define "o dia do treino". |
| `unidades` | `str \| None` | `None` → herda do personal | Um personal métrico pode ter aluno americano. |

Resolução em cascata, num único helper (`services/locale_service.py`):
`valor explícito do aluno → valor do personal → default do sistema`.

**Pacote da loja** (`models/loja.py`): adicionar `idioma: str` e `moeda: str`. Um pacote de
treinos escrito em português é inútil para um comprador americano — a loja precisa **filtrar por
idioma**, não só traduzir os botões.

### 3.2 Como descobrir o fuso e o idioma na primeira vez

- **Frontend**: `Intl.DateTimeFormat().resolvedOptions().timeZone` e `navigator.language` dão o
  palpite. Preencher o formulário de cadastro com eles já selecionados, **nunca** aplicar em
  silêncio sem mostrar — o usuário precisa ver e poder trocar.
- **Backend**: `Accept-Language` serve como fallback para respostas síncronas de request. **Não
  serve** para push/e-mail/notificação, que são assíncronos e precisam do `locale` gravado no
  perfil do destinatário.
- **Aluno**: o app do aluno entra por link com token (`aluno_auth.redeem_token`), sem tela de
  cadastro. Na primeira sessão, mandar o `timeZone` e o `language` detectados no
  `POST /v1/aluno/auth/redeem` e gravar se o perfil ainda não tiver — com opção de trocar em
  "Meu perfil".

### 3.3 Onde configurar (UI)

- **Portal → Configurações** (`pages/SettingsPage.tsx`, 702 linhas): nova seção
  "Idioma e região" com idioma, fuso, unidades, moeda e país. É a página natural, já existe.
- **Portal → cadastro/edição do aluno** (`pages/AlunoDetailPage.tsx`): fuso/unidade/idioma do
  aluno, cada um com a opção "igual ao meu" como default explícito.
- **App do aluno → perfil**: idioma, fuso e unidades. Precisa ser acessível ao aluno porque é
  ele quem sabe onde mora.
- **Seletor de idioma na landing** — necessário para SEO e para quem chega pelo domínio errado.

---

## 4. Fuso horário — desenho da solução

Este é o capítulo mais técnico e o de maior risco. Três problemas distintos.

### 4.1 Agregados pré-calculados em dia UTC

`STATS#D#{dia}`, `STATS#W#{semana}` e `dow_{n}` são incrementados na escrita
(`sessao_service.py:466-505`) usando dia/semana **UTC**. Não dá para "converter na leitura":
o dado já foi somado no balde errado.

**Solução recomendada — calcular o balde no fuso do aluno, no momento da escrita.**

```
dia_local  = instante_utc → ZoneInfo(tz_do_aluno) → date().isoformat()
semana_local = mesma coisa → isocalendar()
```

O formato da chave não muda (`STATS#D#2026-09-02`), só o valor passa a ser o dia local. Nenhuma
migração de schema, nenhum GSI novo, nenhum custo extra de RCU/WCU.

**Consequência a aceitar conscientemente**: se o aluno trocar de fuso, o histórico agregado
continua nos baldes do fuso antigo. É o comportamento certo — o treino aconteceu de manhã no
Brasil e continua tendo sido de manhã no Brasil. Documentar e não tentar reprocessar.

**Dado já existente**: fica no dia UTC. Para BR (UTC-3) o desvio é de até 3h — só sessões
iniciadas depois das 21h caem no dia errado, e apenas no histórico anterior à mudança. Não vale
migração; vale uma nota no changelog.

### 4.2 `date.today()` no backend

`pendencia_service.hoje_iso()` e os 5 pontos de `financeiro_service` usam `date.today()`, que na
Lambda é UTC. Todos passam a receber o fuso do dono:

```python
def hoje_no_fuso(tz: str) -> str:
    return datetime.now(ZoneInfo(tz)).date().isoformat()
```

`pendencia_service` já recebe `hoje` como parâmetro em quase todas as funções internas — a
mudança fica quase toda em `hoje_iso()` e nos dois pontos que a chamam.

> **Nota de runtime**: adicionar `tzdata` ao `requirements.txt`. O runtime Python da Lambda tem
> `zoneinfo` no stdlib, mas depender da base de fusos do sistema no container é frágil; o pacote
> `tzdata` custa ~600 KB no layer e elimina a dúvida.

### 4.3 Jobs agendados

**`scheduler.py` (diário, `cron(0 9 * * ? *)`)** — hoje dispara tudo no mesmo instante mundial.
Avisos de vencimento e cobrança precisam chegar de manhã **local**.

Recomendação: **unificar com o padrão que `sessao_scheduler.py` já usa** — partição por dia UTC,
SK carregando o instante de disparo, e o job varrendo `query_between(prefixo, prefixo + agora)`.

- Na hora de **agendar** o item, converter "06:00 do dia D no fuso do personal" para instante UTC
  e usar esse instante tanto na partição (`SCHED#{dia_utc_do_disparo}`) quanto no SK.
- Trocar o EventBridge de `cron(0 9 * * ? *)` para `rate(1 hour)`.
- A janela retroativa de 30 dias (`_JANELA_DIAS`) continua valendo e cobre Lambda fora do ar.

Custo: 24 invocações/dia em vez de 1, cada uma varrendo uma partição pequena. Irrelevante frente
ao free tier — e resolve o problema para todos os fusos de uma vez, sem job por região.

**`agenda_scheduler.py` e `sessao_scheduler.py`**: já corretos, nada a fazer. Vale um teste
explícito confirmando isso, para ninguém "consertar" o que não está quebrado.

### 4.4 Frontend

`utils/datetime.ts` já faz a coisa certa em espírito — recorta o dia/semana **no fuso do
aparelho**, com comentários explicando o porquê. O problema é que "fuso do aparelho" e "fuso
configurado do usuário" divergem quando o aluno viaja.

Mudança: essas funções passam a receber o fuso como parâmetro (vindo de um `LocaleContext`), com
o fuso do aparelho como fallback. E `AgendaPage.tsx:71` deixa de usar `.slice(0, 10)` e passa a
usar `diaLocalIso()` — que já existe no arquivo e já faz certo.

### 4.5 Testes a criar

- Sessão às 23h em UTC+9 e às 01h em UTC-10 caem no dia local certo em `STATS#D#`.
- Segunda-feira 07:00 em UTC+12 conta na semana ISO local, não na anterior.
- Cobrança com vencimento `2026-03-10` para um personal em `America/New_York` vira `VENCIDA` no
  instante certo — **atravessando a virada do DST americano em março**.
- Agrupamento da agenda: compromisso 22:00 BRT aparece no dia do compromisso.

---

## 5. Infraestrutura de i18n

### 5.1 Frontend

**Recomendação: `t()` próprio, ~1 KB, sem lib externa.**

Motivo: o projeto já é sensível a bundle no app do aluno — há comentário explícito em
`vite.config.ts` sobre precache travando install em rede móvel, e code-splitting agressivo em
`App.tsx`. `react-i18next` + `i18next` custam ~25 KB gzip em todo entrypoint. `Intl.PluralRules`,
`Intl.DateTimeFormat`, `Intl.NumberFormat` e `Intl.RelativeTimeFormat` são nativos e cobrem
plural, data, número e "há 3 dias" sem dependência nenhuma.

Desenho:

```
frontend/src/i18n/
  index.ts          # t(), LocaleProvider, useLocale()
  formato.ts        # data, hora, número, moeda, unidade — via Intl, nunca literal
  catalogos/
    pt-BR/portal.json  aluno.json  loja.json  divulgador.json  landing.json
    en-US/…
```

- **Um catálogo por app** (portal, aluno, loja, divulgador, landing), carregado por `import()`
  dinâmico no entrypoint. O aluno não baixa as strings do portal — mesma lógica do
  code-splitting que já existe.
- Chaves **semânticas com namespace**: `aluno.sessao.finalizar`, não `botao_1`.
- Interpolação simples `{nome}` + `Intl.PluralRules` para contagem. Sem ICU completo.
- `pt-BR` é o catálogo de referência; chave faltando em outro idioma cai em pt-BR e loga em dev.

**Ferramental que precisa existir junto** (sem isso a Fase 2 apodrece em 3 meses):
- Script `npm run i18n:check` — falha se houver chave usada e não declarada, ou declarada e não
  usada, ou presente em pt-BR e ausente em en-US.
- Regra de ESLint contra literal de texto em JSX. É o que impede a regressão.

**Alternativa considerada e descartada**: `react-i18next`. Melhor ecossistema e ferramentas
maduras, mas o custo de bundle no app do aluno e o fato de o catálogo ser simples (sem ICU,
sem gênero, sem contexto complexo) não justificam. Se o terceiro/quarto idioma trouxer regras de
plural que o `Intl.PluralRules` não resolva, migrar então — a camada `t()` isola isso.

### 5.2 Backend

Duas categorias, tratamento diferente:

**(a) Erro de API → vira código, o frontend traduz.**
Generalizar o padrão que `routers/personal.py` já usa. Os 59 `detail=` viram:

```python
raise HTTPException(422, {"code": "SLUG_INVALIDO", "params": {"min": 3, "max": 30}})
```

O texto sai do backend inteiro. `utils/erroApi.ts` (já existe) passa a mapear código → chave de
catálogo. Isso é bom independentemente de i18n: hoje o frontend não tem como reagir
programaticamente a um erro sem comparar string em português.

**(b) Notificação, push, e-mail → catálogo de templates no backend.**

Este é o ponto de desenho mais importante do backend. Hoje `notif_service.criar()` e
`anotif_service.criar()` **persistem o título e a mensagem já renderizados em português** no
DynamoDB. Se o usuário trocar de idioma, o histórico continua em português para sempre — e a
tradução no momento da leitura é impossível.

Mudança: persistir **`tipo` + `params`**, e renderizar na leitura, no locale de quem lê.

```python
# antes
notif_service.criar(personal_id, "TREINO_FIM", "Treino vence amanhã", f"O treino '{t}' de {n}…")

# depois
notif_service.criar(personal_id, "TREINO_FIM", params={"treino": t, "aluno": n, "data": d})
```

- Os campos `titulo`/`mensagem` **continuam sendo gravados** com o render em pt-BR. Servem de
  fallback para os itens antigos e para qualquer tipo ainda não migrado. Notificação tem TTL de
  30 dias (`NOTIF_TTL_S`), então o legado se resolve sozinho em um mês — **sem migração**.
- O push (`push_service`) é renderizado no envio, usando o `locale` gravado no perfil do
  destinatário — não o `Accept-Language` da request que originou o evento.

**(c) Cognito.** O `UserPool` em `template.yaml:180` não customiza template de e-mail — usa o
padrão da AWS, que segue o locale do navegador no fluxo hospedado, mas os e-mails transacionais
(verificação, recuperação de senha) saem em inglês genérico. Para um produto sério em dois
idiomas: definir `VerificationMessageTemplate` e usar um **Custom Message Lambda trigger**, que
lê o locale do atributo do usuário e devolve o corpo no idioma certo. Fase 3.

### 5.3 O que **não** se traduz

Fronteira que precisa estar clara desde o começo, senão o escopo explode:

- **Dado do usuário**: nome de exercício, nome de treino, observação, anamnese, chat, post do
  feed, nome de pacote da loja. É conteúdo do personal, escrito por ele, no idioma dele.
- **Biblioteca de exercícios**: é dado do personal. O que precisa de versão em inglês é a
  **biblioteca-semente gratuita** (`coachpilot_essencial_biblioteca_gratuita_completa.json`,
  70 KB) — que é conteúdo nosso oferecido no onboarding.
- **Grupos musculares**: `models/grupos_musculares.py` tem um `VOCABULARIO` de 15 strings de
  exibição ("Peito", "Quadríceps") que são **gravadas no item** e normalizadas para a SK. Não é
  enum fechado — o personal pode digitar o próprio grupo. Recomendação: adicionar um código
  canônico (`CHEST`, `QUADS`) com mapa de exibição por idioma para os 15 do vocabulário,
  **preservando o texto livre** para o resto. Sem isso, um personal americano vê "Quadríceps"
  no seletor. Com isso, o gráfico de volume continua agregando certo entre idiomas.

---

## 6. Moeda, preço e pagamento

O eixo mais bloqueante comercialmente, e o único que não é resolvível só com código nosso.

### 6.1 Assinatura da plataforma (nós cobramos o personal)

Hoje: `assinatura_service.py` tem catálogo fixo `{"preco": "39.90", "preco_anual": "399.00"}` e
`mp_assinatura_service.criar_pix()` é o único trilho.

Mudanças:
- Catálogo vira **por país/moeda**, não valor único. `R$ 39,90/mês` não é `US$ 39,90/mês` — é
  decisão de posicionamento, não de câmbio (ver `estrategia/PLANO_NEGOCIO.md`).
- Novo provedor: **Stripe** para fora do Brasil (cartão, Apple Pay, Google Pay, cobrança
  recorrente de verdade — hoje o PIX obriga renovação manual). `mp_assinatura_service` e um novo
  `stripe_assinatura_service` atrás de uma interface comum; o roteamento é pelo `pais` do perfil.
- Webhook do Stripe: **Lambda separada**, não no handler principal — mesmo raciocínio do item 7
  de `docs/PERFORMANCE_ESCALA.md`.

### 6.2 Cobrança do personal ao aluno

Hoje o personal pluga o **próprio** access token do Mercado Pago (`routers/config.py`
`PUT /v1/config/mercadopago`) e o dinheiro vai direto para ele. Fora do Brasil isso não existe.

Recomendação para a Fase 5: **fora do BR, só o modo MANUAL** — que o sistema já suporta
inteiro (`FormaPagamento.MANUAL`). O personal registra o recebimento; toda a régua de
vencimento, atraso e lembrete continua funcionando. Stripe Connect é um projeto com peso próprio
(onboarding KYC, split, payout, compliance) e não deve entrar no caminho crítico do lançamento
em inglês.

### 6.3 Loja / marketplace

`models/loja.py`: `preco_centavos` ganha `moeda` ao lado, e o teto `le=500000` deixa de ser
"R$ 5.000" para virar limite por moeda. Anúncio ganha `idioma` (§3.1) e a vitrine filtra por ele.

---

## 7. Conteúdo público, SEO e domínio

**Isto é redação, não engenharia** — e é o maior volume absoluto de palavras do projeto.

- **Não traduzir slug mecanicamente.** `/software-para-personal-trainer` não vira
  `/software-for-personal-trainer` por tradução: a página em inglês precisa ser escrita a partir
  de pesquisa de palavra-chave do mercado alvo. `publicSeoData.js` (815 linhas) e `blogData.js`
  (1.216 linhas) são **conteúdo novo**, não tradução.
- `scripts/prerender-public-pages.mjs` precisa gerar por idioma, e o `sitemap.xml` precisa de
  `hreflang` recíproco entre as versões. A lista `PRERENDERED` na CloudFront Function
  (`template.yaml:556`) tem que crescer junto — o comentário no código já avisa disso.
- Manuais (`public/ajuda-portal.md` 928 linhas, `ajuda-aluno.md` 459): traduzir de fato, com
  revisão humana. São o material de suporte.
- **Webmanifests** (`manifest.webmanifest`, `aluno.webmanifest`, `loja.webmanifest`,
  `divulgador.webmanifest`): nome e descrição em português. PWA não tem manifest por idioma —
  ou servem-se manifests diferentes por distribuição/domínio, ou o nome do app fica neutro
  ("CoachPilot" / "CoachPilot Training").
- **`<html lang>`** nos 4 HTMLs precisa ser definido em runtime pelo locale resolvido.
- **`_ALUNO_ORIGIN = "app.coachpilot.com.br"`** (`routers/aluno.py:29`) é uma checagem de origem
  hardcoded. Vira lista de origens permitidas quando existir domínio internacional.
- **Quatro distribuições CloudFront** hoje (portal, aluno, loja, divulgador). Se D1 for
  "domínio separado por idioma", isso dobra para oito, e o `deploy.ps1` precisa invalidar todas —
  a regra do CLAUDE.md sobre invalidar as quatro juntas vale igual para oito.

---

## 8. IA, MCP e prompts

- **`INSTRUCOES_SERVIDOR`** (`backend/app/mcp/tools.py:43`) e as descrições de todas as tools
  estão em português. O LLM entende, mas as instruções guiam comportamento e ficam melhores no
  idioma do personal. Recomendação: renderizar as instruções e as descrições no `locale` do
  tenant, resolvido do token — o `personal_id` já vem do `ContextVar`, o `locale` vai junto.
- **`guia_de_prescricao`** e `prompts/montar_treino.md`: precisam de versão en-US. Atenção à
  regra do CLAUDE.md — o corpo de `backend/app/mcp/prompts/montar_treino.md` é **byte-idêntico**
  a `frontend/public/prompt-treino-aluno.md`, garantido por `test_mcp_prompt_sync.py`. Esse teste
  precisa passar a validar **o par por idioma**, não um par único.
- **`prompt-cpkg.md`** (378 linhas): idem.
- **Mensagens de erro de validação** (`validacao_programa.py`, `validacao_pacote.py`) voltam para
  o LLM e para o portal. Como §5.2(a): código + params, texto no cliente.
- **`llm_agent.py` / `agent_service.py`** (agente de WhatsApp, hoje "em breve"): system prompt em
  português. Fora do caminho crítico enquanto o add-on não estiver ativo, mas anotado.

### Jurídico (bloqueante para lançar)

Já existe pendência registrada no CLAUDE.md sobre termos cobrindo envio de dado de saúde. Ela
**cresce** com a internacionalização:

- **UE**: dado de saúde é categoria especial (GDPR Art. 9) e exige consentimento explícito;
  transferência para `us-east-1` exige SCC. Isso é o que torna a UE um mercado mais caro que os
  EUA — argumento a favor de fazer **en-US antes de qualquer país europeu**.
- **EUA**: HIPAA em geral não alcança personal trainer (não é covered entity), mas CCPA/CPRA na
  Califórnia sim. Termos e privacidade precisam de versão em inglês redigida para a jurisdição,
  não traduzida da brasileira.
- `estrategia/juridico/` já tem as minutas em pt-BR — a versão internacional é trabalho de
  advogado, não de tradução.

---

## 9. Fases

Cada fase é entregável e deployável sozinha. Nenhuma depende de a seguinte existir.

---

### Fase 0 — Fundação de formatos e correção de bugs de fuso
**Sem nenhuma mudança visível de idioma. Só correção.**

1. `frontend/src/i18n/formato.ts`: `formatarData`, `formatarHora`, `formatarNumero`,
   `formatarMoeda`, `formatarPeso`, `formatarDistancia`, `tempoRelativo` — todos via `Intl.*`,
   recebendo locale/fuso/unidade. `utils/currency.ts` passa a delegar.
2. Trocar as **83 ocorrências de `'pt-BR'` nos 44 arquivos** e as 68 chamadas `toLocale*` por
   chamadas ao módulo novo. Nesta fase o locale ainda é constante `'pt-BR'` — é refatoração pura.
3. **Corrigir `AgendaPage.tsx:71`** (`.slice(0,10)` → `diaLocalIso`). Bug de produção hoje.
4. Adicionar `LocaleContext` no frontend, alimentado por constante — o encanamento existe, o
   valor ainda não varia.
5. Adicionar `tzdata` ao `requirements.txt` e criar `services/locale_service.py` com a cascata de
   resolução (ainda devolvendo sempre o default).

**Aceite**: build passa, nenhum teste quebra, a agenda mostra compromissos noturnos no dia certo,
`grep -r "pt-BR" frontend/src` só encontra o default no módulo de formato.

---

### Fase 1 — Fuso horário por usuário

1. Campos `timezone`, `locale`, `unidades`, `moeda`, `pais` no perfil do personal; `timezone`,
   `locale`, `unidades` no do aluno (§3.1), com cascata em `locale_service`.
2. UI de configuração em `SettingsPage`, no cadastro do aluno e no perfil do app do aluno (§3.3),
   com detecção via `Intl.DateTimeFormat().resolvedOptions().timeZone` como sugestão visível.
3. `STATS#D#`, `STATS#W#` e `dow_` passam a usar dia/semana **local do aluno** (§4.1).
4. `date.today()` → `hoje_no_fuso(tz)` em `pendencia_service` e `financeiro_service` (§4.2).
5. `scheduler.py` migra para o padrão instante-de-disparo; EventBridge vira `rate(1 hour)` (§4.3).
6. `utils/datetime.ts` recebe fuso por parâmetro; `LocaleContext` passa a alimentar de verdade.
7. Bateria de testes de fuso de §4.5, incluindo o caso de DST americano.

**Aceite**: conta de teste em `Asia/Tokyo` e outra em `America/Los_Angeles` — dashboard, streak,
pendências, vencimento e avisos batem com o calendário local em ambas. Conta brasileira
inalterada.

**Risco**: é a fase que mexe em caminho de escrita quente (`sessao_service.finish`). Fazer com
teste antes, e conferir que o agregado antigo continua legível.

---

### Fase 2 — Infraestrutura de i18n no frontend (só pt-BR)

1. `i18n/index.ts` com `t()`, provider e carregamento de catálogo por app (§5.1).
2. Extração das ~2.500–3.500 strings para os catálogos pt-BR. **Maior esforço bruto do plano.**
   Ordem sugerida, por valor decrescente: `pages/AlunoApp.tsx` (2.391 linhas — é o app do
   aluno, o que mais gente vê) → `AlunoDetailPage` (1.658) → `components/` → `auth/` →
   `SettingsPage` → resto.
3. `npm run i18n:check` no CI e regra de ESLint contra literal em JSX.
4. `<html lang>` definido em runtime.

**Aceite**: `i18n:check` verde, ESLint sem literal em JSX, **nenhuma diferença visual** — a UI
continua idêntica em português. Diff enorme, comportamento zero.

---

### Fase 3 — Infraestrutura de i18n no backend (só pt-BR)

1. Os 59 `detail=` viram `{code, params}`; `utils/erroApi.ts` mapeia código → catálogo (§5.2a).
2. `notif_service` / `anotif_service` passam a persistir `tipo` + `params`, com render na leitura
   e `titulo`/`mensagem` mantidos como fallback do legado (§5.2b). 76 pontos de chamada.
3. `push_service` renderiza no locale do destinatário.
4. Custom Message Lambda trigger no Cognito para e-mail transacional por idioma (§5.2c).
5. Código canônico para os 15 grupos musculares do `VOCABULARIO`, texto livre preservado (§5.3).

**Aceite**: notificação nova nasce estruturada; notificação antiga ainda renderiza; o texto em
português é byte-idêntico ao de antes.

---

### Fase 4 — Inglês (en-US)

1. Tradução dos catálogos de frontend e backend, com revisão de falante nativo — a terminologia
   de treino tem armadilha (série ≠ *series*, é *set*; carga = *load/weight*; RPE mantém sigla).
2. Unidades imperiais na exibição: lb, in, mi, ft (armazenamento segue métrico).
3. Formato de data `MM/DD/YYYY` e semana começando no **domingo** — `utils/datetime.ts`
   `inicioSemanaLocal()` assume segunda hoje; passa a vir do locale.
4. Biblioteca-semente gratuita em inglês.
5. `guia_de_prescricao`, `montar_treino.md` e `prompt-cpkg.md` em inglês, com o teste de sincronia
   estendido por idioma (§8).
6. Landing, páginas SEO e blog em inglês — **conteúdo novo** (§7). `hreflang` e sitemap.
7. `ajuda-portal.md` e `ajuda-aluno.md` traduzidos.
8. Termos e privacidade em inglês, redigidos para a jurisdição (§8).
9. Domínio conforme D1, distribuições CloudFront e `deploy.ps1` atualizado.

**Aceite**: um personal americano faz cadastro, cria aluno, monta treino pelo ChatGPT via MCP,
o aluno executa no app — tudo em inglês, tudo em fuso e unidade locais, sem uma palavra de
português na tela.

---

### Fase 5 — Comercial internacional

1. Catálogo de preço por país/moeda.
2. Stripe para assinatura fora do BR, atrás de interface comum com o Mercado Pago (§6.1).
3. Webhook Stripe em Lambda separada.
4. Cobrança personal→aluno em modo MANUAL fora do BR (§6.2).
5. `moeda` e `idioma` no anúncio da loja; filtro por idioma na vitrine (§6.3).

**Aceite**: assinatura paga com cartão internacional, ativa o plano, e a loja não mostra pacote
em português para comprador em inglês.

---

### Fase 6 — Terceiro idioma (recomendação: es-419)

Prova a maquinaria. Espanhol LatAm é o próximo mercado mais próximo — `PhoneInput.tsx` já lista
AR, MX, CO, CL e ES, e o `estrategia/ANALISE_MERCADO_CONCORRENTES.md` já é sobre um mercado
adjacente. Se as fases 2 a 4 foram feitas direito, o custo aqui é **só tradução e conteúdo**, sem
tocar em código de produto. Se doer, é sinal de que algo vazou de volta para o código — e o
diagnóstico é a própria Fase 6.

---

## 10. Riscos e pontos de atenção

| Risco | Mitigação |
|---|---|
| **Fase 2 é um diff gigante que colide com desenvolvimento normal** | Fatiar por diretório e mergear rápido; não deixar branch viver mais de uma semana. |
| **Agregado em fuso local muda caminho de escrita quente** | Teste antes de mexer; `sessao_service.finish` é o coração do app do aluno. |
| **Tradução mecânica de termo técnico de treino** | Revisão por profissional de educação física que fale inglês, não só tradutor. |
| **SEO em inglês tratado como tradução** | Orçar como criação de conteúdo. Sem isso, gasta-se a Fase 4 para não ranquear. |
| **Strings novas nascendo hardcoded durante as fases** | A regra de ESLint da Fase 2 é o que impede — é ferramenta, não disciplina. |
| **`prompt-treino-aluno.md` e o espelho no MCP** | O teste de sincronia byte-idêntica precisa virar por-idioma **na mesma PR** que criar o arquivo em inglês, senão quebra o CI. |
| **Custo AWS** | Praticamente nulo: 23 invocações extras/dia no scheduler, alguns KB de catálogo. Distribuições CloudFront adicionais (se D1 = domínio separado) são o único custo real, e é baixo. |
| **Conta demo (`demo@coachpilot.com.br`)** | O seed cria dados em português. Fase 4 precisa de uma conta demo em inglês, ou `scripts/seed_demo_conta.py` parametrizado por idioma — é a conta usada em demo para prospect. |

---

## 11. Anexo — inventário de pontos de mudança

### Frontend

| Arquivo | O quê |
|---|---|
| `src/utils/currency.ts` | BRL cravado |
| `src/utils/datetime.ts` | Semana começa na segunda; `pt-BR` no dia da semana; fuso do aparelho |
| `src/pages/AgendaPage.tsx:71` | **Bug**: agrupa por dia UTC |
| `src/pages/AgendaPage.tsx:146,274` | `toLocaleTimeString('pt-BR')`, construção de instante |
| `src/components/historico/HistoricoLista.tsx:101` | `toLocaleString('pt-BR')` |
| `src/pages/SettingsPage.tsx` | Onde entra a seção "Idioma e região" |
| `src/pages/AlunoApp.tsx` (2.391 linhas) | Maior concentração de string do projeto |
| `src/calc/*.ts` | Labels de protocolo e sítio de dobra; unidades |
| `src/pages/landing/publicSeoData.js` (815) e `blogData.js` (1.216) | Conteúdo SEO |
| `scripts/prerender-public-pages.mjs` | Meses em português; gerar por idioma; `hreflang` |
| `index.html`, `aluno.html`, `loja.html`, `divulgador.html` | `lang="pt-BR"` |
| `public/*.webmanifest` (4) | Nome/descrição em português |
| `public/ajuda-portal.md` (928), `ajuda-aluno.md` (459) | Manuais |
| `public/prompt-treino-aluno.md` (433), `prompt-cpkg.md` (378) | Prompts (espelhados no backend) |
| 44 arquivos com `'pt-BR'` / 68 `toLocale*` | Migração para `i18n/formato.ts` |

### Backend

| Arquivo | O quê |
|---|---|
| `app/services/sessao_service.py:466-505` | `STATS#D#`, `STATS#W#`, `dow_` em dia/semana UTC |
| `app/routers/dashboard.py:34-42,66,86` | Janelas 7/14 dias em dia UTC |
| `app/services/pendencia_service.py:41` | `date.today()` em UTC |
| `app/services/financeiro_service.py` (5 pontos) | `date.today()` em UTC |
| `app/scheduler.py` | Diário 09:00 UTC → instante de disparo por fuso |
| `template.yaml:387` | `cron(0 9 * * ? *)` → `rate(1 hour)` |
| `template.yaml:180` | UserPool sem template de e-mail por idioma |
| `app/services/notif_service.py`, `anotif_service.py` | Texto renderizado persistido |
| `app/services/push_service.py` | Render no locale do destinatário |
| `app/routers/*.py` (59 `detail=`) | Texto de erro → código |
| `app/models/avaliacao.py` | `altura_cm` — unidade no nome do campo |
| `app/models/loja.py` | `preco_centavos` sem moeda; falta `idioma` |
| `app/services/assinatura_service.py:28` | Catálogo de preço fixo em BRL |
| `app/services/mp_service.py`, `mp_assinatura_service.py` | PIX Brasil-only |
| `app/models/grupos_musculares.py` | `VOCABULARIO` de exibição persistido |
| `app/mcp/tools.py:43` | `INSTRUCOES_SERVIDOR` + descrições das tools |
| `app/mcp/prompts/montar_treino.md` | Espelho byte-idêntico do arquivo do frontend |
| `app/services/validacao_programa.py`, `validacao_pacote.py` | Mensagens de validação |
| `app/routers/aluno.py:29` | `_ALUNO_ORIGIN` hardcoded |
| `app/services/llm_agent.py`, `agent_service.py` | System prompt do agente WhatsApp |
| `requirements.txt` | Falta `tzdata` |
| `scripts/seed_demo_conta.py` | Conta demo em português |

### Estratégia / conteúdo

`estrategia/juridico/` (minutas pt-BR), `estrategia/PLANO_NEGOCIO.md` (preço por mercado),
`estrategia/SEO_PLANO_ACAO.md` (equivalente para o mercado alvo),
`estrategia/kit-divulgador/` e `estrategia/comercial/` (material de venda).
