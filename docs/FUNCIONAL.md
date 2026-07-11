# FUNCIONAL.md — CoachPilot (Documentação Funcional)

> Descreve **o que** o sistema faz (domínio, regras, comportamento). Para **como** construir
> (stack, padrões de código, infra) ver `ARCHITECTURE.md`; diretrizes técnicas deste produto em
> `ESPEC_TECNICA.md`; regras operacionais (conta AWS, deploy) em `CLAUDE.md`.
>
> **Hierarquia em conflito:** regra de negócio → este doc · modelo de dados/API → `ESPEC_TECNICA.md`
> · padrão de stack → `ARCHITECTURE.md` · regra operacional → `CLAUDE.md`.

| Campo | Valor |
|---|---|
| Versão | 1.0 |
| Status | **Produto em produção** (coachpilot.com.br) — este doc reflete o que está no ar |
| Última atualização | 2026-07-11 |

> Os detalhes de tela a tela estão nos guias servidos ao usuário (`frontend/public/ajuda-portal.md`
> e `ajuda-aluno.md`) — mantidos atualizados como parte do produto. Este doc guarda a **visão de
> domínio e as regras de negócio**, não o passo a passo de UI. Atributos exatos das entidades vivem
> no código (`backend/app/models/`), não aqui (specs enxutas).

---

## 1. Visão do Produto

**CoachPilot** — SaaS serverless de gestão para personal trainers: alunos, treinos, agenda,
avaliações físicas, evolução, financeiro e engajamento do aluno.

Diferenciais centrais:
1. **Operação por IA (grátis):** o personal monta treinos, pacotes e migra alunos conversando com
   o próprio ChatGPT/Claude/Gemini via prompts prontos da plataforma; a IA **gera**, o personal
   **revisa e importa** com 1 clique — a IA nunca escreve direto no sistema. Posicionamento:
   *o personal prescreve; a IA só escreve/cadastra.*
2. **Rastreabilidade:** *nenhuma informação do aluno fica solta* — todo dado (carga, foto, vídeo,
   dor, feedback, pagamento) nasce vinculado a aluno + treino + exercício (§4).

## 2. Atores e Identidade

| Ator | Autenticação | Descrição |
|---|---|---|
| **Personal** | Cognito (e-mail/senha) | Único usuário "dono" de dados. Tenant do sistema (`ESPEC_TECNICA.md` §1). Assina o Gestão Pro. |
| **Aluno** | Link com token (sem login) | Entidade do personal, não usuário Cognito. Acessa o app pelo link enviado via WhatsApp; link renovável (o anterior é invalidado). |
| **Comprador da loja** | Cognito (mesma conta CoachPilot) | Personal que compra/resgata pacotes no marketplace. |
| **Divulgador** | Cognito (mesma conta) | Conta comum registrada como divulgador pelo admin; acessa o painel próprio. |
| **Admin (superadmin)** | Cognito + flag | Suporte: lista personais, impersona contas, gerencia divulgadores e repasses. |
| **Agente IA (WhatsApp)** | Sistema | Responde alunos no WhatsApp com contexto de treino — só quando habilitado para o aluno (add-on; ver §6). |

## 3. Apps e Canais (produção)

| App | Domínio | Público |
|---|---|---|
| Portal do personal | coachpilot.com.br | Personal (inclui landing pública + blog SEO) |
| App do aluno (PWA) | app.coachpilot.com.br | Aluno, via link do personal |
| Loja (marketplace) | loja.coachpilot.com.br | Personais compram/vendem pacotes .cpkg |
| Painel do divulgador | divulgador.coachpilot.com.br | Divulgadores do programa de indicação |
| WhatsApp (W-API) | número do próprio personal | Lembretes; mensagens do aluno; agente IA quando habilitado |

## 4. Princípio Central — Rastreamento por Treino e Exercício

Toda interação relevante do aluno é vinculada a um contexto: **aluno + personal + treino +
exercício** (quando aplicável) + sessão + data/hora + canal de origem.

Exigem vínculo: foto · vídeo · carga · repetições · dor/desconforto · comentário de execução ·
dúvida · feedback · registro de exercício/treino concluído.

Regras vigentes:
- **Nada fica solto no histórico** — registro sem contexto completo vira **pendência** e não
  alimenta evolução, gráficos nem relatórios até ser classificado.
- **Contexto ativo reduz perguntas** — numa sessão ativa, o exercício atual é o contexto default.
- **Relato de dor tem prioridade**: registra, vincula ao exercício e **gera alerta imediato ao
  personal**; o sistema não orienta progressão sem autorização do personal.
- **O personal pode revisar e corrigir** qualquer vínculo/registro (escrita do personal atuando
  como aluno grava `ator = personal`, `classificacao = manual` — rastreável).
- **Todo registro é rastreável**: quem enviou, quando, por qual canal, a qual
  aluno/treino/exercício pertence e se a classificação foi automática ou manual.

## 5. Domínio (como implementado)

```
Personal 1─< Aluno 1─< Treino 1─< Exercicio (ordenados; opcionalmente agrupados em blocos)
Aluno 1─< SessaoTreino 1─< Registro (1 item por sessão+exercício; séries acumulam no item)
Exercicio 1─< Midia / Feedback / RelatoDor → Alerta (notificação ao personal)
Aluno 1─< Avaliacao | Meta | Cobranca | Anamnese
Personal 1─< Template | Rotina | Pacote(.cpkg) | Biblioteca | RecursoEducacional | Agenda | Anuncio(loja)
```

Pontos que orientam qualquer mudança:

