# Contexto de Marketing — CoachPilot

> Arquivo gerado para uso com LLMs na criação de conteúdo de marketing (posts, anúncios, e-mails,
> roteiros de vídeo, copy de landing page etc.). Reúne produto, dores, benefícios, identidade
> visual, preço e provas sociais. Mantenha este arquivo atualizado conforme o produto evolui.

---

## 1. O produto em uma frase

**CoachPilot** é um SaaS de gestão para personal trainers e estúdios de treinamento: substitui
planilhas, papel e WhatsApp manual por uma plataforma única que organiza alunos, treinos, agenda,
avaliações físicas e evolução — com um **app exclusivo para o aluno (PWA)** e um **assistente de
IA via WhatsApp** que tira dúvidas e registra a execução dos treinos.

**Nome do produto:** CoachPilot
**Categoria:** SaaS / Software de gestão para personal trainers (fitness management software)
**Idioma/mercado:** Português do Brasil, personal trainers e estúdios de treinamento no Brasil
**Landing page (produção):** https://coachpilot.com.br (domínio próprio — Route53 + ACM +
CloudFront; o domínio `*.cloudfront.net` é só a infraestrutura por trás, não usar em divulgação)
**App do aluno:** https://app.coachpilot.com.br (PWA separado, sem instalação de loja)
**Status:** produto em produção, em fase de aquisição de primeiros clientes pagantes

---

## 2. Para quem é (público-alvo / personas)

1. **Personal trainer autônomo** — atende vários alunos, hoje usa planilha (Excel/Google Sheets),
   papel, ou WhatsApp comum para passar treino e cobrar evolução. Perde tempo repetindo treinos
   manualmente, esquece de cobrar renovação, não tem histórico organizado por aluno.
2. **Dono(a) de studio de treinamento** — gerencia uma equipe pequena ou vários alunos ao mesmo
   tempo, precisa de visão geral do negócio (quantos alunos ativos, frequência, agenda do dia).
3. (Secundário, beneficiário direto da experiência) **O aluno do personal** — quer saber o treino
   do dia sem perguntar, ver sua evolução, sentir-se acompanhado e engajado.

---

## 3. Dores que o produto resolve

- **Informação espalhada**: ficha de treino em planilha, fotos de avaliação no celular, conversa
  de WhatsApp perdida no histórico — nada centralizado.
- **Trabalho manual repetitivo**: montar o mesmo treino do zero para cada aluno parecido.
- **Aluno esquece o horário**: falta de lembrete automático gera no-show e cancelamento.
- **Aluno some/desengaja**: sem visibilidade de evolução e sem reconhecimento, o aluno perde
  motivação e abandona o acompanhamento.
- **Personal não sabe quem está prestes a vencer o plano**: renovação não é acompanhada,
  vira perda de receita.
- **Dúvidas do aluno fora do horário de treino**: aluno manda mensagem perguntando carga/série
  e o personal precisa responder manualmente, a qualquer hora.
- **Falta de profissionalismo percebido**: planilha e papel passam imagem amadora; o personal
  quer ferramentas à altura de quem cobra por um serviço premium.
- **Custo de ferramentas fragmentadas**: hoje, para cobrir tudo isso, o personal precisaria de
  vários apps/planilhas diferentes (agenda + planilha + WhatsApp + Drive de fotos).

---

## 4. Benefícios / proposta de valor

- **Tudo em um só lugar**: alunos, treinos, agenda, avaliações físicas e evolução, sem planilhas
  soltas.
- **Economia de tempo**: templates de treino reutilizáveis, rotinas de split completo (ABC,
  ABCDE…) e pacotes de treino prontos — aplicados a vários alunos com poucos cliques.
- **Menos no-show**: agenda com lembretes automáticos por WhatsApp para o personal e o aluno.
- **Evolução visual e automática**: avaliações físicas (medidas + fotos) geram gráficos de
  evolução a cada nova medição — ótimo argumento de retenção/venda para o personal mostrar ao aluno.
- **App do aluno (PWA) incluso**: o aluno vê o treino do dia, registra evolução e recebe
  notificações direto no celular, sem precisar baixar nada da loja de apps.
