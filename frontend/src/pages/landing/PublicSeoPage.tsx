import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'
import LandingFooter from './LandingFooter'

type PageKey =
  | 'software-personal-trainer'
  | 'app-personal-trainer'
  | 'gestao-alunos'
  | 'app-treino-alunos'
  | 'avaliacao-fisica'
  | 'agenda-personal'
  | 'whatsapp-personal'
  | 'coachpilot-vs-planilhas'
  | 'precos'
  | 'faq'
  | 'sobre'

type SeoPage = {
  path: string
  title: string
  description: string
  h1: string
  intro: string
  bullets: string[]
  sections: { title: string; body: string }[]
  faqs: { q: string; a: string }[]
  related: PageKey[]
}

const BASE_URL = 'https://coachpilot.com.br'

const PAGES: Record<PageKey, SeoPage> = {
  'software-personal-trainer': {
    path: '/software-para-personal-trainer',
    title: 'Software para Personal Trainer no Brasil | CoachPilot',
    description: 'Software de gestão para personal trainers: alunos, treinos, avaliações físicas, agenda, app do aluno e evolução em um só lugar.',
    h1: 'Software para personal trainer que organiza alunos, treinos e evolução',
    intro: 'O CoachPilot é uma plataforma SaaS brasileira para personal trainers que querem trocar planilhas, papel e mensagens soltas por uma gestão profissional.',
    bullets: ['Plano grátis para até 3 alunos', 'Gestão Pro com alunos ilimitados', 'App do aluno via PWA, sem loja de aplicativos', 'Avaliações físicas, agenda e evolução centralizadas'],
    sections: [
      { title: 'Para quem é indicado', body: 'Personal trainers autônomos, studios pequenos e profissionais que atendem online ou presencialmente e precisam manter histórico confiável de cada aluno.' },
      { title: 'O que substitui', body: 'Substitui planilhas de treino, fichas impressas, controle manual de avaliações, agenda separada e mensagens de WhatsApp sem contexto.' },
      { title: 'Principal diferencial', body: 'O CoachPilot mantém aluno, treino, avaliação, agenda e evolução no mesmo ambiente, criando uma experiência mais profissional para o personal e para o aluno.' },
    ],
    faqs: [
      { q: 'O CoachPilot é um software para personal trainer?', a: 'Sim. Ele foi criado especificamente para personal trainers e studios organizarem alunos, treinos, avaliações físicas, agenda e evolução.' },
      { q: 'Funciona para personal online?', a: 'Sim. O aluno acessa o treino pelo celular via link, e o personal acompanha a evolução pelo portal.' },
    ],
    related: ['app-personal-trainer', 'gestao-alunos', 'precos'],
  },
  'app-personal-trainer': {
    path: '/app-para-personal-trainer',
    title: 'App para Personal Trainer | CoachPilot',
    description: 'App web para personal trainer gerenciar alunos, treinos, agenda, avaliações e evolução pelo navegador.',
    h1: 'App para personal trainer gerenciar a rotina em um só lugar',
    intro: 'O CoachPilot funciona pelo navegador e pode ser usado como app instalado na tela inicial, sem depender de app store.',
    bullets: ['Gestão pelo portal web', 'Acesso rápido no celular', 'Alunos e treinos centralizados', 'Plano grátis para começar'],
    sections: [
      { title: 'Portal do personal', body: 'O personal cadastra alunos, monta treinos, acompanha avaliações físicas e consulta a agenda pelo portal.' },
      { title: 'Experiência mobile', body: 'Por ser PWA, o CoachPilot pode ser salvo na tela inicial do celular e usado como aplicativo.' },
      { title: 'Gestão profissional', body: 'A proposta é reduzir retrabalho e dar ao aluno uma experiência mais organizada que planilhas ou PDFs soltos.' },
    ],
    faqs: [
      { q: 'Precisa instalar app nativo?', a: 'Não. O CoachPilot é uma aplicação web/PWA, acessada pelo navegador.' },
      { q: 'Dá para usar no celular?', a: 'Sim. Personal e aluno podem acessar pelo celular.' },
    ],
    related: ['app-treino-alunos', 'software-personal-trainer', 'precos'],
  },
  'gestao-alunos': {
    path: '/gestao-de-alunos-personal-trainer',
    title: 'Gestão de Alunos para Personal Trainer | CoachPilot',
    description: 'Organize cadastro, histórico, treinos, avaliações e evolução dos alunos em uma plataforma para personal trainers.',
    h1: 'Gestão de alunos para personal trainer sem planilhas espalhadas',
    intro: 'O CoachPilot centraliza dados do aluno para o personal acompanhar histórico, treinos, avaliações físicas, frequência e evolução.',
    bullets: ['Cadastro e histórico por aluno', 'Treinos vinculados ao aluno', 'Avaliações e gráficos de evolução', 'Dashboard para acompanhar a operação'],
    sections: [
      { title: 'Histórico centralizado', body: 'Cada aluno fica com dados, treinos, medidas, fotos e registros organizados em um único lugar.' },
      { title: 'Menos retrabalho', body: 'Templates de treino ajudam a reaproveitar estruturas sem perder personalização.' },
      { title: 'Mais retenção', body: 'Com evolução visível, lembretes e rotina organizada, o aluno percebe mais valor no acompanhamento.' },
    ],
    faqs: [
      { q: 'Quantos alunos posso cadastrar?', a: 'O plano grátis permite até 3 alunos. O Gestão Pro libera alunos ilimitados.' },
      { q: 'Serve para studio?', a: 'Sim, especialmente para studios pequenos que precisam organizar vários alunos com rotina recorrente.' },
    ],
    related: ['avaliacao-fisica', 'agenda-personal', 'precos'],
  },
  'app-treino-alunos': {
    path: '/app-de-treino-para-alunos',
    title: 'App de Treino para Alunos | CoachPilot',
    description: 'Alunos acessam treino do dia pelo celular, registram evolução e acompanham informações enviadas pelo personal.',
    h1: 'App de treino para alunos acessarem pelo celular',
    intro: 'O aluno recebe um link e acessa o treino pelo celular, sem criar uma rotina paralela de PDFs, fotos ou planilhas.',
    bullets: ['Treino do dia no celular', 'Acesso via link', 'PWA sem app store', 'Registros e evolução ligados ao aluno'],
    sections: [
      { title: 'Sem fricção para o aluno', body: 'O aluno abre o app pelo navegador e pode salvar na tela inicial como um aplicativo.' },
      { title: 'Treino com contexto', body: 'O treino fica ligado ao histórico do aluno, facilitando acompanhamento de evolução.' },
      { title: 'Imagem mais profissional', body: 'A entrega do treino em app próprio melhora a percepção de valor do serviço do personal.' },
    ],
    faqs: [
      { q: 'O aluno precisa baixar na loja?', a: 'Não. O app do aluno é PWA e funciona pelo navegador.' },
      { q: 'O aluno vê a evolução?', a: 'Sim. O CoachPilot mostra dados e registros conforme o personal usa a plataforma.' },
    ],
    related: ['app-personal-trainer', 'gestao-alunos', 'avaliacao-fisica'],
  },
  'avaliacao-fisica': {
    path: '/avaliacao-fisica-digital',
    title: 'Avaliação Física Digital para Personal Trainer | CoachPilot',
    description: 'Registre avaliações físicas, medidas, fotos e evolução dos alunos em uma plataforma para personal trainers.',
    h1: 'Avaliação física digital para acompanhar evolução de alunos',
    intro: 'O CoachPilot ajuda o personal a registrar avaliações físicas e acompanhar a evolução com histórico organizado.',
    bullets: ['Medidas e fotos organizadas', 'Histórico por aluno', 'Gráficos de evolução', 'Relatórios para demonstrar resultado'],
    sections: [
      { title: 'Evolução visível', body: 'Medidas e registros ficam organizados para o personal mostrar progresso de forma clara.' },
      { title: 'Retenção de alunos', body: 'Quando o aluno vê progresso, fica mais fácil justificar continuidade e renovação.' },
      { title: 'Menos arquivos soltos', body: 'Fotos e avaliações deixam de ficar perdidas no celular ou em pastas sem contexto.' },
    ],
    faqs: [
      { q: 'Dá para acompanhar medidas?', a: 'Sim. O CoachPilot permite registrar avaliações físicas e acompanhar evolução.' },
      { q: 'É útil para personal online?', a: 'Sim. Ajuda a manter histórico mesmo quando o acompanhamento acontece à distância.' },
    ],
    related: ['gestao-alunos', 'software-personal-trainer', 'app-treino-alunos'],
  },
  'agenda-personal': {
    path: '/agenda-para-personal-trainer',
    title: 'Agenda para Personal Trainer | CoachPilot',
    description: 'Agenda para personal trainer organizar sessões, horários e rotina de alunos dentro da plataforma CoachPilot.',
    h1: 'Agenda para personal trainer organizar sessões e rotina',
    intro: 'A agenda do CoachPilot ajuda o personal a visualizar compromissos, reduzir esquecimentos e manter a operação organizada.',
    bullets: ['Sessões por aluno', 'Rotina centralizada', 'Base para lembretes', 'Integração com a gestão do aluno'],
    sections: [
      { title: 'Agenda ligada ao aluno', body: 'A sessão não fica isolada: ela conversa com o cadastro e o acompanhamento do aluno.' },
      { title: 'Menos no-show', body: 'Com rotina mais clara e lembretes, o personal reduz faltas e confusões de horário.' },
      { title: 'Visão do dia', body: 'A agenda ajuda o profissional a entender rapidamente quem atende e o que precisa preparar.' },
    ],
    faqs: [
      { q: 'A agenda fica dentro do CoachPilot?', a: 'Sim. Ela faz parte da gestão do personal.' },
      { q: 'Tem lembretes automáticos?', a: 'O CoachPilot tem recursos de notificações e WhatsApp opcional para comunicação com alunos.' },
    ],
    related: ['whatsapp-personal', 'gestao-alunos', 'precos'],
  },
  'whatsapp-personal': {
    path: '/whatsapp-para-personal-trainer',
    title: 'WhatsApp para Personal Trainer | CoachPilot',
    description: 'Canal WhatsApp opcional para personal trainer melhorar comunicação com alunos usando o CoachPilot.',
    h1: 'WhatsApp para personal trainer com contexto de treino e aluno',
    intro: 'O CoachPilot trata WhatsApp como add-on opcional para facilitar comunicação com alunos sem transformar a gestão em conversa perdida.',
    bullets: ['Canal WhatsApp opcional', 'Comunicação com alunos', 'Base para assistente IA opcional', 'Gestão continua centralizada no CoachPilot'],
    sections: [
      { title: 'WhatsApp como canal, não como planilha', body: 'A proposta é usar WhatsApp para comunicação, mantendo dados importantes dentro da plataforma.' },
      { title: 'Add-on separado', body: 'O Canal WhatsApp é opcional e custa +R$29,90/mês, para o personal pagar apenas se fizer sentido.' },
      { title: 'IA opcional', body: 'O Assistente IA pode ser habilitado por aluno, com custo separado de +R$4,90/aluno/mês.' },
    ],
    faqs: [
      { q: 'WhatsApp está incluso no plano grátis?', a: 'Não. O Canal WhatsApp é um add-on opcional.' },
      { q: 'A IA é obrigatória?', a: 'Não. A IA é opcional e pode ser habilitada apenas para alunos selecionados.' },
    ],
    related: ['agenda-personal', 'precos', 'software-personal-trainer'],
  },
  'coachpilot-vs-planilhas': {
    path: '/coachpilot-vs-planilhas',
    title: 'CoachPilot vs Planilhas para Personal Trainer',
    description: 'Compare CoachPilot com planilhas e WhatsApp manual para gestão de alunos, treinos e avaliações físicas.',
    h1: 'CoachPilot vs planilhas e WhatsApp manual',
    intro: 'Planilhas funcionam no começo, mas ficam frágeis quando o personal precisa organizar muitos alunos, avaliações, treinos e renovações.',
    bullets: ['Histórico centralizado', 'App do aluno incluso', 'Avaliações com evolução', 'Menos informação perdida em conversas'],
    sections: [
      { title: 'Quando planilha basta', body: 'Para poucos alunos e rotina simples, uma planilha pode resolver o básico.' },
      { title: 'Quando a plataforma ajuda', body: 'Quando há vários alunos, treinos recorrentes, avaliações, agenda e necessidade de entregar uma experiência profissional.' },
      { title: 'Diferença prática', body: 'O CoachPilot organiza a operação inteira em torno do aluno, enquanto planilhas e WhatsApp deixam muitas informações soltas.' },
    ],
    faqs: [
      { q: 'CoachPilot substitui planilha?', a: 'Sim, para gestão de alunos, treinos, avaliações, agenda e acompanhamento de evolução.' },
      { q: 'Posso começar grátis?', a: 'Sim. O plano grátis permite gerenciar até 3 alunos.' },
    ],
    related: ['software-personal-trainer', 'gestao-alunos', 'precos'],
  },
  precos: {
    path: '/precos',
    title: 'Preços do CoachPilot | Plano Grátis e Gestão Pro',
    description: 'Conheça os preços do CoachPilot: plano grátis para até 3 alunos, Gestão Pro por R$39,90/mês e add-ons opcionais.',
    h1: 'Preços do CoachPilot',
    intro: 'O CoachPilot separa gestão, WhatsApp e IA para o personal começar grátis e pagar apenas quando precisar crescer.',
    bullets: ['Grátis: até 3 alunos', 'Gestão Pro: R$39,90/mês com alunos ilimitados', 'Canal WhatsApp: +R$29,90/mês', 'Assistente IA: +R$4,90/aluno/mês'],
    sections: [
      { title: 'Plano grátis', body: 'Permite testar o CoachPilot com até 3 alunos reais e recursos essenciais de gestão.' },
      { title: 'Gestão Pro', body: 'Indicado para personal trainers que querem gerenciar alunos ilimitados em uma plataforma profissional.' },
      { title: 'Add-ons opcionais', body: 'WhatsApp e IA são separados para evitar que o personal pague por recursos que ainda não usa.' },
    ],
    faqs: [
      { q: 'Preciso de cartão para começar?', a: 'A comunicação atual da landing informa entrada grátis; confirme no fluxo de cadastro se algum método de pagamento é solicitado.' },
      { q: 'Há fidelidade?', a: 'Não. A comunicação atual informa que não há fidelidade.' },
    ],
    related: ['software-personal-trainer', 'whatsapp-personal', 'faq'],
  },
  faq: {
    path: '/faq',
    title: 'Perguntas Frequentes sobre o CoachPilot',
    description: 'Tire dúvidas sobre plano grátis, Gestão Pro, app do aluno, WhatsApp, IA e uso do CoachPilot por personal trainers.',
    h1: 'Perguntas frequentes sobre o CoachPilot',
    intro: 'Respostas diretas para personal trainers que estão avaliando o CoachPilot.',
    bullets: ['Plano grátis até 3 alunos', 'Gestão Pro com alunos ilimitados', 'App do aluno via PWA', 'WhatsApp e IA opcionais'],
    sections: [
      { title: 'Resumo rápido', body: 'O CoachPilot é uma plataforma de gestão para personal trainers brasileiros organizarem alunos, treinos, agenda, avaliações e evolução.' },
      { title: 'Modelo comercial', body: 'Você pode começar grátis com até 3 alunos e fazer upgrade para Gestão Pro quando precisar de alunos ilimitados.' },
      { title: 'Canais opcionais', body: 'WhatsApp e Assistente IA são add-ons, não obrigações para usar a plataforma.' },
    ],
    faqs: [
      { q: 'O CoachPilot é gratuito?', a: 'Sim. Existe plano gratuito para até 3 alunos.' },
      { q: 'Quanto custa o Gestão Pro?', a: 'O Gestão Pro custa R$39,90/mês no preço de lançamento comunicado na landing.' },
      { q: 'O aluno precisa instalar app?', a: 'Não. O app do aluno funciona como PWA pelo navegador.' },
      { q: 'WhatsApp está incluso?', a: 'Não. O Canal WhatsApp é um add-on opcional.' },
      { q: 'A IA está inclusa?', a: 'Não. O Assistente IA é opcional e cobrado por aluno habilitado.' },
    ],
    related: ['precos', 'app-treino-alunos', 'whatsapp-personal'],
  },
  sobre: {
    path: '/sobre',
    title: 'Sobre o CoachPilot',
    description: 'Conheça o CoachPilot, plataforma brasileira de gestão para personal trainers e studios de treinamento.',
    h1: 'Sobre o CoachPilot',
    intro: 'O CoachPilot é um SaaS brasileiro criado para ajudar personal trainers a profissionalizar a gestão de alunos, treinos e evolução.',
    bullets: ['Feito para o mercado brasileiro', 'Foco em personal trainers e studios', 'Suporte em português', 'Contato via WhatsApp'],
    sections: [
      { title: 'Missão', body: 'Ajudar personal trainers a entregar uma experiência mais organizada e profissional para seus alunos.' },
      { title: 'Posicionamento', body: 'Gestão vem primeiro. IA e WhatsApp entram como add-ons opcionais para ampliar a operação quando fizer sentido.' },
      { title: 'Contato', body: 'O contato público de suporte e vendas é o WhatsApp +55 13 99183-0305.' },
    ],
    faqs: [
      { q: 'O CoachPilot atende o Brasil?', a: 'Sim. A comunicação e os preços são voltados ao mercado brasileiro.' },
      { q: 'Qual é a categoria do produto?', a: 'Software de gestão para fitness, personal training e studios.' },
    ],
    related: ['software-personal-trainer', 'precos', 'faq'],
  },
}

