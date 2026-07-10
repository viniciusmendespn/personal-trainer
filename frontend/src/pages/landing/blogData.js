// Artigos do blog (coachpilot.com.br/blog).
// Fonte única consumida pelo React (BlogPages.tsx) E pelo prerender em build-time
// (scripts/prerender-public-pages.mjs) — .js puro, sem imports.
// Parágrafos aceitam links inline no formato [texto](/caminho) — renderizados
// como <Link>/<a> no React e como <a> no HTML prerenderizado.
// Dados de concorrentes: verificados em julho/2026 (estrategia/ANALISE_MERCADO_CONCORRENTES.md).

export const BLOG_POSTS = [
  {
    slug: 'melhores-aplicativos-para-personal-trainer',
    title: 'Os 7 melhores aplicativos para personal trainer em 2026',
    description: 'Comparamos os principais apps para personal trainer do Brasil em 2026: MFIT, CoachPilot, Tecnofit, Nexur e mais — preços, IA, WhatsApp e gamificação.',
    h1: 'Os 7 melhores aplicativos para personal trainer em 2026',
    datePublished: '2026-07-10',
    dateModified: '2026-07-10',
    readingMinutes: 9,
    intro: 'Escolher um aplicativo para personal trainer virou uma decisão de negócio: o app certo economiza horas de montagem de treino, reduz faltas e ajuda a reter alunos. Comparamos as principais opções disponíveis no Brasil em 2026 — com preços e recursos verificados em julho de 2026 nos sites oficiais (valores sujeitos a alteração).',
    sections: [
      {
        h2: 'O que avaliar antes de escolher',
        paragraphs: [
          'Antes da lista, vale alinhar os critérios. Um bom app para personal trainer precisa resolver cinco frentes: prescrição de treinos (com templates e progressão), experiência do aluno (app próprio, de preferência sem fricção de instalação), avaliações físicas com evolução visível, agenda com lembretes e controle financeiro. Recursos de IA e comunicação por WhatsApp deixaram de ser luxo e passaram a diferenciar as plataformas em 2026.',
          'Outro ponto decisivo é o modelo de cobrança: algumas plataformas cobram por faixa de alunos (o custo sobe conforme você cresce), outras cobram valor fixo com alunos ilimitados. Para quem está escalando a carteira, essa diferença muda a conta no fim do ano.',
        ],
      },
      {
        h2: '1. CoachPilot — gestão com IA e WhatsApp integrados',
        paragraphs: [
          'O [CoachPilot](/software-para-personal-trainer) é uma plataforma brasileira com plano grátis para até 3 alunos e Gestão Pro por R$39,90/mês com alunos ilimitados. O diferencial é a operação por IA: você monta pacotes de treino ABC/ABCDE e migra a carteira inteira de alunos conversando com o ChatGPT, Claude ou Gemini que já usa — a IA gera o conteúdo no formato da plataforma e você importa com um clique, revisando antes de aplicar. Esse recurso é gratuito em todos os planos.',
          'Também se destaca na experiência do aluno: app via PWA (sem loja de aplicativos), gamificação completa com ranking, conquistas e streaks, e um assistente de IA opcional que responde o aluno no WhatsApp com contexto do treino real — o aluno manda "fiz 3x10 com 80kg" e o registro entra no treino dele. O financeiro recebe via Pix direto na conta do personal, sem taxa da plataforma.',
          'Pontos a considerar: é uma plataforma mais nova, sem a base de avaliações dos líderes de mercado, e o app do aluno é PWA em vez de app nativo nas lojas.',
        ],
      },
      {
        h2: '2. MFIT Personal — o líder de mercado',
        paragraphs: [
          'O MFIT é o app mais usado do Brasil, com mais de 1 milhão de downloads e nota 4,9 nas lojas. Tem biblioteca com mais de 1.800 vídeos de exercícios, avaliação física, agenda e a Carteira MFIT para receber dos alunos (taxa de 2,59% por transação). O plano com alunos ilimitados custa R$39,90/mês, com um degrau de R$10,90/mês para até 3 alunos.',
          'A "MFIT IA" gera treinos dentro do app, um por vez. Não há gamificação para os alunos nem integração com WhatsApp além do compartilhamento de link. Para quem valoriza marca consolidada, app nativo e biblioteca de vídeos gigante, é a referência do mercado.',
        ],
      },
      {
        h2: '3. Tecnofit Personal — da gigante das academias',
        paragraphs: [
          'A Tecnofit é forte no software de gestão de academias, e o produto para personal é uma extensão dessa operação. Oferece plano grátis para até 5 alunos (o maior free tier da lista) e o plano Performance a partir de R$24,90/mês no ciclo anual, cobrado via compra no aplicativo (Apple/Google). Tem marketplace "Encontre seu personal" e ranking mensal de alunos.',
          'O produto Personal não tem recursos de IA nem integração com WhatsApp, e o financeiro registra e lembra cobranças, mas não processa recebimentos. É uma opção sólida para quem quer começar grátis com mais alunos.',
        ],
      },
      {
        h2: '4. Nexur — preço por faixa de alunos',
        paragraphs: [
          'O Nexur cobra por faixa: R$19,90/mês para até 9 alunos, R$49,90 para 25, R$79,90 para 50, chegando a R$249,90 para 250 alunos. Tem biblioteca de exercícios e app para o aluno; publicar um app próprio com a sua marca custa a partir de R$789/ano. Não tem recursos de IA.',
          'O modelo por faixa funciona bem para quem tem poucos alunos e quer o menor preço de entrada — mas o custo cresce junto com a carteira, o que merece atenção de quem planeja escalar.',
        ],
      },
      {
        h2: '5. TreinoAI — prescrição com IA nativa',
        paragraphs: [
          'O TreinoAI aposta na geração de treinos por IA dentro da própria plataforma, com planos a partir de R$24,90/mês para 5 alunos e R$69,90/mês para 15. É uma boa porta de entrada para quem quer testar prescrição assistida por IA, com a ressalva de que o preço também escala por número de alunos.',
        ],
      },
      {
        h2: '6. Mobitrainer e Wiki4Fit — alternativas nacionais',
        paragraphs: [
          'O Mobitrainer (a partir de R$29,90/mês para 10 alunos) foca em gestão de alunos e treinos em ambientes variados — parques, condomínios, studios. O Wiki4Fit (a partir de R$29/mês) oferece treinos, vídeos, agenda, avaliação e planos de pagamento online. Ambos são opções funcionais de gestão, sem os recursos de IA das plataformas mais recentes.',
        ],
      },
      {
        h2: '7. Internacionais: Trainerize, TrueCoach, Everfit e Hevy Coach',
        paragraphs: [
          'As plataformas internacionais são maduras e poderosas — ABC Trainerize e Everfit têm geradores de treino por IA — mas custam em dólar (de US$25 a mais de US$130 por mês, algo entre R$130 e R$714) e não têm painel em português, Pix nem WhatsApp. O Hevy Coach (US$25/mês) tem o app do aluno em português, mas o painel do coach é em inglês e não cobre gestão completa (sem agenda, cobrança ou avaliação física). Para o personal que atende alunos brasileiros, a barreira de idioma e pagamento costuma pesar mais que os recursos extras.',
        ],
      },
      {
        h2: 'Tabela comparativa (julho/2026)',
        paragraphs: [
          'Resumo dos principais critérios. Preços verificados nos sites oficiais em julho de 2026 e sujeitos a alteração.',
        ],
        table: {
          headers: ['Plataforma', 'Alunos ilimitados', 'IA gera treino', 'IA no WhatsApp', 'Gamificação', 'Free tier'],
          rows: [
            ['CoachPilot', 'R$39,90/mês', 'Sim (grátis)', 'Sim (add-on)', 'Ranking + conquistas + streak', '3 alunos'],
            ['MFIT', 'R$39,90/mês', 'Sim (in-app)', 'Não', 'Não', '1 aluno'],
            ['Tecnofit Personal', '~R$24,90/mês (anual)', 'Não', 'Não', 'Ranking', '5 alunos'],
            ['Nexur', 'Não (até R$249,90)', 'Não', 'Não', 'Ranking', 'Não'],
            ['TreinoAI', 'Não (por faixa)', 'Sim', 'Não', 'Não', 'Não'],
            ['Internacionais', 'US$25–137/mês', 'Sim (2 de 4)', 'Não', 'Parcial', 'Varia'],
          ],
        },
      },
      {
        h2: 'Qual escolher?',
        paragraphs: [
          'Se você quer a marca mais estabelecida e biblioteca de vídeos, o MFIT é a escolha segura. Se quer o maior plano grátis para começar, a Tecnofit atende. Se a prioridade é operar com IA de ponta a ponta — montar treinos conversando com o ChatGPT, migrar a carteira sem redigitar e ter um assistente respondendo alunos no WhatsApp — com preço fixo que não sobe conforme você cresce, vale [testar o CoachPilot grátis](/precos) com até 3 alunos, sem cartão.',
        ],
      },
    ],
    faqs: [
      { q: 'Qual o melhor app gratuito para personal trainer?', a: 'A Tecnofit tem o maior free tier (5 alunos). O CoachPilot oferece 3 alunos grátis sem prazo e com todos os recursos essenciais, incluindo a operação por IA. O MFIT oferece 1 aluno grátis.' },
      { q: 'Existe app para personal trainer com IA?', a: 'Sim. CoachPilot, MFIT e TreinoAI têm recursos de IA. O CoachPilot é o único em que a IA também migra a carteira inteira de alunos e responde alunos no WhatsApp com contexto do treino.' },
      { q: 'Quanto custa um app para personal trainer?', a: 'Em 2026, os planos nacionais vão de R$10,90 a R$249,90/mês, dependendo do número de alunos. Plataformas com alunos ilimitados custam em torno de R$39,90/mês.' },
    ],
    related: [
      { label: 'CoachPilot vs MFIT: comparativo completo', to: '/blog/coachpilot-vs-mfit' },
      { label: 'Software para personal trainer', to: '/software-para-personal-trainer' },
      { label: 'Preços do CoachPilot', to: '/precos' },
    ],
  },
  {
    slug: 'coachpilot-vs-mfit',
    title: 'CoachPilot vs MFIT: qual sistema para personal trainer escolher em 2026?',
    description: 'Comparativo honesto entre CoachPilot e MFIT Personal: preços, IA, WhatsApp, gamificação, taxas de pagamento e migração. Dados de julho/2026.',
    h1: 'CoachPilot vs MFIT: qual escolher?',
    datePublished: '2026-07-10',
    dateModified: '2026-07-10',
    readingMinutes: 7,
    intro: 'MFIT é o líder do mercado brasileiro de apps para personal trainer; o CoachPilot é a alternativa que aposta em IA de ponta a ponta e WhatsApp. Os dois custam os mesmos R$39,90/mês no plano com alunos ilimitados — então a escolha se decide nos detalhes. Comparamos os dois com dados verificados em julho de 2026 (sujeitos a alteração).',
    sections: [
      {
        h2: 'Onde o MFIT é mais forte',
        paragraphs: [
          'O MFIT é líder por mérito: mais de 1 milhão de downloads, nota 4,9 com mais de 146 mil avaliações e uma base declarada de 200 mil personais. Isso se traduz em maturidade de produto e prova social. O app do aluno é nativo, disponível na App Store e no Google Play, e a biblioteca passa de 1.800 vídeos de exercícios prontos.',
          'A MFIT IA gera treinos dentro do app, e a Carteira MFIT permite receber dos alunos dentro da plataforma, com taxa de 2,59% por transação. Para quem quer o caminho mais testado do mercado, o MFIT é a escolha conservadora.',
        ],
      },
      {
        h2: 'Onde o CoachPilot é mais forte',
        paragraphs: [
          'O CoachPilot aposta em três frentes que o MFIT não cobre hoje. A primeira é a profundidade da IA: em vez de gerar um treino por vez dentro do app, a [operação por IA do CoachPilot](/software-para-personal-trainer) monta pacotes completos ABC/ABCDE e migra a carteira inteira de alunos a partir de planilha, PDF ou print — você conversa com o ChatGPT que já usa, a IA gera tudo no formato da plataforma e você importa com um clique, revisando antes. Esse recurso é gratuito.',
          'A segunda é o WhatsApp: além de lembretes de sessão, o assistente de IA opcional responde o aluno no WhatsApp com contexto do treino real — registra cargas relatadas por mensagem e prioriza alertas de dor para o personal. A terceira é a [gamificação completa para os alunos](/app-de-treino-para-alunos): ranking, conquistas e streaks de treino, que o MFIT não oferece.',
          'No financeiro, o Pix dos alunos cai direto na conta do personal, sem taxa da plataforma — na Carteira MFIT, a taxa é de 2,59% por transação. Para quem movimenta alguns milhares de reais por mês em mensalidades, vale fazer essa conta no ano.',
        ],
      },
      {
        h2: 'Comparativo lado a lado (julho/2026)',
        paragraphs: ['Preços e recursos verificados nos canais oficiais em julho de 2026.'],
        table: {
          headers: ['Critério', 'CoachPilot', 'MFIT Personal'],
          rows: [
            ['Plano ilimitado', 'R$39,90/mês', 'R$39,90/mês'],
            ['Plano grátis', '3 alunos, sem prazo', '1 aluno'],
            ['App do aluno', 'PWA (sem loja)', 'Nativo (lojas)'],
            ['IA', 'Monta pacotes + migra carteira (grátis)', 'Gera treino in-app'],
            ['WhatsApp', 'Lembretes + assistente IA (add-ons)', 'Compartilhar link'],
            ['Gamificação', 'Ranking, conquistas, streak', 'Não tem'],
            ['Recebimento', 'Pix direto, sem taxa', 'Carteira com taxa 2,59%'],
            ['Loja de treinos', 'Marketplace de pacotes', 'Não tem'],
            ['Biblioteca de vídeos', 'Vídeos por exercício', '1.800+ vídeos'],
          ],
        },
      },
      {
        h2: 'Como decidir',
        paragraphs: [
          'Escolha o MFIT se prova social, app nativo nas lojas e biblioteca de vídeos gigante são decisivos para você. Escolha o CoachPilot se a sua prioridade é operar com IA (montagem e migração sem digitação), engajar alunos com gamificação e usar o WhatsApp como canal inteligente — pagando o mesmo valor mensal e sem taxa sobre os seus recebimentos.',
          'Migrar não exige recomeçar do zero: a IA do CoachPilot importa a sua carteira a partir da exportação ou planilha que você já tem. Dá para [começar grátis com até 3 alunos](/precos) e testar o fluxo completo antes de decidir.',
        ],
      },
    ],
    faqs: [
      { q: 'CoachPilot e MFIT custam o mesmo?', a: 'No plano com alunos ilimitados, sim: R$39,90/mês em ambos (julho/2026). O MFIT tem um degrau de R$10,90/mês para até 3 alunos; no CoachPilot, até 3 alunos é grátis.' },
      { q: 'Consigo migrar do MFIT para o CoachPilot?', a: 'Sim. A operação por IA do CoachPilot converte planilhas, PDFs e exportações em cadastros e treinos importáveis com revisão — sem redigitar aluno por aluno.' },
      { q: 'O CoachPilot tem app na App Store ou Google Play?', a: 'Não. O app do aluno e o portal são PWA: abrem pelo navegador e podem ser instalados na tela inicial, sem loja de aplicativos.' },
    ],
    related: [
      { label: 'Os 7 melhores apps para personal trainer', to: '/blog/melhores-aplicativos-para-personal-trainer' },
      { label: 'Preços do CoachPilot', to: '/precos' },
      { label: 'WhatsApp para personal trainer', to: '/whatsapp-para-personal-trainer' },
    ],
  },
  {
    slug: 'gestao-de-alunos-guia-completo',
    title: 'Gestão de alunos para personal trainer: o guia completo (2026)',
    description: 'Como organizar cadastro, treinos, avaliações, agenda e cobrança dos seus alunos — os 6 pilares da gestão para personal trainer e os erros mais comuns.',
    h1: 'Gestão de alunos para personal trainer: o guia completo',
    datePublished: '2026-07-10',
    dateModified: '2026-07-10',
    readingMinutes: 8,
    intro: 'A diferença entre um personal com agenda cheia e um personal com negócio saudável costuma estar na gestão: quem controla histórico, renovações e evolução dos alunos retém mais e cobra melhor. Este guia organiza a gestão de alunos em 6 pilares práticos — e mostra onde planilha resolve e onde ela quebra.',
    sections: [
      {
        h2: 'Pilar 1 — Cadastro e histórico centralizados',
        paragraphs: [
          'Tudo começa com uma ficha confiável por aluno: dados de contato, anamnese, restrições e lesões, objetivos e histórico de treinos. O erro clássico é espalhar isso entre WhatsApp, caderno e memória — quando o aluno pergunta "qual era minha carga há dois meses?", a resposta precisa estar a um clique.',
          'Regra de ouro: nenhuma informação do aluno pode ficar solta. Cada foto, medida, treino e conversa relevante deve estar vinculada ao cadastro do aluno, não perdida numa galeria ou numa conversa antiga.',
        ],
      },
      {
        h2: 'Pilar 2 — Treinos com progressão registrada',
        paragraphs: [
          'Prescrever é o coração do trabalho, mas a gestão do treino vai além da montagem: registrar cargas realizadas, controlar a validade do programa e reaproveitar estruturas (splits ABC/ABCDE) sem perder a personalização. Templates reutilizáveis economizam as horas de domingo que muitos personais gastam montando treino.',
          'Em 2026, a montagem assistida por IA virou realidade: dá para [montar pacotes de treino conversando com o ChatGPT](/blog/como-montar-treino-com-ia-chatgpt) e importar na plataforma com revisão — a decisão técnica continua sua, a digitação não.',
        ],
      },
      {
        h2: 'Pilar 3 — Avaliações físicas que provam resultado',
        paragraphs: [
          'A avaliação física é a sua principal ferramenta de retenção: aluno que vê progresso renova. Padronize a periodicidade (a cada 8–12 semanas), registre medidas e fotos comparativas no mesmo lugar e apresente a evolução em gráficos na conversa de renovação. [Avaliação física digital](/avaliacao-fisica-digital) com histórico organizado transforma renovação de "convencimento" em constatação.',
        ],
      },
      {
        h2: 'Pilar 4 — Agenda e presença',
        paragraphs: [
          'Faltas e confusões de horário custam dinheiro direto. Uma [agenda integrada à gestão](/agenda-para-personal-trainer) — com lembretes automáticos e visão do dia — reduz no-show e libera espaço mental. O dado importante: a sessão deve ficar ligada ao aluno, alimentando o histórico de frequência que você usa nas conversas de renovação.',
        ],
      },
      {
        h2: 'Pilar 5 — Financeiro sem constrangimento',
        paragraphs: [
          'Cobrar manualmente é desconfortável e falho: planos vencem e passam despercebidos. O ideal é ter vencimentos visíveis, cobrança recorrente e pagamento fácil para o aluno (Pix). Atenção às taxas: algumas plataformas cobram percentual sobre cada recebimento — em uma carteira de 30 alunos, isso vira um valor relevante no ano.',
        ],
      },
      {
        h2: 'Pilar 6 — Comunicação e engajamento',
        paragraphs: [
          'O acompanhamento entre sessões é o que diferencia consultoria de "entrega de ficha". Estruture check-ins, responda dúvidas com contexto e use mecanismos de engajamento — ranking, conquistas e streaks fazem o aluno treinar por consistência, não só por obrigação. O [app do aluno](/app-de-treino-para-alunos) é a base disso: se o aluno tem onde ver o treino do dia e a própria evolução, ele se mantém no jogo.',
        ],
      },
      {
        h2: 'Planilha ou plataforma?',
        paragraphs: [
          'Com até 5 alunos e rotina simples, uma boa planilha resolve. A partir daí, os custos invisíveis aparecem: versões duplicadas, fotos perdidas, treinos vencidos sem aviso, cobranças esquecidas. Detalhamos essa conta no comparativo [planilha de treino vs sistema de gestão](/blog/planilha-de-treino-ou-sistema-de-gestao).',
          'Se decidir migrar, não precisa redigitar: a operação por IA do [CoachPilot](/gestao-de-alunos-personal-trainer) lê a sua planilha e gera os cadastros e treinos para importação com revisão. O plano grátis atende até 3 alunos, sem cartão.',
        ],
      },
    ],
    faqs: [
      { q: 'Como organizar a gestão de alunos de personal trainer?', a: 'Centralize seis frentes: cadastro/histórico, treinos com progressão, avaliações físicas periódicas, agenda com lembretes, financeiro com vencimentos visíveis e comunicação estruturada com o aluno.' },
      { q: 'Quantos alunos dá para gerenciar com planilha?', a: 'Em geral até 5 alunos. Acima disso, o retrabalho e as falhas (treinos vencidos, cobranças esquecidas, fotos perdidas) passam a custar mais que uma plataforma.' },
      { q: 'O que é mais importante para reter alunos?', a: 'Evolução visível. Aluno que enxerga o próprio progresso em gráficos e conquistas renova com muito menos resistência.' },
    ],
    related: [
      { label: 'Gestão de alunos no CoachPilot', to: '/gestao-de-alunos-personal-trainer' },
      { label: 'Planilha vs sistema de gestão', to: '/blog/planilha-de-treino-ou-sistema-de-gestao' },
      { label: 'Avaliação física digital', to: '/avaliacao-fisica-digital' },
    ],
  },
  {
    slug: 'como-montar-treino-com-ia-chatgpt',
    title: 'Como montar treino com IA (ChatGPT) na prática — guia para personal trainers',
    description: 'Passo a passo para personal trainer usar ChatGPT, Claude ou Gemini para montar treinos ABC/ABCDE e migrar alunos de planilha — mantendo a responsabilidade técnica.',
    h1: 'Como montar treino com IA (ChatGPT) na prática',
    datePublished: '2026-07-10',
    dateModified: '2026-07-10',
    readingMinutes: 7,
    intro: 'Montar treino com IA deixou de ser experimento: em 2026, personal trainers usam ChatGPT, Claude e Gemini para transformar horas de digitação em minutos de revisão. Este guia mostra o fluxo na prática, os cuidados técnicos — e por que a IA deve trabalhar para o personal, nunca substituí-lo.',
    sections: [
      {
        h2: 'O que a IA faz bem (e o que não faz)',
        paragraphs: [
          'A IA é excelente em estruturar e digitar: transformar as suas decisões de prescrição em um pacote ABC/ABCDE formatado, com séries, repetições, cargas iniciais e intervalos. Ela também lê material desorganizado — planilhas, PDFs, até prints — e converte em dados estruturados.',
          'O que a IA genérica não faz é conhecer o SEU aluno: lesões, histórico real de cargas, resposta a estímulos, contexto de vida. Treino genérico de IA é o equivalente digital da ficha de academia de shopping. A prescrição é ato profissional do personal, com seu CREF — a IA entra como assistente de produção, não como prescritor.',
        ],
      },
      {
        h2: 'Passo 1 — Dê contexto real à IA',
        paragraphs: [
          'A qualidade do resultado depende do briefing. Informe: objetivo do aluno, nível, frequência semanal, restrições e lesões, equipamentos disponíveis e as suas diretrizes de prescrição (método, faixas de repetição, progressão). Quanto mais específico o contexto, menos genérico o resultado.',
        ],
      },
      {
        h2: 'Passo 2 — Peça estrutura, não inspiração',
        paragraphs: [
          'Em vez de "monte um treino de hipertrofia", peça o formato final: "monte um split ABC para 3x/semana, com 6–8 exercícios por dia, séries, repetições, intervalo e observações de execução, seguindo as diretrizes que passei". Você decide o método; a IA produz o documento.',
        ],
      },
      {
        h2: 'Passo 3 — Importe sem redigitar',
        paragraphs: [
          'O gargalo clássico era passar o resultado da IA para o sistema, exercício por exercício. No [CoachPilot](/software-para-personal-trainer), esse passo desaparece: a plataforma fornece prompts prontos que fazem o ChatGPT (ou Claude, ou Gemini) gerar o pacote de treino já no formato de importação. Você cola o arquivo, revisa cada item na tela de conferência e aplica com um clique. O mesmo fluxo funciona para migrar a carteira inteira: a IA lê a sua planilha de alunos e gera todos os cadastros e treinos de uma vez.',
          'Importante: a importação é sempre assistida — nada entra no sistema sem a sua revisão. A IA acelera a produção; a validação técnica continua sendo sua.',
        ],
      },
      {
        h2: 'Passo 4 — Feche o ciclo com dados',
        paragraphs: [
          'Treino montado é metade do trabalho; o ciclo fecha com registro e ajuste. Com o treino na plataforma, o aluno registra cargas no app e você ajusta a progressão com dados reais em vez de memória. No CoachPilot, o assistente de IA opcional leva isso ao WhatsApp: o aluno manda "fiz 3x10 com 80kg" e o registro entra no treino dele automaticamente — e um relato de dor gera alerta priorizado para você.',
        ],
      },
      {
        h2: 'Custo: quanto isso adiciona à mensalidade?',
        paragraphs: [
          'Nada, no caso da montagem: a operação por IA do CoachPilot usa a conta de ChatGPT/Claude/Gemini que você já tem (inclusive as versões gratuitas) e o recurso de importação é incluído em todos os planos, inclusive no grátis de até 3 alunos. Só o assistente do aluno no WhatsApp é add-on pago (+R$4,90/aluno/mês).',
        ],
      },
    ],
    faqs: [
      { q: 'Personal trainer pode usar ChatGPT para montar treino?', a: 'Sim, como ferramenta de produção sob sua responsabilidade técnica. A prescrição continua sendo ato do profissional com CREF; a IA estrutura e digita o que você decidir.' },
      { q: 'A IA do CoachPilot escreve direto no sistema?', a: 'Não. A IA gera o pacote e você importa com um clique, revisando tudo numa tela de conferência antes de aplicar. Nada entra sem a sua validação.' },
      { q: 'Preciso pagar ChatGPT Plus para usar?', a: 'Não necessariamente. Os prompts do CoachPilot funcionam nas versões gratuitas de ChatGPT, Claude e Gemini.' },
    ],
    related: [
      { label: 'Software para personal trainer', to: '/software-para-personal-trainer' },
      { label: 'WhatsApp para personal trainer', to: '/whatsapp-para-personal-trainer' },
      { label: 'Guia de gestão de alunos', to: '/blog/gestao-de-alunos-guia-completo' },
    ],
  },
  {
    slug: 'como-conseguir-mais-alunos-personal-trainer',
    title: 'Como conseguir mais alunos como personal trainer: 8 estratégias que funcionam',
    description: 'Estratégias práticas para personal trainer conseguir mais alunos em 2026: indicação estruturada, Instagram com prova de resultado, retenção e experiência profissional.',
    h1: 'Como conseguir mais alunos como personal trainer',
    datePublished: '2026-07-10',
    dateModified: '2026-07-10',
    readingMinutes: 8,
    intro: 'Conseguir alunos é o desafio nº 1 de quem vive de personal training — e a maioria dos conselhos por aí ignora o básico: aluno novo custa caro, aluno retido é lucro. Estas 8 estratégias combinam captação e retenção, na ordem em que dão retorno mais rápido.',
    sections: [
      {
        h2: '1. Estruture a indicação (não espere ela acontecer)',
        paragraphs: [
          'Indicação é o canal com maior taxa de conversão do mercado fitness, mas quase nenhum personal a estrutura. Crie um motivo concreto para o aluno indicar: um benefício mútuo ("você e o indicado ganham X"), um pedido explícito no momento certo (logo após uma avaliação com bom resultado) e agradecimento público quando autorizado.',
        ],
      },
      {
        h2: '2. Transforme resultado em conteúdo',
        paragraphs: [
          'No Instagram, antes/depois e evolução em números convertem mais que dancinha. Com [avaliações físicas organizadas](/avaliacao-fisica-digital), você tem um acervo permanente de provas de resultado (com autorização do aluno) — gráficos de evolução são conteúdo pronto. Consistência importa mais que produção: 3 posts por semana com resultado real batem 1 reel viral por mês.',
        ],
      },
      {
        h2: '3. Seja encontrável no Google',
        paragraphs: [
          'Quem procura "personal trainer + seu bairro/cidade" está pronto para comprar. Crie um perfil no Google (Perfil da Empresa) com fotos, avaliações de alunos e área de atendimento. Peça avaliação 5 estrelas para cada aluno satisfeito — é o fator que mais pesa no ranking local.',
        ],
      },
      {
        h2: '4. Parcerias de bairro',
        paragraphs: [
          'Nutricionistas, fisioterapeutas, clínicas de estética e academias que não têm personal exclusivo são fontes recorrentes de indicação. A moeda de troca é a recíproca: indique-os também. Um acordo simples com 2–3 profissionais de saúde do seu bairro gera fluxo constante.',
        ],
      },
      {
        h2: '5. Atenda online (e multiplique seu teto)',
        paragraphs: [
          'A consultoria online quebra o limite físico da agenda: você deixa de vender só horas e passa a vender acompanhamento. O pré-requisito é entregar experiência profissional à distância — treino acessível no celular do aluno, registro de cargas, check-ins e evolução visível. Um [app de treino para o aluno](/app-de-treino-para-alunos) é o que separa consultoria séria de PDF no WhatsApp.',
        ],
      },
      {
        h2: '6. Retenha antes de captar',
        paragraphs: [
          'Cada aluno que sai anula um aluno novo captado. Os 3 maiores motivos de saída — não ver resultado, não se sentir acompanhado e desorganização do serviço — são todos endereçáveis com gestão: avaliações periódicas com evolução visível, check-ins estruturados e uma operação sem falhas (treino vencido, cobrança esquecida, horário confundido). O nosso [guia de gestão de alunos](/blog/gestao-de-alunos-guia-completo) cobre isso em detalhe.',
        ],
      },
      {
        h2: '7. Gamifique a experiência',
        paragraphs: [
          'Aluno engajado treina mais, falta menos e vira divulgador espontâneo. Ranking entre alunos, conquistas por consistência e sequências de treino (streaks) criam o efeito de comunidade que academias grandes usam há décadas — e que o personal autônomo pode oferecer pelo app.',
        ],
      },
      {
        h2: '8. Profissionalize a primeira impressão',
        paragraphs: [
          'Entre dois personais igualmente competentes, fecha o que parece mais profissional. Anamnese digital em vez de papel, treino entregue em app com a sua identidade, cobrança automática via Pix e evolução em gráficos — cada detalhe comunica valor e justifica o seu preço. É o tipo de estrutura que uma [plataforma de gestão](/software-para-personal-trainer) entrega pronta, sem você montar peça por peça.',
        ],
      },
    ],
    faqs: [
      { q: 'Qual o melhor canal para conseguir alunos de personal?', a: 'Indicação estruturada tem a maior conversão. Google local (Perfil da Empresa) capta quem já está procurando, e Instagram com prova de resultado sustenta o médio prazo.' },
      { q: 'Vale a pena atender online?', a: 'Sim, desde que a experiência seja profissional: app para o aluno, registro de treino, check-ins e evolução visível. Online mal estruturado (PDF no WhatsApp) tem churn altíssimo.' },
      { q: 'Como reter mais alunos?', a: 'Mostre resultado (avaliações com gráficos), acompanhe de verdade entre as sessões e elimine falhas operacionais como treinos vencidos e cobranças esquecidas.' },
    ],
    related: [
      { label: 'Guia de gestão de alunos', to: '/blog/gestao-de-alunos-guia-completo' },
      { label: 'App de treino para alunos', to: '/app-de-treino-para-alunos' },
      { label: 'Comece grátis no CoachPilot', to: '/precos' },
    ],
  },
  {
    slug: 'planilha-de-treino-ou-sistema-de-gestao',
    title: 'Planilha de treino ou sistema de gestão: quando migrar? (guia honesto)',
    description: 'Planilha resolve até certo ponto. Veja os custos invisíveis, os sinais de que chegou a hora de migrar para um sistema de gestão e como migrar sem redigitar nada.',
    h1: 'Planilha de treino ou sistema de gestão: quando migrar?',
    datePublished: '2026-07-10',
    dateModified: '2026-07-10',
    readingMinutes: 6,
    intro: 'Toda operação de personal começa na planilha — e está certo assim. A pergunta não é se planilha funciona (funciona), e sim quando ela passa a custar mais do que um sistema. Este guia mostra a conta honesta e os sinais de que chegou a hora.',
    sections: [
      {
        h2: 'Onde a planilha funciona bem',
        paragraphs: [
          'Com até 5 alunos e rotina simples, a planilha é imbatível: grátis, flexível e você já sabe usar. Se a sua carteira é pequena e estável, não há urgência em migrar — organize bem as abas, padronize o modelo de treino e mantenha backup.',
        ],
      },
      {
        h2: 'Os custos invisíveis que crescem com a carteira',
        paragraphs: [
          'O problema da planilha não é o que ela faz, é o que ela não avisa. Ela não avisa que o programa do aluno venceu há duas semanas. Não avisa que a mensalidade não caiu. Não junta a foto da avaliação de março com a de junho. Não mostra ao aluno a própria evolução. Cada um desses silêncios custa: renovação atrasada, cobrança esquecida, aluno que não vê resultado e sai.',
          'Há também o custo de horas: montar treino no domingo, copiar e colar de um modelo, ajustar formatação, exportar PDF, mandar no WhatsApp. Personais com 15+ alunos relatam de 4 a 8 horas semanais nessa operação manual — tempo que não é cobrado de ninguém.',
        ],
      },
      {
        h2: '5 sinais de que chegou a hora de migrar',
        paragraphs: ['Se você marcou dois ou mais, a conta da migração já fecha:'],
        list: [
          'Você tem mais de 5–8 alunos ativos e sente que "alguma coisa sempre escapa".',
          'Já esqueceu uma renovação ou cobrança nos últimos 3 meses.',
          'As fotos de avaliação dos alunos estão espalhadas na galeria do celular.',
          'O aluno pergunta a própria evolução e você não tem resposta rápida.',
          'Monta treinos no fim de semana copiando e colando de planilhas antigas.',
        ],
      },
      {
        h2: 'O que muda com um sistema de gestão',
        paragraphs: [
          'Um [sistema de gestão para personal trainer](/software-para-personal-trainer) inverte a lógica: em vez de você vigiar a operação, a operação avisa você. Treinos vencendo, cobranças em aberto, dores relatadas e dúvidas dos alunos chegam como pendências; a evolução vira gráfico automático; o aluno recebe um app com o treino do dia em vez de um PDF. E a cobrança via Pix acontece sem conversa constrangedora.',
          'Veja o [comparativo detalhado CoachPilot vs planilhas](/coachpilot-vs-planilhas) para a lista completa do que muda na prática.',
        ],
      },
      {
        h2: 'A objeção real: "não quero redigitar tudo"',
        paragraphs: [
          'A maior barreira de migração sempre foi passar a carteira para o sistema novo — semanas digitando aluno por aluno. Em 2026, essa barreira caiu: a operação por IA do CoachPilot lê a sua planilha (ou PDF, ou prints), gera todos os cadastros e treinos no formato da plataforma, e você importa com um clique, revisando antes de aplicar. A migração de uma carteira inteira cai de semanas para minutos de revisão.',
          'Dá para testar o fluxo sem risco: o [plano grátis](/precos) atende até 3 alunos, sem prazo e sem cartão. Migre 3 alunos, viva a rotina por duas semanas e decida com base na prática.',
        ],
      },
    ],
    faqs: [
      { q: 'Planilha de treino funciona para personal trainer?', a: 'Funciona bem até 5 alunos com rotina simples. Acima disso, os custos invisíveis (renovações perdidas, cobranças esquecidas, horas de digitação) passam a superar o custo de um sistema.' },
      { q: 'Quanto custa migrar para um sistema?', a: 'Sistemas com alunos ilimitados custam em torno de R$39,90/mês em 2026. No CoachPilot, a migração da carteira por IA é gratuita e o plano de até 3 alunos também.' },
      { q: 'Vou precisar redigitar meus alunos?', a: 'Não necessariamente. No CoachPilot, a IA converte a sua planilha em cadastros e treinos importáveis com revisão — sem redigitação manual.' },
    ],
    related: [
      { label: 'CoachPilot vs planilhas', to: '/coachpilot-vs-planilhas' },
      { label: 'Guia de gestão de alunos', to: '/blog/gestao-de-alunos-guia-completo' },
      { label: 'Preços do CoachPilot', to: '/precos' },
    ],
  },
]

export const BLOG_BASE = {
  path: '/blog',
  title: 'Blog do CoachPilot — Gestão e crescimento para personal trainers',
  description: 'Guias práticos sobre gestão de alunos, prescrição com IA, retenção e crescimento para personal trainers brasileiros.',
  h1: 'Blog do CoachPilot',
  intro: 'Guias práticos sobre gestão de alunos, prescrição com IA, retenção e crescimento — escritos para personal trainers brasileiros.',
}
