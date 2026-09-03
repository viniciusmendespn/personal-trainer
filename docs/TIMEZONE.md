# Fuso horário — modelo, decisões e plano

> Documento de referência. Define como o CoachPilot trata tempo, para que o sistema funcione em
> qualquer fuso sem correção caso a caso. Substitui o §4 de `PLANO_INTERNACIONALIZACAO.md`.
> Escrito em 2026-09-03.

---

## 1. O princípio está certo — mas ele só cobre uma das quatro categorias

"Armazenar tudo em UTC e converter na exibição" é a regra correta, e é a que o backend já segue.
Ela não é suficiente sozinha porque **"tempo" não é um tipo só**. São quatro, e cada um tem uma
regra de armazenamento diferente. Confundi-los é a origem de praticamente todo bug de fuso.

### 1.1 Instante — um ponto na linha do tempo universal

> "a sessão terminou neste momento", "esta notificação foi criada neste momento"

Campos: `data_hora_inicio`/`data_hora_fim` de sessão, `created_at`, `updated_at`, `data_hora` de
notificação, `ultimo_treino`.

**Regra: UTC, ISO-8601 com `Z`. Converter no momento de exibir.** É exatamente a sua intuição, e
o backend já faz isso corretamente via `utils.now_iso()`. **Nada a mudar aqui.**

### 1.2 Data civil — uma data no calendário de alguém, sem hora

> "a mensalidade vence dia 10 de setembro"

Campos: `vencimento` de cobrança, `data_nascimento`, `data_inicio`/`data_fim` de treino, `data`
de avaliação, `dia_vencimento`.

**Regra: `YYYY-MM-DD` puro. NUNCA converter para instante UTC.**

Aqui é onde aplicar "tudo em UTC" ao pé da letra **causaria** um bug em vez de evitar. Dia 10 de
setembro em Tóquio e dia 10 de setembro em Los Angeles são instantes diferentes, mas são a mesma
data civil. Não existe "10 de setembro em UTC" — a pergunta não faz sentido. Uma cobrança vence
no dia 10 do calendário de quem cobra, e ponto.

O bug atual não está no armazenamento (que já está certo), está na **comparação**: o código
compara essas datas com `date.today()`, que na Lambda é o dia UTC.

### 1.3 Evento futuro com hora local — um compromisso

> "treino às 8h da manhã do dia 15 de março"

Campo: `data_hora_inicio` de agendamento.

**Regra rigorosa: hora local + nome da zona.** O motivo é que governos mudam regra de horário de
verão — quando isso acontece, o instante UTC congelado passa a apontar para a hora local errada.
Quem marcou 8h da manhã queria 8h da manhã, não "13h UTC".

**Decisão para o CoachPilot: manter o instante UTC.** Os agendamentos aqui são de curto prazo
(dias/semanas) e não recorrentes; o risco de uma mudança de regra de DST cair no meio é
desprezível, e o instante UTC simplifica o lembrete de 15 min, que já está correto. **Limitação
assumida e registrada** — se um dia existir agendamento recorrente ou marcado com meses de
antecedência, esta decisão precisa ser revista.

### 1.4 Balde agregado — um contador indexado por dia ou semana

> "quantas sessões aconteceram no dia 2 de setembro"

Campos: `STATS#D#{dia}`, `STATS#W#{semana}`, `dow_{n}`, `streak_ultima_semana`.

**Isto não é armazenamento de tempo. É um índice derivado**, e é a única categoria onde a regra
"UTC e converte depois" **não pode** ser aplicada. A §2 explica por quê.

---

## 2. Por que o contador é a única exceção real

Um instante pode ser convertido para qualquer fuso na leitura porque ele **carrega a informação
inteira**: `2026-09-08T00:30:00Z` sabe dizer que é 21h30 do dia 7 em São Paulo e 9h30 do dia 8
em Tóquio. Nada se perdeu.

Um contador não. Quando o código faz:

```python
repo.add_and_set(pk_personal, f"STATS#D#{dia}", add={"sessoes": 1})
```

...o `ADD` soma 1 e **descarta qual sessão era**. Depois disso, `STATS#D#2026-09-08 = 7` é tudo
o que existe. Um dia UTC cobre pedaços de dois dias locais, e não há como saber que as 7 sessões
se dividem em 5 de um dia local e 2 do outro. **A informação foi destruída na escrita.**

Daí a consequência: para contador, ou você **não pré-agrega** (e paga o custo de derivar dos
dados brutos na leitura), ou você **agrega no fuso certo desde a escrita**. Não existe terceira
opção.

Então a pergunta certa não é "como converter o contador depois", é: **quais contadores precisam
mesmo existir?**

| Agregado | Dá para derivar na leitura? | Decisão |
|---|---|---|
| `historico_mes` (calendário do aluno) | **Sim** — já lê as sessões brutas da partição `AL#` e agrupa na hora. Não é pré-agregado, apesar de parecer. | **Converter na leitura.** Retroativo de graça. |
| `STATS#D#` (gráfico do dashboard) | **Não** — as sessões moram em `AL#{aluno}`, então derivar exigiria fan-out por toda a carteira. É exatamente o N+1 que a arquitetura evita (ESPEC §3.1). | Balde na escrita |
| `STATS#W#` + streak | **Não** — é all-time; derivar significa varrer o histórico inteiro a cada leitura. | Balde na escrita |
| `dow_{n}` ("dias que treina") | **Não** — mesmo motivo. | Balde na escrita |

**Isto corrige uma proposta anterior minha, que estava errada.** Eu havia sugerido gravar
`dia_local` no item da sessão para o calendário. Era denormalização desnecessária e pior:
`historico_mes` é caminho de **leitura**, então converter na hora custa quase nada, corrige o
histórico já existente de graça, e — o que mais importa — permite que alguém **conserte** um
fuso configurado errado e veja o passado inteiro se corrigir sozinho. Um `dia_local` gravado
congelaria o erro para sempre.

**Regra geral que sai daí:** derivar na leitura sempre que possível; aceitar balde na escrita só
onde derivar é inviável. Quanto menos coisas bucketizadas na escrita, menor a área irreversível.

---

## 3. O que guardar junto do dado

Nunca uma data derivada. Quando o contexto local de um evento importa, guarda-se **a zona**, não
o resultado da conversão — é isso que "UTC + zona" significa.

Os quatro contadores da §2 precisam saber, no `finish()`, o fuso do aluno (streak, `dow_`,
`STATS#W#`) e o do personal (`STATS#D#`). Hoje `finish()` faz só 2 leituras (os `REG#` e o
`STATS#ALUNO`) e não lê nenhum perfil — é o caminho mais quente do app do aluno.

**Decisão: `start_session()` grava `tz_aluno` e `tz_personal` no item da sessão.** O `finish()`
já tem o dict da sessão em memória, então lê os dois de graça. Iniciar um treino é um caminho
morno que já faz 2 leituras; somar duas leituras pontuais ali é irrelevante e mantém o `finish`
intocado. Bônus: a sessão fica autodescritiva para depuração, e registra o fuso vigente **quando
o treino aconteceu** — que é a semântica certa para quem muda de país.

> Alternativa considerada: `finish()` ler os dois perfis via `BatchGetItem`. Funciona e é mais
> simples, ao custo de uma ida a mais no caminho quente. Se o campo na sessão criar atrito,
> trocar por isto é seguro.

---

## 4. Fuso do sujeito × fuso do leitor

Duas perguntas diferentes que costumam ser confundidas:

- **"De que dia é este dado?"** → fuso do **sujeito** (de quem o dado é).
  O calendário de treinos de um aluno em Tóquio mostra os dias **dele**, mesmo quando quem olha
  é o personal em São Paulo. O treino foi na terça dele.
