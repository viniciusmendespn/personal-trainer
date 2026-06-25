import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const dist = join(root, 'dist')
const baseUrl = 'https://coachpilot.com.br'

const pages = [
  {
    path: '/divulgadores',
    title: 'Divulgadores CoachPilot | Comissao recorrente',
    description: 'Programa de divulgadores do CoachPilot para indicar a plataforma a personal trainers e ganhar comissao recorrente.',
    h1: 'Ganhe comissao indicando o CoachPilot para outros personal trainers',
    intro: 'Divulgadores CoachPilot indicam a plataforma para outros profissionais e recebem comissao recorrente sobre assinaturas Gestao Pro ativas.',
    bullets: ['Comissao inicial de 25%', 'Pode subir para 30% ou 35%', 'Comissao somente sobre Gestao Pro', 'Contato pelo WhatsApp publico'],
  },
  {
    path: '/software-para-personal-trainer',
    title: 'Software para Personal Trainer no Brasil | CoachPilot',
    description: 'Software de gestao para personal trainers: alunos, treinos, avaliacoes fisicas, agenda, app do aluno e evolucao em um so lugar.',
    h1: 'Software para personal trainer que organiza alunos, treinos e evolucao',
    intro: 'O CoachPilot e uma plataforma SaaS brasileira para personal trainers que querem trocar planilhas, papel e mensagens soltas por uma gestao profissional.',
    bullets: ['Plano gratis para ate 3 alunos', 'Gestao Pro com alunos ilimitados', 'App do aluno via PWA, sem loja de aplicativos', 'Avaliacoes fisicas, agenda e evolucao centralizadas'],
  },
  {
    path: '/app-para-personal-trainer',
    title: 'App para Personal Trainer | CoachPilot',
    description: 'App web para personal trainer gerenciar alunos, treinos, agenda, avaliacoes e evolucao pelo navegador.',
    h1: 'App para personal trainer gerenciar a rotina em um so lugar',
    intro: 'O CoachPilot funciona pelo navegador e pode ser usado como app instalado na tela inicial, sem depender de app store.',
    bullets: ['Gestao pelo portal web', 'Acesso rapido no celular', 'Alunos e treinos centralizados', 'Plano gratis para comecar'],
  },
  {
    path: '/gestao-de-alunos-personal-trainer',
    title: 'Gestao de Alunos para Personal Trainer | CoachPilot',
    description: 'Organize cadastro, historico, treinos, avaliacoes e evolucao dos alunos em uma plataforma para personal trainers.',
    h1: 'Gestao de alunos para personal trainer sem planilhas espalhadas',
    intro: 'O CoachPilot centraliza dados do aluno para o personal acompanhar historico, treinos, avaliacoes fisicas, frequencia e evolucao.',
    bullets: ['Cadastro e historico por aluno', 'Treinos vinculados ao aluno', 'Avaliacoes e graficos de evolucao', 'Dashboard para acompanhar a operacao'],
  },
  {
    path: '/app-de-treino-para-alunos',
    title: 'App de Treino para Alunos | CoachPilot',
    description: 'Alunos acessam treino do dia pelo celular, registram evolucao e acompanham informacoes enviadas pelo personal.',
    h1: 'App de treino para alunos acessarem pelo celular',
    intro: 'O aluno recebe um link e acessa o treino pelo celular, sem criar uma rotina paralela de PDFs, fotos ou planilhas.',
    bullets: ['Treino do dia no celular', 'Acesso via link', 'PWA sem app store', 'Registros e evolucao ligados ao aluno'],
  },
  {
    path: '/avaliacao-fisica-digital',
    title: 'Avaliacao Fisica Digital para Personal Trainer | CoachPilot',
    description: 'Registre avaliacoes fisicas, medidas, fotos e evolucao dos alunos em uma plataforma para personal trainers.',
    h1: 'Avaliacao fisica digital para acompanhar evolucao de alunos',
    intro: 'O CoachPilot ajuda o personal a registrar avaliacoes fisicas e acompanhar a evolucao com historico organizado.',
    bullets: ['Medidas e fotos organizadas', 'Historico por aluno', 'Graficos de evolucao', 'Relatorios para demonstrar resultado'],
  },
  {
    path: '/agenda-para-personal-trainer',
    title: 'Agenda para Personal Trainer | CoachPilot',
    description: 'Agenda para personal trainer organizar sessoes, horarios e rotina de alunos dentro da plataforma CoachPilot.',
    h1: 'Agenda para personal trainer organizar sessoes e rotina',
    intro: 'A agenda do CoachPilot ajuda o personal a visualizar compromissos, reduzir esquecimentos e manter a operacao organizada.',
    bullets: ['Sessoes por aluno', 'Rotina centralizada', 'Base para lembretes', 'Integracao com a gestao do aluno'],
  },
  {
    path: '/whatsapp-para-personal-trainer',
    title: 'WhatsApp para Personal Trainer | CoachPilot',
    description: 'Canal WhatsApp opcional para personal trainer melhorar comunicacao com alunos usando o CoachPilot.',
    h1: 'WhatsApp para personal trainer com contexto de treino e aluno',
    intro: 'O CoachPilot trata WhatsApp como add-on opcional para facilitar comunicacao com alunos sem transformar a gestao em conversa perdida.',
    bullets: ['Canal WhatsApp opcional', 'Comunicacao com alunos', 'Base para assistente IA opcional', 'Gestao continua centralizada no CoachPilot'],
  },
  {
    path: '/coachpilot-vs-planilhas',
    title: 'CoachPilot vs Planilhas para Personal Trainer',
    description: 'Compare CoachPilot com planilhas e WhatsApp manual para gestao de alunos, treinos e avaliacoes fisicas.',
    h1: 'CoachPilot vs planilhas e WhatsApp manual',
    intro: 'Planilhas funcionam no comeco, mas ficam frageis quando o personal precisa organizar muitos alunos, avaliacoes, treinos e renovacoes.',
    bullets: ['Historico centralizado', 'App do aluno incluso', 'Avaliacoes com evolucao', 'Menos informacao perdida em conversas'],
  },
  {
    path: '/precos',
    title: 'Precos do CoachPilot | Plano Gratis e Gestao Pro',
    description: 'Conheca os precos do CoachPilot: plano gratis para ate 3 alunos, Gestao Pro por R$39,90/mes e add-ons opcionais.',
    h1: 'Precos do CoachPilot',
    intro: 'O CoachPilot separa gestao, WhatsApp e IA para o personal comecar gratis e pagar apenas quando precisar crescer.',
    bullets: ['Gratis: ate 3 alunos', 'Gestao Pro: R$39,90/mes com alunos ilimitados', 'Canal WhatsApp: +R$29,90/mes', 'Assistente IA: +R$4,90/aluno/mes'],
  },
  {
    path: '/faq',
    title: 'Perguntas Frequentes sobre o CoachPilot',
    description: 'Tire duvidas sobre plano gratis, Gestao Pro, app do aluno, WhatsApp, IA e uso do CoachPilot por personal trainers.',
    h1: 'Perguntas frequentes sobre o CoachPilot',
    intro: 'Respostas diretas para personal trainers que estao avaliando o CoachPilot.',
    bullets: ['Plano gratis ate 3 alunos', 'Gestao Pro com alunos ilimitados', 'App do aluno via PWA', 'WhatsApp e IA opcionais'],
  },
  {
    path: '/sobre',
    title: 'Sobre o CoachPilot',
    description: 'Conheca o CoachPilot, plataforma brasileira de gestao para personal trainers e studios de treinamento.',
    h1: 'Sobre o CoachPilot',
    intro: 'O CoachPilot e um SaaS brasileiro criado para ajudar personal trainers a profissionalizar a gestao de alunos, treinos e evolucao.',
    bullets: ['Feito para o mercado brasileiro', 'Foco em personal trainers e studios', 'Suporte em portugues', 'Contato via WhatsApp'],
  },
]

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function renderStaticContent(page) {
  const items = page.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
  return `<main style="font-family:Inter,Arial,sans-serif;max-width:920px;margin:0 auto;padding:48px 24px;color:#0f172a">
    <p style="font-weight:700;color:#0d9488;text-transform:uppercase">CoachPilot para personal trainers</p>
    <h1>${escapeHtml(page.h1)}</h1>
    <p>${escapeHtml(page.intro)}</p>
    <ul>${items}</ul>
    <p><a href="/signup">Comecar gratis</a> | <a href="/precos">Ver precos</a> | <a href="/">Pagina inicial</a></p>
  </main>`
}

