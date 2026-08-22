# SEO — Plano de Ação e Monitoramento

> Criado em 2026-07-10, junto com a correção técnica de indexação (prerender servido pela CDN,
> blog, termos/privacidade, sitemap gerado no build). Este documento cobre o que **não** é código:
> ações manuais, off-page e rotina de acompanhamento.

## Diagnóstico que originou este plano (2026-07-10)

- `site:coachpilot.com.br` retornava **0 resultados** no índice Bing/DuckDuckGo; o site não
  aparecia em nenhuma busca por "app/sistema/aplicativo para personal trainer".
- Causa-raiz técnica: a CloudFront Function reescrevia toda rota para `/index.html`, então as
  13 páginas SEO prerenderizadas nunca eram servidas — o Google via 13 duplicatas da home.
  **Corrigido** em `backend/template.yaml` (rotas prerenderizadas → `/<rota>/index.html`).
- Quem domina as SERPs alvo: MFIT, Vedius, Tecnofit, WIKI4FIT, Trainer Connect, TreinoAI,
  MillBody — todos rankeiam com **blog de artigos comparativos** + landing pages por keyword.
  Por isso o blog (`/blog`, 6 artigos iniciais) faz parte da correção.
- Conflito de marca: "coachpilot" no Google devolve o SaaS americano coachpilot.com (AI sales
  coaching). Mitigação: co-ocorrência consistente de "CoachPilot" + "personal trainer" em todo
  conteúdo, título e âncora de link.

## 1. Ações imediatas pós-deploy (fazer 1x — ~30 min)

### Google Search Console (maior impacto)
Propriedade já verificada (`google1975efa97ae4599e.html`).
1. Acessar https://search.google.com/search-console → propriedade `coachpilot.com.br`.
2. **Sitemaps** → remover status antigo se houver erro → submeter `https://coachpilot.com.br/sitemap.xml`.
3. **Inspeção de URL** → colar cada URL abaixo → "Solicitar indexação" (limite diário ~10-12;
   fazer em 2-3 dias, nesta ordem de prioridade):
   - Dia 1: `/`, `/software-para-personal-trainer`, `/app-para-personal-trainer`,
     `/gestao-de-alunos-personal-trainer`, `/precos`, `/blog`,
     `/blog/melhores-aplicativos-para-personal-trainer`, `/blog/coachpilot-vs-mfit`
   - Dia 2: demais páginas SEO + demais artigos do blog
   - Dia 3: `/termos`, `/privacidade`, `/sobre`, `/divulgadores`
4. Conferir em **Configurações → Estatísticas de rastreamento** se o Googlebot está baixando as
   páginas novas (leva alguns dias).

### Bing Webmaster Tools (grátis, 5 min — alimenta Bing/DuckDuckGo/ChatGPT search)
1. https://www.bing.com/webmasters → "Importar do Google Search Console" (importa verificação e sitemap).

### Google Analytics 4
1. https://analytics.google.com → criar propriedade "CoachPilot" (fuso America/Sao_Paulo, moeda BRL).
2. Criar fluxo de dados Web para `https://coachpilot.com.br` → copiar o **Measurement ID** (`G-...`).
3. Em `frontend/index.html`, descomentar o bloco "Google Analytics 4" e substituir `G-XXXXXXXXXX`
   pelo ID real (2 ocorrências) → commit + `.\deploy.ps1 frontend`.
4. Marcar como conversão o evento de page_view em `/signup` (Admin → Eventos).

## 2. Off-page — backlinks e presença (semanas 1–4)

Backlink é o fator que mais falta contra MFIT/Tecnofit (domínios estabelecidos). Fontes por
ordem de esforço/retorno:

1. **Diretórios de software** (grátis, autoridade alta): criar perfil em
   B2B Stack (b2bstack.com.br), Capterra Brasil e GetApp. Categoria "Personal Trainer Software".
   Usar descrição consistente + link para a home.
2. **Instagram @coachpilotoficial**: colocar link na bio para a home (não linktree — o link
   direto passa sinal); fixar post apresentando o blog.
3. **Divulgadores e parceiros**: pedir aos divulgadores ativos e parceiros (cursos de Ed. Física,
   studios) que publiquem o link em seus sites/bios. Cada domínio .com.br apontando para o site conta.
4. **Pitch para listas "melhores apps"**: Techtudo, MillBody, Vedius e TreinoAI mantêm listicles
   que rankeiam ("7 melhores apps para personal"). E-mail curto de apresentação pedindo inclusão
   — mencionar diferenciais verificáveis (IA de migração em massa, assistente WhatsApp, grátis 3 alunos).