const LABELS: Record<PageKey, string> = Object.fromEntries(
  Object.entries(PAGES).map(([key, page]) => [key, page.h1.replace('CoachPilot vs ', 'Vs ')])
) as Record<PageKey, string>

function upsertMeta(selector: string, create: () => HTMLMetaElement | HTMLLinkElement, attr: string, value: string) {
  let el = document.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null
  if (!el) {
    el = create()
    document.head.appendChild(el)
  }
  el.setAttribute(attr, value)
}

function usePageMeta(page: SeoPage) {
  useEffect(() => {
    const canonical = `${BASE_URL}${page.path}`
    document.title = page.title
    upsertMeta('meta[name="description"]', () => {
      const el = document.createElement('meta')
      el.setAttribute('name', 'description')
      return el
    }, 'content', page.description)
    upsertMeta('link[rel="canonical"]', () => {
      const el = document.createElement('link')
      el.setAttribute('rel', 'canonical')
      return el
    }, 'href', canonical)
    upsertMeta('meta[property="og:title"]', () => {
      const el = document.createElement('meta')
      el.setAttribute('property', 'og:title')
      return el
    }, 'content', page.title)
    upsertMeta('meta[property="og:description"]', () => {
      const el = document.createElement('meta')
      el.setAttribute('property', 'og:description')
      return el
    }, 'content', page.description)
    upsertMeta('meta[property="og:url"]', () => {
      const el = document.createElement('meta')
      el.setAttribute('property', 'og:url')
      return el
    }, 'content', canonical)

    const schema = {
      '@context': 'https://schema.org',
      '@graph': [
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
          '@type': 'FAQPage',
          '@id': `${canonical}#faq`,
          mainEntity: page.faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.q,
            acceptedAnswer: { '@type': 'Answer', text: faq.a },
          })),
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${canonical}#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'CoachPilot', item: BASE_URL },
            { '@type': 'ListItem', position: 2, name: page.h1, item: canonical },
          ],
        },
      ],
    }
    let script = document.querySelector('#page-json-ld') as HTMLScriptElement | null
    if (!script) {
      script = document.createElement('script')
      script.id = 'page-json-ld'
      script.type = 'application/ld+json'
      document.head.appendChild(script)
    }
    script.textContent = JSON.stringify(schema)
  }, [page])
}

