# FUNCIONAL.md — Personal Trainer (Documentação Funcional)

> **Porta de entrada para o desenvolvimento com Claude Code.**
> Descreve **o que** o sistema faz (domínio, regras, comportamento). Para **como** construir
> (stack, padrões de código, infra) ver `ARCHITECTURE.md`. Para **regras operacionais do projeto**
> (conta AWS, deploy, convenções) ver `CLAUDE.md`.

| Campo | Valor |
|---|---|
| Versão | 0.5 (reestruturação) |
| Status | Em definição — base funcional sendo consolidada |
| Última atualização | 2026-06-15 |
| Documentos relacionados | `CLAUDE.md` (regras/projeto), `ARCHITECTURE.md` (stack genérica), `ESPEC_TECNICA.md` (diretrizes técnicas deste produto) |

> **Changelog 0.4 → 0.5:** documento deixou de ser um "delta" e passou a ser o documento-base
> funcional. Adicionadas seções de fundação (visão, atores, glossário, modelo de domínio, escopo).
> Requisitos renumerados a partir de `RF001`/`RN001` (a numeração antiga `RF047+`/`RN013+` era
> herdada de um documento inexistente). Todo o conteúdo e exemplos da 0.4 foram preservados.

---

## 0. Como usar este documento (meta — para o Claude Code)

### 0.1 Hierarquia dos documentos
- **`FUNCIONAL.md`** (este) — fonte de verdade para **domínio, regras de negócio e comportamento do agente**.
- **`ARCHITECTURE.md`** — fonte de verdade para a **stack genérica e padrões reutilizáveis** (estrutura de código, infra SAM, padrões single-table agnósticos).
- **`ESPEC_TECNICA.md`** — fonte de verdade para o **modelo de dados, API e otimização específicos deste produto** (tenancy, partição, integração W-API).
- **`CLAUDE.md`** — fonte de verdade para **conta AWS, profiles, deploy, separação de custos, convenções de nome**.

Em caso de conflito: regra de negócio → `FUNCIONAL.md`; modelo de dados/API deste produto → `ESPEC_TECNICA.md`; padrão genérico de stack → `ARCHITECTURE.md`; regra operacional → `CLAUDE.md`.

### 0.2 Convenções de identificação
- `RF###` — Requisito Funcional (o sistema **deve fazer**). Ver §14.
- `RN###` — Regra de Negócio (restrição/política que governa o comportamento). Ver §15.
- `D##` — Diálogo canônico do agente (exemplo de referência). Ver §16.
- IDs são **estáveis**: nunca reaproveitar um número; itens descontinuados ficam marcados como `(obsoleto)`.

### 0.3 Legenda de status (aplicada por item)
- `[MVP]` — entra na primeira versão entregável.
- `[FUTURO]` — desejável, fora do MVP.
- `⚠️ A DEFINIR` — decisão pendente do product owner (Vinícius). **Claude Code não deve inventar** — perguntar ou deixar TODO explícito.

### 0.4 Entidades canônicas (nomes oficiais)
Sempre usar estes nomes (campos/tabela/código), em snake_case para chaves: `personal`, `aluno`,
`treino`, `exercicio` (exercício dentro de um treino), `sessao_treino`, `registro`, `midia`,
`feedback`, `relato_dor`, `alerta`, `pendencia`. Ver modelo completo em §5.

---

## 1. Visão do Produto

**SaaS serverless para gestão de personal training** — o personal acompanha seus alunos, monta
treinos e registra evolução; o aluno executa os treinos e registra cargas, repetições, percepção
de esforço, mídias e feedbacks, **principalmente via um agente conversacional no WhatsApp** e,
de forma complementar, por um **portal web**.

**Proposta de valor central:** *nenhuma informação fica solta.* Toda interação do aluno é
amarrada a um treino e a um exercício, gerando um histórico rastreável que alimenta evolução,
relatórios e decisões do personal.

⚠️ A DEFINIR — refinar a frase de posicionamento e a métrica de sucesso do produto (ex.: % de
registros com contexto completo, adesão semanal do aluno).

---

## 2. Atores e Personas