- **Engajamento gamificado**: ranking de frequência/desempenho e sistema de badges/conquistas
  (ex.: "Primeira Passada", "Consistência — 25 sessões", "Centenário — 100 sessões", streak de
  semanas seguidas treinando) — vira competição saudável entre alunos.
- **Assistente de IA 24h no WhatsApp**: o aluno tira dúvida de treino e recebe orientação a
  qualquer hora, sem depender do personal estar disponível.
- **Rastreabilidade total**: cada registro do aluno (carga, repetição, RPE, foto, vídeo, relato de
  dor) fica vinculado a um treino e exercício específico — nada fica "solto"; relato de dor gera
  alerta imediato para o personal.
- **Perfil público do personal**: página de perfil com bio, formação, experiência e redes sociais
  (Instagram, TikTok, YouTube, LinkedIn, Facebook, X, site) — reforça autoridade profissional.
- **Anamnese digital**: questionário de saúde/objetivos customizável, preenchido pelo aluno antes
  de começar.
- **Relatórios em PDF**: exportação de relatório de evolução para entregar/mostrar ao aluno.
- **Indique e ganhe**: programa de indicação — personal compartilha seu código, quem usar ganha
  30 dias grátis e, quando virar assinante, o indicador também ganha 30 dias.
- **Preço único e simples**: sem plano básico capado, sem letras miúdas.
- **Ativação imediata**: acesso completo liberado assim que cadastra.

---

## 5. Funcionalidades (lista completa para referência)

| Funcionalidade | Descrição |
|---|---|
| Gestão de alunos | Cadastro, histórico e timeline de evolução de cada aluno, sem limite de quantidade. Inclui notas internas, endereço, email e data de nascimento |
| Treinos e templates | Criação de treinos com séries/reps/carga prescrita/intervalo; templates reutilizáveis aplicáveis a múltiplos alunos com um clique |
| Rotinas de treino | Split completo (ex.: rotina ABC ou ABCDE) criado juntando templates ou salvo a partir dos treinos de um aluno — aplicável a vários alunos de uma vez (modo adicionar ou substituir) |
| Pacotes de treino (.cpkg) | Pacotes prontos com exercícios, templates e rotinas empacotados num arquivo .cpkg — importáveis com um clique, criados com ajuda de IA ou editados manualmente; suporte a pacotes licenciados com token de uso único |
| Sessão ativa de treino | O aluno "inicia" o treino e o sistema acompanha exercício atual, registros e status em tempo real |
| Exercícios substitutos | O personal cadastra alternativas para cada exercício; o aluno escolhe qual executar durante a sessão sem precisar consultar o personal |
| Tipos de exercício | Força (kg/lb + repetições), Cardio (RPE + minutos ou km), Peso Corporal (só repetições). Unidades de carga e repetição totalmente personalizáveis |
| % 1RM e IRM | Cadastro do 1RM do aluno, prescrição por percentual (carga calculada automaticamente) e gráfico de Intensidade Relativa Média por sessão |
| Avaliações físicas | Medidas corporais + fotos comparativas + gráficos de evolução automáticos |
| Agenda | Agendamento de sessões com lembretes automáticos via WhatsApp |
| App do aluno (PWA) | Instalável no celular sem loja de apps; treino do dia, evolução, notificações push |
| Ranking e gamificação | Ranking de frequência/desempenho + badges/conquistas (sessões e streaks) |
| Assistente via WhatsApp (IA) | Agente conversacional que entende contexto (treino/exercício atual), desambigua perguntas, registra carga/reps/RPE, recebe fotos e vídeos, prioriza relatos de dor com alerta automático ao personal |
| Feed / postagens | Feed de exercícios e posts com mídia (foto/vídeo) vinculados a treino/exercício |
| Recursos educacionais | Materiais de apoio (texto, foto, vídeo) vinculados a exercícios — o aluno acessa tocando no ícone de livro durante o treino |
| Notificações automáticas | Lembrete de treino, avaliação e renovação, via push/WhatsApp |
| Anamnese digital | Questionário de saúde e objetivos customizável pelo personal, preenchido pelo aluno via link público (sem login) |
| Perfil público do personal | Bio, formação, experiência profissional e redes sociais — visível para os alunos no app |
| Relatórios em PDF | Exportação de relatório de evolução do aluno com gráficos e badges |
| Dashboard | Visão geral do negócio: alunos ativos, frequência 7d, sessões hoje/semana, aderência, % no app, gráfico 14d, distribuição por objetivo, próximos eventos e aniversariantes do mês |
| Notificações / Pendências | Central de alertas: dores, dúvidas, mídias, metas atingidas, treinos vencendo — tudo organizado com ação direta |
| Financeiro dos alunos | Cobranças recorrentes (mensal/anual) ou avulsas, controle de pagamentos, integração Pix via Mercado Pago (o aluno paga diretamente pelo app) |
| Biblioteca de materiais | Upload de PDFs, vídeos e arquivos para os alunos baixarem no app |
| Base de IA | Arquivos de conhecimento (protocolos, FAQs) que o agente de IA usa para responder os alunos |
| Multicanal | Tudo funciona tanto pelo portal web quanto pelo WhatsApp, mantendo o mesmo vínculo de contexto |
| Indique e Ganhe | Código de indicação exclusivo: quem recebe ganha 30 dias grátis; quando vira assinante, quem indicou também ganha 30 dias |
| Tema claro/escuro | Portal e app suportam modo claro, escuro e automático (segue o sistema) |

