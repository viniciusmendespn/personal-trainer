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

O blog nasceu com 6 artigos. Meta: **+2 artigos/mês** (Claude escreve, você revisa). Fila
sugerida, por volume de busca e afinidade com o produto:

1. "Quanto cobrar como personal trainer em 2026 (tabela por cidade e modelo)"
2. "CoachPilot vs Tecnofit Personal: comparativo"
3. "Anamnese para personal trainer: modelo pronto + o que perguntar"
4. "Como montar consultoria online de treino do zero"
5. "Avaliação física: protocolos e periodicidade ideal"
6. "CoachPilot vs Nexur: preço fixo vs preço por aluno"
7. "Treino em planilha Excel: modelos grátis (e quando abandoná-los)" (captura busca por planilha)
8. "Como usar WhatsApp profissionalmente sendo personal trainer"

Regras editoriais (dos limites de `CONTEXTO_MARKETING.md` §14):
- IA **gera + importa com revisão** — nunca "escreve direto no sistema".
- App é **PWA** — nunca prometer App Store/Google Play.
- Não prometer integrações inexistentes (Apple Health, Strava, multi-tenant).
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
- Páginas → Indexação: nº de páginas indexadas deve chegar a ~22 (13 antigas + termos,
  privacidade, blog + 6 posts) em 2–4 semanas. Se URLs ficarem em "Rastreada, não indexada",
  reforçar links internos e pedir indexação de novo.

**Mensal (15 min)**:
- GA4: sessões orgânicas → signups (taxa de conversão da landing).
- Buscar manualmente (janela anônima): "app para personal trainer", "sistema para personal
  trainer", "coachpilot" — anotar posição.
- Conferir se novos artigos entraram no índice (`site:coachpilot.com.br/blog`).

**Expectativa realista**: indexação em dias/semanas após as solicitações; primeiras posições em
long-tail em 4–8 semanas; competir nas head keywords ("app para personal trainer") exige meses de
conteúdo + backlinks — MFIT e Tecnofit têm anos de autoridade. O caminho é long-tail → autoridade
→ head terms.

## 5. Melhorias técnicas futuras (backlog, menor prioridade)

- **Fonts self-hosted**: Sora/Inter servidas do Google Fonts bloqueiam render (LCP). Já existem
  fontes em `frontend/public/fonts` — migrar com `@font-face` + preload.
- **PNGs pesadas** em `frontend/public/` (>1MB: novo-icon-treinos.png, og-image.png) — converter
  para WebP/otimizar (og-image.jpg já é a usada nas meta tags, ok).
- **llms.txt**: incluir os artigos do blog.
- **hreflang**: só se um dia houver versão em outro idioma.
- **Soft-404**: rotas inexistentes devolvem 200 com o shell (padrão SPA). Se o GSC apontar volume
  de soft-404, avaliar resposta 404 real na CloudFront Function.