- **Tipos de exercício:** `FORCA` (carga + reps; suporta 1RM, %1RM e gráfico de IRM) e
  `PERFORMANCE` (uma métrica numérica livre — unidade definida pelo personal — com direção
  `MAIOR`/`MENOR` para PR/evolução, e 2ª medida opcional apenas contextual). Os tipos antigos
  `CARDIO`/`PESO_CORPORAL` são **legados**, mapeados para `PERFORMANCE` na leitura.
- **Registro de série:** carga e/ou reps por série. Flags: `aquecimento` (fora de PR, volume e
  pontos) e `contexto` (anotação dentro de bloco de WOD). **RPE não é mais registrado** — o campo
  existe só como legado para exibir históricos antigos; não criar UI nem docs novos citando RPE.
- **Blocos / CrossFit:** treino pode ter blocos (`LIVRE`, `FOR_TIME`, `AMRAP`, `EMOM`) com
  parâmetros (rounds, time cap, duração, intervalo). Blocos de WOD não registram série a série —
  o resultado oficial é o **score do bloco** (tempo / rounds+reps / minutos, RX ou Adaptado),
  que gera PR e evolução do WOD. Ver `especificacoes/CROSSFIT_ADAPTACAO.md`.
- **Evolução e PRs são por nome canônico de exercício** — o mesmo nome em treinos diferentes
  compartilha histórico e recorde (idem WODs por nome de treino/bloco).
- **Extensibilidade:** entidades têm campos base + mapa `custom` livre — detalhar dados novos não
  exige migração.

## 6. Agente IA do aluno (WhatsApp) e chat do app

- **Chat do app do aluno é 100% direto com o personal** (2026-07): a mensagem é registrada e o
  personal é notificado (`MSG_ALUNO_DIRETO`, dedup 1h). Não passa pelo agente.
- **WhatsApp:** mensagens de aluno com agente **desabilitado** (default) também viram notificação
  direta ao personal. Com o agente habilitado (add-on "Assistente IA do aluno" — hoje "em breve"
  no plano; backend intacto), o agente responde com contexto do treino real.
- Comportamento do agente (quando ativo): interpreta a mensagem no contexto da sessão ativa;
  **pergunta o contexto que falta, uma pergunta por vez**; respostas **curtas e diretas** (sem
  textão no WhatsApp); nunca envia o treino inteiro sem pedido explícito; registra com vínculo;
  dor → alerta prioritário; usa a **Base de IA** do personal como conhecimento adicional.
- Proteções: dedup por `messageId`, rate limiting por aluno, resposta rápida ao webhook.

## 7. Módulos em produção (resumo)

| Módulo | Essência |
|---|---|
| Gestão de alunos | CRUD, notas internas, importação em massa via IA (CSV), link de acesso, anamnese digital |
| Treinos | Prescrição por série, %1RM, substitutos, aquecimento (bloco/exercício/série), blocos WOD, vencimento com notificação |
| Templates / Rotinas / Pacotes | Treino modelo → split completo → pacote .cpkg (livre ou licenciado com token) |
| Loja | Marketplace de pacotes: anúncio, PIX automático (MP) ou pagamento por fora, resgate gratuito |
| Sessão ativa | Aluno executa exercício a exercício; cronômetro persistente (PiP); timer de WOD; cancelamento descarta tudo |
| Evolução | Gráficos de carga, IRM, volume semanal por grupo muscular, PRs, WODs |
| Avaliações físicas | Medidas + fotos before/after + gráficos automáticos |
| Metas | CARGA (exercício ou WOD, direção ↑/↓), PESO, MEDIDA, LIVRE — verificação automática |
| Gamificação | Pontos por ação, multiplicador de streak semanal (2x/3x), ranking semanal/mensal/geral, 8 badges |
| Feed | Publicações vinculadas a exercício (execução, dor, dúvida, correção, recurso educacional), curtidas/comentários |
| Notificações | Central do personal (dor, dúvida, mídia, meta, vencimento, mensagem direta) + Web Push nos dois apps |
| Financeiro | Cobrança recorrente/avulsa por aluno, painel consolidado, PIX Mercado Pago opcional (`especificacoes/MERCADOPAGO_PIX.md`) |
| Plano/assinatura | Grátis (3 alunos) × Gestão Pro (PIX mensal/anual); promo codes e Indique e Ganhe (`especificacoes/PROMO_CODES.md`); benefício FinPilot |
| Programa de divulgadores | Cupom/link próprio, comissão recorrente, painel do divulgador; regras em `../estrategia/PROGRAMA_DIVULGADORES_REGRAS.md` |
| Admin | Impersonação para suporte, gestão de divulgadores e repasses |

## 8. Regras de gamificação (referência rápida)

Pontos: série 1 · sessão 8 · sessão completa +7 · PR 10 · post 3 · comentário 2 · curtida
recebida 1 · meta 50. Multiplicador por streak de semanas: 3–8 = 2x, 9+ = 3x. Aquecimento e
anotações de contexto **não pontuam nem geram PR**. Ranking reseta segunda (semanal) e dia 1
(mensal). Badges: 1/10/25/50/100 sessões e 3/8/12 semanas de streak.

## 9. Limites do produto (não prometer / não afirmar)

- 1 personal = 1 conta isolada — **não** há painel multi-personal para estúdios.
- Sem integração com terceiros (Apple Health, Strava) e sem app nas lojas (é PWA, proposital).
- A IA de operação **não** escreve direto no sistema (gera → revisa → importa).
- O aluno não cria avaliações nem metas — visão apenas.
- Estatística pública: **"+500 alunos gerenciados"** (alunos, não personais).