- **"Que horas isso foi/será, para quem está lendo?"** → fuso do **leitor**.

Regra prática que resolve os casos ambíguos: **o instante se exibe no fuso de quem a frase é
sobre.** "Sua aula às 14h" (push para o personal) → fuso do personal. "João finalizou o treino
às 19h32" → fuso do João.

---

## 5. O modelo de dados

Um campo, dois lugares:

| Onde | Campo | Default | Nota |
|---|---|---|---|
| Perfil do personal (`PT#` / `PROFILE`) | `timezone` | `"America/Sao_Paulo"` | Nome **IANA** |
| Perfil do aluno (`AL#` / `PROFILE`) | `timezone` | `null` → herda do personal | O aluno pode não morar onde o personal mora |

**Sempre nome IANA (`America/Sao_Paulo`), nunca offset (`-3`).** Offset é a forma errada por dois
motivos: quebra no horário de verão (irrelevante no Brasil, obrigatório nos EUA e na Europa) e
não sobrevive a mudança de regra do país. Isto **aposenta o `TZ_OFFSET_HOURS`**, uma env var
global com default `-3` que hoje formata o horário dentro do texto dos pushes
(`agenda_notif_service.py:13` e `sessao_service.py:641`) — global, ela não consegue variar por
usuário, que é exatamente o que precisamos.

Resolução em cascata, num helper único (`services/locale_service.py`):
`timezone do aluno → timezone do personal → default do sistema`.

### Como o fuso é definido

- **Personal**: em Configurações, com `Intl.DateTimeFormat().resolvedOptions().timeZone`
  **sugerido e visível**, nunca aplicado em silêncio.
- **Aluno**: o app entra por link com token, sem tela de cadastro. O `redeem` manda o fuso
  detectado e o backend grava **se ainda não houver um**. O personal também pode definir no
  cadastro, para o aluno que nunca abre o app.
- **Sticky.** Não redetectar a cada acesso: uma viagem de duas semanas reescreveria em silêncio
  onde caem os baldes de streak do aluno. Detecta uma vez, sugere mudança se divergir, e só troca
  se alguém confirmar.

### Modelo mais simples que foi considerado e descartado

Muitos SaaS usam **um fuso por conta** e renderizam tudo nele. É mais simples e dispensa o campo
no aluno. Não serve aqui: o CoachPilot existe em boa parte para treino remoto, então aluno em
outro fuso que o personal não é caso raro — é o caso de uso.

---

## 6. Inventário — cada ponto e o que muda

| Onde | Categoria (§1) | O que muda |
|---|---|---|
| `utils.now_iso()`, todos os `created_at` | Instante | **Nada.** Já correto. |
| `data_hora_inicio` de agendamento | Evento futuro | **Nada.** Limitação assumida (§1.3). |
| `agenda_scheduler.py`, `sessao_scheduler.py` | Instante | **Nada.** Já corretos por construção. |
| `AgendaPage.tsx` | Instante → dia | ✅ Corrigido (dia local do aparelho). Falta passar o fuso **configurado** no lugar do fuso do aparelho. |
| `sessao_service.historico_mes:1248` | Instante → dia | Agrupar no fuso do aluno **na leitura**. Janela da query alargada em ±1 dia. **Corrige o histórico antigo junto.** |
| `routers/dashboard.py:34-42` | Instante → dia | Janelas de 7/14 dias no fuso do personal. |
| `sessao_service:502` `STATS#D#` | Balde | Dia local **do personal** (dono da partição). Escrita. |
| `sessao_service:467` streak / `STATS#W#` | Balde | Semana ISO local **do aluno**. Escrita. |
| `sessao_service:486` `dow_{n}` | Balde | Dia da semana local **do aluno**. Escrita. |
| `pendencia_service.hoje_iso():41` | Data civil | `date.today()` → `hoje_no_fuso(tz_do_personal)`. |
| `financeiro_service` (5 × `date.today()`) | Data civil | Idem. Vencimento e atraso no calendário de quem cobra. |
| `scheduler.py` + `template.yaml:387` | Instante | Item agendado pelo instante de disparo (06:00 local → UTC); EventBridge `cron(0 9)` → `rate(1 hour)`. |
| `agenda_notif_service:13`, `sessao_service:641` | Exibição | Matar `TZ_OFFSET_HOURS`; formatar no fuso do destinatário (§4). |
| `DashboardPage.tsx:43` `ymd` | Balde | UTC de propósito hoje; vira dia local **junto** com `STATS#D#`, nunca antes. |

