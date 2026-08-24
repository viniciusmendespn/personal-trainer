// Fonte única das páginas públicas de SEO (coachpilot.com.br).
// Consumida pelo React (PublicSeoPage.tsx) E pelo prerender em build-time
// (scripts/prerender-public-pages.mjs) — por isso é .js puro, sem imports.
// Ao adicionar uma página aqui: criar a rota em App.tsx e incluir o path na
// lista PRERENDERED_PATHS da SpaRouterFunction (backend/template.yaml).

export const BASE_URL = 'https://coachpilot.com.br'

// Widgets interativos das calculadoras. Lista em runtime (usada pelo assert do
// prerender); o tipo espelho vive em publicSeoData.d.ts (WidgetKind).
export const WIDGET_KINDS = ['1rm', 'dobras', 'precificacao', 'volume', 'energia']

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
      { title: 'Conexão MCP: a sua IA falando com o sistema', body: 'O CoachPilot tem um servidor MCP, o padrão que ChatGPT, Claude e Gemini usam para se conectar a sistemas externos. Autorizada uma vez, a sua IA consulta alunos, anamneses, avaliações, sessões, evolução e agenda, e — se você permitir — monta e aplica programas de treino direto na plataforma, com aviso e desfazer. Gratuito nos dois planos.' },
      { title: 'Principal diferencial', body: 'O CoachPilot mantém aluno, treino, avaliação, agenda e evolução no mesmo ambiente, criando uma experiência mais profissional para o personal e para o aluno — com gamificação (ranking, conquistas e streaks) que aumenta a adesão ao treino.' },
    ],
    faqs: [
      { q: 'O CoachPilot é um software para personal trainer?', a: 'Sim. Ele foi criado especificamente para personal trainers e studios organizarem alunos, treinos, avaliações físicas, agenda e evolução.' },
      { q: 'Funciona para personal online?', a: 'Sim. O aluno acessa o treino pelo celular via link, e o personal acompanha a evolução pelo portal, de qualquer lugar.' },
      { q: 'Quanto custa?', a: 'Há plano grátis para até 3 alunos. O Gestão Pro custa R$39,90/mês (promoção de lançamento) com alunos ilimitados.' },
      { q: 'Dá para usar o software pelo ChatGPT?', a: 'Sim. Pelo servidor MCP do CoachPilot, o ChatGPT, o Claude ou o Gemini consultam os seus alunos e treinos e podem aplicar programas, conversando — sem abrir o portal. É gratuito nos dois planos.' },
    ],
    related: ['ia-personal-trainer', 'app-personal-trainer', 'gestao-alunos', 'precos'],
  },
  'ia-personal-trainer': {
    path: '/ia-para-personal-trainer',
    title: 'IA para Personal Trainer | CoachPilot',
    description: 'IA para personal trainer que lê os seus dados: conecte o ChatGPT, o Claude ou o Gemini ao CoachPilot e consulte alunos, monte e atualize treinos conversando. Grátis nos dois planos.',
    h1: 'IA para personal trainer que trabalha com os seus dados, não com achismo',
    intro: 'O CoachPilot tem um servidor MCP: você conecta a IA que já assina — ChatGPT, Claude ou Gemini — e ela passa a ler os seus alunos, anamneses, avaliações, histórico de sessões e evolução, além de montar e aplicar programas de treino direto na plataforma. Sem copiar, sem colar, sem baixar arquivo. A conexão é gratuita nos dois planos, inclusive no grátis.',
    bullets: ['Conexão com ChatGPT, Claude ou Gemini, gratuita nos dois planos', 'A IA responde com o seu dado real, não com estimativa', 'Escrita de treino com aviso, auditoria e desfazer por 7 dias', 'Você escolhe se a IA só consulta ou também altera treinos'],
    sections: [
      { title: 'Três níveis de IA — e qual muda a rotina', body: 'IA solta (ChatGPT sem acesso aos seus dados) resolve rascunho, mas alguém precisa digitar o resultado no sistema. Gerador de treino dentro do app resolve um treino por vez, num formulário, com o custo do modelo embutido na mensalidade. IA conectada ao seu sistema é o terceiro nível: você pergunta sobre a carteira e recebe resposta do dado real, ou dá uma instrução e ela é executada. O CoachPilot cobre o primeiro e o terceiro.' },
      { title: 'O que a IA conectada faz', body: 'Leitura: lista alunos com status e último treino, entrega o dossiê completo de um aluno (anamnese, avaliações, metas, sessões, dores, notas), mostra evolução por exercício com carga e volume, resume a carteira apontando quem está parado, sem programa vigente ou com mensalidade em atraso, e consulta a agenda do período. Escrita, se você autorizar: aplica programa de treino, atualiza um treino específico e desfaz a última alteração.' },
      { title: 'Sem custo de IA na mensalidade', body: 'O token é da sua assinatura de ChatGPT, Claude ou Gemini e não passa pelo CoachPilot. Isso muda duas coisas: você não paga IA embutida em plano que talvez não use, e não fica preso ao modelo de um fornecedor — usa o que preferir e troca quando quiser.' },
      { title: 'Prescrição continua sendo sua', body: 'A IA produz e digita; a decisão técnica é do personal, sob responsabilidade profissional e registro no CREF. A revisão acontece na conversa, antes de aplicar, e toda escrita gera notificação no portal com snapshot que permite desfazer por 7 dias. Não existe operação para excluir aluno, apagar histórico ou mexer em plano e cobrança.' },
      { title: 'Para quem não quer conectar nada', body: 'O fluxo por prompt continua disponível: a plataforma fornece prompts prontos que fazem a IA gerar o pacote de treinos e a migração da carteira já no formato de importação, e você aplica com um clique após revisar em tela. Também é gratuito em todos os planos.' },
    ],
    faqs: [
      { q: 'Existe app para personal trainer com IA?', a: 'Sim. O CoachPilot conecta o ChatGPT, o Claude ou o Gemini aos seus dados por MCP, e também oferece prompts prontos para gerar treinos e migrar a carteira sem conexão. Os dois recursos são gratuitos nos dois planos.' },
      { q: 'A IA fica dentro da plataforma?', a: 'Não, e é uma vantagem: você usa a IA que já assina, pelo aplicativo dela, com os seus dados do CoachPilot à disposição. Assim o custo do modelo não entra na mensalidade.' },
      { q: 'A IA pode alterar meus treinos sem eu ver?', a: 'Você escolhe, na autorização, se a conexão é só de leitura ou também de escrita. Com escrita ativa, toda alteração gera notificação no portal, fica em auditoria e pode ser desfeita por 7 dias.' },
      { q: 'Quanto custa a IA no CoachPilot?', a: 'A conexão MCP é gratuita nos dois planos, inclusive no grátis de até 3 alunos. Você paga apenas a sua assinatura de IA, se tiver uma.' },
    ],
    related: ['chatgpt-personal-trainer', 'software-personal-trainer', 'precos'],
  },
  'chatgpt-personal-trainer': {
    path: '/chatgpt-para-personal-trainer',
    title: 'ChatGPT para Personal Trainer: conecte aos seus alunos | CoachPilot',
    description: 'Conecte o ChatGPT ao CoachPilot e gerencie alunos e treinos conversando: consulte a carteira, prepare a sessão e aplique programas sem abrir o app. Também funciona com Claude e Gemini.',
    h1: 'ChatGPT para personal trainer conectado aos seus alunos de verdade',
    intro: 'Não é um plugin — plugins do ChatGPT foram descontinuados. O CoachPilot publica um servidor MCP, o padrão aberto que o ChatGPT, o Claude e o Gemini usam para se conectar a sistemas externos. Você autoriza uma vez e passa a perguntar sobre a sua carteira em português, recebendo resposta do dado real: quem está parado, o que a Júlia respondeu na anamnese, como está a evolução do agachamento da Carla.',
    bullets: ['Uma conexão, três IAs: ChatGPT, Claude e Gemini', 'Consulte alunos e treinos sem abrir o portal', 'Monte e aplique programas de treino pelo chat', 'Autorização por OAuth, revogável a qualquer momento'],
    sections: [
      { title: 'Como funciona a conexão', body: 'Em Configurações → Conexões você copia o endereço do servidor MCP e adiciona no seu assistente. A autorização é por OAuth: você faz login no próprio CoachPilot, vê o que aquela IA vai poder fazer e escolhe entre somente leitura ou leitura e escrita de treinos. Sua senha nunca passa pela IA. Requisitos variam por provedor: no Claude o conector funciona até no plano grátis (limitado a um); no ChatGPT é preciso ativar o Developer mode, disponível nos planos pagos; no Gemini o caminho suportado hoje é CLI ou Vertex.' },
      { title: 'O que dá para pedir', body: 'Perguntas de carteira ("quem não treina há mais de 10 dias?", "quem está sem programa vigente?"), preparo de sessão ("me dá o resumo da Júlia antes de amanhã"), evolução ("como está o agachamento da Carla nos últimos 3 meses?"), agenda ("o que eu tenho na quinta?") e, com escrita autorizada, prescrição ("adapta o treino do Pedro pra dor no ombro e aplica") e reversão ("desfaz a última alteração").' },
      { title: 'Sem copiar e colar', body: 'O fluxo antigo era baixar o programa, colar na IA, pedir o ajuste e reimportar. A conexão elimina os quatro passos: a IA lê e grava pelo mesmo caminho de código do portal, com as mesmas validações. Um programa com erro de estrutura é recusado antes de gravar, com a explicação do que corrigir.' },
      { title: 'Os limites, de propósito', body: 'A IA acessa um conjunto fechado de operações — nunca o banco de dados livremente. Não existe excluir aluno, apagar histórico, mexer em plano, assinatura ou cobrança, nem escrita em massa: cada programa é aplicado a um aluno por vez, com snapshot individual, para que o desfazer também seja individual. E nenhuma conexão vê dado de outro personal: a identificação da conta vem do token, nunca de um parâmetro que a IA possa preencher.' },
      { title: 'Dado de saúde: o que você precisa saber', body: 'O escopo de leitura alcança anamnese, avaliações físicas e relatos de dor — dados sensíveis de saúde do aluno pela LGPD. Consultá-los por uma IA externa envia a informação ao provedor daquela IA, no exterior. É a sua decisão e exige que o consentimento obtido do aluno cubra essa transferência; quem não quer essa transmissão não conecta. A hipótese está descrita nos termos de uso e na política de privacidade.' },
    ],
    faqs: [
      { q: 'Existe plugin do ChatGPT para personal trainer?', a: 'Plugins do ChatGPT foram descontinuados em 2024. O que existe hoje é conexão via MCP (Model Context Protocol), e o CoachPilot tem um servidor MCP próprio — a mesma conexão funciona no ChatGPT, no Claude e no Gemini.' },
      { q: 'Dá para gerenciar alunos pelo ChatGPT?', a: 'Sim. Com a conexão ativa, você consulta alunos, anamnese, avaliações, sessões, evolução, agenda e pendências, e pode montar e aplicar programas de treino se autorizar a escrita.' },
      { q: 'Preciso de ChatGPT Plus?', a: 'Para conectar pelo ChatGPT, sim — o Developer mode exige plano pago (agosto/2026). No Claude, o conector personalizado funciona até no plano grátis, com o limite de um conector.' },
      { q: 'A conexão é paga no CoachPilot?', a: 'Não. É gratuita nos dois planos, inclusive no grátis de até 3 alunos.' },
      { q: 'Como eu revogo o acesso?', a: 'Em Configurações → Conexões, a qualquer momento, com efeito imediato.' },
    ],
    related: ['ia-personal-trainer', 'software-personal-trainer', 'gestao-alunos'],
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
      { q: 'Consigo consultar a carteira sem abrir o sistema?', a: 'Sim, conectando o ChatGPT, o Claude ou o Gemini pelo servidor MCP: você pergunta quem está parado, quem está sem treino vigente ou quem tem mensalidade em atraso e recebe a resposta no chat.' },
    ],
    related: ['ia-personal-trainer', 'avaliacao-fisica', 'agenda-personal', 'precos'],
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
      { q: 'O Assistente IA do aluno é a mesma coisa que a conexão MCP?', a: 'Não. O Assistente IA responde ao aluno no WhatsApp e é add-on pago por aluno. A conexão MCP é para o personal: liga o seu ChatGPT, Claude ou Gemini aos seus dados e é gratuita nos dois planos.' },
    ],
    related: ['chatgpt-personal-trainer', 'agenda-personal', 'precos', 'software-personal-trainer'],
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
  // ── Calculadoras (2026-08) ────────────────────────────────────────────────
  // Regra editorial destas páginas: toda conta exibida tem autor, ano e faixa de
  // validade citados no corpo. Onde a internet brasileira erra (sítios do Pollock,
  // equação feminina do Petroski, o mito do Faulkner), a página corrige — é o
  // conteúdo que nenhum concorrente tem.
  calculadoras: {
    path: '/calculadoras',
    title: 'Calculadoras grátis para personal trainer | CoachPilot',
    description: 'Cinco calculadoras gratuitas para personal trainers: 1RM com tabela NSCA, percentual de gordura por dobras cutâneas, precificação, volume semanal de treino e gasto calórico. Sem cadastro.',
    h1: 'Calculadoras grátis para personal trainers',
    label: 'Calculadoras',
    eyebrow: 'Ferramentas gratuitas',
    widgetTitle: 'Escolha a calculadora',
    widgetNote: 'Todas rodam no seu navegador, sem cadastro e sem enviar nada para servidor nenhum.',
    index: ['calculadora-1rm', 'calculadora-dobras', 'calculadora-precificacao', 'calculadora-volume', 'calculadora-energia'],
    intro: 'Cinco ferramentas que resolvem contas que o personal trainer faz toda semana — estimativa de carga máxima, composição corporal, preço da hora, volume de treino e gasto energético. Cada uma mostra a fórmula usada, quem a publicou, com que população foi desenvolvida e em que faixa ela deixa de valer. Nenhuma pede cadastro.',
    bullets: [
      'Sem cadastro, sem login e sem limite de uso',
      'Cada conta com autor, ano e faixa de validade declarados',
      'O cálculo roda no seu navegador — nada é enviado para servidor',
      'Feitas para personal trainer, não adaptadas de site estrangeiro',
    ],
    sections: [
      {
        title: 'Qual usar em cada situação',
        paragraphs: [
          'As cinco cobrem momentos diferentes do atendimento. A de [1RM](/calculadoras/1rm) entra na prescrição: você tem uma série pesada registrada e precisa transformar isso em carga para as próximas semanas. A de [dobras cutâneas](/calculadoras/dobras-cutaneas) entra na avaliação física, quando você já tem o adipômetro na mão e precisa converter milímetros em percentual de gordura por um protocolo defensável.',
          'A de [volume semanal](/calculadoras/volume-semanal) entra no desenho do programa, para conferir se cada grupo muscular está recebendo estímulo suficiente ao longo da semana. A de [gasto calórico](/calculadoras/tmb-e-macros) serve de referência educativa quando o aluno pergunta — lembrando que prescrição alimentar é do nutricionista. E a de [precificação](/calculadoras/quanto-cobrar) não é sobre treino: é sobre o seu negócio, e costuma ser a que dá o susto mais útil.',
        ],
      },
      {
        title: 'Por que estas contas e não outras',
        body: 'Faltam aqui algumas calculadoras óbvias, e a ausência é deliberada. IMC, por exemplo, é fácil de implementar e tem busca alta, mas é um índice fraco justamente na população que treina: não separa massa magra de gordura, então classifica atleta como sobrepeso com frequência. Preferimos entregar dobras cutâneas bem feita a entregar IMC mal explicado.',
      },
      {
        title: 'O que fazer com o resultado',
        body: 'Toda estimativa aqui é um ponto de partida, não um laudo. O valor de um número desses aparece quando ele vira série temporal: o mesmo protocolo, o mesmo avaliador e o mesmo horário, repetidos a cada seis ou oito semanas. É exatamente isso que o CoachPilot guarda — avaliações, cargas e evolução por exercício ficam no histórico do aluno, e a comparação deixa de depender da sua memória ou de uma planilha paralela.',
      },
    ],
    faqs: [
      { q: 'As calculadoras são gratuitas mesmo?', a: 'Sim, e sem cadastro. Não há limite de uso, não pedimos e-mail e o cálculo roda inteiramente no seu navegador — nenhum dado que você digitar é enviado para os nossos servidores.' },
      { q: 'Posso usar com meus alunos?', a: 'Pode. São ferramentas de uso profissional livre. A responsabilidade técnica pela interpretação e pela prescrição continua sendo do profissional registrado no CREF.' },
      { q: 'Dá para salvar os resultados?', a: 'Nas calculadoras, não — elas não guardam nada. Para manter histórico por aluno e comparar avaliações ao longo do tempo, é preciso uma conta no CoachPilot, que tem plano grátis para até 3 alunos.' },
      { q: 'De onde vêm as fórmulas?', a: 'De literatura publicada, citada em cada página com autor, ano, população estudada e faixa etária de validade. Onde há divergência entre fontes ou erro difundido na internet brasileira, a página aponta explicitamente.' },
    ],
    related: ['avaliacao-fisica', 'software-personal-trainer', 'precos'],
  },

  'calculadora-1rm': {
    path: '/calculadoras/1rm',
    title: 'Calculadora de 1RM: repetição máxima + tabela de porcentagem | CoachPilot',
    description: 'Calcule seu 1RM por 7 fórmulas (Epley, Brzycki, Lombardi, Lander, Mayhew, Wathen, O’Conner) e veja a tabela oficial da NSCA de %1RM por repetições. Grátis, sem cadastro.',
    h1: 'Calculadora de 1RM: estime a repetição máxima e monte a carga do treino',
    label: 'Calculadora de 1RM',
    eyebrow: 'Calculadora gratuita',
    parent: 'calculadoras',
    widget: '1rm',
    widgetTitle: 'Calcule seu 1RM',
    widgetNote: 'Informe uma série que você levou até (ou perto de) a falha. Quanto menor o número de repetições, mais confiável a estimativa.',
    appCategory: 'HealthApplication',
    intro: '1RM é a maior carga que se consegue mover por uma repetição completa. Testar isso na prática é demorado e nem sempre seguro, então a saída usual é estimar a partir de uma série submáxima — 100 kg por 8 repetições, por exemplo. Esta calculadora aplica sete equações publicadas de uma vez, mostra a divergência entre elas em vez de escondê-la, e converte o resultado na tabela de cargas que você vai usar de fato na prescrição.',
    bullets: [
      'Sete fórmulas ao mesmo tempo, com a divergência à mostra',
      'Tabela oficial da NSCA de %1RM por número de repetições',
      'Carga já convertida em kg para cada intensidade',
      'Aviso quando a estimativa sai da faixa em que ela é confiável',
    ],
    sections: [
      {
        title: 'Tabela de porcentagem do 1RM (NSCA)',
        paragraphs: [
          'Esta é a tabela de referência do Training Load Chart da NSCA, adaptada de Landers, J. (NSCA Journal 6(6):60-61, 1984). Ela funciona nos dois sentidos: para estimar o 1RM a partir de uma série submáxima, e — o uso mais comum no dia a dia — para descobrir que carga colocar na barra quando o programa pede uma intensidade específica.',
          'A coluna de carga usa um 1RM de 120 kg como exemplo. Repare que 11 repetições não existe na tabela original e não foi inventada aqui: entre 10 e 12 há um salto real, e preencher esse buraco com interpolação seria apresentar como referência algo que a fonte não traz.',
        ],
        table: {
          headers: ['Repetições', '% do 1RM', 'Carga se o 1RM for 120 kg'],
          rows: [
            ['1', '100%', '120,0 kg'],
            ['2', '95%', '114,0 kg'],
            ['3', '93%', '111,6 kg'],
            ['4', '90%', '108,0 kg'],
            ['5', '87%', '104,4 kg'],
            ['6', '85%', '102,0 kg'],
            ['7', '83%', '99,6 kg'],
            ['8', '80%', '96,0 kg'],
            ['9', '77%', '92,4 kg'],
            ['10', '75%', '90,0 kg'],
            ['12', '70%', '84,0 kg'],
          ],
        },
      },
      {
        title: 'As sete fórmulas, e por que elas discordam',
        paragraphs: [
          'Não existe uma equação de 1RM: existem várias, publicadas por autores diferentes, ajustadas a amostras diferentes. Todas partem da mesma ideia — quanto mais repetições você faz com uma carga, mais longe ela está do seu máximo — mas modelam essa curva de jeitos distintos. Abaixo, o que cada uma devolve para a mesma entrada de 100 kg por 8 repetições.',
          'A mediana das sete nesse caso é 125,1 kg. A tabela da NSCA, pelo caminho independente da porcentagem, diz que 8 repetições correspondem a 80% do 1RM, o que dá 100 ÷ 0,80 = 125,0 kg. Duas fontes que não conversam entre si chegando a 100 gramas de distância é um bom sinal de que a faixa está certa.',
        ],
        table: {
          headers: ['Fórmula', 'Equação', '1RM para 100 kg × 8'],
          rows: [
            ['Epley', '1RM = w × (1 + r/30)', '126,7 kg'],
            ['Brzycki', '1RM = w × 36 / (37 − r)', '124,1 kg'],
            ['Lombardi', '1RM = w × r^0,10', '123,1 kg'],
            ['O’Conner', '1RM = w × (1 + 0,025r)', '120,0 kg'],
            ['Lander', '1RM = 100w / (101,3 − 2,67123r)', '125,1 kg'],
            ['Mayhew', '1RM = 100w / (52,2 + 41,9·e^(−0,055r))', '126,3 kg'],
            ['Wathen', '1RM = 100w / (48,8 + 53,8·e^(−0,075r))', '127,7 kg'],
          ],
        },
      },
      {
        title: 'Epley ou Brzycki? As duas cruzam exatamente em 10 repetições',
        paragraphs: [
          'É a dúvida mais comum, e ela tem resposta objetiva em vez de preferência. Em 10 repetições as duas fórmulas dão o mesmo resultado: Epley devolve w × (1 + 10/30) = 1,3333w, e Brzycki devolve w × 36/27 = 1,3333w. O cruzamento é exato, não aproximado.',
          'Abaixo de 10 repetições, Epley estima mais alto; acima de 10, Brzycki estima mais alto, e a diferença cresce rápido. Em 15 repetições, Brzycki já devolve 1,64w contra 1,50w de Epley — quase 10% de distância. Na prática isso importa menos do que parece: o que estraga o acompanhamento não é escolher a fórmula "errada", é trocar de fórmula no meio do caminho. Escolha uma e mantenha.',
        ],
      },
      {
        title: 'Quando a estimativa deixa de valer',
        list: [
          'De 2 a 10 repetições, o erro típico fica em torno de ±5% — é a faixa em que estimar compensa.',
          'Acima de 12 repetições, a divergência entre fórmulas chega a ±15–20%. A resistência muscular passa a pesar mais que a força máxima, e a extrapolação perde o sentido.',
          'Com 1 repetição, não há estimativa: o 1RM é a própria carga. Vale dizer que várias fórmulas, aplicadas cegamente, erram justamente aí — a de Mayhew devolveria 130,6 kg para alguém que levantou 120 kg uma vez.',
          'A série precisa ter sido levada até a falha ou muito perto dela. Uma série de 8 repetições que poderia ter sido de 12 subestima o 1RM em cerca de 10%.',
          'A estimativa é específica do exercício. Um 1RM de agachamento não diz nada sobre o leg press, e a relação carga-repetição é diferente entre exercícios de membro superior e inferior.',
        ],
      },
      {
        title: '1RM estimado ou teste direto?',
        body: 'O teste direto continua sendo o padrão-ouro, mas cobra caro: exige aquecimento longo, várias tentativas até a carga máxima, técnica consolidada e supervisão. Não é razoável para iniciante, para quem está voltando de lesão nem para a maioria dos alunos de personal — e ainda gera uma sessão inteira sem estímulo de treino. A estimativa a partir de uma série de 3 a 6 repetições resolve o mesmo problema com risco muito menor, e o erro de 5% costuma ser irrelevante diante da variação normal de força de um dia para o outro.',
      },
      {
        title: 'Do número para a prescrição',
        body: 'Estimar o 1RM só vale se ele virar carga escrita no treino do aluno. No CoachPilot, cada exercício tem um campo de 1RM: preenchido ele, você digita a intensidade em porcentagem e a plataforma converte para quilos automaticamente na hora de montar as séries — e faz o caminho inverso, mostrando a que porcentagem corresponde a carga que o aluno realmente usou. Com o histórico de sessões, dá para acompanhar a intensidade relativa média ao longo dos meses em vez de olhar carga absoluta solta.',
      },
    ],
    faqs: [
      { q: 'Qual fórmula de 1RM é a mais precisa?', a: 'Nenhuma é consistentemente melhor para todo mundo — a precisão depende do exercício, do nível de treino e da faixa de repetições. Por isso esta calculadora mostra as sete e a mediana. O que mais importa na prática é usar sempre a mesma fórmula ao longo do tempo, para que as comparações entre ciclos sejam válidas.' },
      { q: 'Quantas repetições devo usar para estimar melhor?', a: 'Entre 3 e 6, levadas até perto da falha. É a faixa em que as equações concordam mais e o erro típico fica em torno de 5%, sem exigir uma tentativa máxima real.' },
      { q: 'Por que a tabela não tem 11 repetições?', a: 'Porque a tabela original da NSCA não traz esse valor. Entre 10 repetições (75%) e 12 (70%) existe um salto na fonte, e inventar um valor interpolado seria apresentar como referência oficial algo que ela não diz.' },
      { q: 'Serve para qualquer exercício?', a: 'A estimativa funciona melhor em exercícios multiarticulares com barra — agachamento, supino, terra, desenvolvimento. Em exercícios isolados e em máquinas a relação entre carga e repetições é menos previsível, e o resultado deve ser tratado como referência grosseira.' },
      { q: 'O que é IRM no CoachPilot?', a: 'É outra coisa: intensidade relativa média, a média das porcentagens de 1RM usadas numa sessão, ponderada pelas repetições. Serve para acompanhar o quanto o aluno treinou pesado ao longo do tempo, e depende de o 1RM estar preenchido no exercício.' },
    ],
    related: ['calculadora-volume', 'calculadora-dobras', 'app-treino-alunos', 'software-personal-trainer'],
  },

  'calculadora-dobras': {
    path: '/calculadoras/dobras-cutaneas',
    title: 'Calculadora de Dobras Cutâneas: % de gordura por 5 protocolos | CoachPilot',
    description: 'Calcule o percentual de gordura por dobras cutâneas: Pollock 3 e 7, Faulkner, Guedes e Petroski, com Siri e Brozek. Com os pontos anatômicos corretos e a faixa de validade de cada equação.',
    h1: 'Calculadora de dobras cutâneas: percentual de gordura por 5 protocolos',
    label: 'Dobras cutâneas',
    eyebrow: 'Calculadora gratuita',
    parent: 'calculadoras',
    widget: 'dobras',
    widgetTitle: 'Calcule o percentual de gordura',
    widgetNote: 'Meça cada dobra três vezes e use a mediana. O protocolo já vem escolhido — troque só se quiser.',
    appCategory: 'HealthApplication',
    intro: 'A dobra cutânea continua sendo o método de campo mais usado para estimar composição corporal, porque custa pouco e é reprodutível quando a técnica é padronizada. Esta calculadora traz cinco protocolos — Jackson & Pollock de 3 e de 7 dobras, Faulkner, e os dois brasileiros, Guedes e Petroski — com os pontos anatômicos corretos de cada um, a faixa etária em que cada equação foi validada e a conversão de densidade em gordura por Siri ou Brozek.',
    bullets: [
      'Cinco protocolos, incluindo dois desenvolvidos com população brasileira',
      'Pontos anatômicos de cada dobra descritos ponto a ponto',
      'Aviso quando a idade sai da faixa em que a equação foi validada',
      'Siri e Brozek, com a diferença entre as duas explicada',
    ],
    sections: [
      {
        title: 'Os protocolos e o que cada um exige',
        paragraphs: [
          'Um protocolo de dobras é sempre um par: uma lista de pontos anatômicos e uma equação de regressão desenvolvida com aquela lista, naquela população. Trocar os pontos e manter a equação invalida o resultado — é o erro mais comum nas calculadoras disponíveis em português.',
        ],
        table: {
          headers: ['Protocolo', 'Dobras (homens)', 'Dobras (mulheres)', 'Validade'],
          rows: [
            ['Jackson & Pollock, 3 dobras', 'Peitoral, abdominal, coxa', 'Tríceps, suprailíaca, coxa', 'H 18–61 · M 18–55'],
            ['Jackson & Pollock, 7 dobras', 'Peitoral, axilar média, tríceps, subescapular, abdominal, suprailíaca, coxa', 'Os mesmos 7 pontos', 'H 18–61 · M 18–55'],
            ['Faulkner (Yuhasz), 4 dobras', 'Tríceps, subescapular, suprailíaca, abdominal', 'Os mesmos 4 pontos', 'Adultos jovens treinados'],
            ['Guedes, 3 dobras', 'Tríceps, suprailíaca, abdominal', 'Coxa, suprailíaca, subescapular', 'H 17–27 · M 18–30'],
            ['Petroski, 4 dobras', 'Subescapular, tríceps, suprailíaca, panturrilha medial', 'Axilar média, suprailíaca, coxa, panturrilha medial', 'H 18–66 · M 18–51'],
          ],
        },
      },
      {
        title: 'Três erros que circulam nas calculadoras em português',
        list: [
          'Pollock de 3 dobras em homens não é tríceps, peitoral e abdominal: É peitoral, abdominal e coxa. Há calculadoras brasileiras publicando a lista errada com os coeficientes certos, o que produz um número plausível e incorreto.',
          'Pollock de 7 dobras não inclui panturrilha: O sétimo ponto é a axilar média. A panturrilha medial aparece no protocolo de Petroski, não no de Jackson & Pollock.',
          'A equação feminina de Petroski é logarítmica: Circulam versões com o somatório ao quadrado e sem termo linear. Não é questão de opinião: com quatro dobras somando 66 mm e 30 anos de idade, a forma incorreta devolve densidade corporal negativa, o que é fisicamente impossível. A forma correta é D = 1,19547130 − 0,07513507 × log₁₀(Σ4) − 0,00041072 × idade.',
        ],
      },
      {
        title: 'Onde e como medir cada dobra',
        paragraphs: [
          'A precisão do resultado depende muito mais da coleta do que da equação escolhida. Meça sempre do lado direito, com o avaliado em pé e relaxado, pinçando a pele e o tecido subcutâneo sem incluir músculo, e aplicando o compasso cerca de 1 cm abaixo dos dedos. Faça três medidas em cada ponto, em rodízio entre os pontos, e use a mediana.',
        ],
        table: {
          headers: ['Dobra', 'Direção', 'Localização'],
          rows: [
            ['Tríceps', 'Vertical', 'Face posterior do braço, no ponto médio entre o acrômio e o olécrano, com o braço solto'],
            ['Subescapular', 'Oblíqua, 45°', 'Dois centímetros abaixo do ângulo inferior da escápula, acompanhando a borda'],
            ['Peitoral', 'Oblíqua', 'Homens: ponto médio entre a linha axilar anterior e o mamilo. Mulheres: a um terço dessa distância, a partir da axila'],
            ['Axilar média', 'Vertical', 'Sobre a linha axilar média, na altura do processo xifoide'],
            ['Abdominal', 'Vertical', 'Dois centímetros ao lado da cicatriz umbilical'],
            ['Suprailíaca', 'Oblíqua', 'Logo acima da crista ilíaca, sobre a linha axilar média'],
            ['Coxa', 'Vertical', 'Face anterior, no ponto médio entre a prega inguinal e a borda superior da patela'],
            ['Panturrilha medial', 'Vertical', 'Face medial da perna, na altura do maior perímetro, com o joelho a 90°'],
          ],
        },
      },
      {
        title: 'De densidade para percentual: Siri ou Brozek',
        paragraphs: [
          'Quase todos os protocolos não devolvem gordura diretamente — devolvem densidade corporal, que depois é convertida. As duas equações clássicas são a de Siri (1961), %G = 495 ÷ D − 450, e a de Brozek (1963), %G = 457 ÷ D − 414,2. Siri é o padrão da maior parte da literatura e é o default aqui.',
          'A diferença entre as duas é pequena na faixa usual e cresce nos extremos: para uma densidade de 1,0657, Siri devolve 14,5% e Brozek 14,6%; em pessoas com percentual mais alto, Siri tende a dar valores um pouco maiores. O que não se pode fazer é alternar entre elas entre uma avaliação e outra do mesmo aluno — a variação do método viraria "evolução".',
          'A exceção é o Faulkner, que estima o percentual direto do somatório, sem passar por densidade: %G = (Σ4 × 0,153) + 5,783. Nele, escolher Siri ou Brozek não muda nada.',
        ],
      },
      {
        title: 'Faixas de referência',
        paragraphs: [
          'A tabela abaixo traz as faixas mais difundidas na literatura de exercício. Trate-as como referência, não como diagnóstico: os pontos de corte variam entre fontes, e as faixas saudáveis sobem alguns pontos com a idade — o que é normal, não um problema a corrigir.',
        ],
        table: {
          headers: ['Faixa', 'Homens', 'Mulheres'],
          rows: [
            ['Gordura essencial', '2–5%', '10–13%'],
            ['Atletas', '6–13%', '14–20%'],
            ['Bom / em forma', '14–17%', '21–24%'],
            ['Aceitável', '18–24%', '25–31%'],
            ['Acima do recomendado', '25% ou mais', '32% ou mais'],
          ],
        },
      },
      {
        title: 'O que a estimativa não consegue fazer',
        list: [
          'Não é medida direta. É uma estimativa de densidade a partir de gordura subcutânea, com erro-padrão que costuma ficar em 3 a 4 pontos percentuais mesmo com boa técnica.',
          'Não enxerga gordura visceral. Duas pessoas com o mesmo somatório de dobras podem ter distribuições internas bem diferentes.',
          'Equações estrangeiras aplicadas à população brasileira tendem a viés — é a razão de existirem Guedes e Petroski, desenvolvidos aqui.',
          'Fora da faixa etária de validade a equação continua devolvendo um número, e é aí que ela engana. A calculadora avisa quando isso acontece em vez de silenciar.',
          'O valor absoluto importa menos que a série temporal. Mesmo protocolo, mesmo avaliador, mesmas condições — só assim a comparação entre duas avaliações significa alguma coisa.',
        ],
      },
      {
        title: 'Registrar no histórico do aluno',
        body: 'Uma medição isolada resolve pouco. O que muda a conversa com o aluno é a sequência: o mesmo protocolo repetido a cada seis ou oito semanas, com peso, medidas e fotos ao lado. No CoachPilot, cada [avaliação física](/avaliacao-fisica-digital) guarda percentual de gordura, peso, medidas livres, fotos comparativas e anexos de bioimpedância no histórico do aluno, com gráficos de evolução gerados automaticamente. Você calcula aqui e registra lá — o plano grátis cobre até 3 alunos.',
      },
    ],
    faqs: [
      { q: 'Qual protocolo de dobras cutâneas devo usar?', a: 'Se você não tem preferência, Pollock de 3 dobras resolve na maior parte dos casos e é o mais rápido. Pollock de 7 reduz o erro em quem tem distribuição de gordura atípica. Para população brasileira adulta jovem, Guedes e Petroski foram desenvolvidos aqui e tendem a ter menos viés. O mais importante é não trocar de protocolo entre avaliações do mesmo aluno.' },
      { q: 'Pollock de 3 dobras em homens usa quais pontos?', a: 'Peitoral, abdominal e coxa. Em mulheres, tríceps, suprailíaca e coxa. Atenção: existem calculadoras em português publicando "tríceps, peitoral e abdominal" para homens, o que está incorreto e produz um resultado plausível mas errado.' },
      { q: 'A equação de Faulkner foi feita com nadadores?', a: 'Não — é um mito difundido. A equação nem sequer é de Faulkner: é atribuída a Yuhasz e nunca foi publicada por ele. Pires Neto e Glaner demonstraram na Revista Brasileira de Cineantropometria e Desempenho Humano que não houve amostra de nadadores no desenvolvimento dela.' },
      { q: 'Qual a diferença entre Siri e Brozek?', a: 'São duas conversões de densidade corporal em percentual de gordura, com pressupostos ligeiramente diferentes sobre a densidade da massa magra. Na faixa usual a diferença é de décimos de ponto. Siri é o padrão da literatura e o default aqui; o que não vale é alternar entre elas ao acompanhar o mesmo aluno.' },
      { q: 'Dobra cutânea ou bioimpedância?', a: 'Ambas são estimativas com erro parecido. A bioimpedância é mais rápida e não depende da técnica do avaliador, mas é sensível a hidratação, horário e refeição recente. A dobra depende de técnica, mas é mais estável entre dias. Na prática, escolha um método e mantenha — comparar dobra com bioimpedância no mesmo aluno gera diferença que não é mudança de composição corporal.' },
      { q: 'Preciso de compasso profissional?', a: 'Sim, e calibrado. O compasso precisa exercer pressão constante de cerca de 10 g/mm² na superfície de contato. Modelos de plástico sem mola calibrada introduzem erro grande o suficiente para inviabilizar a comparação entre avaliações.' },
    ],
    related: ['calculadora-energia', 'calculadora-1rm', 'avaliacao-fisica', 'gestao-alunos'],
  },

  'calculadora-precificacao': {
    path: '/calculadoras/quanto-cobrar',
    title: 'Quanto cobrar como personal trainer: calculadora de preço | CoachPilot',
    description: 'Calcule quanto cobrar por sessão e por mensalidade a partir dos seus custos, das horas que você tem e da renda que quer tirar. Mostra também quantos alunos você precisa. Grátis.',
    h1: 'Calculadora: quanto cobrar como personal trainer',
    label: 'Quanto cobrar',
    eyebrow: 'Calculadora gratuita',
    parent: 'calculadoras',
    widget: 'precificacao',
    widgetTitle: 'Calcule o seu preço',
    widgetNote: 'Já vem preenchida com um cenário de exemplo. Troque pelos seus números e o resultado se ajusta na hora.',
    appCategory: 'BusinessApplication',
    intro: 'A maioria dos personais define preço olhando o que o colega da academia cobra. O problema é que o preço do colega foi calculado a partir dos custos dele, das horas dele e da ocupação dele. Esta calculadora faz o caminho inverso: parte do quanto você precisa receber e da agenda que você realmente consegue preencher, e devolve o preço por sessão, a mensalidade equivalente e quantos alunos isso exige.',
    bullets: [
      'Preço por sessão a partir dos seus custos, não do mercado',
      'Mensalidade equivalente para 1×, 2× e 3× por semana',
      'Quantos alunos você precisa para a renda que quer',
      'Alerta quando a meta não cabe na sua agenda',
    ],
    sections: [
      {
        title: 'A conta que quase ninguém faz',
        paragraphs: [
          'Preço por hora não é renda por hora. Entre uma coisa e outra entram três descontos que costumam ser ignorados: o custo fixo de trabalhar (transporte, acesso à academia, material, celular, plano de gestão), o imposto, e principalmente a ociosidade — as horas que você tem disponíveis mas não consegue vender.',
          'A ociosidade é o item mais subestimado. Um personal com 30 horas semanais disponíveis raramente atende 30 horas: a demanda se concentra em dois blocos, cedo e no fim da tarde, e o meio do dia fica vazio. Quem calcula preço supondo agenda cheia descobre no fim do mês que o número não fecha, e conclui erradamente que precisa de mais alunos, quando precisava de preço maior.',
          'A conta usada aqui é direta: primeiro descobrimos quantas sessões você realmente vende por mês; depois, quanto precisa entrar de faturamento bruto para cobrir custos, imposto e a sua renda; e dividimos um pelo outro. O imposto incide sobre o bruto, então ele entra como bruto = (custos + renda desejada) ÷ (1 − alíquota), e não como um desconto no fim.',
        ],
      },
      {
        title: 'Referências de mercado, para contexto',
        paragraphs: [
          'Os números abaixo servem para você saber onde o seu resultado cai em relação ao mercado — eles não entram na conta em momento nenhum, e não deveriam definir o seu preço. Um preço muito abaixo da faixa costuma indicar custo subestimado ou ociosidade otimista demais; muito acima, uma proposta de valor que precisa estar clara para o aluno.',
        ],
        table: {
          headers: ['Modalidade', 'Faixa praticada', 'Concentração'],
          rows: [
            ['Sessão presencial', 'R$ 50 a R$ 250', 'R$ 86 a R$ 150'],
            ['Consultoria online (mensal)', 'R$ 90 a R$ 320', '—'],
            ['Nichos de alta renda em capitais', 'Acima de R$ 250', '—'],
          ],
        },
        list: [
          'Verificado em agosto de 2026, a partir de levantamentos públicos de mercado. Faixas amplas e sujeitas a variação por cidade, especialização e formato.',
        ],
      },
      {
        title: 'Imposto: MEI, Simples ou nada',
        paragraphs: [
          'A calculadora trata o imposto como parâmetro, com três atalhos. O MEI paga um valor fixo mensal — R$ 86,05 para serviços em 2026 — e não um percentual, com teto de faturamento de R$ 81.000 por ano, o que dá uma média de R$ 6.750 por mês. Se o seu resultado projetar faturamento acima disso, a calculadora avisa: o enquadramento vai precisar mudar.',
          'O Simples Nacional cobra percentual sobre o faturamento, com alíquota que varia por anexo e por faixa de receita. E há quem ainda atue sem CNPJ, caso em que o campo fica zerado — sem juízo de valor aqui, mas vale lembrar que isso costuma sair mais caro no imposto de renda pessoa física.',
          'Regras tributárias mudam. Os valores acima foram verificados em agosto de 2026 e são exibidos como preenchimento sugerido, nunca travados: confirme com o seu contador antes de usar como base de decisão.',
        ],
      },
      {
        title: 'Preço por sessão ou mensalidade?',
        body: 'A mensalidade é quase sempre melhor para os dois lados. Para você, transforma receita variável em previsível e reduz o buraco de agenda de quem falta. Para o aluno, ancora o compromisso no mês e não na sessão, o que melhora a adesão. A calculadora mostra a mensalidade equivalente para 1, 2 e 3 sessões por semana, usando 4,33 semanas por mês — a média real, e não 4, que é o arredondamento que faz perder quase uma sessão por mês em cada aluno.',
      },
      {
        title: 'Quantos alunos você precisa',
        body: 'É a saída mais útil da calculadora e a que costuma surpreender. Com o preço definido, o número de alunos para atingir a meta sai de uma divisão simples — mas o resultado precisa caber na agenda. Quando o número de sessões exigidas passa da sua capacidade real, subir o preço é o único caminho: não existe atender mais horas do que existem no dia. É nesse ponto que a conversa deixa de ser sobre preço e passa a ser sobre modelo de atendimento — consultoria online, treino em dupla ou pequenos grupos multiplicam a receita por hora sem esticar a agenda.',
      },
      {
        title: 'Depois do preço vem a cobrança',
        body: 'Definir o valor é a parte fácil; o que come tempo é lembrar quem pagou, quem está atrasado e quem venceu ontem. O CoachPilot tem controle financeiro por aluno com cobrança via Pix caindo direto na sua conta, sem taxa da plataforma, e marca automaticamente quem está em atraso. Junto com [gestão de alunos](/gestao-de-alunos-personal-trainer), treinos e avaliações, sai por R$ 39,90 por mês — que, aliás, é um custo fixo a incluir na conta acima. Veja os [planos](/precos).',
      },
    ],
    faqs: [
      { q: 'Quanto cobrar por aula de personal trainer em 2026?', a: 'A faixa praticada no Brasil vai de R$ 50 a R$ 250 por sessão presencial, com a maior parte entre R$ 86 e R$ 150. Mas a média de mercado é um péssimo ponto de partida: o preço certo depende dos seus custos fixos, das horas que você consegue efetivamente vender e da renda que precisa tirar. É essa conta que a calculadora faz.' },
      { q: 'Quanto cobrar por consultoria online?', a: 'Os planos de acompanhamento a distância no Brasil ficam entre R$ 90 e R$ 320 por mês. Como não há deslocamento nem hora presencial, a conta muda: o limite deixa de ser a sua agenda e passa a ser quantos alunos você consegue acompanhar com qualidade.' },
      { q: 'Devo cobrar por sessão avulsa ou pacote mensal?', a: 'Pacote mensal, na maior parte dos casos. Ele torna a sua receita previsível, reduz o prejuízo de faltas e melhora a adesão do aluno. A sessão avulsa faz sentido como porta de entrada ou para quem tem rotina realmente imprevisível, normalmente com preço maior que o da sessão dentro do pacote.' },
      { q: 'Como calcular o preço de um pacote de 12 sessões?', a: 'Parta do preço por sessão calculado aqui e decida conscientemente se vai dar desconto. Um desconto de 10% num pacote fechado costuma se pagar pela previsibilidade e pelo pagamento antecipado — mas ele precisa ser uma escolha, não o resultado de não ter feito a conta.' },
      { q: 'Personal trainer pode ser MEI?', a: 'Sim, pela atividade de condicionamento físico, com teto de faturamento de R$ 81.000 por ano e DAS mensal fixo de R$ 86,05 para serviços em 2026. Ultrapassando o teto, o desenquadramento é obrigatório. Valores verificados em agosto de 2026 — confirme com o seu contador, porque as regras mudam.' },
    ],
    related: ['calculadora-volume', 'calculadora-1rm', 'precos', 'gestao-alunos'],
  },

  'calculadora-volume': {
    path: '/calculadoras/volume-semanal',
    title: 'Calculadora de volume de treino: séries por semana | CoachPilot',
    description: 'Quantas séries por semana por grupo muscular? Calcule o volume semanal e compare com a faixa da meta-análise de Schoenfeld. Com contagem de série indireta opcional. Grátis.',
    h1: 'Calculadora de volume semanal: séries por grupo muscular',
    label: 'Volume semanal',
    eyebrow: 'Calculadora gratuita',
    parent: 'calculadoras',
    widget: 'volume',
    widgetTitle: 'Calcule o volume semanal',
    widgetNote: 'Um grupo muscular por vez. Se quiser conferir a semana inteira, vá adicionando grupos.',
    appCategory: 'HealthApplication',
    intro: 'Volume semanal — o número de séries que um grupo muscular recebe ao longo da semana — é hoje a variável com relação dose-resposta melhor documentada para hipertrofia. Esta calculadora soma as séries de cada grupo considerando a frequência de treino e mostra onde o resultado cai em relação às faixas encontradas na literatura, com a opção de contar séries indiretas pela metade.',
    bullets: [
      'Séries por semana por grupo, considerando a frequência',
      'Faixas baseadas na meta-análise de Schoenfeld (2017)',
      'Contagem fracionária de série indireta, opcional',
      'Mostra quantas séries faltam para chegar à faixa alvo',
    ],
    sections: [
      {
        title: 'O que a literatura mostra',
        paragraphs: [
          'A referência mais citada é a meta-análise de Schoenfeld, Ogborn e Krieger (2017), publicada no Journal of Sports Sciences, que reuniu 34 grupos de tratamento de 15 estudos. O achado central é uma relação dose-resposta graduada: mais séries por semana produzem mais hipertrofia, na ordem de 0,38% de ganho adicional por série acrescentada.',
          'Isso não significa que mais é sempre melhor sem teto — significa que, dentro das faixas estudadas, o volume é o que mais explica a diferença de resultado entre programas. As faixas abaixo são a leitura prática desse achado.',
        ],
        table: {
          headers: ['Séries por semana', 'Leitura', 'O que costuma acontecer'],
          rows: [
            ['Menos de 5', 'Abaixo do mínimo', 'Funciona em iniciante e para manter, mas fica longe do potencial'],
            ['5 a 9', 'Mínimo efetivo', 'Já produz ganho consistente na maioria das pessoas'],
            ['10 ou mais', 'Faixa alvo', 'Onde os melhores resultados aparecem na meta-análise'],
          ],
        },
      },
      {
        title: 'Série direta e série indireta',
        paragraphs: [
          'Uma série de rosca direta é volume direto de bíceps. Uma série de remada também recruta bíceps, mas como músculo auxiliar. A pergunta de sempre é se a remada conta para o volume de bíceps — e, se conta, quanto.',
          'Durante anos isso foi convenção de treinador. Deixou de ser: a meta-regressão publicada na Sports Medicine em 2025, com 67 estudos e 2.058 participantes, comparou três formas de contar a série indireta — como 1, como 0,5 e como 0 — e a contagem fracionária, de meia série, foi a que melhor explicou os ganhos observados. É por isso que o fator padrão aqui é 0,5.',
          'Ainda assim, o campo vem desligado na calculadora. O motivo é prático: quem só quer saber quantas séries diretas está fazendo não deveria precisar entender essa nuance para obter um número. Ligue quando quiser o retrato completo da semana.',
        ],
      },
      {
        title: 'Volume não é a única variável',
        list: [
          'Proximidade da falha muda tudo. Dez séries paradas a cinco repetições da falha não equivalem a dez séries levadas perto do limite.',
          'A meta-análise descreve médias entre estudos, não previsão individual. A sua tolerância a volume depende de recuperação, sono, alimentação, estresse e tempo de treino.',
          'Volume alto sem progressão de carga estagna. Séries a mais não substituem sobrecarga.',
          'Frequência distribui o volume, e distribuir costuma ser melhor que concentrar: 12 séries em dois dias tende a render mais que 12 num só.',
          'O volume que você aguenta hoje não é o de daqui a seis meses. Subir gradualmente e observar a recuperação vale mais que perseguir um número.',
        ],
      },
      {
        title: 'Contar volume sem planilha paralela',
        body: 'Fazer essa conta na mão para dez alunos, toda semana, não se sustenta. No CoachPilot o programa do aluno já é estruturado por exercício, séries e frequência, então o volume por grupo sai do próprio treino prescrito — e o histórico de sessões mostra o que foi de fato executado, que é sempre diferente do planejado. Comece grátis com até 3 alunos.',
      },
    ],
    faqs: [
      { q: 'Quantas séries por semana para hipertrofia?', a: 'A meta-análise de Schoenfeld (2017) aponta relação dose-resposta graduada, com os melhores resultados a partir de 10 séries semanais por grupo muscular. Entre 5 e 9 já há ganho consistente. Abaixo de 5 funciona para iniciantes e para manutenção, mas fica aquém do potencial.' },
      { q: 'Série de remada conta como volume de bíceps?', a: 'Conta parcialmente. A meta-regressão publicada na Sports Medicine em 2025, com 67 estudos, mostrou que contar a série indireta como meia série é o que melhor explica os ganhos observados — melhor do que contar como série inteira ou ignorar.' },
      { q: 'Existe volume máximo?', a: 'A meta-análise não identifica um teto claro dentro das faixas estudadas, mas isso não autoriza volume ilimitado: os estudos têm duração limitada e a recuperação é individual. O sinal prático de excesso é queda de desempenho entre sessões, e não um número universal.' },
      { q: 'É melhor treinar um grupo uma ou duas vezes por semana?', a: 'Para um mesmo volume total, distribuir em duas sessões costuma render mais que concentrar em uma, sobretudo em volumes mais altos. A frequência é o meio de acomodar o volume com qualidade, não um fim em si.' },
    ],
    related: ['calculadora-1rm', 'calculadora-energia', 'software-personal-trainer', 'app-treino-alunos'],
  },

  'calculadora-energia': {
    path: '/calculadoras/tmb-e-macros',
    title: 'Calculadora de TMB e gasto calórico + macros | CoachPilot',
    description: 'Estime a taxa metabólica basal e o gasto calórico diário por Mifflin-St Jeor, Harris-Benedict revisada ou Katch-McArdle, com distribuição de macronutrientes. Estimativa educativa, grátis.',
    h1: 'Calculadora de TMB e gasto calórico diário',
    label: 'TMB e macros',
    eyebrow: 'Calculadora gratuita',
    parent: 'calculadoras',
    widget: 'energia',
    widgetTitle: 'Estime o gasto energético',
    widgetNote: 'Estimativa educativa. Prescrição alimentar é atribuição privativa do nutricionista — veja a ressalva abaixo do resultado.',
    appCategory: 'HealthApplication',
    intro: 'Taxa metabólica basal é a energia que o corpo gasta em repouso absoluto; o gasto energético total acrescenta a isso o efeito da atividade do dia. Esta calculadora estima os dois por três equações diferentes e mostra uma distribuição possível de macronutrientes. É material educativo para embasar a conversa com o aluno — não é prescrição nutricional, e a diferença importa juridicamente.',
    bullets: [
      'Três equações: Mifflin-St Jeor, Harris-Benedict revisada e Katch-McArdle',
      'Comparação lado a lado, porque elas discordam entre si',
      'Distribuição de macros com proteína e gordura ajustáveis',
      'Ressalva profissional explícita, não escondida no rodapé',
    ],
    sections: [
      {
        title: 'O limite profissional, dito antes de tudo',
        paragraphs: [
          'No Brasil, a prescrição de dietas é atribuição privativa do nutricionista, conforme a Resolução CFN nº 600/2018. Um personal trainer pode calcular e explicar gasto energético como informação educativa; não pode prescrever plano alimentar, cardápio ou meta calórica individualizada.',
          'A distinção não é formalidade. Estimar que o gasto de alguém gira em torno de 2.700 kcal é informação; dizer a essa pessoa que ela deve comer 2.200 kcal por dia distribuídas assim e assado é prescrição. A calculadora foi desenhada para ficar do lado certo dessa linha, e por isso fala em estimativa e distribuição possível, nunca em meta ou recomendação.',
        ],
      },
      {
        title: 'As três equações',
        paragraphs: [
          'Mifflin-St Jeor (1990) é a mais usada hoje para adultos não atletas e costuma ser a mais precisa quando não se conhece a composição corporal. Harris-Benedict revisada por Roza e Shizgal (1984) é a atualização de uma equação de 1919 e tende a estimar um pouco acima. Katch-McArdle parte da massa magra em vez do peso total, o que a torna a melhor opção quando existe um percentual de gordura confiável — e é o motivo de essas duas calculadoras conversarem.',
        ],
        table: {
          headers: ['Equação', 'Fórmula', 'Quando usar'],
          rows: [
            ['Mifflin-St Jeor (1990)', 'H: 10×peso + 6,25×altura − 5×idade + 5 · M: idem − 161', 'Padrão para adultos, sem dado de composição corporal'],
            ['Harris-Benedict rev. (1984)', 'H: 88,362 + 13,397×peso + 4,799×altura − 5,677×idade · M: 447,593 + 9,247×peso + 3,098×altura − 4,330×idade', 'Alternativa clássica; tende a estimar um pouco mais alto'],
            ['Katch-McArdle', '370 + 21,6 × massa magra (kg)', 'Quando há percentual de gordura medido — ver [dobras cutâneas](/calculadoras/dobras-cutaneas)'],
          ],
        },
      },
      {
        title: 'Do basal para o gasto do dia',
        paragraphs: [
          'A TMB sozinha não serve para nada prático: ninguém passa o dia deitado. O gasto total é obtido multiplicando a TMB por um fator de atividade, que vai de 1,2 para quem é sedentário a 1,9 para quem treina pesado quase todos os dias.',
          'Esse fator é a maior fonte de erro de toda a conta. A diferença entre escolher 1,55 e 1,725 pode passar de 300 kcal por dia — mais do que a diferença entre qualquer par de equações. Na dúvida, escolha o fator mais baixo: subestimar o gasto e ajustar depois com base no que acontece na balança é bem menos problemático que o contrário.',
        ],
      },
      {
        title: 'Como a distribuição de macros é montada',
        list: [
          'Proteína é definida em gramas por quilo de peso. O intervalo usual em quem treina força fica entre 1,6 e 2,2 g/kg.',
          'Gordura pode ser definida em gramas por quilo ou como percentual das calorias. Abaixo de cerca de 0,5 g/kg costuma haver prejuízo hormonal.',
          'Carboidrato entra por diferença: é o que sobra das calorias depois de proteína e gordura.',
          'Se proteína e gordura já ultrapassam o total de calorias, o carboidrato não vira número negativo — a calculadora trava em zero e avisa que a combinação é impossível.',
          'A soma dos macros arredondados sempre fecha com o total de calorias, sem sobrar aquela diferença de dezenas de kcal que aparece em muitas calculadoras.',
        ],
      },
      {
        title: 'O que a estimativa não sabe sobre a pessoa',
        body: 'Todas essas equações são regressões feitas em populações e devolvem a média de pessoas parecidas com quem foi medido. A variação individual é real: duas pessoas de mesmo sexo, peso, altura e idade podem ter gasto basal diferente em 200 kcal ou mais, por genética, massa magra, histórico de dieta e função tireoidiana. Por isso o número aqui é ponto de partida. O que dá a resposta de verdade é o acompanhamento ao longo de algumas semanas — peso, medidas, desempenho no treino e como a pessoa se sente — e esse acompanhamento, quando envolve dieta, é do nutricionista.',
      },
    ],
    faqs: [
      { q: 'Qual a fórmula mais precisa para calcular a TMB?', a: 'Para adultos sem dado de composição corporal, Mifflin-St Jeor é a mais validada e a escolha padrão. Quando existe um percentual de gordura confiável, Katch-McArdle tende a ser melhor, porque parte da massa magra — que é o tecido metabolicamente ativo.' },
      { q: 'Personal trainer pode prescrever dieta?', a: 'Não. A prescrição dietética é atribuição privativa do nutricionista pela Resolução CFN nº 600/2018. O personal pode calcular e explicar gasto energético como informação educativa, e deve encaminhar ao nutricionista quando o assunto for plano alimentar.' },
      { q: 'Qual fator de atividade escolher?', a: 'Ele reflete o dia inteiro, não só o treino. Quem treina uma hora e passa o resto do dia sentado está mais perto de 1,375 do que de 1,55. Na dúvida, escolha o menor: é mais fácil ajustar para cima depois do que descobrir semanas depois que o gasto foi superestimado.' },
      { q: 'Por que as três equações dão resultados diferentes?', a: 'Porque foram desenvolvidas com amostras diferentes, em épocas diferentes, e modelam o metabolismo a partir de variáveis diferentes — peso total em duas delas, massa magra na terceira. A divergência entre elas costuma ser menor que o erro de escolher o fator de atividade errado.' },
      { q: 'A calculadora serve para emagrecimento?', a: 'Ela estima o gasto, que é o ponto de partida de qualquer estratégia. Definir o déficit adequado, a distribuição de nutrientes e o acompanhamento é trabalho de nutricionista. Se o resultado calculado cai abaixo de 1.200 kcal para mulheres ou 1.500 para homens, a calculadora avisa — é território que exige acompanhamento profissional.' },
    ],
    related: ['calculadora-dobras', 'calculadora-volume', 'avaliacao-fisica', 'app-treino-alunos'],
  },

  precos: {
    path: '/precos',
    title: 'Preços do CoachPilot | Plano Grátis e Gestão Pro',
    description: 'Preços do CoachPilot: plano grátis para até 3 alunos, Gestão Pro por R$39,90/mês com alunos ilimitados e add-ons opcionais de WhatsApp e IA.',
    h1: 'Preços do CoachPilot',
    intro: 'O CoachPilot separa gestão, WhatsApp e IA para o personal começar grátis e pagar apenas quando precisar crescer. Sem fidelidade, sem multa e com pagamento via Pix.',
    bullets: ['Grátis: até 3 alunos, sem prazo e sem cartão', 'Gestão Pro: R$39,90/mês com alunos ilimitados', 'Conexão com ChatGPT, Claude ou Gemini incluída nos dois planos', 'Canal WhatsApp: +R$29,90/mês (opcional)', 'Assistente IA do aluno: +R$4,90/aluno/mês (opcional)'],
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
      { q: 'A conexão com ChatGPT, Claude ou Gemini custa a mais?', a: 'Não. A conexão MCP é gratuita nos dois planos, inclusive no grátis de até 3 alunos. O custo de IA é o da sua própria assinatura e não passa pelo CoachPilot.' },
    ],
    related: ['ia-personal-trainer', 'software-personal-trainer', 'whatsapp-personal', 'faq'],
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
      { title: 'Conexão com IA (MCP)', body: 'O CoachPilot publica um servidor MCP: você conecta o ChatGPT, o Claude ou o Gemini que já assina e passa a consultar alunos, anamneses, avaliações, sessões, evolução e agenda conversando — e a aplicar programas de treino, se autorizar a escrita. A conexão é gratuita nos dois planos, exige autorização explícita, alcança apenas os dados da sua conta e pode ser revogada em Configurações → Conexões.' },
    ],
    faqs: [
      { q: 'O CoachPilot é gratuito?', a: 'Sim. Existe plano gratuito para até 3 alunos, sem prazo.' },
      { q: 'Quanto custa o Gestão Pro?', a: 'R$39,90/mês no preço promocional de lançamento, com alunos ilimitados.' },
      { q: 'O aluno precisa instalar app?', a: 'Não. O app do aluno funciona como PWA pelo navegador, instalável na tela inicial.' },
      { q: 'Como a IA monta treinos?', a: 'Você conversa com o ChatGPT, Claude ou Gemini usando os prompts prontos do CoachPilot; a IA gera o pacote de treinos e você importa com um clique, revisando antes de aplicar. É grátis em todos os planos.' },
      { q: 'WhatsApp está incluso?', a: 'Não. O Canal WhatsApp é um add-on opcional de +R$29,90/mês.' },
      { q: 'A IA do aluno está inclusa?', a: 'Não. O Assistente IA do aluno é opcional e cobrado por aluno habilitado (+R$4,90/aluno/mês).' },
      { q: 'Posso migrar de outro software ou planilha?', a: 'Sim. A operação por IA lê planilhas, PDFs e até prints e gera os cadastros para importação com revisão — sem redigitar aluno por aluno.' },
      { q: 'O CoachPilot tem plugin do ChatGPT?', a: 'Plugins do ChatGPT foram descontinuados. O CoachPilot tem um servidor MCP, o padrão atual: a mesma conexão funciona no ChatGPT, no Claude e no Gemini.' },
      { q: 'Como conecto minha IA ao CoachPilot?', a: 'Em Configurações → Conexões você copia o endereço do servidor MCP e adiciona no seu assistente. A autorização é por OAuth, com escolha entre somente leitura ou leitura e escrita de treinos.' },
      { q: 'A IA conectada pode apagar meus dados?', a: 'Não. Não existe operação para excluir aluno, apagar histórico ou alterar plano, assinatura e cobranças. A escrita se limita a programas de treino, com auditoria, notificação e desfazer por 7 dias.' },
      { q: 'A conexão com IA é paga?', a: 'Não. É gratuita nos dois planos, inclusive no grátis de até 3 alunos. O custo de IA é o da sua assinatura de ChatGPT, Claude ou Gemini.' },
    ],
    related: ['chatgpt-personal-trainer', 'precos', 'app-treino-alunos', 'whatsapp-personal'],
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
      { title: 'Posicionamento', body: 'Gestão vem primeiro. IA e WhatsApp entram como aliados: a operação por IA é gratuita — tanto pelos prompts de importação quanto pela conexão MCP, que liga o ChatGPT, o Claude ou o Gemini do personal aos dados dele —, e o Canal WhatsApp com Assistente IA do aluno são add-ons opcionais.' },
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
    intro: 'Estes termos regulam o uso da plataforma CoachPilot (coachpilot.com.br) por personal trainers, studios e seus alunos. Ao criar uma conta, você concorda com as condições abaixo. Última atualização: 20 de agosto de 2026.',
    bullets: ['Plano grátis para até 3 alunos, sem prazo', 'Assinatura mensal sem fidelidade', 'Cancelamento a qualquer momento, sem multa', 'Dados dos alunos pertencem ao personal', 'Dado de saúde do aluno exige consentimento específico'],
    sections: [
      { title: '1. O serviço', body: 'O CoachPilot é uma plataforma de gestão para personal trainers que inclui cadastro de alunos, prescrição de treinos, avaliações físicas, agenda, app do aluno (PWA), gamificação, financeiro e recursos opcionais de comunicação via WhatsApp e assistente de IA. O serviço é fornecido "como está", com evolução contínua de funcionalidades. O CoachPilot é ferramenta de organização e registro: não presta serviços de educação física, medicina, fisioterapia ou nutrição, não emite diagnóstico, não interpreta exame e não substitui avaliação médica ou liberação para a prática de exercício.' },
      { title: '2. Conta e responsabilidades do usuário', body: 'A conta é pessoal e intransferível. O personal é responsável pela veracidade dos dados cadastrados, pela guarda das credenciais de acesso e pelo conteúdo que insere na plataforma (treinos, avaliações, orientações e materiais). A prescrição de exercícios é ato profissional do personal trainer, realizado sob sua responsabilidade técnica e registro profissional; o CoachPilot é ferramenta de organização e não presta serviços de educação física.' },
      { title: '3. Planos e pagamento', body: 'O plano gratuito permite gerenciar até 3 alunos, sem prazo determinado. O plano Gestão Pro é uma assinatura mensal pré-paga com alunos ilimitados, paga via Pix. Add-ons (Canal WhatsApp e Assistente IA do aluno) são cobrados separadamente. Os preços vigentes são os publicados em coachpilot.com.br/precos e podem ser atualizados com aviso prévio — reajustes não se aplicam retroativamente a períodos já pagos.' },
      { title: '4. Cancelamento', body: 'Não há fidelidade nem multa. O cancelamento pode ser feito a qualquer momento pelas configurações do portal; o acesso aos recursos pagos permanece até o fim do período já pago. Após o cancelamento, a conta retorna às condições do plano gratuito.' },
      { title: '5. Conteúdo e dados dos alunos', body: 'Os dados de alunos inseridos na plataforma pertencem ao personal, que atua como controlador dessas informações perante seus alunos. O CoachPilot atua como operador, armazenando e processando os dados exclusivamente para prestar o serviço, conforme a Política de Privacidade. O personal declara possuir autorização dos seus alunos para registrar os dados na plataforma e é responsável por informar a cada aluno quais dados são coletados e com qual finalidade.' },
      { title: '6. Dados de saúde dos alunos', body: 'As respostas da anamnese, as avaliações físicas, as fotos de evolução corporal e os relatos de dor ou desconforto são dados pessoais sensíveis de saúde (art. 5º, II, da LGPD). O personal configura livremente as perguntas da anamnese e, portanto, define o que é coletado: ao fazê-lo, compromete-se a pedir apenas o necessário à prescrição do treino e a obter do aluno consentimento específico e destacado para o tratamento desses dados, nos termos do art. 11 da LGPD, antes de registrá-los. É vedado usar a plataforma como prontuário médico ou para armazenar informação de saúde sem relação com o treinamento. O aluno pode revogar o consentimento junto ao personal a qualquer momento, hipótese em que o personal deve excluir pelo portal os dados de saúde correspondentes; o CoachPilot disponibiliza os recursos técnicos para essa exclusão e trata esses dados apenas sob as instruções do personal.' },
      { title: '7. Alunos menores de idade', body: 'Para alunos crianças ou adolescentes, o personal deve obter o consentimento específico de pelo menos um dos pais ou do responsável legal antes de cadastrar o aluno e, em especial, antes de registrar dados de saúde ou fotos, observando o art. 14 da LGPD e o melhor interesse do menor. O personal é responsável por manter comprovação desse consentimento e por limitar a coleta ao estritamente necessário.' },
      { title: '8. Uso aceitável', body: 'É vedado usar a plataforma para fins ilícitos, violar direitos de terceiros, tentar acessar dados de outras contas, revender o serviço sem autorização ou sobrecarregar deliberadamente a infraestrutura. Contas em violação podem ser suspensas mediante notificação.' },
      { title: '9. Loja de pacotes de treino', body: 'A Loja CoachPilot permite que personais publiquem e adquiram pacotes de treino. O conteúdo dos pacotes é de responsabilidade do autor. Pacotes licenciados têm uso individual e intransferível, vinculado à conta compradora. Pacotes não devem conter dado pessoal ou de saúde de aluno.' },
      { title: '10. Conexão com assistentes de IA externos', body: 'O personal pode conectar sua conta a assistentes de IA de terceiros (como ChatGPT, Claude ou Gemini) pelo servidor MCP do CoachPilot. A conexão é opcional, exige autorização explícita no portal, alcança apenas os dados da própria conta e pode ser revogada a qualquer momento em Configurações → Conexões. Ao conectar, o personal autoriza o envio ao provedor escolhido dos dados que consultar pelo assistente — incluindo dados de saúde de seus alunos, como anamnese, avaliações físicas e relatos de dor —, que passam a ser tratados também sob os termos daquele provedor, em servidores no exterior. Por envolver dado sensível, cabe ao personal, antes de consultar essas informações pelo assistente, certificar-se de que o consentimento obtido do aluno abrange essa transferência; o escopo de leitura da conexão já alcança anamnese e avaliações, de modo que quem não deseja essa transmissão não deve conectar um assistente externo. O CoachPilot registra em auditoria as alterações feitas por essa via, notifica o personal a cada escrita e permite desfazer alterações de treino por 7 dias; a prescrição resultante permanece sob a responsabilidade técnica do personal.' },
      { title: '11. Disponibilidade e suporte', body: 'O CoachPilot emprega esforços comerciais razoáveis para manter o serviço disponível, hospedado em infraestrutura de nuvem de mercado. Manutenções programadas e eventos de força maior podem gerar indisponibilidades temporárias. O suporte é prestado em português, pelo WhatsApp +55 13 98808-8204.' },
      { title: '12. Alterações destes termos', body: 'Estes termos podem ser atualizados para refletir mudanças no produto ou na legislação. Alterações relevantes serão comunicadas pelo portal ou por e-mail. O uso contínuo da plataforma após a comunicação constitui aceite da nova versão.' },
      { title: '13. Legislação e foro', body: 'Estes termos são regidos pela legislação brasileira, incluindo o Código de Defesa do Consumidor e a Lei Geral de Proteção de Dados (Lei 13.709/2018). Fica eleito o foro do domicílio do usuário para dirimir controvérsias.' },
    ],
    faqs: [],
    related: ['privacidade', 'precos', 'faq'],
  },
  privacidade: {
    path: '/privacidade',
    title: 'Política de Privacidade | CoachPilot',
    description: 'Política de privacidade do CoachPilot: quais dados coletamos, como usamos, com quem compartilhamos e seus direitos sob a LGPD.',
    h1: 'Política de Privacidade do CoachPilot',
    intro: 'Esta política explica como o CoachPilot coleta, usa, armazena e protege dados pessoais, incluindo os dados de saúde necessários à prescrição de treino, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018). Última atualização: 20 de agosto de 2026.',
    bullets: ['Dados usados apenas para prestar o serviço', 'Dado de saúde tratado como sensível, sob consentimento do aluno', 'Sem venda de dados e sem treinar modelos de IA com dado de aluno', 'Conexão com IA externa é opcional e revogável', 'Infraestrutura em nuvem com criptografia', 'Direitos LGPD atendidos via WhatsApp de suporte'],
    sections: [
      { title: '1. Dados que coletamos', body: 'Do personal (titular da conta): nome, e-mail, telefone e dados de autenticação, além dos dados de uso da plataforma. Dos alunos: nome, contato, data de nascimento, endereço, objetivos, observações, dados de treino e histórico de execução das sessões, avaliações físicas, fotos de evolução e registros de atividade. Esses dados podem ser inseridos pelo personal ou pelo próprio aluno, que preenche a anamnese no cadastro e registra treinos, fotos, vídeos e relatos pelo app do aluno. De pagamento: as cobranças via Pix são processadas pelo Mercado Pago; o CoachPilot não armazena dados bancários completos. Parte dessas informações é dado pessoal sensível de saúde e recebe o tratamento descrito na seção 2.' },
      { title: '2. Dados de saúde dos alunos (dados sensíveis)', body: 'Prescrever treino depende de informação de saúde, e a plataforma trata esses dados como dado pessoal sensível, nos termos do art. 5º, II, da LGPD: (a) as respostas da anamnese, questionário que cada personal configura livremente e que costuma abranger histórico de saúde, lesões, cirurgias, medicamentos, restrições médicas e nível de atividade; (b) as avaliações físicas, incluindo peso, altura, percentual de gordura, medidas corporais, métricas customizadas, observações e o anexo de exame de bioimpedância; (c) as fotos de evolução corporal; (d) os relatos de dor ou desconforto que o aluno publica no feed, com foto ou vídeo. Esses dados são usados exclusivamente para que o personal responsável possa prescrever e acompanhar o treino daquele aluno. Não são usados para publicidade, não são vendidos nem cedidos a terceiros, não são compartilhados com outros personais e não são usados para treinar modelos de inteligência artificial. O acesso é limitado ao próprio aluno e à conta do personal que o cadastrou, por isolamento lógico dos dados por conta. A única hipótese em que essas informações saem da plataforma por ação do usuário é a conexão com assistente de IA externo, descrita na seção 9.' },
      { title: '3. Papéis sob a LGPD', body: 'Para os dados da conta do personal, o CoachPilot é controlador. Para os dados dos alunos cadastrados pelo personal, o personal é o controlador e o CoachPilot atua como operador, tratando os dados exclusivamente conforme as finalidades do serviço e as instruções do controlador. Isso vale também para os dados de saúde: cabe ao personal definir quais informações coletar, obter a base legal perante o aluno e atender às solicitações do titular, com suporte técnico do CoachPilot.' },
      { title: '4. Bases legais do tratamento', body: 'Para os dados da conta do personal, o tratamento se apoia na execução do contrato (art. 7º, V), no cumprimento de obrigação legal ou regulatória (art. 7º, II) e no legítimo interesse para segurança e melhoria do serviço (art. 7º, IX). Para os dados de saúde dos alunos, a base legal aplicável é o consentimento específico e destacado do titular (art. 11, I), que deve ser obtido pelo personal antes de registrar a informação, com a finalidade informada de forma clara. O CoachPilot, como operador, trata esses dados apenas para executar o serviço contratado pelo personal e sob as instruções dele. O consentimento pode ser revogado a qualquer momento junto ao personal, o que implica a exclusão dos dados de saúde correspondentes.' },
      { title: '5. Para que usamos os dados', body: 'Prestar e melhorar o serviço (gestão de alunos, treinos, avaliações, agenda, notificações), processar pagamentos, prestar suporte, enviar comunicações operacionais e, quando habilitados, operar os add-ons de WhatsApp e assistente de IA. Não vendemos dados pessoais a terceiros e não usamos dados de alunos para treinar modelos de inteligência artificial, próprios ou de terceiros.' },
      { title: '6. Alunos menores de idade', body: 'A plataforma pode ser usada para acompanhar crianças e adolescentes, situação em que o tratamento observa o art. 14 da LGPD e o melhor interesse do titular. Nesse caso, cabe ao personal obter o consentimento específico de pelo menos um dos pais ou do responsável legal antes de registrar dados do menor, em especial dados de saúde e fotos, e coletar apenas o necessário à prescrição. O CoachPilot não direciona publicidade a menores e não exige do aluno, no app, dados além dos necessários ao acompanhamento do treino.' },
      { title: '7. Compartilhamento com operadores', body: 'Utilizamos provedores estritamente necessários à operação: infraestrutura de nuvem Amazon Web Services (hospedagem, banco de dados e armazenamento de arquivos, com criptografia em repouso e em trânsito), Mercado Pago (processamento de pagamentos Pix) e, quando o add-on está ativo, provedor de conexão WhatsApp para envio e recebimento de mensagens. Cada provedor trata os dados sob contrato e apenas para a finalidade contratada. A infraestrutura AWS utilizada fica na região us-east-1, nos Estados Unidos, de modo que o armazenamento dos dados, inclusive os de saúde, configura transferência internacional nos termos dos arts. 33 e seguintes da LGPD, amparada nas cláusulas contratuais e nas garantias de proteção oferecidas pelo provedor. Se o personal conectar um assistente de IA externo, aplica-se adicionalmente o disposto na seção 9.' },
      { title: '8. Assistente de IA do aluno (add-on)', body: 'Quando o personal habilita o add-on Assistente IA para um aluno, as mensagens desse aluno são processadas por modelo de linguagem para gerar respostas com contexto do treino, o que pode incluir informação de saúde que o próprio aluno mencione na conversa. Os registros gerados ficam vinculados ao aluno na plataforma. O recurso é opcional, depende de habilitação individual e pode ser desabilitado por aluno a qualquer momento.' },
      { title: '9. Conexão com assistentes de IA externos', body: 'O personal pode conectar sua conta a assistentes de IA de terceiros (ChatGPT/OpenAI, Claude/Anthropic, Gemini/Google) pelo servidor MCP do CoachPilot. A conexão é opcional, exige autorização explícita por OAuth no portal e dá acesso apenas aos dados da conta daquele personal — nunca aos de outras contas. Com a conexão ativa, os dados que o personal consultar pelo assistente são transmitidos ao provedor escolhido para gerar a resposta, o que inclui dados pessoais sensíveis de saúde dos alunos (anamnese, avaliações físicas e relatos de dor) quando o personal os solicita. Esses provedores estão sediados fora do Brasil, o que caracteriza transferência internacional de dados nos termos dos arts. 33 e seguintes da LGPD, e o tratamento passa a se reger também pela política daquele provedor. No momento da autorização o personal escolhe conceder apenas leitura ou também escrita de treinos, e pode revogar a conexão a qualquer momento em Configurações → Conexões, com efeito imediato. Note que o escopo de leitura já abrange anamnese e avaliações: por isso, antes de consultar dados de saúde por um assistente externo, o personal deve verificar se o consentimento obtido do aluno cobre essa transferência, e quem não deseja essa transmissão simplesmente não deve conectar. Não há envio por iniciativa do CoachPilot: a transmissão só ocorre quando o personal faz uma consulta no assistente com a conexão ativa. Toda escrita por essa via é registrada em auditoria e notificada ao personal.' },
      { title: '10. Cookies e analytics', body: 'O site usa armazenamento local para preferências (como tema claro/escuro) e sessão de login. Podemos utilizar ferramentas de métricas de audiência nas páginas públicas para entender o uso do site; essas métricas não são cruzadas com os dados de alunos da plataforma.' },
      { title: '11. Retenção e exclusão', body: 'Os dados são mantidos enquanto a conta estiver ativa. Ao excluir um aluno ou encerrar a conta, os dados correspondentes — inclusive anamnese, avaliações, fotos de evolução e relatos de dor — são removidos dos sistemas ativos em prazo razoável, ressalvadas obrigações legais de guarda (como registros fiscais de pagamento). Itens temporários, como sessões de login e tokens de conexão, expiram automaticamente. Cópias de segurança seguem o ciclo de retenção da infraestrutura e são descartadas ao fim dele.' },
      { title: '12. Seus direitos', body: 'Titulares podem solicitar confirmação de tratamento, acesso, correção, portabilidade, anonimização ou exclusão de seus dados, além da revogação do consentimento e da informação sobre com quem os dados foram compartilhados, nos termos do art. 18 da LGPD. Alunos devem direcionar solicitações primeiro ao seu personal (controlador); o CoachPilot dará suporte técnico ao atendimento e, se o personal não responder, pode ser acionado diretamente. Canal para exercício de direitos: WhatsApp +55 13 98808-8204.' },
      { title: '13. Segurança', body: 'Adotamos controles de acesso por autenticação, criptografia em trânsito (HTTPS) e em repouso, isolamento de dados por conta e princípio de menor privilégio na infraestrutura. Fotos de evolução, vídeos e anexos de exame ficam em armazenamento privado e são servidos apenas por links temporários gerados para a sessão autenticada, sem URL pública permanente. Nenhum sistema é imune a incidentes; em caso de incidente de segurança relevante, os afetados e as autoridades serão comunicados conforme a LGPD.' },
      { title: '14. Alterações desta política', body: 'Esta política pode ser atualizada para refletir mudanças no produto ou na legislação. A versão vigente estará sempre publicada em coachpilot.com.br/privacidade, com a data de atualização no topo.' },
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