| Ator | Tipo | Descrição | Canais |
|---|---|---|---|
| **Personal** | Humano | Cria/edita treinos, acompanha alunos, recebe alertas (ex.: dor), corrige vínculos classificados pelo agente. | Portal (e ⚠️ A DEFINIR: WhatsApp?) |
| **Aluno** | Humano | Executa treinos, registra cargas/reps/RPE, envia mídias e feedbacks, consulta histórico e vídeos. | WhatsApp (principal) + Portal |
| **Agente** | Sistema (IA) | Interpreta mensagens do aluno no WhatsApp, mantém contexto da sessão, desambigua, registra com vínculo e responde de forma sucinta. | WhatsApp |
| **Admin** | Humano | ⚠️ A DEFINIR — existe papel de administrador da plataforma (multi-personal)? |  |

⚠️ A DEFINIR — modelo de tenancy: cada personal é um usuário isolado (PK = `USER#{personal_id}`)?
Onde entra o aluno no isolamento por usuário do DynamoDB (ver `ARCHITECTURE.md` §9.2)? Esta é uma
decisão estrutural e precisa ser resolvida antes do scaffold do backend.

---

## 3. Canais

### 3.1 WhatsApp (canal principal do aluno)
Interação conversacional com o **Agente**. Toda regra de contexto, desambiguação e estilo de
resposta deste documento (§7–§12, §16) aplica-se aqui. `canal_origem = whatsapp`.

### 3.2 Portal Web
Interface visual para personal e aluno. O vínculo por contexto também é obrigatório, mas a
associação é facilitada pela própria navegação (estar "dentro" da tela do exercício). Ver §13.
`canal_origem = portal`.

⚠️ A DEFINIR — integração de WhatsApp: número, provedor (API oficial Cloud API vs. terceiros),
e como o webhook chega ao backend (ver implicação de infra em `ARCHITECTURE.md`).

---

## 4. Glossário do Domínio

| Termo | Definição |
|---|---|
| **Treino** | Conjunto ordenado de exercícios prescrito ao aluno (ex.: "Treino A — Inferiores"). |
| **Exercício** | Um item do treino (ex.: Supino reto), com séries, repetições, carga prescrita e intervalo. |
| **Sessão de treino** (`sessao_treino`) | Instância de execução de um treino por um aluno num momento — tem início, exercício atual, status e registros. |
| **Registro** | Dado executado pelo aluno num exercício: carga, repetições realizadas, RPE, RM etc. |
| **Carga** | Peso utilizado no exercício (ex.: 30kg). |
| **Repetições (reps)** | Número de execuções por série (ex.: 10/9/8). |
| **Série** | Cada bloco de repetições (ex.: 4x10 = 4 séries de 10). |
| **RPE** | *Rate of Perceived Exertion* — percepção subjetiva de esforço. |
| **RM** | Repetição Máxima — carga máxima para N repetições. |
| **Carga prescrita** | Peso planejado pelo personal (vs. carga executada pelo aluno). |
| **Mídia** | Foto ou vídeo enviado pelo aluno (execução, evolução etc.). |
| **Pendência** | Informação recebida sem contexto completo, aguardando classificação. |
| **Contexto ativo** | Treino/exercício correntes durante uma sessão, usados para interpretar mensagens curtas. |
| **Relato de dor** | Registro de dor/desconforto — tratado com prioridade e gera alerta ao personal. |

⚠️ A DEFINIR — completar termos restantes (ex.: "avaliação física", "agenda", "ciclo/periodização")
quando essas áreas entrarem no escopo.

---

## 5. Modelo de Domínio

> Esta seção é a **base para o scaffold do backend** (models Pydantic, SK patterns DynamoDB).
> Os atributos detalhados estão marcados como `⚠️ A DEFINIR` — preencher antes de modelar.

### 5.1 Entidades e relacionamentos (visão lógica)

```
Personal 1 ───< N Aluno
Aluno    1 ───< N Treino
Treino   1 ───< N Exercicio (ordenados)
Aluno    1 ───< N SessaoTreino
SessaoTreino 1 ──< N Registro        (cada registro referencia 1 Exercicio)
Exercicio    1 ──< N Midia
Exercicio    1 ──< N Feedback
Exercicio    1 ──< N RelatoDor ──> 1 Alerta (para o Personal)
(qualquer entrada sem contexto) ──> Pendencia ──> (resolve para vínculo definitivo)
```

### 5.2 Atributos mínimos por entidade

Derivados do "contexto obrigatório" da §8. Detalhar os demais campos é `⚠️ A DEFINIR`.