---

## 6. Diferencial central (mecanismo único de venda)

> **"Nenhuma informação do aluno fica solta."**

Todo dado que entra no sistema — mensagem, foto, vídeo, carga, repetição, relato de dor — é
vinculado obrigatoriamente a um aluno, um treino e um exercício específico. Isso é o que permite
histórico confiável, gráficos de evolução reais e alertas automáticos (ex.: dor) — diferente de
planilha/WhatsApp manual, onde a informação se perde ou fica fora de contexto.

O agente de IA no WhatsApp reforça isso: ele **pergunta o contexto que falta** (treino/exercício)
em vez de registrar algo ambíguo, faz **uma pergunta por vez**, e responde de forma **curta e
direta** (sem textão no WhatsApp) — pensado para a realidade de uso real do aluno no dia a dia.

---

## 7. Comparativo (vs. planilha/WhatsApp manual)

Usado na landing page (seção "Por que usar CoachPilot?"), todos os itens abaixo: **CoachPilot tem,
planilha/manual não tem.**

- Histórico de alunos centralizado
- Avaliações físicas com gráficos automáticos
- Agenda com lembretes automáticos
- Templates de treino reutilizáveis
- App exclusivo para o aluno acompanhar o treino
- Ranking e gamificação para engajamento
- Notificações automáticas de vencimento
- Dashboard com visão geral do negócio

---

## 8. Preço

- **Plano Grátis (Trial)**: até 3 alunos, sem custo e sem prazo.
- **Plano Gestão Pro — Promo Lançamento**: **R$ 39,90/mês** (de R$ 69,90/mês). Alunos
  ilimitados, todas as funcionalidades inclusas.
- **Add-ons contratados separadamente**: Canal WhatsApp (assistente IA) e instância W-API.
- **Sem fidelidade** — cancela quando quiser.
- **Ativação imediata** após cadastro.
- **Pagamento via Pix** — confirmação automática, sem cartão de crédito.
- **Código de indicação**: quem for indicado ganha 30 dias grátis; quando vira assinante, o
  indicador também ganha 30 dias. Códigos promocionais de campanhas também disponíveis.
- **Benefício FinPilot**: a cada mês pago no Gestão Pro, o personal ganha automaticamente 1 mês
  grátis no FinPilot (gerenciador financeiro pessoal com IA).
- CTA principal: "Começar Grátis Agora" / "Criar Conta Grátis".

---

## 9. Provas sociais (depoimentos usados na landing page)

> "Em 1 mês usando o CoachPilot, parei de perder tempo procurando ficha de treino em planilha.
> Meus alunos adoram o app — eles veem o treino do dia e a evolução deles sem precisar me
> perguntar nada."
> — **Rafael Martins**, Personal Trainer Autônomo

