// Fonte única do Mídia Kit público (coachpilot.com.br/midia-kit).
// Consumida pelo React (MediaKitPage.tsx) E pelo prerender em build-time
// (scripts/prerender-public-pages.mjs) — por isso é .js puro, sem imports.
// Tipos espelho em mediaKitData.d.ts.
//
// ⚠️ Esta página é institucional e pública: só entra aqui número verificável e
// afirmação que o Kit do Divulgador autoriza (estrategia/kit-divulgador/
// KIT_DIVULGADOR.md §6). Nada de "parceria/integração oficial da OpenAI" — a
// formulação correta é "app publicado e aprovado no diretório de apps do ChatGPT".
// Regras de comissão NÃO são duplicadas aqui: a fonte é /divulgadores.

export const MEDIA_KIT_PATH = '/midia-kit'

// WhatsApp oficial de vendas/suporte — o mesmo da landing e do /sobre.
const WA = '5513988088204'
const wa = (texto) => `https://wa.me/${WA}?text=${encodeURIComponent(texto)}`

export const MEDIA_KIT = {
  path: MEDIA_KIT_PATH,
  title: 'Mídia Kit CoachPilot | Parcerias, IA e Personal Trainers',
  description:
    'Conheça o CoachPilot, plataforma brasileira de gestão para personal trainers com Inteligência Artificial, e veja oportunidades de parceria, divulgação e conteúdo.',

  hero: {
    eyebrow: 'Mídia Kit · Parcerias',
    h1: 'Tecnologia e Inteligência Artificial para personal trainers',
    subheadline:
      'O CoachPilot é uma plataforma brasileira de gestão para personal trainers que reúne alunos, treinos, avaliações, evolução, agenda e financeiro em um só lugar — com um app publicado no diretório de plugins do ChatGPT para consultar informações e operar treinos conversando.',
    ctaPrimario: { label: 'Conhecer o CoachPilot', href: 'https://coachpilot.com.br', event: 'media_kit_site_click' },
    ctaSecundario: {
      label: 'Falar sobre uma parceria',
      href: wa('Oi! Vi o mídia kit do CoachPilot e quero conversar sobre uma parceria.'),
      event: 'media_kit_whatsapp_click',
    },
  },

  // ── CoachPilot em 30 segundos ──────────────────────────────────────────────
  resumo: {
    titulo: 'O CoachPilot em 30 segundos',
    paragrafo:
      'O CoachPilot foi criado para simplificar a rotina de personal trainers. O profissional gerencia alunos, prescreve treinos, acompanha evolução, organiza agenda e financeiro e entrega uma experiência digital ao aluno. Com os recursos de IA e o app no ChatGPT, boa parte do trabalho operacional pode ser consultada ou executada por conversa — mas quem prescreve continua sendo o personal, com CREF.',
    cards: [
      { titulo: 'Gestão de alunos', desc: 'Histórico, anamnese, avaliações, treinos e evolução centralizados em cada aluno.' },
      { titulo: 'Prescrição de treinos', desc: 'Templates, rotinas ABC/ABCDE reutilizáveis e acompanhamento da execução série a série.' },
      { titulo: 'App do aluno', desc: 'PWA sem loja de aplicativos: treino do dia, cargas, histórico, evolução, ranking, conquistas e streak.' },
      { titulo: 'Inteligência Artificial', desc: 'Montagem de pacotes de treino e migração da carteira por conversa, com revisão antes de aplicar.' },
      { titulo: 'CoachPilot no ChatGPT', desc: 'O personal consulta os próprios dados e opera as funções suportadas em linguagem natural, direto no chat.' },
      { titulo: 'Agenda e financeiro', desc: 'Sessões, lembretes e cobrança via Pix na conta do próprio personal, sem taxa da plataforma.' },
    ],
  },

  // ── Público ────────────────────────────────────────────────────────────────
  publico: {
    titulo: 'Falamos direto com quem vive o mercado de personal training',
    intro:
      'O CoachPilot não é um app fitness para consumidor final. O público é o profissional de Educação Física — e isso costuma ser o que uma marca precisa saber primeiro para avaliar afinidade de audiência.',
    itens: [
      'Personal trainers presenciais',
      'Personal trainers online',
      'Profissionais de Educação Física',
      'Donos de estúdios pequenos',
      'Profissionais começando o atendimento particular',
      'Quem quer digitalizar a própria gestão',
      'Quem se interessa por IA aplicada ao fitness',
    ],
    nota:
      'Audiência B2B dentro do fitness: quem compra é o profissional, não o aluno final. Marcas de equipamento, formação, serviços e conteúdo para personal trainers falam com exatamente as mesmas pessoas.',
  },

  // ── Diferenciais ───────────────────────────────────────────────────────────
  diferenciais: [
    {
      titulo: 'IA ligada aos dados reais do personal',
      desc: 'Não é geração de texto solta: a IA lê os alunos, anamneses, avaliações e sessões daquele profissional e trabalha em cima disso.',
    },
    {
      titulo: 'App publicado no diretório do ChatGPT',
      desc: 'O personal instala o CoachPilot no ChatGPT que já usa e opera a plataforma conversando. Por baixo é o padrão aberto MCP, então vale também para Claude e Gemini.',
    },
    {
      titulo: 'Tudo em um só lugar',
      desc: 'Aluno, treino, avaliação, evolução, agenda, financeiro e a experiência do aluno no mesmo ambiente.',
    },
    {
      titulo: 'Começo simples',
      desc: 'Plano gratuito para até 3 alunos, sem prazo e sem cartão. O Gestão Pro é R$39,90/mês, sem fidelidade.',
    },
    {
      titulo: 'Feito para personal trainer',
      desc: 'Posicionamento vertical: não é software genérico de academia adaptado, é produto pensado para o atendimento individual.',
    },
    {
      titulo: 'Experiência do aluno',
      desc: 'App PWA com gamificação — ranking, conquistas e streaks — que aumenta a adesão ao treino e a percepção de valor do serviço.',
    },
  ],

  // ── Números ────────────────────────────────────────────────────────────────
  // REGRA: nunca inventar número. Só entra aqui o que for verificável e já
  // autorizado nos materiais oficiais (KIT_DIVULGADOR.md §6).
  metricas: [
    { valor: '+500', label: 'alunos gerenciados na plataforma' },
    { valor: '3', label: 'IAs conectáveis: ChatGPT, Claude e Gemini' },
    { valor: 'R$ 39,90', label: 'plano Gestão Pro por mês, sem fidelidade' },
    { valor: '0', label: 'custo para começar — até 3 alunos, sem prazo' },
  ],
  metricasNota:
    'Números verificados e mantidos atualizados. Dados de audiência e desempenho por campanha são compartilhados sob demanda na conversa comercial.',

  // ── Por que fazer parceria ────────────────────────────────────────────────
  parceria: {
    titulo: 'Por que fazer parceria com o CoachPilot?',
    paragrafo:
      'O CoachPilot está na interseção entre fitness, tecnologia e Inteligência Artificial. Buscamos parceiros que já conversem com personal trainers e profissionais de Educação Física para criar conteúdo útil, demonstrações reais e benefícios exclusivos para suas audiências.',
    beneficios: [
      'Produto com forte apelo demonstrativo — dá para mostrar funcionando em 30 segundos de vídeo',
      'IA no ChatGPT é assunto que gera curiosidade e alcance orgânico',
      'Cupom individual rastreável para medir o resultado da ação',
      'Benefício exclusivo para a sua audiência',
      'Comissão recorrente enquanto o indicado continuar ativo',
      'Ações pontuais ou relacionamento de longo prazo',
      'Material de apoio, roteiros e conta de demonstração disponíveis',
    ],
  },

  // ── Formatos de parceria ──────────────────────────────────────────────────
  // O eixo é o Programa de Divulgadores (cupom rastreável + comissão recorrente).
  // Percentuais e faixas NÃO são repetidos aqui — a fonte é /divulgadores.
  formatos: [
    {
      titulo: 'Programa de Divulgadores',
      destaque: true,
      desc: 'O formato principal. Você recebe um cupom exclusivo e rastreável, a sua audiência ganha um benefício ao assinar e você recebe comissão recorrente sobre cada assinatura Gestão Pro ativa gerada pelo seu cupom — todo mês, enquanto o cliente permanecer.',
      itens: [
        'Cupom individual rastreável por parceiro',
        'Comissão recorrente sobre as vendas do cupom, não pagamento único',
        'Comissão que sobe conforme a carteira de indicados cresce',
        'Camada de Embaixador da Marca, por convite, com a maior comissão do programa',
      ],
      cta: { label: 'Ver as regras do programa', href: '/divulgadores', event: 'media_kit_divulgadores_click' },
    },
    {
      titulo: 'Conteúdo com creators',
      desc: 'Reels, stories, review, tutorial e demonstração real da plataforma — combinados com o cupom rastreável do parceiro, para medir o retorno de cada peça.',
      itens: ['Reels e stories', 'Review e teste da plataforma', 'Tutorial de uso', 'Conteúdo sobre IA na rotina do personal'],
    },
    {
      titulo: 'Parcerias com empresas',
      desc: 'Marcas que já vendem para personal trainers podem oferecer o CoachPilot como benefício à própria base, com cupom exclusivo da marca e comissão recorrente sobre o que ele gerar.',
      itens: ['Co-marketing e conteúdo conjunto', 'Campanha para a base de clientes', 'Benefício cruzado', 'Eventos, workshops e kits'],
    },
    {
      titulo: 'Educação',
      desc: 'Faculdades, cursos e professores usando o CoachPilot como ferramenta de aula, com cupom da instituição para os alunos formados.',
      itens: ['Faculdades e cursos técnicos', 'Professores e coordenadores', 'Workshops de IA na rotina do personal'],
    },
  ],
  formatosNota:
    'Percentuais, faixas e condições vigentes ficam em uma fonte só, a página do programa — assim nenhum material fica desatualizado.',

  // ── Sinergia ──────────────────────────────────────────────────────────────
  sinergia: {
    titulo: 'Uma parceria que faça sentido',
    paragrafo:
      'Procuramos marcas que compartilhem o mesmo público, mesmo quando os produtos são diferentes. Uma empresa pode oferecer equipamentos, formação, serviços ou conteúdo para personal trainers, enquanto o CoachPilot oferece a camada de tecnologia e gestão. Essa complementaridade abre espaço para campanhas que entregam valor real ao profissional — sem que as marcas concorram entre si.',
    colunas: [
      { titulo: 'O parceiro traz', desc: 'Equipamentos, serviços, formação, produtos ou audiência no mercado fitness.' },
      { titulo: 'O CoachPilot traz', desc: 'Tecnologia, gestão, experiência digital e Inteligência Artificial para o personal trainer.' },
      { titulo: 'A audiência recebe', desc: 'Benefício, conteúdo e ofertas relevantes, sem competição direta entre as marcas.' },
    ],
  },

  // ── Prova visual ──────────────────────────────────────────────────────────
  // Prints REAIS, capturados na conta de demonstração (demo@coachpilot.com.br).
  // Recapturar: scripts do mídia kit descritos em MIDIA_KIT_COACHPILOT.md §26.
  // ⚠️ Nenhum print pode conter o "Link do app do aluno" — o token dá acesso real
  // ao app daquele aluno e esta página é pública.
  provaVisual: {
    titulo: 'O produto por dentro',
    intro: 'Prints reais da plataforma — dá para entender o CoachPilot sem criar conta.',
    // O banner /plugin-chatgpt.png da landing NÃO entra aqui: ele estampa
    // "aprovado pela OpenAI", e §25 do plano proíbe qualquer linguagem de
    // endosso nesta página. O app no ChatGPT é citado em texto, que é preciso.
    imagens: [
      { src: '/media-kit/treino.webp', alt: 'Tela de prescrição de treino do CoachPilot, com exercícios, séries, repetições e intervalo', legenda: 'Prescrição de treino: séries, repetições, intervalo, vídeo do exercício e histórico de carga.', largo: true },
      { src: '/media-kit/portal.webp', alt: 'Dashboard do portal do personal trainer no CoachPilot', legenda: 'Portal do personal: carteira, aderência, financeiro e atividade recente do dia.' },
      { src: '/media-kit/recordes.webp', alt: 'Tela de evolução do aluno com recordes por exercício', legenda: 'Evolução por aluno: sessões, volume total e recorde de carga em cada exercício.' },
      { src: '/media-kit/ranking.webp', alt: 'Ranking de alunos com pontos de gamificação', legenda: 'Gamificação: ranking entre os alunos do personal, por semana, mês e geral.' },
      { src: '/media-kit/app-aluno.webp', alt: 'App do aluno do CoachPilot aberto no celular', legenda: 'App do aluno (PWA): treino do dia, pontos, ranking e sequência de semanas.', largo: true, retrato: true },
    ],
  },

  // ── Links oficiais ────────────────────────────────────────────────────────
  links: [
    { label: 'Site oficial', valor: 'coachpilot.com.br', href: 'https://coachpilot.com.br', event: 'media_kit_site_click' },
    { label: 'App do aluno', valor: 'app.coachpilot.com.br', href: 'https://app.coachpilot.com.br' },
    { label: 'Loja de pacotes de treino', valor: 'loja.coachpilot.com.br', href: 'https://loja.coachpilot.com.br' },
    { label: 'Programa de divulgadores', valor: 'coachpilot.com.br/divulgadores', href: '/divulgadores', event: 'media_kit_divulgadores_click' },
    { label: 'O CoachPilot no ChatGPT', valor: 'coachpilot.com.br/chatgpt-para-personal-trainer', href: '/chatgpt-para-personal-trainer' },
    { label: 'Instagram', valor: '@coachpilotoficial', href: 'https://instagram.com/coachpilotoficial', event: 'media_kit_instagram_click' },
    { label: 'WhatsApp comercial', valor: '+55 13 98808-8204', href: `https://wa.me/${WA}`, event: 'media_kit_whatsapp_click' },
  ],

  // ── Contato ───────────────────────────────────────────────────────────────
  contato: {
    titulo: 'Vamos criar algo juntos?',
    paragrafo:
      'Se a sua empresa, projeto ou audiência conversa com personal trainers, profissionais de Educação Física ou o mercado fitness, fale com o CoachPilot.',
    whatsapp: {
      label: 'Falar no WhatsApp',
      href: wa('Oi! Vi o mídia kit do CoachPilot e quero conversar sobre uma parceria.'),
      event: 'media_kit_whatsapp_click',
    },
    instagram: { label: 'Chamar no Instagram', href: 'https://instagram.com/coachpilotoficial', event: 'media_kit_instagram_click' },
    site: { label: 'Conhecer o CoachPilot', href: 'https://coachpilot.com.br', event: 'media_kit_site_click' },
  },

  faqs: [
    {
      q: 'Que tipo de parceiro o CoachPilot procura?',
      a: 'Quem já fala com personal trainers e profissionais de Educação Física: creators do nicho, marcas de equipamento e suplementação, escolas e cursos, estúdios, academias e portais do setor. O critério é afinidade de audiência, não tamanho.',
    },
    {
      q: 'Como funciona a remuneração do parceiro?',
      a: 'Pelo Programa de Divulgadores: cada parceiro recebe um cupom exclusivo e rastreável e ganha comissão recorrente sobre cada assinatura Gestão Pro ativa gerada por esse cupom, todo mês, enquanto o cliente permanecer ativo. As faixas e condições vigentes estão na página do programa, em coachpilot.com.br/divulgadores.',
    },
    {
      q: 'Preciso ser personal trainer para ser parceiro?',
      a: 'Não. O programa é aberto a creators, marcas, escolas e profissionais que se comuniquem com o público de personal trainers.',
    },
    {
      q: 'Dá para testar o produto antes de fechar qualquer coisa?',
      a: 'Sim. O plano gratuito atende até 3 alunos, sem prazo e sem cartão, e conseguimos abrir uma conta de demonstração já populada para você ver a plataforma cheia. É só pedir no WhatsApp.',
    },
    {
      q: 'O CoachPilot tem parceria com a OpenAI?',
      a: 'Não. O CoachPilot é um app publicado e aprovado no diretório de plugins do ChatGPT, o que é diferente de parceria ou endosso da OpenAI. A conexão usa o padrão aberto MCP, que também funciona no Claude e no Gemini.',
    },
  ],
}