- **Personal** — `personal_id`, `nome`, ⚠️ A DEFINIR.
- **Aluno** — `aluno_id`, `personal_id`, `nome`, `whatsapp`, ⚠️ A DEFINIR.
- **Treino** — `treino_id`, `aluno_id`, `nome`, `ordem`, ⚠️ A DEFINIR (grupo muscular, ativo?).
- **Exercicio** — `exercicio_id`, `treino_id`, `nome`, `series`, `reps_prescritas`, `carga_prescrita`, `intervalo_s`, `video_referencia_url?`, `ordem`.
- **SessaoTreino** — `sessao_treino_id`, `aluno_id`, `personal_id`, `treino_id`, `exercicio_atual_id`, `data_hora_inicio`, `status`, `registros[]`.
- **Registro** — `registro_id`, `sessao_treino_id`, `exercicio_id`, `aluno_id`, `carga?`, `reps?`, `rpe?`, `rm?`, `data_hora`, `canal_origem`, `classificacao` (`auto`|`manual`).
- **Midia** — `midia_id`, `tipo` (ver §10), `treino_id?`, `exercicio_id?`, `url`, `status` (`pendente`|`vinculada`), `observacao?`, `data_hora`, `canal_origem`.
- **Feedback** — `feedback_id`, `exercicio_id?`, `treino_id?`, `texto`, `data_hora`, `canal_origem`.
- **RelatoDor** — `relato_dor_id`, `exercicio_id`, `descricao`, `data_hora`, `gera_alerta=true`.
- **Alerta** — `alerta_id`, `personal_id`, `aluno_id`, `origem` (ex.: `relato_dor`), `status`, `data_hora`.
- **Pendencia** — `pendencia_id`, `tipo_dado` (ver §11), `payload`, `motivo` (contexto faltante), `status`, `data_hora`.

### 5.3 Mapeamento DynamoDB (single-table)

> **Resolvido em `ESPEC_TECNICA.md` §2.** A tenancy é *Tenant = Personal* e os dados se dividem em
> duas famílias de partição — `PT#{personal_id}` (dados/visões do personal) e `AL#{aluno_id}` (tudo do
> aluno, para distribuir a escrita e escalar). O esboço anterior (`PK = USER#{personal_id}` com tudo
> numa partição) foi **substituído** por esse modelo. Chaves exatas: na implementação.

---

## 6. Escopo: MVP vs Futuro

⚠️ A DEFINIR — esta seção precisa da sua priorização. Proposta inicial para discussão:

**MVP candidato:**
- [MVP] Cadastro de aluno, treino e exercícios (portal, pelo personal).
- [MVP] Sessão ativa de treino + registro de carga/reps com vínculo (§8).
- [MVP] Desambiguação de contexto pelo agente (§9).
- [MVP] Relato de dor → alerta ao personal (§10 / D? em §16).
- [MVP] Consulta de histórico por exercício (§9).

**Futuro candidato:**
- [FUTURO] Mídia pendente + classificação assistida (§10, §11).
- [FUTURO] Área de pendências para o personal classificar manualmente (§11).
- [FUTURO] Avaliações físicas, agenda, relatórios de evolução/gráficos.

> Pergunta-chave a decidir primeiro: **o agente de WhatsApp faz parte do MVP, ou o MVP é
> portal-first e o agente vem depois?** Isso muda a ordem de construção.

---

## 7. Princípio Central — Rastreamento por Treino e Exercício

Toda interação relevante do aluno deve ser vinculada a um contexto específico dentro da plataforma.

Sempre que possível, mensagens, fotos, vídeos, feedbacks, cargas, repetições, percepção de esforço
e relatos devem estar relacionados a:

1. Um aluno;
2. Um personal;
3. Um treino;
4. Um exercício específico do treino.

O objetivo é evitar informações soltas no histórico, facilitando consulta futura, relatórios,
evolução e análise pelo personal.

### 7.1 Informações que exigem vínculo
Foto · Vídeo · Carga utilizada · Repetições realizadas · RPE · RM · Dor ou desconforto ·
Comentário sobre execução · Dúvida sobre exercício · Feedback sobre treino · Solicitação de troca
de exercício · Registro de treino concluído · Registro de exercício concluído.

### 7.2 Premissa resumida (norte do produto)
> Toda informação precisa ter contexto.
> Nada fica solto no histórico.
> O agente pergunta treino e exercício quando necessário.
> Se já existe contexto ativo, ele usa esse contexto.
> As respostas devem ser curtas, claras e objetivas.

---