function renderHomeContent() {
  return `<main style="font-family:Inter,Arial,sans-serif;max-width:960px;margin:0 auto;padding:48px 24px;color:#0f172a">
    <h1>CoachPilot - Gestao para personal trainers</h1>
    <p>Plataforma SaaS brasileira para personal trainers gerenciarem alunos, treinos, avaliacoes fisicas, agenda, app do aluno e evolucao em um so lugar.</p>
    <ul>
      <li>Plano gratis para ate 3 alunos.</li>
      <li>Gestao Pro por R$39,90/mes com alunos ilimitados.</li>
      <li>Canal WhatsApp e Assistente IA como add-ons opcionais.</li>
      <li>App do aluno via PWA, sem instalacao pela loja de aplicativos.</li>
    </ul>
    <p><a href="/signup">Comecar gratis</a> | <a href="/precos">Ver precos</a> | <a href="/software-para-personal-trainer">Software para personal trainer</a></p>
  </main>`
}

function renderPageSchema(page) {
  const canonical = `${baseUrl}${page.path}`
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${canonical}#webpage`,
    url: canonical,
    name: page.title,
    description: page.description,
    inLanguage: 'pt-BR',
    isPartOf: { '@id': `${baseUrl}/#website` },
    about: { '@id': `${baseUrl}/#app` },
  }).replaceAll('</', '<\\/')
}