export function PublicSeoPage({ pageKey }: { pageKey: PageKey }) {
  const page = PAGES[pageKey]
  usePageMeta(page)

  return (
    <div style={{ minHeight: '100vh', background: '#fff', color: '#0f172a' }}>
      <header style={{ background: '#060a14', borderBottom: '1px solid rgba(20,184,166,0.14)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <img src="/novo-logo-slogan-semfundo.png" alt="CoachPilot" style={{ height: 52, width: 'auto' }} />
          </Link>
          <Link to="/" style={{ color: 'rgba(255,255,255,0.74)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600 }}>
            <ArrowLeft size={15} /> Voltar
          </Link>
        </div>
      </header>

      <main>
        <section style={{ background: 'linear-gradient(160deg, #0f172a 0%, #0a0e1a 55%, #060a14 100%)', padding: '72px 24px 64px' }}>
          <div style={{ maxWidth: 980, margin: '0 auto' }}>
            <p style={{ color: '#14b8a6', fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0, marginBottom: 16 }}>
              CoachPilot para personal trainers
            </p>
            <h1 style={{ fontFamily: "'Sora', sans-serif", color: '#fff', fontSize: 'clamp(32px, 5vw, 56px)', lineHeight: 1.1, maxWidth: 860, marginBottom: 20 }}>
              {page.h1}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 18, lineHeight: 1.7, maxWidth: 760, marginBottom: 32 }}>
              {page.intro}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <Link to="/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #14b8a6, #10b981)', color: '#fff', textDecoration: 'none', fontWeight: 800, padding: '14px 22px', borderRadius: 10 }}>
                Começar grátis <ArrowRight size={18} />
              </Link>
              <Link to="/precos" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.86)', textDecoration: 'none', fontWeight: 700, padding: '13px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.22)' }}>
                Ver preços
              </Link>
            </div>
          </div>
        </section>

        <section style={{ padding: '64px 24px', background: '#f8fafc' }}>
          <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {page.bullets.map((bullet) => (
              <div key={bullet} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <CheckCircle2 size={20} color="#14b8a6" style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ color: '#334155', fontWeight: 650, lineHeight: 1.45 }}>{bullet}</span>
              </div>
            ))}
          </div>
        </section>

        <section style={{ padding: '64px 24px', background: '#fff' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gap: 28 }}>
            {page.sections.map((section) => (
              <article key={section.title}>
                <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 26, marginBottom: 10 }}>{section.title}</h2>
                <p style={{ color: '#475569', fontSize: 16, lineHeight: 1.75 }}>{section.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section style={{ padding: '64px 24px', background: '#f0fdfa' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 30, marginBottom: 24 }}>Perguntas frequentes</h2>
            <div style={{ display: 'grid', gap: 14 }}>
              {page.faqs.map((faq) => (
                <article key={faq.q} style={{ background: '#fff', border: '1px solid rgba(20,184,166,0.18)', borderRadius: 12, padding: 22 }}>
                  <h3 style={{ fontSize: 17, marginBottom: 8 }}>{faq.q}</h3>
                  <p style={{ color: '#475569', lineHeight: 1.7 }}>{faq.a}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: '56px 24px', background: '#fff' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 24, marginBottom: 18 }}>Também pode ajudar</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {page.related.map((key) => (
                <Link key={key} to={PAGES[key].path} style={{ color: '#0f766e', textDecoration: 'none', fontWeight: 700, background: '#f0fdfa', border: '1px solid rgba(20,184,166,0.22)', borderRadius: 999, padding: '10px 14px' }}>
                  {LABELS[key]}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}

export { PAGES }
