// Prerender das páginas públicas (postbuild).
// Gera dist/<rota>/index.html com title/meta/canonical/JSON-LD e o CONTEÚDO
// COMPLETO de cada página (crawlers sem JS veem a página inteira), além do
// sitemap.xml com lastmod do build.
//
// Fontes de conteúdo (únicas, compartilhadas com o React):
//   - src/pages/landing/publicSeoData.js  (páginas SEO + termos/privacidade)
//   - src/pages/landing/blogData.js       (artigos do blog)
//
// ⚠️ Ao adicionar rota prerenderizada aqui, incluir o path na lista
// PRERENDERED da SpaRouterFunction (backend/template.yaml) — sem isso a CDN
// serve o shell da home no lugar do HTML gerado.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BASE_URL, PAGES } from '../src/pages/landing/publicSeoData.js'
import { BLOG_POSTS, BLOG_BASE } from '../src/pages/landing/blogData.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const dist = join(root, 'dist')
const buildDate = new Date().toISOString().slice(0, 10)

// /divulgadores tem página React própria (DivulgadoresPage) — só o fallback vive aqui.
const DIVULGADORES = {
  path: '/divulgadores',
  title: 'Divulgadores CoachPilot | Comissão recorrente',
  description: 'Programa de divulgadores do CoachPilot para indicar a plataforma a personal trainers e ganhar comissão recorrente.',
  h1: 'Ganhe comissão indicando o CoachPilot para outros personal trainers',
  intro: 'Divulgadores CoachPilot indicam a plataforma para outros profissionais e recebem comissão recorrente sobre assinaturas Gestão Pro ativas.',
  bullets: ['Comissão recorrente enquanto o cliente estiver ativo', 'Escada de comissão que cresce com a sua carteira', 'Comissão somente sobre Gestão Pro', 'Contato pelo WhatsApp público'],
  sections: [],
  faqs: [],
  related: [],
}

const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} de ${MES[m - 1]} de ${y}`
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

// [texto](/caminho) → <a href="/caminho">texto</a> (mesmo formato do React)
function inline(text) {
  return escapeHtml(text).replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
}

const CTA = '<p><a href="/signup">Começar grátis</a> | <a href="/precos">Ver preços</a> | <a href="/">Página inicial</a></p>'

function renderSeoPageContent(page) {
  const bullets = page.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
  const sections = page.sections
    .map((s) => `<section><h2>${escapeHtml(s.title)}</h2><p>${escapeHtml(s.body)}</p></section>`)
    .join('')
  const faqs = page.faqs.length
    ? `<section><h2>Perguntas frequentes</h2>${page.faqs.map((f) => `<h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p>`).join('')}</section>`
    : ''
  const related = page.related.length
    ? `<p>Veja também: ${page.related.map((key) => `<a href="${PAGES[key].path}">${escapeHtml(PAGES[key].h1)}</a>`).join(' · ')}</p>`
    : ''
  return `<main style="font-family:Inter,Arial,sans-serif;max-width:920px;margin:0 auto;padding:48px 24px;color:#0f172a">
    <p style="font-weight:700;color:#0d9488;text-transform:uppercase">CoachPilot para personal trainers</p>
    <h1>${escapeHtml(page.h1)}</h1>
    <p>${escapeHtml(page.intro)}</p>
    <ul>${bullets}</ul>
    ${sections}
    ${faqs}
    ${related}
    ${CTA}
  </main>`
}

function renderBlogPostContent(post) {
  const sections = post.sections.map((s) => {
    const paragraphs = s.paragraphs.map((p) => `<p>${inline(p)}</p>`).join('')
    const list = s.list ? `<ul>${s.list.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>` : ''
    const table = s.table
      ? `<table border="1" cellpadding="6" style="border-collapse:collapse"><thead><tr>${s.table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${s.table.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
      : ''
    return `<section><h2>${escapeHtml(s.h2)}</h2>${paragraphs}${list}${table}</section>`
  }).join('')
  const faqs = post.faqs.length
    ? `<section><h2>Perguntas frequentes</h2>${post.faqs.map((f) => `<h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p>`).join('')}</section>`
    : ''
  const related = post.related.length
    ? `<p>Leia também: ${post.related.map((r) => `<a href="${r.to}">${escapeHtml(r.label)}</a>`).join(' · ')}</p>`
    : ''
  return `<main style="font-family:Inter,Arial,sans-serif;max-width:820px;margin:0 auto;padding:48px 24px;color:#0f172a">
    <p style="font-weight:700;color:#0d9488;text-transform:uppercase"><a href="/blog">Blog CoachPilot</a></p>
    <article>
      <h1>${escapeHtml(post.h1)}</h1>
      <p>Publicado em ${formatDate(post.datePublished)} · ${post.readingMinutes} min de leitura</p>
      <p>${escapeHtml(post.intro)}</p>
      ${sections}
      ${faqs}
      ${related}
    </article>
    ${CTA}
  </main>`
}

