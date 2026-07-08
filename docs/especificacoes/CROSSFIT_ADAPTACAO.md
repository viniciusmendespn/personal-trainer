# Adaptação para CrossFit — Proposta de funcionalidades

> **Status:** ✅ IMPLEMENTADO (2026-07-07) — todas as fases entregues em 8 ondas: blocos com
> formato, score de WOD com PR/evolução, aquecimento em 3 níveis, 2ª métrica, timer de WOD
> (For Time/AMRAP/EMOM), metas com direção MENOR, prompts de IA atualizados e pacote de
> benchmarks (`coachpilot_benchmarks_crossfit.cpkg`). Objetivo: suportar treinos de CrossFit
> **sem perder nada da musculação/performance atual e mudando o mínimo possível**.
>
> Insumos do personal parceiro (atua com cross):
> - Formatos usados: **FOR TIME** (tarefa, às vezes 3–5 rounds), **SKILLS** (movimentos
>   complexos), **STRENGTH** (força, igual musculação), **EMOM** (tarefa a cada 1min / 1:30 /
>   2min) e **AMRAP** (circuito — máximo de rounds e reps).
> - Treinos reais em `exemplo-treinos.txt` — a estrutura observada é decisiva: **um treino é
>   uma sequência de blocos** (ex.: `A) Força 5x5 75–80%` → `B) Potência` → `C) Metcon AMRAP
>   15min`; ou `Aquecimento 2 rounds` → `Corrida 4×8min Zona 3` → `Final 10min Zona 2`).
>   **EMOM alternado** (minuto ímpar/par com tarefas diferentes, ou ciclo de 4 minutos) aparece
>   em 3 dos 5 treinos de exemplo — é padrão, não exceção.

---

## 1. O que o sistema JÁ cobre (não precisa mexer)

| Necessidade do cross | Já existe hoje |
|---|---|
| **STRENGTH** (`Front Squat 5x5 75–80%`) | Tipo `FORCA`: séries × reps · carga, `rm_kg` + %RM, PR de carga. `unidade_carga` livre aceita "%1RM". Zero mudança. |
| **SKILLS** (`8 Pull-ups estritos`) | Exercício `PERFORMANCE` com unidade livre + vídeo + recomendações + substitutos (progressões). Zero mudança. |
| Métricas de metcon (m, kcal, reps, min) | `unidade_reps` é string livre; `SerieExec.reps` é float. `750 m Remo`, `30 kcal Bike` já são representáveis. |
| "Menor é melhor" (tempo de For Time) | `metrica_direcao MAIOR/MENOR` + motor de PR (`STATS#PR#`) já respeitam direção. |
| Prescrição textual livre | `SeriePrescrita.reps` é string livre — aceita "21-15-9", "máx", "60/40kg". |
| Zonas de FC / corrida | PERFORMANCE (unidade "min"/"km") + `observacoes` ("Zona 3 alta, 75–82% FCmáx"). |
| Extensão sem migração | `custom: dict` existe em Treino, Exercicio e Registro. |
| Cronômetro | `CronometroProvider` (regressivo/progressivo, persiste navegação, WakeLock, beep, PiP) — base pronta para os timers de WOD. |

Dos 5 formatos citados, **Strength e Skills já funcionam hoje** sem mudança. O trabalho está nos
metcons (For Time, AMRAP, EMOM) e na **estrutura em blocos** do treino.

## 2. Os gaps reais (à luz dos treinos de exemplo)

1. **Blocos dentro do treino** — exercícios são lista plana por `ordem`. Não dá para representar
   `A) Força → B) Ginástica EMOM 10' → C) Metcon For Time 4 rounds` como partes distintas do
   mesmo treino, cada uma com seu formato.
2. **Formato + parâmetros por bloco** — não existe campo estruturado para "AMRAP 15min",
   "EMOM 24", "Every 90s x 8 sets", "4 rounds", "time cap", "descanso 2min entre rounds".
3. **Score do bloco/WOD** — toda métrica hoje é por exercício. Um For Time tem UM resultado
   (tempo; ou rounds+reps no AMRAP), não um registro por movimento.