> "A agenda com lembretes automáticos resolveu o problema de aluno esquecendo horário. E o
> ranking deixou meus alunos muito mais engajados — virou até uma competição saudável entre eles."
> — **Beatriz Lima**, Dona de Studio de Treinamento

Estatística usada no hero: **"+500 alunos gerenciados"** na plataforma.

---

## 10. Como funciona (jornada em 4 passos — usado na landing page)

1. **Cadastre seus alunos** — manualmente, em minutos; cada aluno fica com histórico, contato e
   plano organizados.
2. **Monte os treinos** — templates reutilizáveis ou do zero, vinculados à agenda do aluno.
3. **Acompanhe a evolução** — avaliações físicas geram gráficos automáticos a cada medição.
4. **Engaje pelo app do aluno** — o aluno acessa o treino do dia, recebe notificações e sobe no
   ranking de frequência direto pelo celular.

Mensagem de apoio: *"Não precisa de conhecimento técnico. Em poucos minutos você já está
gerenciando seus alunos como um profissional."*

---

## 11. Identidade visual

### 11.1 Nome e logotipo
- **Nome da marca:** CoachPilot (sempre "Coach" + "Pilot" grudados, com "Pilot" geralmente
  destacado na cor primária quando em duas cores).
- **Arquivos de logo (URLs públicas, servidas via CloudFront no domínio de produção —
  confirmado acessível, usar direto como referência de imagem para a LLM):**
  - https://coachpilot.com.br/coach-icon.png — ícone principal (favicon / uso geral)
  - https://coachpilot.com.br/icon-semfundo.png — versão sem fundo (fundo transparente)
  - https://coachpilot.com.br/horizontal-icon.png — versão horizontal (logo + texto lado a lado)
  - https://coachpilot.com.br/vertical-icon.png — versão vertical
  - https://coachpilot.com.br/icon-192.png, https://coachpilot.com.br/icon-512.png,
    https://coachpilot.com.br/icon-512-maskable.png — ícones PWA em várias resoluções
  - https://coachpilot.com.br/apple-touch-icon.png — ícone para iOS
- Símbolo: ícone com tema de "🏋️" / treino, em estilo flat moderno (ver URLs acima para o
  desenho exato).

### 11.2 Paleta de cores
| Uso | Cor | Hex |
|---|---|---|
| Primária (teal) | Verde-azulado | `#14b8a6` |
| Secundária (emerald) | Verde | `#10b981` |
| Fundo escuro / dark sections | Navy quase preto | `#0f172a` → `#0a0e1a` → `#060a14` (gradiente) |
| Fundo claro | Off-white esverdeado | `#f0fdfa` |
| Texto em fundo claro | Slate escuro | `#0f172a` (títulos), `#475569` (corpo) |
| Texto em fundo escuro | Branco com opacidade | `rgba(255,255,255,0.85)` / `0.65` / `0.5` etc. |
| Destaque/alerta (ex.: "não tem" no comparativo) | Vermelho | `#ef4444` |
| Estrelas de avaliação | Âmbar | `#f59e0b` |

- **Gradiente de marca principal:** `linear-gradient(135deg, #14b8a6, #10b981)` (teal → emerald) —
  usado em botões primários, ícones de destaque, textos em destaque (gradient text) e CTA.
- **Fundo hero/seções escuras:** `linear-gradient(160deg, #0f172a 0%, #0a0e1a 50%, #060a14 100%)`.
- **Padrão decorativo:** pontilhado sutil (`radial-gradient` de pontos) sobre fundos escuros, mais
  "glows"/blur circulares em teal/emerald — visual tech/SaaS moderno, não "fitness genérico".

### 11.3 Tipografia
- **Títulos/display:** `Sora` (peso 600–800) — geométrica, moderna, bold.
- **Corpo/UI:** `Inter` (peso 400–700).
- Fontes carregadas via Google Fonts.
- Estilo de título: bastante peso (800), letter-spacing negativo (`-0.5px` a `-1px`), tamanhos
  grandes (`clamp(28px, 4vw, 42px)` ou maiores no hero).