---

## 7. Plano

Quatro passos. Cada um deployável; nenhum depende do seguinte existir.

### Passo 2 — Fundação
Campo `timezone` (IANA) nos dois perfis, com cascata em `locale_service.py`. `tzdata` no
`requirements.txt`. UI em Configurações, no cadastro do aluno e no perfil do app do aluno, com
detecção sugerida. Aposentar `TZ_OFFSET_HOURS` nos dois pontos que o usam.

*Nada muda de comportamento ainda — só passa a existir a informação.*

### Passo 3 — Leitura (seguro, retroativo)
`historico_mes`, janelas do `dashboard.py`, `pendencia_service.hoje_iso()`, e `AgendaPage`
passando o fuso configurado no lugar do fuso do aparelho.

**Vem antes da escrita de propósito**: é zero-risco, entrega a maior parte do valor visível,
corrige o histórico já gravado de graça, e valida o encanamento do fuso numa superfície onde um
erro não deixa marca permanente.

### Passo 4 — Escrita (o irreversível)
`start_session` grava `tz_aluno`/`tz_personal`; `finish` bucketiza `STATS#D#` no fuso do
personal e `STATS#W#`/streak/`dow_` no do aluno. `DashboardPage.ymd` vira dia local na **mesma**
entrega, senão as duas pontas desalinham.

Caminho quente do app do aluno: teste antes, e conferir que o agregado antigo continua legível.

### Passo 5 — Datas civis e agendamento
`financeiro_service` no fuso do personal; `scheduler.py` migrado para instante de disparo com
EventBridge horário. Deixado por último porque mexe na régua de cobrança e, para o Brasil, o
comportamento atual (06:00 BRT) já está correto — só passa a importar quando existir usuário
fora do fuso.

---

## 8. Testes

- Sessão que termina 23h em UTC+9 e 01h em UTC-10 cai no dia local certo em cada balde.
- Segunda 07:00 em UTC+12 conta na semana ISO local, não na anterior.
- Aluno em `Asia/Tokyo` com personal em `America/Sao_Paulo`: o calendário do aluno mostra os dias
  dele; o gráfico do personal, os dias do personal. Os dois números batem com o esperado.
- Cobrança vencendo `2026-03-10` para personal em `America/New_York` vira `VENCIDA` no instante
  certo, **atravessando a virada do horário de verão** — é o teste que só o nome IANA passa.
- Sessão sem `tz_aluno` (dado antigo) continua legível e cai no comportamento atual.
- `agenda_scheduler` e `sessao_scheduler` permanecem corretos — teste de blindagem, para ninguém
  "consertar" o que não está quebrado.

---

## 9. Erros a não cometer

1. **Guardar offset** (`-3`) em vez de nome IANA. Quebra no horário de verão.
2. **Converter data civil para instante UTC.** Vencimento vira o dia errado em metade do mundo.
3. **`toISOString().slice(0, 10)` como dia de calendário.** É o dia UTC. Use `diaLocal`.
4. **Confiar no fuso do aparelho como valor persistido.** Serve de sugestão, não de verdade.
5. **Redetectar o fuso a cada acesso.** Viagem reescreve histórico em silêncio.
6. **Gravar o dia derivado junto do dado.** Congela o erro; converta na leitura quando der.
7. **Mudar só um lado de um par balde↔leitura.** Os dois viram local na mesma entrega.