function renderBlogIndexContent() {
  const items = BLOG_POSTS.map((post) =>
    `<li><a href="/blog/${post.slug}"><strong>${escapeHtml(post.h1)}</strong></a><br>${escapeHtml(post.description)}</li>`
  ).join('')
  return `<main style="font-family:Inter,Arial,sans-serif;max-width:920px;margin:0 auto;padding:48px 24px;color:#0f172a">
    <h1>${escapeHtml(BLOG_BASE.h1)}</h1>
    <p>${escapeHtml(BLOG_BASE.intro)}</p>
    <ul>${items}</ul>
    ${CTA}
  </main>`
}

function renderHomeContent() {
  const featured = BLOG_POSTS.slice(0, 3)
    .map((post) => `<li><a href="/blog/${post.slug}">${escapeHtml(post.h1)}</a></li>`)
    .join('')
  return `<main style="font-family:Inter,Arial,sans-serif;max-width:960px;margin:0 auto;padding:48px 24px;color:#0f172a">
    <h1>CoachPilot — Gestão para personal trainers</h1>
    <p>Plataforma SaaS brasileira para personal trainers gerenciarem alunos, treinos, avaliações físicas, agenda, financeiro, app do aluno e evolução em um só lugar — com operação por IA gratuita para montar treinos e migrar alunos sem digitar série a série.</p>
    <section>
      <h2>Tudo que você precisa para profissionalizar sua gestão</h2>
      <ul>
        <li>Gestão de alunos com histórico completo: treinos, avaliações, fotos e registros vinculados a cada aluno.</li>
        <li>Treinos com templates e rotinas ABC/ABCDE reutilizáveis, com séries, repetições, carga e intervalo.</li>
        <li><a href="/avaliacao-fisica-digital">Avaliações físicas</a> com medidas, fotos comparativas e gráficos de evolução automáticos.</li>
        <li><a href="/agenda-para-personal-trainer">Agenda</a> com lembretes e central de pendências (treinos vencendo, dores, dúvidas).</li>
        <li><a href="/app-de-treino-para-alunos">App do aluno</a> via PWA com gamificação: ranking, conquistas e streaks.</li>
        <li>Financeiro com cobrança via Pix direto na conta do personal, sem taxa da plataforma.</li>
        <li><a href="/whatsapp-para-personal-trainer">Canal WhatsApp e Assistente IA do aluno</a> como add-ons opcionais.</li>
      </ul>
    </section>
    <section>
      <h2>Pare de digitar série a série — converse com a IA</h2>
      <p>Monte pacotes de treino e migre a sua carteira inteira de alunos (planilha, PDF ou print) conversando com o ChatGPT, Claude ou Gemini que você já usa: a IA gera tudo no formato do CoachPilot e você importa com um clique, revisando antes de aplicar. Grátis em todos os planos.</p>
    </section>
    <section>
      <h2>Planos simples</h2>
      <ul>
        <li>Plano grátis: até 3 alunos, sem prazo e sem cartão.</li>
        <li>Gestão Pro: R$39,90/mês (promoção de lançamento) com alunos ilimitados.</li>
        <li>Add-ons opcionais: Canal WhatsApp (+R$29,90/mês) e Assistente IA do aluno (+R$4,90/aluno/mês).</li>
        <li>Sem fidelidade, sem multa, pagamento via Pix. <a href="/precos">Ver preços completos</a>.</li>
      </ul>
    </section>
    <section>
      <h2>Do blog</h2>
      <ul>${featured}</ul>
      <p><a href="/blog">Ver todos os artigos</a></p>
    </section>
    <section>
      <h2>Perguntas frequentes</h2>
      <h3>O CoachPilot é gratuito?</h3>
      <p>Sim. O plano gratuito permite gerenciar até 3 alunos com os recursos essenciais. Para alunos ilimitados, o Gestão Pro custa R$39,90/mês.</p>
      <h3>Preciso instalar algum aplicativo?</h3>
      <p>Não. O CoachPilot é uma plataforma web (PWA): você gerencia pelo navegador e o aluno acessa o treino pelo celular via link, sem loja de aplicativos.</p>
      <h3>Funciona para personal trainer online?</h3>
      <p>Sim. Você prescreve pelo portal e o aluno treina de qualquer lugar com registro de cargas e evolução visível.</p>
    </section>
    <p><a href="/signup">Começar grátis</a> | <a href="/precos">Ver preços</a> | <a href="/software-para-personal-trainer">Software para personal trainer</a> | <a href="https://loja.coachpilot.com.br">Loja CoachPilot: marketplace de pacotes de treino</a></p>
    <p><a href="/termos">Termos de Uso</a> · <a href="/privacidade">Política de Privacidade</a> · <a href="/divulgadores">Divulgadores</a></p>
  </main>`
}

