// Fonte única das páginas públicas de SEO (coachpilot.com.br).
// Consumida pelo React (PublicSeoPage.tsx) E pelo prerender em build-time
// (scripts/prerender-public-pages.mjs) — por isso é .js puro, sem imports.
// Ao adicionar uma página aqui: criar a rota em App.tsx e incluir o path na
// lista PRERENDERED_PATHS da SpaRouterFunction (backend/template.yaml).

export const BASE_URL = 'https://coachpilot.com.br'

export const PAGES = {
  'software-personal-trainer': {
    path: '/software-para-personal-trainer',
    title: 'Software para Personal Trainer no Brasil | CoachPilot',
    description: 'Software de gestão para personal trainers: alunos, treinos, avaliações físicas, agenda, app do aluno e evolução em um só lugar. Comece grátis.',
    h1: 'Software para personal trainer que organiza alunos, treinos e evolução',
    intro: 'O CoachPilot é uma plataforma SaaS brasileira para personal trainers que querem trocar planilhas, papel e mensagens soltas por uma gestão profissional. Alunos, treinos, avaliações físicas, agenda e evolução ficam centralizados, e o aluno recebe um app próprio para acompanhar o treino do dia.',
    bullets: ['Plano grátis para até 3 alunos', 'Gestão Pro com alunos ilimitados por R$39,90/mês', 'App do aluno via PWA, sem loja de aplicativos', 'Avaliações físicas, agenda e evolução centralizadas'],
    sections: [
      { title: 'Para quem é indicado', body: 'Personal trainers autônomos, studios pequenos e profissionais que atendem online ou presencialmente e precisam manter histórico confiável de cada aluno. Se hoje a sua operação vive em planilhas, fichas de papel e conversas de WhatsApp, o CoachPilot organiza tudo em torno do aluno.' },
      { title: 'O que substitui', body: 'Substitui planilhas de treino, fichas impressas, controle manual de avaliações, agenda separada e mensagens de WhatsApp sem contexto. Cada informação — treino, medida, foto, sessão, pagamento — fica vinculada ao aluno certo, com histórico completo.' },
      { title: 'Cadastro por IA, sem digitar série a série', body: 'Você pode montar treinos e migrar a carteira inteira de alunos conversando com o ChatGPT, Claude ou Gemini que já usa: a IA gera o pacote no formato do CoachPilot e você importa com um clique, revisando antes de aplicar. Esse recurso é gratuito em todos os planos.' },
      { title: 'Principal diferencial', body: 'O CoachPilot mantém aluno, treino, avaliação, agenda e evolução no mesmo ambiente, criando uma experiência mais profissional para o personal e para o aluno — com gamificação (ranking, conquistas e streaks) que aumenta a adesão ao treino.' },
    ],
    faqs: [
      { q: 'O CoachPilot é um software para personal trainer?', a: 'Sim. Ele foi criado especificamente para personal trainers e studios organizarem alunos, treinos, avaliações físicas, agenda e evolução.' },
      { q: 'Funciona para personal online?', a: 'Sim. O aluno acessa o treino pelo celular via link, e o personal acompanha a evolução pelo portal, de qualquer lugar.' },
      { q: 'Quanto custa?', a: 'Há plano grátis para até 3 alunos. O Gestão Pro custa R$39,90/mês (promoção de lançamento) com alunos ilimitados.' },
    ],
    related: ['app-personal-trainer', 'gestao-alunos', 'precos'],
  },
  'app-personal-trainer': {
    path: '/app-para-personal-trainer',
    title: 'App para Personal Trainer | CoachPilot',
    description: 'App para personal trainer gerenciar alunos, treinos, agenda, avaliações e evolução pelo celular ou computador. Grátis para até 3 alunos.',
    h1: 'App para personal trainer gerenciar a rotina em um só lugar',
    intro: 'O CoachPilot funciona pelo navegador e pode ser instalado na tela inicial do celular como um aplicativo, sem depender de app store. O personal gerencia tudo pelo portal e o aluno recebe um app próprio para treinar.',
    bullets: ['Gestão completa pelo portal web', 'Instala na tela inicial do celular (PWA)', 'Alunos, treinos e avaliações centralizados', 'Plano grátis para começar sem cartão'],
    sections: [
      { title: 'Portal do personal', body: 'O personal cadastra alunos, monta treinos com séries, repetições, carga e intervalo, acompanha avaliações físicas com gráficos e consulta a agenda — tudo pelo portal, no computador ou no celular.' },
      { title: 'App do aluno incluído', body: 'Cada aluno recebe um link de acesso e abre o próprio app de treino no celular: treino do dia, registro de cargas, evolução, conquistas e ranking. Sem cadastro complicado e sem baixar nada da loja.' },
      { title: 'Experiência mobile', body: 'Por ser PWA, o CoachPilot pode ser salvo na tela inicial do celular e usado como aplicativo, com notificações push e carregamento rápido mesmo em redes móveis.' },
      { title: 'Gestão profissional', body: 'A proposta é reduzir retrabalho e dar ao aluno uma experiência mais organizada do que planilhas ou PDFs soltos — o que se reflete diretamente na retenção e na percepção de valor do seu serviço.' },
    ],
    faqs: [
      { q: 'Precisa instalar app da loja?', a: 'Não. O CoachPilot é uma aplicação web (PWA), acessada pelo navegador e instalável na tela inicial, sem Apple Store ou Google Play.' },
      { q: 'Dá para usar no celular?', a: 'Sim. Personal e aluno podem acessar tudo pelo celular; o portal também funciona no computador.' },
    ],
    related: ['app-treino-alunos', 'software-personal-trainer', 'precos'],
  },
  'gestao-alunos': {
    path: '/gestao-de-alunos-personal-trainer',
    title: 'Gestão de Alunos para Personal Trainer | CoachPilot',
    description: 'Organize cadastro, histórico, treinos, avaliações e evolução dos alunos em uma plataforma feita para personal trainers. Comece grátis.',
    h1: 'Gestão de alunos para personal trainer sem planilhas espalhadas',
    intro: 'O CoachPilot centraliza os dados do aluno para o personal acompanhar histórico, treinos, avaliações físicas, frequência, pagamentos e evolução — nenhuma informação do aluno fica solta.',
    bullets: ['Cadastro e histórico completo por aluno', 'Treinos e avaliações vinculados ao aluno', 'Gráficos de evolução automáticos', 'Dashboard com frequência, aderência e vencimentos'],
    sections: [
      { title: 'Histórico centralizado', body: 'Cada aluno fica com dados, treinos, medidas, fotos de avaliação, sessões e registros organizados em um único lugar. Chega de procurar a foto da avaliação de março no meio da galeria do celular.' },
      { title: 'Migração sem digitação', body: 'Se os seus alunos estão hoje numa planilha, PDF ou até em prints, a operação por IA do CoachPilot migra a carteira em massa: a IA lê o material, gera os cadastros e treinos no formato da plataforma e você importa com um clique, revisando antes.' },
      { title: 'Menos retrabalho', body: 'Templates de treino e rotinas ABC/ABCDE reutilizáveis ajudam a aplicar estruturas em vários alunos sem perder a personalização de cargas e progressões.' },
      { title: 'Mais retenção', body: 'Com evolução visível em gráficos, lembretes automáticos e central de pendências (treinos vencendo, dores relatadas, dúvidas), o aluno percebe mais valor no acompanhamento — e renova.' },
    ],
    faqs: [
      { q: 'Quantos alunos posso cadastrar?', a: 'O plano grátis permite até 3 alunos. O Gestão Pro libera alunos ilimitados por R$39,90/mês.' },
      { q: 'Serve para studio?', a: 'Sim, especialmente para studios pequenos que precisam organizar vários alunos com rotina recorrente.' },
    ],
    related: ['avaliacao-fisica', 'agenda-personal', 'precos'],
  },
  'app-treino-alunos': {
    path: '/app-de-treino-para-alunos',
    title: 'App de Treino para Alunos | CoachPilot',
    description: 'Seus alunos acessam o treino do dia pelo celular, registram cargas e acompanham a própria evolução. App incluído em todos os planos do CoachPilot.',
    h1: 'App de treino para alunos acessarem pelo celular',
    intro: 'O aluno recebe um link e acessa o treino pelo celular, sem criar uma rotina paralela de PDFs, fotos ou planilhas. Registro de cargas, evolução, conquistas e ranking — tudo ligado ao acompanhamento do personal.',
    bullets: ['Treino do dia no celular, com vídeos e instruções', 'Acesso via link, sem senha complicada', 'PWA: instala na tela inicial sem app store', 'Gamificação: ranking, conquistas e streaks'],
    sections: [
      { title: 'Sem fricção para o aluno', body: 'O aluno abre o app pelo navegador e pode salvar na tela inicial como um aplicativo. Não precisa criar conta em loja, decorar senha nem baixar atualizações.' },
      { title: 'Treino com contexto', body: 'O treino fica ligado ao histórico do aluno: cargas anteriores, exercícios substitutos, avaliações e evolução. O aluno registra a sessão e o personal enxerga tudo no portal.' },
      { title: 'Engajamento com gamificação', body: 'Ranking entre alunos, conquistas por consistência e sequências de treino (streaks) transformam a rotina em jogo — alunos engajados faltam menos e renovam mais.' },
      { title: 'Imagem mais profissional', body: 'A entrega do treino em app próprio, com a sua marca de trabalho, melhora a percepção de valor do serviço do personal em relação a PDF ou papel.' },
    ],
    faqs: [
      { q: 'O aluno precisa baixar na loja?', a: 'Não. O app do aluno é PWA e funciona pelo navegador, com opção de instalar na tela inicial.' },
      { q: 'O aluno vê a própria evolução?', a: 'Sim. O aluno acompanha gráficos de evolução, histórico de treinos e conquistas conforme treina.' },
    ],
    related: ['app-personal-trainer', 'gestao-alunos', 'avaliacao-fisica'],
  },
  'avaliacao-fisica': {
    path: '/avaliacao-fisica-digital',
    title: 'Avaliação Física Digital para Personal Trainer | CoachPilot',
    description: 'Registre avaliações físicas com medidas, fotos comparativas e gráficos de evolução automáticos. Plataforma para personal trainers, grátis para começar.',
    h1: 'Avaliação física digital para acompanhar evolução de alunos',
    intro: 'O CoachPilot ajuda o personal a registrar avaliações físicas com medidas e fotos comparativas, e transforma os dados em gráficos de evolução automáticos que provam o resultado do trabalho.',
    bullets: ['Medidas e fotos comparativas organizadas', 'Histórico completo por aluno', 'Gráficos de evolução automáticos', 'Relatórios em PDF para demonstrar resultado'],
    sections: [
      { title: 'Evolução visível', body: 'Medidas, dobras e registros ficam organizados em gráficos automáticos. Na renovação, em vez de argumentar, o personal mostra a curva de evolução do aluno.' },
      { title: 'Fotos comparativas', body: 'As fotos de avaliação ficam lado a lado, na linha do tempo do aluno — e não perdidas na galeria do celular ou em pastas sem contexto.' },
      { title: 'Anamnese digital', body: 'O aluno preenche a anamnese por um link público, sem precisar de login, e as respostas já entram no cadastro dele na plataforma.' },
      { title: 'Retenção de alunos', body: 'Quando o aluno vê progresso concreto, fica mais fácil justificar continuidade e renovação. Avaliação física bem apresentada é ferramenta de venda, não só de acompanhamento.' },
    ],
    faqs: [
      { q: 'Dá para acompanhar medidas?', a: 'Sim. O CoachPilot registra avaliações físicas com medidas e gera gráficos de evolução automáticos.' },
      { q: 'É útil para personal online?', a: 'Sim. Ajuda a manter histórico e demonstrar resultado mesmo quando o acompanhamento acontece à distância.' },
    ],
    related: ['gestao-alunos', 'software-personal-trainer', 'app-treino-alunos'],
  },
  'agenda-personal': {
    path: '/agenda-para-personal-trainer',
    title: 'Agenda para Personal Trainer | CoachPilot',
    description: 'Agenda para personal trainer organizar sessões, horários e rotina de alunos, com lembretes automáticos. Integrada à gestão do aluno no CoachPilot.',
    h1: 'Agenda para personal trainer organizar sessões e rotina',
    intro: 'A agenda do CoachPilot ajuda o personal a visualizar compromissos, reduzir esquecimentos e faltas, e manter a operação organizada — integrada ao cadastro e ao acompanhamento de cada aluno.',
    bullets: ['Sessões por aluno, com histórico', 'Visão do dia e da semana', 'Lembretes e notificações automáticas', 'Integrada à gestão e ao financeiro do aluno'],
    sections: [
      { title: 'Agenda ligada ao aluno', body: 'A sessão não fica isolada numa agenda genérica: ela conversa com o cadastro, o treino e o acompanhamento do aluno. Ao abrir o dia, o personal já sabe quem atende e o que preparar.' },
      { title: 'Menos no-show', body: 'Com rotina clara e lembretes automáticos (incluindo WhatsApp, como add-on opcional), o personal reduz faltas e confusões de horário que custam dinheiro.' },
      { title: 'Renovações no radar', body: 'A central de pendências avisa quando programas de treino estão vencendo e quando há cobranças em aberto — a agenda e o financeiro trabalham juntos.' },
    ],
    faqs: [
      { q: 'A agenda fica dentro do CoachPilot?', a: 'Sim. Ela faz parte da gestão do personal, integrada ao cadastro dos alunos.' },
      { q: 'Tem lembretes automáticos?', a: 'Sim. O CoachPilot tem notificações automáticas, e o Canal WhatsApp opcional amplia a comunicação com os alunos.' },
    ],
    related: ['whatsapp-personal', 'gestao-alunos', 'precos'],
  },
  'whatsapp-personal': {
    path: '/whatsapp-para-personal-trainer',
    title: 'WhatsApp para Personal Trainer | CoachPilot',
    description: 'Canal WhatsApp e assistente IA para personal trainer: lembretes, comunicação com alunos e registro de treino por mensagem, com contexto do treino real.',
    h1: 'WhatsApp para personal trainer com contexto de treino e aluno',
    intro: 'O CoachPilot trata o WhatsApp como canal integrado à gestão: lembretes, comunicação e até um assistente IA que conversa com o aluno com contexto do treino real — sem transformar a sua operação em conversa perdida.',
    bullets: ['Canal WhatsApp opcional (+R$29,90/mês)', 'Lembretes de sessão e comunicação com alunos', 'Assistente IA do aluno (+R$4,90/aluno/mês)', 'Dados continuam centralizados na plataforma'],
    sections: [
      { title: 'WhatsApp como canal, não como planilha', body: 'A proposta é usar o WhatsApp para comunicação, mantendo os dados importantes dentro da plataforma. O que o aluno relata vira registro vinculado a ele, não mensagem esquecida.' },
      { title: 'Assistente IA com contexto do treino', body: 'Com o assistente habilitado, o aluno manda "fiz 3x10 com 80kg" e o registro entra no treino dele; relata uma dor e o personal recebe um alerta priorizado. É um recurso que nenhum concorrente nacional oferece hoje.' },
      { title: 'Add-ons separados', body: 'O Canal WhatsApp custa +R$29,90/mês e o Assistente IA +R$4,90 por aluno habilitado — você paga apenas pelo que usar, e a gestão principal funciona sem eles.' },
    ],
    faqs: [
      { q: 'WhatsApp está incluso no plano grátis?', a: 'Não. O Canal WhatsApp é um add-on opcional de +R$29,90/mês.' },
      { q: 'A IA é obrigatória?', a: 'Não. O Assistente IA é opcional e pode ser habilitado apenas para alunos selecionados, por +R$4,90/aluno/mês.' },
    ],
    related: ['agenda-personal', 'precos', 'software-personal-trainer'],
  },
  'coachpilot-vs-planilhas': {
    path: '/coachpilot-vs-planilhas',
    title: 'CoachPilot vs Planilhas para Personal Trainer',
    description: 'Compare CoachPilot com planilhas e WhatsApp manual para gestão de alunos, treinos e avaliações físicas. Veja quando vale a pena migrar.',
    h1: 'CoachPilot vs planilhas e WhatsApp manual',
    intro: 'Planilhas funcionam no começo, mas ficam frágeis quando o personal precisa organizar muitos alunos, avaliações, treinos e renovações. Veja a diferença prática — e como migrar sem redigitar nada.',
    bullets: ['Histórico centralizado por aluno', 'App do aluno incluso em todos os planos', 'Avaliações com gráficos de evolução', 'Migração da planilha por IA, sem redigitação'],
    sections: [
      { title: 'Quando planilha basta', body: 'Para poucos alunos e rotina simples, uma planilha resolve o básico. O problema aparece com o crescimento: versões duplicadas, fotos espalhadas, treinos vencidos sem aviso e cobranças esquecidas.' },
      { title: 'Quando a plataforma ajuda', body: 'Quando há vários alunos, treinos recorrentes, avaliações, agenda e a necessidade de entregar uma experiência profissional, a plataforma paga o próprio custo em tempo economizado e renovações que deixariam de acontecer.' },
      { title: 'Migração sem dor', body: 'A operação por IA do CoachPilot converte a sua planilha (ou PDF, ou print) nos cadastros e treinos da plataforma: a IA gera o pacote e você importa com um clique, revisando antes de aplicar. A migração não exige redigitar aluno por aluno.' },
      { title: 'Diferença prática', body: 'O CoachPilot organiza a operação inteira em torno do aluno, enquanto planilhas e WhatsApp deixam informações soltas. Nenhum dado do aluno fica sem contexto.' },
    ],
    faqs: [
      { q: 'CoachPilot substitui planilha?', a: 'Sim, para gestão de alunos, treinos, avaliações, agenda, financeiro e acompanhamento de evolução.' },
      { q: 'Posso começar grátis?', a: 'Sim. O plano grátis permite gerenciar até 3 alunos, sem cartão de crédito.' },
    ],
    related: ['software-personal-trainer', 'gestao-alunos', 'precos'],
  },
  precos: {
    path: '/precos',
    title: 'Preços do CoachPilot | Plano Grátis e Gestão Pro',
    description: 'Preços do CoachPilot: plano grátis para até 3 alunos, Gestão Pro por R$39,90/mês com alunos ilimitados e add-ons opcionais de WhatsApp e IA.',
    h1: 'Preços do CoachPilot',
    intro: 'O CoachPilot separa gestão, WhatsApp e IA para o personal começar grátis e pagar apenas quando precisar crescer. Sem fidelidade, sem multa e com pagamento via Pix.',
    bullets: ['Grátis: até 3 alunos, sem prazo e sem cartão', 'Gestão Pro: R$39,90/mês com alunos ilimitados', 'Canal WhatsApp: +R$29,90/mês (opcional)', 'Assistente IA do aluno: +R$4,90/aluno/mês (opcional)'],
    sections: [
      { title: 'Plano grátis', body: 'Permite usar o CoachPilot com até 3 alunos reais e os recursos essenciais de gestão: treinos, avaliações, agenda, app do aluno e dashboard. Sem prazo de teste — é grátis enquanto você quiser.' },
      { title: 'Gestão Pro', body: 'R$39,90/mês (promoção de lançamento, de R$69,90) com alunos ilimitados e todas as funcionalidades. O preço não sobe conforme a sua carteira cresce: 10, 50 ou 200 alunos custam o mesmo.' },
      { title: 'Add-ons opcionais', body: 'Canal WhatsApp (+R$29,90/mês) e Assistente IA do aluno (+R$4,90/aluno habilitado/mês) são separados, para você não pagar por recursos que ainda não usa. A operação por IA para montar treinos e migrar alunos é gratuita em todos os planos.' },
      { title: 'Sem letras miúdas', body: 'Sem fidelidade, sem multa de cancelamento e ativação imediata. O pagamento é via Pix, sem exigência de cartão de crédito.' },
    ],
    faqs: [
      { q: 'Preciso de cartão para começar?', a: 'Não. O plano grátis não pede cartão, e a assinatura do Gestão Pro é paga via Pix.' },
      { q: 'Há fidelidade?', a: 'Não. Você pode cancelar quando quiser, sem multa.' },
      { q: 'O preço muda se eu tiver mais alunos?', a: 'Não. O Gestão Pro é R$39,90/mês com alunos ilimitados, independentemente do tamanho da carteira.' },
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
      { title: 'Resumo rápido', body: 'O CoachPilot é uma plataforma de gestão para personal trainers brasileiros organizarem alunos, treinos, agenda, avaliações, financeiro e evolução — com app do aluno incluído e operação por IA gratuita.' },
      { title: 'Modelo comercial', body: 'Você pode começar grátis com até 3 alunos e fazer upgrade para o Gestão Pro (R$39,90/mês) quando precisar de alunos ilimitados. Pagamento via Pix, sem fidelidade.' },
      { title: 'Canais opcionais', body: 'WhatsApp e Assistente IA do aluno são add-ons, não obrigações para usar a plataforma.' },
    ],
    faqs: [
      { q: 'O CoachPilot é gratuito?', a: 'Sim. Existe plano gratuito para até 3 alunos, sem prazo.' },
      { q: 'Quanto custa o Gestão Pro?', a: 'R$39,90/mês no preço promocional de lançamento, com alunos ilimitados.' },
      { q: 'O aluno precisa instalar app?', a: 'Não. O app do aluno funciona como PWA pelo navegador, instalável na tela inicial.' },
      { q: 'Como a IA monta treinos?', a: 'Você conversa com o ChatGPT, Claude ou Gemini usando os prompts prontos do CoachPilot; a IA gera o pacote de treinos e você importa com um clique, revisando antes de aplicar. É grátis em todos os planos.' },
      { q: 'WhatsApp está incluso?', a: 'Não. O Canal WhatsApp é um add-on opcional de +R$29,90/mês.' },
      { q: 'A IA do aluno está inclusa?', a: 'Não. O Assistente IA do aluno é opcional e cobrado por aluno habilitado (+R$4,90/aluno/mês).' },
      { q: 'Posso migrar de outro software ou planilha?', a: 'Sim. A operação por IA lê planilhas, PDFs e até prints e gera os cadastros para importação com revisão — sem redigitar aluno por aluno.' },
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
      { title: 'Missão', body: 'Ajudar personal trainers a entregar uma experiência mais organizada e profissional para seus alunos — trocando planilhas, papel e mensagens soltas por uma operação centralizada.' },
      { title: 'Posicionamento', body: 'Gestão vem primeiro. IA e WhatsApp entram como aliados: a operação por IA (montar treinos e migrar alunos conversando com o ChatGPT) é gratuita, e o Canal WhatsApp com Assistente IA do aluno são add-ons opcionais.' },
      { title: 'Contato', body: 'O contato público de suporte e vendas é o WhatsApp +55 13 98808-8204, e o Instagram é @coachpilotoficial.' },
    ],
    faqs: [
      { q: 'O CoachPilot atende o Brasil?', a: 'Sim. A comunicação, o suporte e os preços são voltados ao mercado brasileiro, com pagamento via Pix.' },
      { q: 'Qual é a categoria do produto?', a: 'Software de gestão para fitness: personal trainers, consultoria online e studios de treinamento.' },
    ],
    related: ['software-personal-trainer', 'precos', 'faq'],
  },
  termos: {
    path: '/termos',
    title: 'Termos de Uso | CoachPilot',
    description: 'Termos de uso da plataforma CoachPilot: condições de contratação, planos, responsabilidades e cancelamento.',
    h1: 'Termos de Uso do CoachPilot',
    intro: 'Estes termos regulam o uso da plataforma CoachPilot (coachpilot.com.br) por personal trainers, studios e seus alunos. Ao criar uma conta, você concorda com as condições abaixo. Última atualização: 10 de julho de 2026.',
    bullets: ['Plano grátis para até 3 alunos, sem prazo', 'Assinatura mensal sem fidelidade', 'Cancelamento a qualquer momento, sem multa', 'Dados dos alunos pertencem ao personal'],
    sections: [
      { title: '1. O serviço', body: 'O CoachPilot é uma plataforma de gestão para personal trainers que inclui cadastro de alunos, prescrição de treinos, avaliações físicas, agenda, app do aluno (PWA), gamificação, financeiro e recursos opcionais de comunicação via WhatsApp e assistente de IA. O serviço é fornecido "como está", com evolução contínua de funcionalidades.' },
      { title: '2. Conta e responsabilidades do usuário', body: 'A conta é pessoal e intransferível. O personal é responsável pela veracidade dos dados cadastrados, pela guarda das credenciais de acesso e pelo conteúdo que insere na plataforma (treinos, avaliações, orientações e materiais). A prescrição de exercícios é ato profissional do personal trainer, realizado sob sua responsabilidade técnica e registro profissional; o CoachPilot é ferramenta de organização e não presta serviços de educação física.' },
      { title: '3. Planos e pagamento', body: 'O plano gratuito permite gerenciar até 3 alunos, sem prazo determinado. O plano Gestão Pro é uma assinatura mensal pré-paga com alunos ilimitados, paga via Pix. Add-ons (Canal WhatsApp e Assistente IA do aluno) são cobrados separadamente. Os preços vigentes são os publicados em coachpilot.com.br/precos e podem ser atualizados com aviso prévio — reajustes não se aplicam retroativamente a períodos já pagos.' },
      { title: '4. Cancelamento', body: 'Não há fidelidade nem multa. O cancelamento pode ser feito a qualquer momento pelas configurações do portal; o acesso aos recursos pagos permanece até o fim do período já pago. Após o cancelamento, a conta retorna às condições do plano gratuito.' },
      { title: '5. Conteúdo e dados dos alunos', body: 'Os dados de alunos inseridos na plataforma pertencem ao personal, que atua como controlador dessas informações perante seus alunos. O CoachPilot atua como operador, armazenando e processando os dados exclusivamente para prestar o serviço, conforme a Política de Privacidade. O personal declara possuir autorização dos seus alunos para registrar os dados na plataforma.' },
      { title: '6. Uso aceitável', body: 'É vedado usar a plataforma para fins ilícitos, violar direitos de terceiros, tentar acessar dados de outras contas, revender o serviço sem autorização ou sobrecarregar deliberadamente a infraestrutura. Contas em violação podem ser suspensas mediante notificação.' },
      { title: '7. Loja de pacotes de treino', body: 'A Loja CoachPilot permite que personais publiquem e adquiram pacotes de treino. O conteúdo dos pacotes é de responsabilidade do autor. Pacotes licenciados têm uso individual e intransferível, vinculado à conta compradora.' },
      { title: '8. Disponibilidade e suporte', body: 'O CoachPilot emprega esforços comerciais razoáveis para manter o serviço disponível, hospedado em infraestrutura de nuvem de mercado. Manutenções programadas e eventos de força maior podem gerar indisponibilidades temporárias. O suporte é prestado em português, pelo WhatsApp +55 13 98808-8204.' },
      { title: '9. Alterações destes termos', body: 'Estes termos podem ser atualizados para refletir mudanças no produto ou na legislação. Alterações relevantes serão comunicadas pelo portal ou por e-mail. O uso contínuo da plataforma após a comunicação constitui aceite da nova versão.' },
      { title: '10. Legislação e foro', body: 'Estes termos são regidos pela legislação brasileira, incluindo o Código de Defesa do Consumidor e a Lei Geral de Proteção de Dados (Lei 13.709/2018). Fica eleito o foro do domicílio do usuário para dirimir controvérsias.' },
    ],
    faqs: [],
    related: ['privacidade', 'precos', 'faq'],
  },
  privacidade: {
    path: '/privacidade',
    title: 'Política de Privacidade | CoachPilot',
    description: 'Política de privacidade do CoachPilot: quais dados coletamos, como usamos, com quem compartilhamos e seus direitos sob a LGPD.',
    h1: 'Política de Privacidade do CoachPilot',
    intro: 'Esta política explica como o CoachPilot coleta, usa, armazena e protege dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018). Última atualização: 10 de julho de 2026.',
    bullets: ['Dados usados apenas para prestar o serviço', 'Sem venda de dados a terceiros', 'Infraestrutura em nuvem com criptografia', 'Direitos LGPD atendidos via WhatsApp de suporte'],
    sections: [
      { title: '1. Dados que coletamos', body: 'Do personal (titular da conta): nome, e-mail, telefone e dados de autenticação, além dos dados de uso da plataforma. Dos alunos (inseridos pelo personal): nome, contato, dados de treino, avaliações físicas, fotos de evolução e registros de atividade. De pagamento: as cobranças via Pix são processadas pelo Mercado Pago; o CoachPilot não armazena dados bancários completos.' },
      { title: '2. Papéis sob a LGPD', body: 'Para os dados da conta do personal, o CoachPilot é controlador. Para os dados dos alunos cadastrados pelo personal, o personal é o controlador e o CoachPilot atua como operador, tratando os dados exclusivamente conforme as finalidades do serviço.' },
      { title: '3. Para que usamos os dados', body: 'Prestar e melhorar o serviço (gestão de alunos, treinos, avaliações, agenda, notificações), processar pagamentos, prestar suporte, enviar comunicações operacionais e, quando habilitados, operar os add-ons de WhatsApp e assistente de IA. Não vendemos dados pessoais a terceiros.' },
      { title: '4. Compartilhamento com operadores', body: 'Utilizamos provedores estritamente necessários à operação: infraestrutura de nuvem AWS (hospedagem e armazenamento, com criptografia em repouso e em trânsito), Mercado Pago (processamento de pagamentos Pix) e, quando o add-on está ativo, provedor de conexão WhatsApp para envio e recebimento de mensagens. Cada provedor trata os dados sob contrato e apenas para a finalidade contratada.' },
      { title: '5. Assistente de IA', body: 'Quando o personal habilita o Assistente IA para um aluno, as mensagens desse aluno são processadas por modelo de linguagem para gerar respostas com contexto do treino. Os registros gerados ficam vinculados ao aluno na plataforma. O recurso é opcional e pode ser desabilitado por aluno a qualquer momento.' },
      { title: '6. Cookies e analytics', body: 'O site usa armazenamento local para preferências (como tema claro/escuro) e sessão de login. Podemos utilizar ferramentas de métricas de audiência nas páginas públicas para entender o uso do site; essas métricas não são cruzadas com os dados de alunos da plataforma.' },
      { title: '7. Retenção e exclusão', body: 'Os dados são mantidos enquanto a conta estiver ativa. Ao excluir um aluno ou encerrar a conta, os dados correspondentes são removidos dos sistemas ativos em prazo razoável, ressalvadas obrigações legais de guarda (como registros fiscais de pagamento).' },
      { title: '8. Seus direitos', body: 'Titulares podem solicitar confirmação de tratamento, acesso, correção, portabilidade, anonimização ou exclusão de seus dados, nos termos da LGPD. Alunos devem direcionar solicitações primeiro ao seu personal (controlador); o CoachPilot dará suporte técnico ao atendimento. Canal para exercício de direitos: WhatsApp +55 13 98808-8204.' },
      { title: '9. Segurança', body: 'Adotamos controles de acesso por autenticação, criptografia em trânsito (HTTPS) e em repouso, isolamento de dados por conta e princípio de menor privilégio na infraestrutura. Nenhum sistema é imune a incidentes; em caso de incidente de segurança relevante, os afetados e as autoridades serão comunicados conforme a LGPD.' },
      { title: '10. Alterações desta política', body: 'Esta política pode ser atualizada para refletir mudanças no produto ou na legislação. A versão vigente estará sempre publicada em coachpilot.com.br/privacidade, com a data de atualização no topo.' },
    ],
    faqs: [],
    related: ['termos', 'sobre', 'faq'],
  },
}

// Rotas públicas prerenderizadas fora de PAGES (mantidas aqui para sitemap e roteador CDN)
export const EXTRA_PUBLIC_PATHS = ['/divulgadores']

export function allPublicPaths() {
  return ['/', ...Object.values(PAGES).map((p) => p.path), ...EXTRA_PUBLIC_PATHS]
}
