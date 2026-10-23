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
    h1: 'Boas conexões. Novas possibilidades.',
    subheadline:
      'Marcas, creators e instituições de ensino: conheça o CoachPilot e descubra como podemos trabalhar juntos no mercado de personal training.',
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
      'Uma plataforma brasileira que organiza o atendimento do personal trainer, do planejamento ao acompanhamento dos resultados.',
    cards: [
      { titulo: 'Gestão do atendimento', desc: 'Cadastro, anamnese, avaliações, agenda e cobranças em um só lugar.' },
      { titulo: 'Prescrição de treinos', desc: 'Rotinas reutilizáveis, vídeos de exercícios e histórico de cargas por aluno.' },
      { titulo: 'Experiência do aluno', desc: 'Treino no celular, registro de execução, evolução e ranking com conquistas.' },
    ],
  },

  // ── Público ────────────────────────────────────────────────────────────────
  publico: {
    titulo: 'Quem usa o CoachPilot',
    intro:
      'Nosso público é B2B: profissionais de Educação Física que atendem por conta própria ou em pequenos estúdios. Marcas de equipamentos, formação e serviços encontram aqui afinidade de audiência.',
    itens: [
      'Personal trainers presenciais',
      'Personal trainers online',
      'Pequenos estúdios',
    ],
  },

  // A explicação de IA fica em um único bloco; detalhes técnicos na integração.
  conexaoIa: {
    eyebrow: 'Conexão com IA',
    titulo: 'A rotina do personal também pode acontecer por conversa.',
    intro:
      'Com autorização do profissional, a IA consulta seus dados e ajuda a preparar treinos para revisão. A conexão usa o padrão aberto MCP; quem prescreve continua sendo o personal.',
  },

  // ── Números ────────────────────────────────────────────────────────────────
  // REGRA: nunca inventar número. Só entra aqui o que for verificável e já
  // autorizado nos materiais oficiais (KIT_DIVULGADOR.md §6).
  metricas: [
    { valor: '+500', label: 'alunos gerenciados na plataforma' },
    { valor: 'R$ 39,90', label: 'plano Gestão Pro por mês, sem fidelidade' },
    { valor: '0', label: 'custo para começar — até 3 alunos, sem prazo' },
  ],
  metricasNota:
    'Dados de audiência e desempenho por campanha disponíveis sob demanda.',

  // ── Por que fazer parceria ────────────────────────────────────────────────
  parceria: {
    titulo: 'Como podemos trabalhar juntos',
    paragrafo:
      'Escolha o formato que combina com o seu canal, empresa ou instituição.',
  },

  // ── Formatos de parceria ──────────────────────────────────────────────────
  // O eixo é o Programa de Divulgadores (cupom rastreável + comissão recorrente).
  // Percentuais e faixas NÃO são repetidos aqui — a fonte é /divulgadores.
  formatos: [
    {
      titulo: 'Programa de Divulgadores',
      destaque: true,
      desc: 'Indique a plataforma e ofereça um benefício à sua audiência nas assinaturas do Gestão Pro.',
      itens: [
        'Cupom exclusivo para acompanhar suas indicações',
        'Comissão mensal enquanto o indicado permanecer ativo',
        'Faixas de remuneração conforme a carteira de clientes',
      ],
      cta: { label: 'Ver as regras do programa', href: '/divulgadores', event: 'media_kit_divulgadores_click' },
    },
    {
      titulo: 'Conteúdo com creators',
      desc: 'Reviews, tutoriais, reels e stories com demonstrações práticas da plataforma.',
      itens: [],
    },
    {
      titulo: 'Parcerias com empresas',
      desc: 'Campanhas conjuntas, benefícios para a base de clientes e participação em eventos do setor.',
      itens: [],
    },
    {
      titulo: 'Educação',
      desc: 'Uso da plataforma em aulas, cursos e workshops sobre gestão e tecnologia no atendimento.',
      itens: [],
    },
  ],
  formatosNota:
    'Consulte percentuais e condições vigentes na página do Programa de Divulgadores.',

  // Prints reais da conta de demonstração. Nunca exibir links com token de aluno.
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

  // Contatos oficiais. Os demais canais ficam no rodapé compartilhado do site.
  contato: {
    titulo: 'Vamos criar algo juntos?',
    paragrafo:
      'Conte a sua ideia e os canais em que pretende divulgá-la. Vamos combinar formato, materiais e próximos passos.',
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
      q: 'Preciso ser personal trainer para ser parceiro?',
      a: 'Não. O critério é a afinidade do seu conteúdo ou negócio com o público da plataforma.',
    },
    {
      q: 'Dá para testar o produto antes de fechar qualquer coisa?',
      a: 'Sim. Peça pelo WhatsApp uma conta de demonstração com dados de exemplo para explorar a plataforma antes de propor uma ação.',
    },
    {
      q: 'Há material de apoio para produzir conteúdo?',
      a: 'Sim. Disponibilizamos materiais de divulgação, roteiros e acesso de demonstração para apoiar a produção.',
    },
  ],
}