## 8. Contexto da Mensagem e Sessão Ativa

### 8.1 Contexto obrigatório da conversa
Antes de registrar qualquer informação enviada pelo aluno, o sistema deve identificar o contexto:

- `personal_id`
- `aluno_id`
- `treino_id`
- `exercicio_id` — quando aplicável
- `sessao_treino_id` — quando o aluno estiver realizando um treino
- `data_hora`
- `canal_origem`: `whatsapp` ou `portal`

### 8.2 Sessão ativa de treino
Quando o aluno inicia um treino, o sistema cria uma **sessão ativa**, que guarda:
Aluno · Personal · Treino iniciado · Exercício atual · Data/hora de início · Status da sessão ·
Registros já realizados.

Enquanto a sessão estiver ativa, o agente pode interpretar mensagens curtas com base no exercício atual.

**Exemplo:**
> **Agente:** Primeiro exercício: Supino reto. 4x10, carga prescrita: 30kg.
> **Aluno:** Fiz 10, 9, 8 e 8.
> **Agente:** Registrado no Supino reto.

---

## 9. Desambiguação: Quando o Agente Deve Perguntar o Contexto

O agente deve **sempre** perguntar qual treino e qual exercício quando essa informação não estiver
clara, e **uma pergunta por vez** (RN006 / §12).

### 9.1 Gatilhos que exigem pergunta de contexto
O agente deve perguntar quando:
- O aluno enviar foto ou vídeo sem informar exercício;
- O aluno informar carga ou repetições sem exercício;
- O aluno relatar dor sem exercício claro;
- O aluno perguntar "quanto peguei?" sem exercício claro;
- O aluno disser "esse exercício" sem existir exercício atual na conversa;
- O aluno falar de um treino sem deixar claro qual;
- Houver mais de um exercício possível com nome parecido.

### 9.2 Exemplos de desambiguação

**Sem contexto:**
> **Aluno:** Fiz 30kg hoje.
> **Agente:** Em qual exercício você fez 30kg?

**Exercício informado, treino não:**
> **Aluno:** Fiz 30kg no supino.
> **Agente:** Esse supino é de qual treino?

**Treino em andamento (não precisa perguntar):**
> *Aluno no Treino A, exercício atual Supino reto.*
> **Aluno:** Fiz 30kg, 10 reps.
> **Agente:** Registrado no Supino reto.

### 9.3 Mensagens e feedbacks
Comentários do aluno também devem ser vinculados a treino ou exercício.
> **Aluno:** Achei muito pesado.
> *Se houver exercício atual:* Registrado nesse exercício.
> *Se não houver:* Qual exercício ficou pesado?

### 9.4 Perguntas sobre histórico
> **Aluno:** Quanto peguei semana passada? → **Agente:** Em qual exercício?
> **Aluno:** Quanto peguei no supino semana passada? → **Agente:** Último registro: 30kg, 10/9/8 reps.

### 9.5 Consultas de vídeo
> **Aluno:** Tem vídeo de execução? → **Agente:** De qual exercício?
> *Com contexto ativo (Leg press):* **Aluno:** Tem vídeo? → **Agente:** Sim: [link do vídeo]

---

## 10. Mídias (Fotos e Vídeos)

Fotos e vídeos **não devem ficar soltos** no sistema.

### 10.1 Mídia sem contexto → pendente
Se o aluno enviar foto/vídeo sem contexto, o sistema armazena como **mídia pendente** e pergunta a
qual treino e exercício pertence.
> *Aluno envia vídeo.*
> **Agente:** Esse vídeo é de qual exercício? → **Aluno:** Agachamento.
> **Agente:** Esse agachamento é de qual treino? → **Aluno:** Treino A.
> **Agente:** Vídeo vinculado ao Agachamento do Treino A.

### 10.2 Mídia com contexto ativo → vínculo automático
> **Agente:** Exercício atual: Remada baixa.
> *Aluno envia vídeo.*
> **Agente:** Vídeo vinculado à Remada baixa.

### 10.3 Relatos de dor (prioridade)
Relatos de dor são tratados com prioridade e vinculados ao exercício correspondente.
> **Aluno:** Senti dor no joelho. → **Agente:** Em qual exercício você sentiu dor?

Após a resposta, o sistema deve:
- Registrar o relato;
- Vincular ao exercício;
- Gerar alerta para o personal;
- **Evitar orientar progressão sem autorização.**

> **Agente:** Registrei a dor no Agachamento e avisei seu personal.