4. **EMOM alternado** — tarefas diferentes por minuto (ímpar/par, ou ciclo de 3–4 minutos com
   minuto de descanso, "repetir 6 vezes").
5. **Timer de WOD** — o cronômetro atual é só descanso. Falta: count-up com time cap (For Time),
   countdown com contador de rounds (AMRAP), intervalos repetidos com beep e indicação do minuto
   atual (EMOM 60/90/120s).
6. **Aquecimento** — não há como marcar exercícios/blocos como warmup; hoje qualquer exercício
   registrado gera PR, volume e pontos, o que distorce estatísticas se o aquecimento for
   prescrito como exercício.

Gap colateral já conhecido: **meta tipo CARGA compara só com `>=`** — não funciona para
"menor é melhor" (tempo). Corrigir junto.

## 3. Proposta — mínimo de mudança, máxima compatibilidade

Princípio: **não criar um "modo CrossFit" paralelo**. Treino atual = treino com um único bloco
implícito `LIVRE`. Personal de musculação não vê nada diferente; blocos e formatos são camada
opcional por cima do que existe.

### 3.1 Blocos no Treino (backend + portal)

Adicionar ao `Treino` uma lista leve de blocos, e ao `Exercicio` um ponteiro opcional:

```
Treino.blocos: list[{
  id: str
  nome: str                # "A) Força", "Aquecimento", "C) Metcon"
  ordem: int
  formato: LIVRE | FOR_TIME | AMRAP | EMOM   (default LIVRE)
  params: {
    rounds?: int           # FOR_TIME: "4 rounds"
    time_cap_s?: int       # FOR_TIME: tempo limite
    duracao_s?: int        # AMRAP: 15min | EMOM: total (EMOM 24)
    intervalo_s?: int      # EMOM: 60 / 90 / 120s ("Every 90s")
    descanso_rounds_s?: int # FOR_TIME: "2min entre rounds"
  }
}]

Exercicio.bloco_id: Optional[str]   # null = comportamento atual
```

- **Retrocompatível por construção**: treino sem `blocos` (todos os existentes) e exercício sem
  `bloco_id` funcionam exatamente como hoje. Nenhuma migração.
- No portal, a lista de exercícios do treino ganha divisórias de bloco (criar bloco = nome +
  formato + 2–3 params). **O formulário de exercício não muda**: os movimentos do WOD continuam
  sendo os exercícios de hoje (vídeo, biblioteca, substitutos, links úteis — tudo aproveitado).
- **EMOM alternado sem modelo novo**: dentro de um bloco EMOM, a `ordem` dos exercícios define
  os slots do ciclo, repetindo até `duracao_s`. Ex.: EMOM 24 com 4 exercícios (o 4º sendo
  "Descanso") = ciclo de 4 minutos repetido 6×. "Minuto ímpar X / par Y" = bloco EMOM com 2
  exercícios. O exemplo `Every 90s: complexo de 3 movimentos` usa um exercício único
  ("Complexo Snatch") com os movimentos nas observações — formalizar só se houver demanda.
- Rounds ficam **no bloco** ("4 rounds de X+Y+Z" = bloco FOR_TIME `rounds:4` com exercícios
  X, Y, Z). Não existe entidade round.

### 3.2 Score do WOD na finalização (backend + app do aluno)

- Para cada bloco com `formato ≠ LIVRE`, ao finalizar a sessão o app pergunta o resultado:
  - **FOR_TIME** → tempo (mm:ss); se estourou o cap, "cap + reps restantes".
  - **AMRAP** → rounds completos + reps extras (score ordenável = rounds×1000 + reps).
  - **EMOM** → "completou X de Y minutos" (opcional, default completo).
  - Checkbox **RX / Adaptado** (scaled) — boolean guardado junto.
- Persistência: lista `scores_blocos` no item `SESSION#{ts}#{id}` + PR por WOD reusando o motor
  atual: `STATS#PR#WOD#{chave}` (chave canônica do nome do treino/bloco), direção MENOR (For
  Time) ou MAIOR (AMRAP). **Evolução do WOD sai de graça** no padrão dos exercícios
  ("seu Fran: 9:40 → 8:55").