### 11.4 Tom de voz
- Direto, confiante, focado em resultado prático ("profissionalize sua gestão", "tudo em um só
  lugar", "sem surpresas", "sem letras miúdas").
- Usa emojis pontuais como ícone visual (🚀 💪 🔒 ⚡), não em excesso.
- Evita jargão técnico — fala para o personal trainer, não para desenvolvedor.
- Badges/tags curtas em uppercase como "etiqueta" de seção (ex.: "FUNCIONALIDADES", "COMO FUNCIONA",
  "PLANOS E PREÇOS", "DIFERENCIAIS", "DEPOIMENTOS").

### 11.5 Estilo visual geral
- Linguagem de **SaaS B2B moderno** (cards com sombra suave, bordas arredondadas grandes — 12 a
  24px —, glassmorphism leve com `backdrop-filter: blur`), não "academia/fitness tradicional".
  Pense Linear/Stripe/Notion com cor teal/emerald, não banner de academia.
- Seções alternam fundo claro (`#fff` / `#f0fdfa`) e fundo escuro navy, criando ritmo visual.
- Cards de feature: ícone colorido em fundo translúcido teal, título bold, descrição curta.

---

## 12. Estrutura da landing page (ordem das seções)

1. **Navbar** — logo CoachPilot, links (Funcionalidades, Como funciona, Comparativo, Preços,
   Depoimentos), botões Entrar / Começar Grátis.
2. **Hero** — headline "Gerencie seus alunos e treinos de forma profissional", subheadline,
   CTA duplo (Começar Grátis Agora / Ver como funciona), prova social rápida (+500 alunos
   gerenciados, App do aluno incluso, IA integrada), mockup de dashboard ao lado.
3. **Features** — grid de funcionalidades.
4. **How it works** — jornada em 4 passos.
5. **Comparison** — tabela CoachPilot vs. Planilha/Manual.
6. **Pricing** — card de preço (Grátis até 3 alunos / Gestão Pro R$39,90/mês).
7. **Testimonials** — 2 depoimentos.
8. **CTA final** — "Pronto para profissionalizar sua gestão de alunos?", botões Criar Conta
   Grátis / Já tenho conta.
9. **Footer** — logo, descrição curta, navegação, links de conta, copyright.

---

## 13. Ângulos de conteúdo sugeridos (para gerar posts/anúncios)

- **Dor → solução**: "Cansado de planilha de treino bagunçada? [funcionalidade] resolve isso."
- **Antes/depois**: comparação visual entre gestão manual (planilha, papel, WhatsApp) e CoachPilot.
- **Feature spotlight**: um post por funcionalidade (ex.: foco só em "ranking e gamificação",
  mostrando como aumenta retenção de aluno; ou foco em "pacotes .cpkg", mostrando como montar
  um treino completo com IA em minutos).
- **Prova social**: depoimentos, estatística "+500 alunos gerenciados".
- **Bastidor/demonstração**: gravação de tela mostrando o app do aluno recebendo o treino do dia.
- **Objeção de preço**: "R$39,90/mês, menos de R$1,30 por dia" / comparar com o custo de perder
  1 aluno por falta de organização.
- **Posicionamento de autoridade**: perfil público do personal (bio + redes sociais) como forma de
  parecer mais profissional para captar novos alunos.
- **Urgência/gatilho de ação**: "ativação imediata", "sem fidelidade, cancele quando quiser".
- **Indique e ganhe**: "Indique um colega personal — ele ganha 30 dias grátis e você também".
- **Pacotes de treino**: "Monte um pacote ABC completo com IA em minutos e aplique a todos os
  seus alunos de uma vez".

---

## 14. O que NÃO afirmar (limites do que está confirmado no produto/código)

- Não afirmar suporte a múltiplos personals/admin multi-tenant — modelo atual é 1 personal =
  1 conta isolada.
- Não prometer integração com apps de terceiros (ex.: Apple Health, Strava) — não existe hoje.
- Não citar números de clientes pagantes reais além do "+500 alunos gerenciados" já usado na
  landing page (não confirmar como "+500 personal trainers" — é alunos gerenciados, não personals).
- Preço promo lançamento (R$39,90/mês) pode ser alterado — verificar landing page antes de
  publicar conteúdo de preço.