function jsonLd(graph) {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replaceAll('</', '<\\/')
}

function pageSchema(page) {
  const canonical = `${BASE_URL}${page.path}`
  const graph = [
    {
      '@type': 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: page.title,
      description: page.description,
      inLanguage: 'pt-BR',
      isPartOf: { '@id': `${BASE_URL}/#website` },
      about: { '@id': `${BASE_URL}/#app` },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'CoachPilot', item: BASE_URL },
        { '@type': 'ListItem', position: 2, name: page.h1, item: canonical },
      ],
    },
  ]
  if (page.faqs.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${canonical}#faq`,
      mainEntity: page.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    })
  }
  return jsonLd(graph)
}

function postSchema(post) {
  const canonical = `${BASE_URL}/blog/${post.slug}`
  const graph = [
    {
      '@type': 'BlogPosting',
      '@id': `${canonical}#article`,
      headline: post.h1,
      description: post.description,
      datePublished: post.datePublished,
      dateModified: post.dateModified,
      inLanguage: 'pt-BR',
      mainEntityOfPage: canonical,
      author: { '@type': 'Organization', name: 'CoachPilot', '@id': `${BASE_URL}/#organization` },
      publisher: { '@id': `${BASE_URL}/#organization` },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'CoachPilot', item: BASE_URL },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${BASE_URL}/blog` },
        { '@type': 'ListItem', position: 3, name: post.h1, item: canonical },
      ],
    },
  ]
  if (post.faqs.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${canonical}#faq`,
      mainEntity: post.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    })
  }
  return jsonLd(graph)
}

function blogIndexSchema() {
  const canonical = `${BASE_URL}/blog`
  return jsonLd([
    {
      '@type': 'Blog',
      '@id': `${canonical}#blog`,
      name: BLOG_BASE.title,
      description: BLOG_BASE.description,
      url: canonical,
      inLanguage: 'pt-BR',
      publisher: { '@id': `${BASE_URL}/#organization` },
    },
  ])
}

function replaceOrInsertMeta(html, selectorRegex, tag) {
  if (selectorRegex.test(html)) return html.replace(selectorRegex, tag)
  return html.replace('</head>', `    ${tag}\n  </head>`)
}