5. **Guest post / imprensa de nicho**: portais de educação física e CREF regionais aceitam artigos.
   Reaproveitar os artigos do blog como base.
6. **Google Perfil da Empresa** (Business Profile): criar perfil de serviço (sem endereço físico
   público) — ajuda em buscas de marca e mostra avaliações.

## 3. Cadência de conteúdo (a partir da semana 2)

O blog nasceu com 6 artigos e chegou a 11 em agosto/2026 (lote do cluster IA + MCP, ver §5).
Meta: **+2 artigos/mês** (Claude escreve, você revisa). Fila sugerida, por volume de busca e
afinidade com o produto:

1. "Quanto cobrar como personal trainer em 2026 (tabela por cidade e modelo)"
2. "CoachPilot vs Tecnofit Personal: comparativo"
3. "Anamnese para personal trainer: modelo pronto + o que perguntar"
4. "Como montar consultoria online de treino do zero"
5. "Avaliação física: protocolos e periodicidade ideal"
6. "CoachPilot vs Nexur: preço fixo vs preço por aluno"
7. "Treino em planilha Excel: modelos grátis (e quando abandoná-los)" (captura busca por planilha)
8. "Como usar WhatsApp profissionalmente sendo personal trainer"

Regras editoriais (dos limites de `CONTEXTO_MARKETING.md` §14):
- **Dois canais de IA, regras diferentes** — no fluxo por prompt, a IA *gera e o personal importa
  com revisão*; na conexão MCP, a IA *escreve direto*, e o que garante o controle é
  escopo + notificação + auditoria + desfazer em 7 dias. Nunca misturar os dois na mesma frase.
- **Nunca chamar a conexão de "plugin"** como afirmação própria. "Plugin do ChatGPT" só aparece
  como termo de busca, sempre corrigido no corpo ("plugins foram descontinuados; o padrão é MCP").
- App é **PWA** — nunca prometer App Store/Google Play.
- Não prometer integrações inexistentes (Apple Health, Strava, multi-tenant).
- **Não prometer escrita em massa pelo MCP**: a IA aplica um aluno por vez, por decisão de projeto.
  O lote de verdade é o template/rotina aplicado a vários alunos pelo portal. Dizer "um pedido só",
  não "uma operação só".
- Requisito de plano de IA é de terceiro e muda: sempre datar ("agosto/2026") — hoje Claude aceita
  conector no plano grátis (1), ChatGPT exige Developer mode em plano pago, Gemini é CLI/Vertex.
- Dado de saúde (anamnese, avaliação, foto, relato de dor) é **sensível pela LGPD**: todo conteúdo
  que fala de enviar dado de aluno para IA externa menciona consentimento específico. É diferencial
  de confiança — nenhum concorrente escreve isso.
- Dados de concorrentes sempre com "verificado em <mês/ano>, sujeito a alteração" e tom neutro
  (regra do battlecard: nunca falar mal).
- Todo artigo linka ≥2 landing pages internas e ≥1 outro artigo.
- Ao publicar: adicionar o post em `frontend/src/pages/landing/blogData.js` (o sitemap e o
  prerender são automáticos no build) e solicitar indexação no GSC.

## 4. Rotina de monitoramento

**Semanal (5 min)** — Google Search Console → Desempenho:
- Impressões e cliques totais (tendência).
- Consultas: quais queries geram impressão (esperar "coachpilot", depois long-tail
  "coachpilot vs planilhas", "whatsapp para personal trainer", depois head terms).
- Páginas → Indexação: nº de páginas indexadas deve chegar a **29** (15 páginas SEO + divulgadores
  + blog + 11 posts, conforme o sitemap gerado no build) em 2–4 semanas. Se URLs ficarem em
  "Rastreada, não indexada", reforçar links internos e pedir indexação de novo.

**Mensal (15 min)**:
- GA4: sessões orgânicas → signups (taxa de conversão da landing).
- Buscar manualmente (janela anônima): "app para personal trainer", "sistema para personal
  trainer", "coachpilot" — anotar posição.
- Conferir se novos artigos entraram no índice (`site:coachpilot.com.br/blog`).

**Expectativa realista**: indexação em dias/semanas após as solicitações; primeiras posições em
long-tail em 4–8 semanas; competir nas head keywords ("app para personal trainer") exige meses de
conteúdo + backlinks — MFIT e Tecnofit têm anos de autoridade. O caminho é long-tail → autoridade
→ head terms.