### 10.4 Tipos de mídia
Vídeo de execução · Foto de evolução · Foto relacionada a exercício · Feedback visual ·
Outro (se permitido pelo personal).

---

## 11. Pendências de Contexto

Quando uma informação chega sem contexto completo, ela vai para uma **área de pendências**.

### 11.1 Tipos de pendência
Vídeo sem exercício · Foto sem classificação · Carga sem exercício · Feedback sem treino ·
Dor sem exercício · Comentário sem contexto.

### 11.2 Fluxo de resolução
1. O sistema tenta resolver perguntando ao aluno (uma pergunta por vez).
2. Se não resolver, exibe ao personal para classificação manual.
3. Dados pendentes **não** entram no histórico definitivo nem alimentam evolução (RN013, RN021).

---

## 12. Estilo de Comunicação do Agente

O agente deve responder de forma **curta, direta e fácil de interpretar**. Respostas no WhatsApp
devem evitar textos longos, excesso de explicação e listas extensas.

### 12.1 Diretrizes
- Ser direto; usar frases curtas;
- **Fazer uma pergunta por vez;**
- Evitar textos longos e explicações técnicas desnecessárias;
- Não repetir informação que o aluno já sabe;
- Confirmar registros de forma objetiva;
- Pedir contexto apenas quando necessário;
- Não enviar blocos grandes de texto pelo WhatsApp.

### 12.2 Tamanho ideal das respostas
- **Resposta simples** — até 1–2 linhas. Ex.: *Hoje é Treino A — Inferiores. Quer começar?*
- **Resposta de exercício** — até 4–5 linhas. Ex.:
  > Supino reto · 4x10 · Carga: 30kg · Intervalo: 60s · Quer ver o vídeo?
- **Resposta de histórico** — curta. Ex.: *Último supino: 30kg — 10/9/8 reps.*
- **Ausência de dados** — direta. Ex.: *Não encontrei carga cadastrada para esse exercício.*

### 12.3 Evitar treino inteiro em uma mensagem
O agente não envia o treino completo de uma vez, salvo pedido explícito.
> **Aluno:** Qual meu treino hoje?
> **Agente:** Hoje é Treino A — Inferiores. Quer ver tudo ou começar pelo primeiro exercício?

> **Aluno:** Começar. → **Agente:** 1º exercício: Agachamento. 4x10, carga: 40kg. Quer vídeo?

> **Aluno:** Ver tudo. → **Agente:** lista resumida (1. Agachamento, 2. Leg press, 3. Cadeira
> extensora, 4. Mesa flexora, 5. Panturrilha).

---

## 13. Portal Web

### 13.1 Vínculo por contexto também no portal
Tudo registrado pelo portal também deve ser vinculado a treino e exercício; a associação é
facilitada visualmente. Ao registrar uma carga, o aluno já está dentro da tela do exercício —
o sistema já sabe aluno, treino, exercício e sessão.

### 13.2 Sem dados soltos
O portal **não** deve permitir upload genérico de mídia sem classificação. Ao enviar, o aluno escolhe:
- Treino relacionado;
- Exercício relacionado (se aplicável);
- Tipo de mídia (ver §10.4);
- Observação opcional.

### 13.3 Correção pelo personal
O personal pode editar o vínculo de qualquer mensagem, foto, vídeo ou registro (RN015, RN022).

---

## 14. Requisitos Funcionais (RF)

> Renumerados a partir de `RF001`. Status entre colchetes; `⚠️` = depende de decisão de escopo (§6).

| ID | Status | Requisito |
|---|---|---|
| **RF001** | [MVP] | Vincular registros relevantes a um treino e/ou exercício. |
| **RF002** | [MVP] | Criar uma sessão ativa quando o aluno iniciar um treino. |
| **RF003** | [MVP] | Manter o exercício atual durante uma sessão de treino. |
| **RF004** | [MVP] | O agente perguntar treino/exercício quando o contexto estiver incompleto (desambiguação). |
| **RF005** | [FUTURO] | Armazenar fotos/vídeos sem contexto como pendentes até classificação. |
| **RF006** | [FUTURO] | Permitir que o personal corrija o vínculo de mensagens, fotos, vídeos e registros. |
| **RF007** | [MVP] | Limitar as respostas do agente para que sejam curtas, claras e objetivas. |
| **RF008** | [MVP] | O agente fazer apenas uma pergunta por vez ao completar informações. |
| **RF009** | [MVP] | Registrar relato de dor, vinculá-lo ao exercício e gerar alerta ao personal. |
| **RF010** | [MVP] | Consultar histórico por exercício (último registro de carga/reps). |
| **RF011** | [MVP] | Cadastrar aluno, treino e exercícios pelo portal. |