// Troca title/description/canonical/OG do template pelo da rota e injeta o
// JSON-LD específico + conteúdo estático dentro de #root.
function renderRoute(template, { path, title, description, schema, content, ogType = 'website' }) {
  const canonical = `${BASE_URL}${path}`
  let html = template
  html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`)
  html = replaceOrInsertMeta(html, /<meta name="description" content=".*?" \/>/s, `<meta name="description" content="${escapeHtml(description)}" />`)
  html = replaceOrInsertMeta(html, /<link rel="canonical" href=".*?" \/>/s, `<link rel="canonical" href="${canonical}" />`)
  html = replaceOrInsertMeta(html, /<meta property="og:type" content=".*?" \/>/s, `<meta property="og:type" content="${ogType}" />`)
  html = replaceOrInsertMeta(html, /<meta property="og:title" content=".*?" \/>/s, `<meta property="og:title" content="${escapeHtml(title)}" />`)
  html = replaceOrInsertMeta(html, /<meta property="og:description" content=".*?" \/>/s, `<meta property="og:description" content="${escapeHtml(description)}" />`)
  html = replaceOrInsertMeta(html, /<meta property="og:url" content=".*?" \/>/s, `<meta property="og:url" content="${canonical}" />`)
  html = replaceOrInsertMeta(html, /<meta name="twitter:title" content=".*?" \/>/s, `<meta name="twitter:title" content="${escapeHtml(title)}" />`)
  html = replaceOrInsertMeta(html, /<meta name="twitter:description" content=".*?" \/>/s, `<meta name="twitter:description" content="${escapeHtml(description)}" />`)
  html = html.replace('</head>', `    <script type="application/ld+json" id="static-page-json-ld">${schema}</script>\n  </head>`)
  html = html.replace('<div id="root"></div>', `<div id="root">${content}</div>`)
  return html
}

function writeRoute(path, html) {
  const outDir = join(dist, path.replace(/^\//, ''))
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'index.html'), html, 'utf8')
}

// ── Sitemap ──────────────────────────────────────────────────────────────────
const PRIORITY = {
  '/': { priority: '1.0', changefreq: 'weekly' },
  '/software-para-personal-trainer': { priority: '0.9', changefreq: 'monthly' },
  '/app-para-personal-trainer': { priority: '0.85', changefreq: 'monthly' },
  '/gestao-de-alunos-personal-trainer': { priority: '0.85', changefreq: 'monthly' },
  '/precos': { priority: '0.85', changefreq: 'monthly' },
  '/app-de-treino-para-alunos': { priority: '0.8', changefreq: 'monthly' },
  '/avaliacao-fisica-digital': { priority: '0.8', changefreq: 'monthly' },
  '/agenda-para-personal-trainer': { priority: '0.8', changefreq: 'monthly' },
  '/coachpilot-vs-planilhas': { priority: '0.8', changefreq: 'monthly' },
  '/divulgadores': { priority: '0.8', changefreq: 'monthly' },
  '/whatsapp-para-personal-trainer': { priority: '0.75', changefreq: 'monthly' },
  '/faq': { priority: '0.75', changefreq: 'monthly' },
  '/blog': { priority: '0.75', changefreq: 'weekly' },
  '/sobre': { priority: '0.65', changefreq: 'monthly' },
  '/termos': { priority: '0.3', changefreq: 'yearly' },
  '/privacidade': { priority: '0.3', changefreq: 'yearly' },
}

function buildSitemap() {
  const staticUrls = Object.entries(PRIORITY).map(([path, meta]) => ({ loc: `${BASE_URL}${path === '/' ? '/' : path}`, lastmod: buildDate, ...meta }))
  const postUrls = BLOG_POSTS.map((post) => ({
    loc: `${BASE_URL}/blog/${post.slug}`,
    lastmod: post.dateModified,
    priority: '0.7',
    changefreq: 'monthly',
  }))
  const entries = [...staticUrls, ...postUrls]
    .map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`
}

// ── Execução ─────────────────────────────────────────────────────────────────
const template = readFileSync(join(dist, 'index.html'), 'utf8')

// Home: injeta fallback rico no index.html raiz
writeFileSync(join(dist, 'index.html'), template.replace('<div id="root"></div>', `<div id="root">${renderHomeContent()}</div>`), 'utf8')

let count = 0

// Páginas SEO + termos/privacidade + divulgadores
for (const page of [...Object.values(PAGES), DIVULGADORES]) {
  writeRoute(page.path, renderRoute(template, {
    path: page.path,
    title: page.title,
    description: page.description,
    schema: pageSchema(page),
    content: renderSeoPageContent(page),
  }))
  count++
}

// Blog: índice + artigos
writeRoute('/blog', renderRoute(template, {
  path: '/blog',
  title: BLOG_BASE.title,
  description: BLOG_BASE.description,
  schema: blogIndexSchema(),
  content: renderBlogIndexContent(),
}))
count++
for (const post of BLOG_POSTS) {
  writeRoute(`/blog/${post.slug}`, renderRoute(template, {
    path: `/blog/${post.slug}`,
    title: post.title,
    description: post.description,
    schema: postSchema(post),
    content: renderBlogPostContent(post),
    ogType: 'article',
  }))
  count++
}

writeFileSync(join(dist, 'sitemap.xml'), buildSitemap(), 'utf8')

console.log(`Prerendered ${count} public pages + home fallback + sitemap.xml (lastmod ${buildDate}).`)