## 5. Cluster IA + MCP (publicado em 2026-08-22)

### A oportunidade, em uma frase
As buscas por IA no mercado fitness já têm concorrência ("IA para personal trainer" tem TreinoAI,
VFIT, Wiki4Fit e Eksy rankeando com conteúdo raso), mas **ninguém no Brasil escreve sobre IA
conectada ao sistema**. A busca por "gerenciar alunos pelo ChatGPT", "plugin do ChatGPT para
personal trainer" ou "MCP personal trainer" não tem página dedicada de nenhum concorrente — e é
exatamente o que o produto faz desde agosto/2026. É a única frente em que dá para ser o resultado
nº 1 sem disputar autoridade de domínio com MFIT e Tecnofit.

Vantagem estrutural: os concorrentes **não podem copiar o conteúdo sem construir o produto**.
Servidor MCP com OAuth, isolamento de tenant, auditoria e desfazer é meses de engenharia, não uma
página de vendas.

### Clusters de palavra-chave e a página que responde cada um

| Cluster | Termos | Página alvo | Concorrência |
|---|---|---|---|
| Head de IA | "IA para personal trainer", "app de personal trainer com IA", "inteligência artificial para montar treino" | `/ia-para-personal-trainer` | Média (conteúdo raso) |
| ChatGPT + profissão | "ChatGPT para personal trainer", "plugin do ChatGPT para personal trainer", "como usar ChatGPT para montar treino" | `/chatgpt-para-personal-trainer` | Baixa |
| Operar pelo chat | "gerenciar alunos pelo ChatGPT", "atualizar treino sem abrir o app", "MCP personal trainer", "o que é MCP" | `/blog/gerenciar-alunos-e-treinos-pelo-chatgpt` | Praticamente zero |
| Tutorial/setup | "como conectar ChatGPT ao sistema", "conector MCP ChatGPT", "MCP Claude conectar" | `/blog/como-conectar-chatgpt-claude-gemini-ao-coachpilot` | Zero em PT-BR |
| Dor operacional | "atualizar treino de vários alunos", "mudar treino de todos os alunos de uma vez", "renovar mesociclo" | `/blog/atualizar-treinos-de-todos-os-alunos-com-ia` | Zero |
| Categoria/comparativo | "o que a IA faz por um personal", "IA substitui personal trainer" | `/blog/ia-para-personal-trainer-o-que-automatizar` | Média |
| Long-tail de volume | "prompts de ChatGPT para personal trainer" | `/blog/prompts-de-chatgpt-para-personal-trainer` | Baixa (conecta.fitness) |

### O que foi publicado neste lote
2 landing pages (`/ia-para-personal-trainer`, `/chatgpt-para-personal-trainer`) e 6 artigos — os
cinco slugs da tabela acima mais `claude-chatgpt-ou-gemini-para-personal-trainer`. Total do site:
15 páginas SEO + blog + 12 artigos = 30 URLs no sitemap.

**Fato de produto que o comparativo das três IAs revelou** (verificado agosto/2026, vale corrigir
em todo conteúdo futuro): o conector MCP do **Claude** funciona no plano grátis (1 conexão) e, uma
vez configurado no navegador ou no desktop, fica disponível no app de celular; no **ChatGPT** o
conector de terceiro é recurso de navegador, não do app de celular; no **Gemini** o caminho
auto-serviço é só CLI/empresarial. Isso muda a recomendação padrão para Claude e obrigou a corrigir
a promessa de "consultar pelo celular" no artigo pillar — que era verdadeira só para o Claude. Os artigos antigos de IA e os comparativos (`melhores-aplicativos`, `coachpilot-vs-mfit`,
`como-montar-treino-com-ia-chatgpt`) foram atualizados para apontar para o cluster novo —
é o que passa autoridade das páginas já indexadas para as novas.

### Solicitar indexação no GSC (nesta ordem)
- **Dia 1**: `/ia-para-personal-trainer`, `/chatgpt-para-personal-trainer`,
  `/blog/gerenciar-alunos-e-treinos-pelo-chatgpt`,
  `/blog/como-conectar-chatgpt-claude-gemini-ao-coachpilot`
- **Dia 2**: `/blog/claude-chatgpt-ou-gemini-para-personal-trainer`,
  `/blog/atualizar-treinos-de-todos-os-alunos-com-ia`,
  `/blog/ia-para-personal-trainer-o-que-automatizar`,
  `/blog/prompts-de-chatgpt-para-personal-trainer`, `/` (home mudou), `/blog`