function replaceOrInsertMeta(html, selectorRegex, tag) {
  if (selectorRegex.test(html)) return html.replace(selectorRegex, tag)
  return html.replace('</head>', `    ${tag}\n  </head>`)
}

function renderPage(template, page) {
  const canonical = `${baseUrl}${page.path}`
  let html = template
  html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(page.title)}</title>`)
  html = replaceOrInsertMeta(html, /<meta name="description" content=".*?" \/>/s, `<meta name="description" content="${escapeHtml(page.description)}" />`)
  html = replaceOrInsertMeta(html, /<link rel="canonical" href=".*?" \/>/s, `<link rel="canonical" href="${canonical}" />`)
  html = replaceOrInsertMeta(html, /<meta property="og:title" content=".*?" \/>/s, `<meta property="og:title" content="${escapeHtml(page.title)}" />`)
  html = replaceOrInsertMeta(html, /<meta property="og:description" content=".*?" \/>/s, `<meta property="og:description" content="${escapeHtml(page.description)}" />`)
  html = replaceOrInsertMeta(html, /<meta property="og:url" content=".*?" \/>/s, `<meta property="og:url" content="${canonical}" />`)
  html = replaceOrInsertMeta(html, /<meta name="twitter:title" content=".*?" \/>/s, `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`)
  html = replaceOrInsertMeta(html, /<meta name="twitter:description" content=".*?" \/>/s, `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`)
  html = html.replace('</head>', `    <script type="application/ld+json" id="static-page-json-ld">${renderPageSchema(page)}</script>\n  </head>`)
  html = html.replace('<div id="root"></div>', `<div id="root">${renderStaticContent(page)}</div>`)
  return html
}

const template = readFileSync(join(dist, 'index.html'), 'utf8')
writeFileSync(join(dist, 'index.html'), template.replace('<div id="root"></div>', `<div id="root">${renderHomeContent()}</div>`), 'utf8')

for (const page of pages) {
  const outDir = join(dist, page.path.slice(1))
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'index.html'), renderPage(template, page), 'utf8')
}

console.log(`Prerendered ${pages.length} public SEO pages.`)