- Registro por série vira **opcional** dentro de blocos de WOD (no meio de um metcon ninguém
  anota série; a UI mostra os movimentos como referência + timer). Blocos LIVRE/Força seguem
  com o registro de hoje — no mesmo treino (`A) Força` registra série a série; `C) Metcon` só
  registra o score).

### 3.3 Timer de WOD (frontend, app do aluno)

Estender o `CronometroProvider` existente (não criar outro) com 3 modos:
- **For Time**: progressivo com time cap opcional (alerta ao atingir) + botão "terminei" que
  já preenche o score do bloco.
- **AMRAP**: regressivo a partir de `duracao_s` + botão grande "+1 round" (contador vira o score).
- **EMOM**: beep/vibração a cada `intervalo_s`, mostra o exercício do slot atual e "minuto 7/24".

Ao entrar num bloco com formato ≠ LIVRE, o timer certo abre pré-configurado. É a feature de
maior valor percebido para o aluno de cross.

### 3.4 Aquecimento (warmup)

Requisito direto do usuário: marcar exercícios como aquecimento. Nos exemplos reais, todo
treino abre com um bloco "Aquecimento" (ex.: "2 rounds: 10 Air Squats, 12 Afundos…").

Aquecimento existe em **três níveis**, e a mesma flag booleana resolve os três:

- **Nível bloco** (cross): bloco marcado como aquecimento (checkbox) seta a flag em todos os
  exercícios dele; bloco de aquecimento não tem formato/score.
- **Nível exercício** (musculação sem blocos): flag `Exercicio.aquecimento: bool` (default
  `false`) — o personal marca no formulário atual; aparecem agrupados no topo com selo
  "Aquecimento".
- **Nível série** (séries de aproximação/ramp-up antes das séries válidas — ex.:
  `50%×10, 70%×5` antes do `5×5 a 80%`): flag `aquecimento: bool` em `SeriePrescrita` e
  `SerieExec`. No editor de prescrição, um toggle por linha; no app do aluno, as linhas de
  aquecimento aparecem atenuadas com selo "aq." antes das válidas. `SeriePrescrita`/`SerieExec`
  já são listas de objetos — campo aditivo, sem migração.
- **Efeitos** (iguais nos três níveis — o motivo de ser flag e não só um nome de bloco):
  - **Fora das estatísticas**: não conta em `volume_total`, não gera PR (`STATS#PR#`), não
    entra nos gráficos de evolução — 10 air squats de aquecimento ou uma série a 50% não
    podem virar "recorde".
  - **Fora dos pontos por série** (gamificação) — evita inflar pontuação com warmup.
  - **Conta para "treino completo"** normalmente (aquecimento faz parte do treino), mas o
    registro é simplificado: um toque "feito" no bloco/exercício, sem anotar série a série.
  - UI do aluno: seção visualmente separada no topo, colapsável, com vídeos/instruções normais.
- Retrocompatível: exercícios existentes sem a flag não mudam nada.

### 3.5 Ajustes menores (junto no pacote)

- **Meta com direção MENOR**: novo tipo de meta "MARCA" (ou generalizar CARGA) que respeita
  `metrica_direcao` — meta "Fran abaixo de 8min" verifica automaticamente.
- **Benchmarks nomeados**: nada de novo no modelo — um **pacote .cpkg gratuito de benchmarks**
  (Fran, Cindy, Murph, Grace…) como templates com blocos preenchidos. Vira material de marketing
  na loja.
- **Export/Import IA e .cpkg**: incluir `blocos`/`bloco_id` nos schemas (`ProgramaTreinoFile`,
  `TemplatePacote`) — mudança aditiva, arquivos antigos seguem válidos. Importante para o fluxo
  "personal cola o treino do coach na IA e importa" — os exemplos reais vieram exatamente nesse
  formato de texto.
- **Gamificação**: nenhuma mudança necessária (sessão finalizada, PRs e streak já pontuam WODs).
  Opcional futuro: leaderboard por WOD benchmark entre alunos do personal — o ranking atual é
  de engajamento, não misturar.

### 3.6 Segunda métrica em exercícios PERFORMANCE