- **Dia 3**: reenviar os 3 artigos atualizados (`melhores-aplicativos-para-personal-trainer`,
  `coachpilot-vs-mfit`, `como-montar-treino-com-ia-chatgpt`) e `/faq`, `/precos`, `/sobre`.

### Backlinks: registries de MCP (a ação de maior retorno agora)
Existe um ecossistema novo de diretórios de servidores MCP, com autoridade crescente e curadoria
frouxa — o equivalente ao B2B Stack para esse nicho, mas sem fila e sem concorrente nosso listado.
Cadastrar `mcp.coachpilot.com.br` em: **PulseMCP, Glama, Smithery, mcp.directory, mcpservers.md,
MCP Market** e no **awesome-mcp-servers** do GitHub (PR). Usar sempre a mesma descrição
("CoachPilot — gestão para personal trainers: alunos, treinos, avaliações e prescrição") e link para
`/chatgpt-para-personal-trainer`, não para a home. Ganho duplo: backlink de domínio técnico + o
personal que já usa MCP descobre o produto pelo diretório.

Complemento off-page específico deste cluster: comunidades de MCP e de IA aplicada (Reddit
r/mcp, grupos de "IA para negócios" em PT-BR) recebem bem um relato de caso de servidor MCP em
produção num nicho não-óbvio. É conteúdo, não anúncio — e o nicho fitness chama atenção justamente
por ser inesperado.

### GEO/AEO — ser citado pela IA, não só rankear no Google
O público-alvo deste cluster pesquisa dentro do ChatGPT. Duas alavancas já aplicadas:
- `frontend/public/llms.txt` documenta a conexão MCP (escopos, operações, limites, requisitos por
  provedor, preço) e lista todos os artigos. É o arquivo que os crawlers de LLM leem primeiro —
  **manter atualizado a cada feature nova**.
- Todo artigo tem `FAQPage` em JSON-LD com perguntas escritas na forma em que as pessoas perguntam
  ("dá para gerenciar meus alunos pelo ChatGPT?", "é um plugin?"). É o formato que alimenta tanto
  o rich result do Google quanto a citação em resposta de LLM.
- Bing Webmaster Tools importa do GSC e alimenta o ChatGPT Search — se ainda não foi feito (§1),
  agora vale mais do que antes.

### Métrica de sucesso deste lote
Em 4–8 semanas, esperar impressão em GSC para "chatgpt personal trainer", "ia para personal
trainer", "gerenciar alunos chatgpt" e variações com "mcp". Termos de MCP devem ranquear rápido
(concorrência zero); os head terms de IA são o alvo de médio prazo. Se as páginas ficarem em
"Rastreada, não indexada", o reforço é link interno da home e do `/software-para-personal-trainer`
— ambos já apontam para o cluster.

### Próximos artigos deste cluster (fila)
1. "O que é MCP e por que todo software vai ter um (explicado sem jargão)" — captura a busca
   institucional e serve de âncora para os registries.
2. "CoachPilot vs TreinoAI: IA que gera treino vs IA que opera o sistema" — comparativo direto no
   concorrente que domina a keyword de IA.
3. "Consultoria online com IA: como atender 50 alunos sem virar fábrica de ficha".
4. ~~"Claude, ChatGPT ou Gemini para personal trainer"~~ — **publicado em 2026-08-22**.
5. "Como a IA me avisa que um aluno vai cancelar" (pendências + resumo de carteira).
6. "Personal trainer usando Claude: o guia do plano grátis" — desdobramento do comparativo, se a
   query "claude para personal trainer" mostrar impressão no GSC.

## 6. Melhorias técnicas futuras (backlog, menor prioridade)

- **Fonts self-hosted**: Sora/Inter servidas do Google Fonts bloqueiam render (LCP). Já existem
  fontes em `frontend/public/fonts` — migrar com `@font-face` + preload.
- **PNGs pesadas** em `frontend/public/` (>1MB: novo-icon-treinos.png, og-image.png) — converter
  para WebP/otimizar (og-image.jpg já é a usada nas meta tags, ok).
- **llms.txt**: incluir os artigos do blog.
- **hreflang**: só se um dia houver versão em outro idioma.
- **Soft-404**: rotas inexistentes devolvem 200 com o shell (padrão SPA). Se o GSC apontar volume
  de soft-404, avaliar resposta 404 real na CloudFront Function.