⚠️ A DEFINIR — RFs de avaliação física, agenda e relatórios quando entrarem no escopo.

---

## 15. Regras de Negócio (RN)

> Renumeradas a partir de `RN001`.

| ID | Regra |
|---|---|
| **RN001** | Nada fica solto no histórico: registros só entram no histórico definitivo com contexto correto. |
| **RN002** | Contexto ativo reduz perguntas: numa sessão ativa, o agente usa o exercício atual como contexto. |
| **RN003** | Contexto ausente exige pergunta antes de registrar. |
| **RN004** | Resposta curta é padrão, especialmente no WhatsApp. |
| **RN005** | Toda informação enviada pelo aluno deve ser associada a um treino e/ou exercício. |
| **RN006** | O agente faz uma pergunta por vez ao completar contexto. |
| **RN007** | Relato de dor tem prioridade; não orientar progressão sem autorização do personal. |
| **RN008** | Mídia sem contexto vira pendência; nunca é armazenada "solta". |
| **RN009** | O personal pode revisar e corrigir classificações feitas automaticamente pelo agente. |
| **RN010** | Todo registro deve ser rastreável: quem enviou, quando, por qual canal, a qual aluno/treino/exercício pertence, e se foi classificado automática ou manualmente. |
| **RN013** | Dados sem contexto não entram no histórico definitivo nem em relatórios/evolução até classificados. |
| **RN015** | O personal pode editar o vínculo de mensagem, foto, vídeo ou registro. |
| **RN021** | Dados pendentes não alimentam gráficos, relatórios ou progressão. |
| **RN022** | O personal pode revisar e corrigir registros classificados automaticamente. |

> Nota: lacunas de numeração (RN011–012, RN014, etc.) reservadas para regras a serem extraídas
> de §7–§13 conforme o detalhamento avançar. Não reaproveitar números.

---

## 16. Catálogo de Diálogos Canônicos do Agente

> Exemplos de referência para implementar e testar o comportamento do agente. Cada `D##` é um caso
> de teste em potencial.

- **D01 — Carga sem exercício:** *Fiz 25kg.* → **Em qual exercício?**
- **D02 — Vídeo sem contexto:** *(envia vídeo)* → **Esse vídeo é de qual exercício?**
- **D03 — Exercício ambíguo:** *Fiz remada.* → **Qual remada? Baixa, curvada ou unilateral?**
- **D04 — Feedback sem contexto:** *Achei difícil.* → **Qual exercício ficou difícil?**
- **D05 — Registro completo:** *No leg press fiz 100kg, 12/10/10.* → **Registrado no Leg press.**
- **D06 — Histórico:** *Quanto peguei no leg semana passada?* → **Último Leg press: 100kg — 12/10/10 reps.**
- **D07 — Dor:** *Senti dor na lombar.* → **Em qual exercício?** → *Terra.* → **Registrei e avisei seu personal.**
- **D08 — Registro em sessão ativa:** *(exercício atual Supino)* *Fiz 10, 9, 8 e 8.* → **Registrado no Supino reto.**
- **D09 — Mídia com contexto ativo:** *(exercício atual Remada baixa, envia vídeo)* → **Vídeo vinculado à Remada baixa.**

---

## 17. Backlog / A Definir

Decisões pendentes que bloqueiam ou direcionam o desenvolvimento (consolidado dos `⚠️ A DEFINIR`):

1. **Tenancy / isolamento por usuário** (§2, §5.3) — como aluno e personal se encaixam no
   `PK = USER#{...}`? **Bloqueia o scaffold do backend.**
2. **MVP: agente-first ou portal-first?** (§6) — define a ordem de construção.
3. **Atributos completos das entidades** (§5.2) — necessários para os models Pydantic.
4. **SK patterns DynamoDB** (§5.3) — confirmar conforme `ARCHITECTURE.md` §5.
5. **Integração WhatsApp** (§3.2) — provedor, webhook, infra.
6. **Papel de Admin / multi-personal** (§2).
7. **Áreas futuras**: avaliação física, agenda, relatórios/gráficos de evolução.