Gap apontado pelo usuário: há treinos medidos em mais de uma métrica (corrida 8min → distância
percorrida; remo 500m → tempo; bike → kcal + tempo), e hoje PERFORMANCE só tem 1 métrica de
evolução/PR.

- **Aproveitar o que já existe**: `SerieExec` já persiste dois campos (`carga` string livre +
  `reps` float), e `unidade_carga` (string livre) já existe no Exercicio e no EXCAT#. Em
  PERFORMANCE a UI do aluno apenas **esconde** o campo carga — a mudança é parar de esconder
  quando o personal preencher `unidade_carga` (ex.: "min", "bpm", "kcal"), usando-a como rótulo.
- **Métrica principal continua única**: só `unidade_reps` + `metrica_direcao` geram PR e gráfico
  de evolução. A segunda métrica é **contextual** — aparece no histórico, no "última vez" e no
  tooltip do gráfico. Evita a ambiguidade de PR bidimensional ("correu mais longe porém mais
  devagar é PR?").
- **Regra prática para o personal** (documentar na ajuda): a métrica principal é o resultado
  que varia; a dimensão fixa fica na prescrição ou na segunda métrica. Corrida de 8min →
  principal = distância (MAIOR); Remo 500m → principal = tempo (MENOR).
- Custo: essencialmente frontend + exibição no histórico. Zero migração, zero mudança no motor
  de PR.
- Futuro, só com demanda: métrica derivada (pace = tempo/distância) e gráfico secundário.

## 4. O que fica explicitamente FORA (para não inchar)

- Entidade "round" ou prescrição por round (round N com reps decrescentes → usar string livre
  "21-15-9" como hoje).
- Complexos olímpicos estruturados (movimentos dentro de um mesmo minuto/slot) — observações
  resolvem; formalizar só com demanda real.
- Tabata, ladders, chipper como enums próprios — cabem em FOR_TIME/AMRAP/EMOM + observações.
- Leaderboard público de benchmarks (fase 2, se houver tração com boxes).
- Zonas de FC estruturadas / integração com monitor cardíaco.
- Modelo multi-métrica completo (lista de métricas por exercício, PR por métrica) — a "segunda
  métrica" contextual (§3.6) cobre os casos reais com fração do custo e sem ambiguidade de PR.

## 5. Faseamento sugerido

| Fase | Entrega | Toca em |
|---|---|---|
| **0 — hoje, sem código** | Orientar personais: Strength/Skills já funcionam; metcon dá para prescrever com PERFORMANCE (unidade "min"/"rounds", direção certa) e observações "AMRAP 15min" | docs/ajuda |
| **1 — blocos + score** | `blocos` no Treino, `bloco_id` e flag `aquecimento` no Exercicio, divisórias no portal, pergunta de score no finish, PR de WOD, meta direção MENOR | backend + portal + app |
| **2 — timer de WOD** | Modos For Time / AMRAP / EMOM no CronometroProvider, integrados à execução por bloco | app do aluno |
| **3 — conteúdo** | Pacote .cpkg de benchmarks + `blocos` nos schemas de export/pacote (import via IA do texto do coach) | backend + loja |

Fases 1 e 2 juntas são o produto mínimo que um box/personal de cross reconheceria como "feito
para mim". Fase 0 pode ser comunicada imediatamente.

## 6. Riscos / decisões em aberto

- **Blocos como atributo do Treino vs. itens próprios no Dynamo**: proposta usa atributo
  (lista pequena, 2–5 blocos, itens continuam <4KB); revisitar só se blocos ganharem conteúdo
  próprio.
- **Chave de PR do WOD**: chave canônica (mesmo `chave_exercicio()` atual) sobre o nome do
  treino ou do bloco — permite que "Fran" importado de pacote e criado à mão compartilhem
  histórico. Decidir se o PR é por treino ou por bloco-metcon (proposta: por bloco, usando
  nome do treino quando o bloco for único).
- **Validação dos exemplos reais**: antes de implementar, montar os 5 treinos de
  `exemplo-treinos.txt` no modelo proposto (papel) e revisar com o personal parceiro — teste
  barato de aderência.
