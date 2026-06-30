# Guia Completo do CoachPilot — Portal do Personal Trainer

---

## INSTRUÇÕES PARA O CHATGPT

Você é um assistente de suporte ao CoachPilot — plataforma de gestão para personal trainers.

**Regras obrigatórias:**
1. Responda SOMENTE com base nas informações deste documento.
2. Se não encontrar a resposta aqui, diga: "Não encontrei essa informação no guia. Entre em contato com o suporte."
3. Nunca invente funcionalidades, telas, botões ou comportamentos que não estejam descritos neste documento.
4. Não confunda funcionalidades do Portal do Personal com as do App do Aluno — são interfaces separadas.
5. Quando descrever passos de navegação, use os nomes exatos de menus e páginas conforme descritos abaixo.

---

## O QUE É O COACHPILOT

O CoachPilot é uma plataforma SaaS para personal trainers gerenciarem seus alunos de forma completa. O personal trainer acessa via portal web (desktop ou mobile) em **coachpilot.com.br** e os alunos acessam via app móvel separado (PWA, sem instalação de loja de apps) em **app.coachpilot.com.br**.

O portal é o painel de controle do personal. Tudo começa aqui.

---

## OPERAÇÃO POR IA (CADASTRE CONVERSANDO COM O CHATGPT)

O maior diferencial do CoachPilot é poder operar a parte braçal por **linguagem natural**, em vez de digitar série a série. Você conversa — **por texto ou voz** — com o **seu próprio ChatGPT, Claude ou Gemini** (não precisa ser uma IA da plataforma), usando os **prompts prontos** que o CoachPilot fornece. A IA entende o formato do CoachPilot e devolve um conteúdo pronto que você **importa com 1 clique**. Você sempre **revisa antes de importar**.

> ⚠️ Importante: isso é **grátis e já incluído** em todos os planos — você usa a IA que já tem. É **diferente** do **Assistente IA do aluno** (add-on pago por aluno), que é o chat que o próprio aluno usa no WhatsApp/app. A "operação por IA" é uma ferramenta do **personal**; o "Assistente IA do aluno" é um recurso do **aluno**.

São **três fluxos** operados por IA (cada um detalhado na sua seção):

1. **Importar/migrar alunos em massa** — jogue sua planilha, PDF ou print de lista de alunos no ChatGPT com o prompt da plataforma; ele extrai os dados em CSV e você importa todos de uma vez. Ver **Gestão de Alunos → Importar alunos em massa via IA**.
2. **Montar pacotes de treino completos** — peça um treino (ABC, ABCDE, foco específico) e a IA gera exercícios, templates e rotinas prontos para importar. Ver **Pacotes de Treino → Via JSON gerado por IA**.
3. **Atualizar o treino de um aluno** — exporte o programa atual do aluno, peça o ajuste em linguagem natural (ex.: "aumenta o volume de pernas", "adapta para dor no ombro") e reimporte. Ver **Treinos → Atualizar o treino de um aluno via IA**.

Em todos os casos, a IA gera o conteúdo (JSON ou CSV) e o CoachPilot faz a importação — a IA **não** escreve direto no sistema; você cola/anexa o resultado e confirma.

---

## VISÃO GERAL DO PORTAL

### Navegação
O portal possui um **menu lateral (sidebar)** com as seguintes seções, agrupadas:

**Principal**
- **Visão geral** — dashboard com KPIs e atividade recente
- **Notificações** — central de alertas (dores, dúvidas, mídias, metas, treinos vencendo)
- **Feed** — feed unificado de publicações de todos os alunos

**Alunos**
- **Alunos** — lista e gestão de todos os alunos
- **Agenda** — agendamento de sessões
- **Ranking** — gamificação e ranking de frequência

**Treinos**
- **Rotinas** — splits completos (ABC, ABCDE…) reutilizáveis
- **Templates** — treinos modelo para aplicar a vários alunos
- **Biblioteca** — upload de materiais para os alunos
- **Pacotes** — pacotes de treino .cpkg com exercícios, templates e rotinas
- **Base de IA** — arquivos de conhecimento para o agente de IA

**Conta**
- **Plano** — assinatura da plataforma (Trial grátis × Gestão Pro)
- **Ajuda** — esta central de ajuda

No **rodapé do menu lateral** está o **menu do usuário** (foto de perfil + nome), com acesso a:
- Meu Perfil
- Configurações
- Tema (claro/escuro/automático) — alternável diretamente pelo ícone de sol/lua no menu
- Instalar app — botão de instalação do portal como PWA no celular ou desktop
- Sair

Em dispositivos móveis, o menu lateral vira um **drawer** acessado pelo ícone de hambúrguer no topo.

---

## FUNCIONALIDADES DETALHADAS

### 1. DASHBOARD (Visão Geral)

A página inicial do portal exibe:

**KPIs no topo:**
- Total de alunos cadastrados / alunos ativos
- Sessões realizadas hoje e na semana atual (com comparativo da semana anterior)
- Notificações não lidas

**Métricas:**
- Aderência 7d — quantos alunos únicos treinaram nos últimos 7 dias vs. total de ativos (%)
- Alunos que usam o app — quantidade e percentual dos ativos que acessaram o app do aluno
- Atalhos rápidos para Biblioteca e Templates (com contagem de itens)

**Gráficos:**
- Barras dos últimos 14 dias — sessões por dia
- Pizza — distribuição de alunos por objetivo de treino

**Listas:**
- Próximos eventos da agenda (próximos 7 dias) com status e aluno
- Atividade recente — últimos alunos que treinaram, treino atual, exercício e status (treinando agora / finalizado / não finalizado)
- Aniversariantes do mês

---

### 2. GESTÃO DE ALUNOS

#### Como cadastrar um novo aluno
1. Acesse **Alunos** no menu lateral
2. Clique em **"+ Novo Aluno"**
3. Preencha: nome completo, telefone (WhatsApp), e-mail (opcional), data de nascimento, endereço (opcional), objetivo, descrição/observação
4. O sistema sincroniza automaticamente a foto de perfil do WhatsApp
5. Clique em **Salvar**

#### Importar alunos em massa via IA (migração)
Em vez de cadastrar um a um, você pode importar vários alunos de uma vez com ajuda de IA — ideal para migrar de planilha ou de outro software.

1. Na página **Alunos**, clique em **"Importar alunos"**
2. **Copie o prompt** exibido no modal
3. Abra o **ChatGPT (ou Claude/Gemini)**, cole o prompt e **anexe ou cole** sua lista de alunos — pode ser planilha, CSV, PDF, ou até um print da tela. A IA extrai os dados no formato CSV com as colunas: `nome,telefone,email,data_nascimento,objetivos,endereco,observacoes`
4. **Cole o CSV** gerado pela IA no campo de texto do modal — uma **prévia** dos alunos é exibida para você conferir
5. Clique em **"Importar"**

Ao final, o sistema mostra quantos foram **importados**, **pulados** (telefone duplicado — o telefone é a chave única de cada aluno) e **erros** (linhas sem nome ou telefone). A importação é tolerante: linhas com problema são puladas sem abortar o resto. O limite de alunos do seu plano continua valendo.

#### Como gerar o link de acesso do aluno
1. Na lista de alunos, clique no aluno desejado
2. Na aba **Perfil**, o link é exibido automaticamente
3. Clique em **"Enviar via WhatsApp"** para enviar pelo WhatsApp conectado, ou em **"Copiar"** para copiar o link

**Renovar link:** Se precisar invalidar o link atual (ex.: aluno passou o link para outra pessoa), clique em **"Novo link"**. O link anterior deixa de funcionar imediatamente.

#### Visualizar perfil do aluno
Clique no aluno na lista. A página de detalhe tem as abas:
- **Treinos** — treinos e exercícios do aluno
- **Perfil** — dados pessoais, link de acesso e configurações do agente IA
- **Histórico** — sessões realizadas com detalhes de séries e cargas
- **Frequência** — estatísticas de frequência, streak e badges
- **Metas** — metas ativas e histórico
- **Financeiro** — cobranças e pagamentos

#### Editar dados do aluno
Na aba **Perfil** do aluno, clique em **"Editar"** para atualizar nome, telefone, email, endereço, data de nascimento, objetivo e descrição.

#### Desativar aluno
Edite o aluno e mude o status para **Inativo**. O aluno perde acesso ao app até ser reativado.

#### Filtrar e ordenar a lista de alunos
No topo da página **Alunos**, use os botões **"Ativos"**, **"Inativos"** ou **"Todos"** para filtrar a lista por status (o padrão ao abrir a página é "Ativos"). A lista é ordenada automaticamente pela **última atualização** (alunos com mudanças mais recentes aparecem primeiro), e cada card mostra "Atualizado há [tempo]".

#### Notas internas
Na página do aluno há um campo de **notas** para registrar observações internas (visível só para o personal, não para o aluno).

#### Assistente IA do aluno (agente no WhatsApp) por aluno
Na aba **Perfil** do aluno, você pode **ativar ou desativar o Assistente IA do aluno** individualmente. Quando desativado, as mensagens chegam diretamente ao personal sem processamento pela IA. Este é o add-on pago por aluno — não confundir com a **operação por IA** do personal (grátis), descrita no início deste guia.

---

### 3. TREINOS

#### Como criar um treino para o aluno
1. Acesse a página do aluno → aba **Treinos**
2. Clique em **"+ Novo Treino"**
3. Preencha: nome do treino, data de início, data de fim (opcional), foco (opcional)
4. Clique em **Salvar**

#### Como adicionar exercícios ao treino
1. Abra o treino criado (clique no nome para expandir)
2. Clique em **"+ Exercício"**
3. Preencha:
   - Nome do exercício (com autocomplete da biblioteca e dos exercícios já usados por esse aluno)
   - Tipo: **Força**, **Cardio** ou **Peso Corporal**
   - Grupo muscular (opcional)
   - Séries prescritas: para cada série, defina repetições e carga (pode variar por série — ex.: 4×10 com cargas 30/35/35/35)
   - Carga prescrita e unidade (ex.: kg, lb, %1RM, ou personalizado)
   - Repetições prescritas e unidade (ex.: reps, min, km, ou personalizado)
   - **1RM (kg)** — peso máximo em 1 repetição (opcional, necessário para % 1RM e IRM)
   - **% 1RM** — percentual do 1RM a usar como carga; a carga em kg é calculada automaticamente
   - Intervalo entre séries (em segundos)
   - Link de vídeo de referência (opcional)
   - Observações (visíveis ao aluno durante a sessão)
4. Arraste os exercícios para reordenar

Ao digitar o nome do exercício, o campo sugere automaticamente exercícios da biblioteca e exercícios que **esse aluno já usou antes**. Se você escolher um nome já usado pelo aluno, o link de vídeo e o grupo muscular são preenchidos com base no último uso.

Exercícios com o mesmo nome em treinos diferentes têm a evolução de carga e os recordes (PRs) **unificados automaticamente** — não é preciso recriar o exercício do zero para manter o histórico.

#### Tipos de exercício

**Força** — exercícios com carga (halteres, barras, máquinas). Carga em kg ou lb, repetições em reps. Suporta 1RM, % 1RM e gráfico de IRM.

**Cardio** — exercícios aeróbicos (esteira, bicicleta, corrida). Carga = RPE (esforço percebido de 0–10). Repetições em **minutos** ou **km** — o aluno pode alternar entre as duas unidades durante o registro.

**Peso Corporal** — exercícios sem carga externa (flexões, abdominais, barras). Repetições em reps, sem campo de carga.

#### Unidades personalizáveis
Você pode definir manualmente o sufixo de carga e de repetições de qualquer exercício (ex.: carga em `%1RM`, reps em `m`, `passos`, `cal`). As unidades definidas aparecem nos campos de prescrição, no registro do aluno e nos gráficos de evolução.

#### % 1RM e cálculo automático de carga
1. Preencha o campo **"1RM (kg)"** com o peso máximo do aluno naquele exercício
2. Preencha o campo **"% 1RM"** com o percentual desejado (ex: 75)
3. A carga prescrita em kg é calculada automaticamente: `1RM × (% 1RM / 100)`
4. O aluno vê a carga calculada e o percentual entre parênteses (ex: "75kg (75% 1RM)")

#### Exercícios substitutos
Você pode cadastrar **substitutos** para um exercício — alternativas que o aluno pode escolher executar no lugar do original durante a sessão (ex.: por falta de equipamento ou preferência).

**Como configurar:**
- **Pela Biblioteca:** ao cadastrar um exercício na biblioteca, defina substitutos que valem para todos os alunos que usarem aquele exercício.
- **Por treino:** na página do aluno, ao editar um exercício do treino, defina substitutos específicos só para aquele aluno/treino (complementam os da biblioteca).

Durante a sessão, o aluno toca no ícone de **substituição (setas ↔)** ao lado do exercício e escolhe entre o original e os substitutos. O substituto escolhido tem seu próprio bloco de séries e aparece marcado como "substituído por" no histórico.

#### Salvar treino como template
Na aba Treinos do aluno, expanda um treino e clique em **"Salvar como template"**. O treino vira um modelo reutilizável na página **Templates**.

#### Salvar rotina completa do aluno
Na aba Treinos do aluno, clique em **"Salvar rotina"** para salvar todos os treinos do aluno como uma rotina reutilizável. Cada treino também vira automaticamente um template. A rotina fica disponível na página **Rotinas**.

#### Aplicar rotina ao aluno
Na aba Treinos do aluno, clique em **"Aplicar rotina"** para aplicar uma rotina existente ao aluno. Você pode escolher entre **adicionar ao lado** dos treinos atuais ou **substituir tudo** (apaga os treinos atuais e cria os da rotina).

#### Atualizar o treino de um aluno via IA
Você pode pedir à IA para ajustar o programa inteiro de um aluno em linguagem natural, sem editar exercício por exercício.

1. Na aba **Treinos** do aluno, clique em **"Atualizar treino com IA"**
2. Clique em **"Baixar treino (JSON)"** — baixa o programa atual do aluno, e em **"Baixar prompt"** — baixa o arquivo de instrução
3. Abra o **ChatGPT (ou Claude/Gemini)**, cole o prompt, **anexe o JSON** do treino e **descreva o ajuste** desejado, por exemplo:
   - "Aumenta o volume de pernas"
   - "Troca o supino reto por supino na máquina"
   - "Adapta para dor no ombro esquerdo"
   - "Reduz a duração de cada treino"
   - "Adiciona um treino D de ombros e core"
4. A IA devolve o **JSON completo atualizado**. Copie e **cole** no campo de texto do modal
5. Clique em **"Importar e sobrescrever treino"** e confirme

> ⚠️ A importação faz **substituição total**: todo o programa de treinos atual do aluno é apagado e recriado a partir do JSON. O histórico de sessões e a evolução de carga (vinculados ao nome do exercício) são preservados. Sempre revise o JSON antes de importar.

---

### 4. TEMPLATES

Acesse **Templates** no menu lateral.

Templates são treinos modelo sem vínculo a um aluno específico — criados uma vez e aplicados a vários alunos com um clique.

**Como criar um template:**
1. Clique em **"+ Novo template"**
2. Preencha nome, foco e adicione os exercícios com suas prescrições
3. Clique em **Criar template**

Você também pode criar um template a partir do treino de um aluno: na página do aluno, expanda o treino e clique em **"Salvar como template"**.

**Como editar um template:** Clique no ícone de lápis no card do template.

**Como aplicar a alunos:**
1. Clique em **"Aplicar a alunos"** no card do template
2. Busque e selecione os alunos desejados
3. Clique em **Aplicar** — um treino é criado para cada aluno selecionado

Templates suportam todos os tipos de exercício (Força, Cardio, Peso Corporal), exercícios substitutos, prescrição de séries variadas por série, % 1RM e observações.

---

### 5. ROTINAS

Acesse **Rotinas** no menu lateral.

Uma **rotina** é um split completo (ex.: Rotina ABC, ABCDE…) com vários treinos organizados na sequência correta. É o nível acima do template.

**Como criar uma rotina:**
- **A partir dos treinos de um aluno:** na página do aluno → **"Salvar rotina"**. Os treinos atuais viram uma rotina + cada treino vira também um template.
- **Juntando templates:** na página Rotinas → **"Nova rotina"**. Selecione os templates que compõem a rotina, ordene-os (arraste ou use as setas ↑↓) e salve.

**Como editar uma rotina:** Clique no ícone de lápis no card da rotina. Você pode renomear, mudar a descrição, adicionar ou remover treinos e reordenar.

**Como aplicar a alunos:**
1. Clique em **"Aplicar a alunos"** no card da rotina
2. Escolha o **modo**:
   - **Adicionar ao lado** — mantém os treinos atuais do aluno e adiciona os da rotina
   - **Substituir tudo** — apaga todos os treinos atuais do aluno e cria os da rotina (requer confirmação)
3. Busque e selecione os alunos
4. Clique em **Aplicar**

Alunos que já receberam uma rotina não são afetados quando a rotina original é editada ou excluída.

---

### 6. PACOTES DE TREINO

Acesse **Pacotes** no menu lateral.

Pacotes (.cpkg) são conjuntos portáteis que incluem exercícios de biblioteca, templates e rotinas — tudo empacotado num único arquivo para importar e usar de imediato.

A página tem três abas:

#### Aba Importar
**Via arquivo .cpkg:**
1. Arraste o arquivo `.cpkg` para a área indicada (ou clique para selecionar)
2. Clique em **"Importar Pacote"**
3. Os exercícios, templates e rotinas do pacote são adicionados à sua conta

**Via JSON gerado por IA:**
1. Clique em **"Baixar prompt"** para baixar o arquivo de instrução
2. Cole o prompt em qualquer IA (ChatGPT, Claude etc.) e responda as 4 perguntas sobre o treino desejado
3. Copie o bloco JSON gerado pela IA
4. Cole no campo de texto e clique em **"Importar JSON da IA"**

#### Aba Instalados
Lista todos os pacotes importados na sua conta. Para cada pacote você pode:
- **Expandir** para ver os templates e rotinas incluídos
- **Ativar/desativar** o pacote inteiro (os templates e rotinas ficam ocultos enquanto desativado)
- **Ativar/desativar** itens individuais (templates ou rotinas específicos dentro do pacote)
- **Baixar JSON** (apenas pacotes livres) para editar no ChatGPT e reimportar
- **Remover** o pacote e todos os seus itens da conta

**Tipos de pacote:**
- **Padrão** — pacote manual gerado automaticamente pelo sistema para agruprar itens criados avulsos
- **Livre** — importado via JSON gerado por IA; pode ser exportado e editado
- **Licenciado** — importado via arquivo .cpkg com token; não pode ser exportado; o token é consumido na importação

#### Aba Criar
Crie um pacote a partir dos templates e rotinas que você já tem:
1. Preencha nome, descrição, autor e versão
2. Selecione os templates e rotinas que farão parte do pacote
3. (Opcional) Ative o modo **Licenciado** para gerar um arquivo .cpkg com token de uso único — defina quantos usos o token permite
4. Clique em **"Gerar JSON do Pacote"** (livre) ou **"Gerar Pacote Licenciado (.cpkg)"** (licenciado)

Pacotes licenciados geram um arquivo `.cpkg` que você distribui para outros personais. Cada importação consome um uso do token. Itens de pacotes licenciados não podem ser selecionados para compor novos pacotes.

---

### 7. AVALIAÇÕES FÍSICAS

#### Como criar uma avaliação
1. Acesse a página do aluno → clique em **"Avaliações"** (aba ou link no topo)
2. Clique em **"+ Nova Avaliação"**
3. Preencha os campos disponíveis:
   - Peso (kg)
   - Medidas corporais: cintura, quadril, coxa, braço, etc.
   - Percentual de gordura
   - Dados de bioimpedância (opcional)
4. Adicione fotos de evolução (opcional)
5. Clique em **Salvar**

#### Comparação before/after
1. Na página de avaliações do aluno, clique em **"Comparar Fotos"**
2. Selecione a foto "antes"
3. Selecione a foto "depois"
4. Visualize as duas imagens lado a lado

#### Gráficos automáticos
Ao ter 2 ou mais avaliações, o sistema gera automaticamente gráficos de evolução de peso e medidas.

---

### 8. METAS E OBJETIVOS

#### Como criar uma meta para o aluno
1. Acesse a página do aluno → aba **"Metas"**
2. Clique em **"+ Nova Meta"**
3. Escolha o tipo:
   - **CARGA** — atingir determinado peso em um exercício
   - **PESO** — atingir determinado peso corporal
   - **MEDIDA** — atingir determinada medida corporal
   - **LIVRE** — meta personalizada com descrição
4. Preencha valor alvo, unidade e data limite (opcional)
5. Ative a meta clicando em **"Aprovar"**

#### Verificação automática de metas
- Metas de **CARGA**: verificadas automaticamente quando o aluno bate um novo PR (personal record)
- Metas de **PESO/MEDIDA**: verificadas automaticamente quando uma nova avaliação é cadastrada
- Ao atingir a meta, o aluno ganha **+50 pontos** automaticamente

---

### 9. FREQUÊNCIA DO ALUNO

Na página do aluno, acesse a aba **"Frequência"** para ver:
- Total de sessões realizadas
- Média semanal de sessões
- Streak atual (semanas seguidas treinando)
- Melhor streak de todos os tempos
- Gráfico de barras das últimas 16 semanas
- Galeria de badges conquistados

---

### 10. EVOLUÇÃO DE CARGA E IRM

Na página do aluno há a aba **"Evolução"** (ou link para a página de evolução completa).

**Gráfico de Carga:** evolução do peso levantado ao longo do tempo. Selecione o exercício pelo campo de busca.

**Gráfico de IRM (Intensidade Relativa Média):** visível quando o exercício tem 1RM cadastrado. Mostra, sessão a sessão, o percentual médio do 1RM utilizado nas séries. Ajuda a verificar se o aluno está treinando na intensidade prescrita.

**Gráfico de Volume:** volume semanal por grupo muscular (séries × reps × carga), visualizado como barras empilhadas. Ajuda a ver se o treino está balanceado.

**Recordes (PRs):** melhor carga registrada em cada exercício, com data. Exercícios com o mesmo nome em treinos diferentes compartilham o mesmo PR.

---

### 11. HISTÓRICO DE SESSÕES

Na página do aluno, aba **"Histórico"**, você vê todas as sessões finalizadas em ordem cronológica reversa. Cada sessão mostra:
- Nome do treino, data e duração
- Exercícios realizados com as séries e cargas registradas
- Pontos ganhos
- Badges conquistadas (se houver)

---

### 12. NOTIFICAÇÕES

Acesse **Notificações** no menu. A central lista todos os eventos que precisam da sua atenção.

**Tipos de notificação:**
- **Relato de Dor** — aluno reportou dor ou desconforto durante exercício (alerta prioritário)
- **Dúvida** — aluno tem pergunta sobre execução ou técnica
- **Mídia enviada** — aluno enviou foto ou vídeo de execução
- **Meta atingida** — aluno alcançou uma meta definida
- **Treino vencendo** — treino de um aluno está próximo do vencimento
- **Pergunta direta** — aluno fez pergunta que não passou pelo agente de IA

**Ações disponíveis:**
- Marcar como lida (individual ou todas de uma vez)
- Clicar para ver o contexto completo (exercício, mensagem, aluno)
- Responder via thread de comentários
- Marcar como **"Resolver"** quando o assunto for tratado

---

### 13. RELATOS DE DOR E DÚVIDAS

Quando um aluno reporta dor ou dúvida, aparece em **Notificações**. Ao clicar:

1. Você vê o exercício afetado, a descrição do aluno e a data
2. Clique em **"Responder"** para abrir a thread
3. Escreva sua resposta (pode incluir mídias)
4. O aluno recebe uma notificação push com sua resposta
5. Clique em **"Resolver"** quando o assunto for tratado

---

### 14. FEED

O feed unificado mostra as publicações de todos os alunos e do personal. Acesse **Feed** no menu.

**Tipos de conteúdo no feed:**
- **Execução** — registro de série com detalhes de carga
- **Dor** — relato de dor/lesão
- **Dúvida** — pergunta sobre exercício
- **Correção** — feedback do personal sobre execução
- **Recurso Educacional** — publicação de conteúdo (texto, foto, vídeo) que pode ser vinculada a exercícios como material de apoio
- **Outro** — postagem genérica

**Como publicar:**
1. Clique em **"Nova Publicação"** (ou ícone de composição)
2. Selecione o tipo, o exercício (se aplicável) e escreva o conteúdo
3. Adicione mídia (foto/vídeo) se quiser
4. Clique em **Publicar**

**Comentários:** Clique em qualquer postagem para abrir a thread e comentar.

---

### 15. LINKS ÚTEIS NOS EXERCÍCIOS (RECURSOS EDUCACIONAIS)

Você pode vincular publicações do tipo **Recurso Educacional** (feitas no Feed) a exercícios, para que o aluno veja esse material de apoio direto na execução do treino.

**Como vincular pela Biblioteca:**
1. Acesse **Biblioteca** ou edite um exercício na biblioteca
2. No campo **"Links Úteis"**, busque e selecione os Recursos Educacionais do feed que deseja associar àquele exercício
3. Todo treino que use um exercício com esse nome passa a exibir automaticamente esses recursos

**Como personalizar por aluno:**
Na página do aluno, ao editar um exercício do treino:
- Em **"Recursos da biblioteca"**, desmarque os recursos que não quer exibir para aquele aluno específico
- Em **"Links Úteis"**, adicione recursos extras só para aquele aluno

O aluno vê os recursos tocando no ícone de **livro** ao lado do exercício durante a sessão de treino.

---

### 16. GAMIFICAÇÃO E RANKING

Acesse **Ranking** no menu.

**Sistema de pontos — como os alunos ganham pontos:**
| Ação | Pontos |
|------|--------|
| Cada série registrada | 1 ponto |
| Sessão finalizada | 8 pontos |
| Sessão 100% completa (todos os exercícios) | +7 pontos bônus |
| Novo personal record (PR) | 10 pontos |
| Publicação no feed | 3 pontos |
| Comentário no feed | 2 pontos |
| Curtida recebida | 1 ponto |
| Meta atingida | 50 pontos |

**Multiplicador de streak:**
- 0–2 semanas seguidas: multiplicador **1x**
- 3–8 semanas seguidas: multiplicador **2x**
- 9+ semanas seguidas: multiplicador **3x**

O multiplicador se aplica a todos os pontos ganhos naquela semana.

**Períodos do ranking:**
- **Semanal** — reseta todo início de semana ISO (segunda-feira)
- **Mensal** — reseta todo início de mês
- **Geral** — acumulado histórico, nunca reseta

---

### 17. BADGES (CONQUISTAS)

Os alunos podem desbloquear 8 badges automaticamente:

| Badge | Conquista |
|-------|-----------|
| Primeira Passada | 1ª sessão finalizada |
| 10 Sessões | 10 sessões finalizadas |
| 25 Sessões | 25 sessões finalizadas |
| 50 Sessões | 50 sessões finalizadas |
| Centenário | 100 sessões finalizadas |
| 3 Semanas | 3 semanas seguidas treinando |
| 8 Semanas | 8 semanas seguidas treinando |
| 12 Semanas | 12 semanas seguidas treinando |

---

### 18. FINANCEIRO DOS ALUNOS (MENSALIDADES E COBRANÇAS)

Controle as mensalidades e cobranças de cada aluno. Acesse a página do aluno → aba **"Financeiro"**.

**Configurar faturamento recorrente:**
1. Clique em **"Configurar"** (ou **"Editar"**, se já configurado)
2. Defina: valor, recorrência (mensal ou anual), dia de vencimento e antecedência (quantos dias antes do vencimento a cobrança é gerada)
3. Salve — o sistema passa a gerar cobranças automaticamente com base nessa configuração
4. Alterações futuras não afetam cobranças já geradas (o histórico fica preservado)

**Status das cobranças:**
- **Pendente** — gerada, aguardando pagamento
- **Vencida** — passou da data de vencimento sem pagamento
- **Paga** — pagamento confirmado (manual ou via Pix)

**Criar cobrança avulsa:** Clique em **"Nova cobrança"** e preencha valor e vencimento.

**Registrar pagamento manualmente:** Na cobrança pendente/vencida, clique em **"Pagar"** e confirme os dados.

**Cancelar cobrança:** Disponível no card da cobrança, com confirmação.

**Filtros:** Todas, Pendentes, Vencidas, Pagas.

#### Pagamento via Pix (Mercado Pago)

Se você configurar a integração com o Mercado Pago (ver **Configurações → Pagamentos**), o aluno pode pagar a mensalidade via Pix direto pelo app dele, sem precisar de pagamento manual. O sistema confirma o pagamento automaticamente assim que o Mercado Pago notifica.

**Como configurar:**
1. Acesse **Configurações** → aba **"Pagamentos"**
2. Informe o **Access Token** da sua conta Mercado Pago
3. Salve

Sem o token configurado, a gestão financeira continua funcionando normalmente (pagamentos manuais).

> Pagamentos via Pix pelo Mercado Pago podem ter taxa de processamento cobrada pelo próprio Mercado Pago.

---

### 19. BIBLIOTECA

Acesse **Biblioteca** no menu para gerenciar materiais compartilhados com todos os alunos.

**Para adicionar arquivo:**
1. Clique em **"+ Upload"**
2. Selecione o arquivo (PDF, imagem, vídeo, etc.)
3. O arquivo é salvo e fica disponível para download pelos alunos

**Para remover:** Clique no ícone de lixeira ao lado do arquivo.

Os alunos baixam os arquivos em formato ZIP pelo app deles.

Na Biblioteca você também configura **exercícios da biblioteca**: adicione exercícios com nome, grupo muscular, substitutos padrão e links úteis. Esses dados são usados como sugestão em todos os treinos que usarem o mesmo nome de exercício.

---

### 20. BASE DE IA (CONHECIMENTO)

Acesse **Base de IA** no menu. Aqui você faz upload de arquivos que serão usados como contexto pelo agente de IA no WhatsApp do aluno.

Exemplos de arquivos úteis: protocolos de treino, explicações de exercícios, orientações nutricionais, FAQs personalizadas.

**Como adicionar:** Clique em **"+ Upload"** e selecione o arquivo.

---

### 21. ANAMNESE (FICHA DE SAÚDE)

Acesse **Configurações** → aba **"Anamnese"** para configurar o questionário de saúde.

**Como funciona:**
1. Você cria o questionário uma vez (ou edita quando quiser)
2. O sistema gera um link público de cadastro
3. Você envia o link ao novo aluno antes do primeiro treino
4. O aluno preenche o formulário sem precisar de login
5. As respostas ficam salvas na aba "Anamnese" / "Perfil" da página do aluno

**Para ver as respostas:** Acesse a página do aluno → aba **"Perfil"**.

---

### 22. AGENDAMENTO

Acesse **Agenda** no menu para gerenciar sessões agendadas.

**Como agendar uma sessão:**
1. Clique em um horário no calendário (ou em **"+ Agendar"**)
2. Selecione o aluno e o treino
3. Defina data e hora
4. Salve — o aluno recebe notificação automática

**Lembretes automáticos:** O sistema envia lembretes de treino via WhatsApp/push conforme as configurações.

Os próximos eventos da agenda aparecem no Dashboard (próximos 7 dias).

---

### 23. INTEGRAÇÃO WHATSAPP (W-API)

Acesse **Configurações** → aba **"WhatsApp"**.

**Para configurar:**
1. Insira o ID da instância e o token da W-API
2. Clique em **"Conectar"**
3. Escolha o método de vinculação:
   - **QR Code** — escaneie com o WhatsApp do celular
   - **Código de pareamento** — informe o número do celular e use o código exibido no WhatsApp
4. Aguarde o status mudar para **"Conectado"**

Após conectar, os alunos podem enviar mensagens ao número cadastrado e o agente de IA responderá automaticamente.

**Agente de IA por aluno:** Na página do aluno (aba Perfil) é possível ativar/desativar o agente individualmente.

---

### 24. NOTIFICAÇÕES PUSH (WEB PUSH)

O portal suporta notificações push nativas do navegador. Para receber alertas mesmo com o portal fechado:
1. Ao acessar o portal, clique em **"Permitir notificações"** quando o navegador solicitar
2. Pronto — você receberá notificações de atividade dos alunos em tempo real

---

### 25. PERFIL DO PERSONAL

Acesse **Meu Perfil** no menu do usuário (canto inferior do sidebar).

**Campos disponíveis:**
- Nome completo e foto de perfil
- Descrição/tagline profissional
- Biografia completa
- Especialidades e formação
- Links de redes sociais: Instagram, TikTok, YouTube, LinkedIn, Facebook, X (Twitter), website

Essas informações ficam visíveis para os alunos na aba **"Personal"** do app.

---

### 26. EXPORTAR RELATÓRIO PDF

Na página do aluno, clique em **"Exportar PDF"** (ou ícone de impressora). O relatório inclui:
- Dados do aluno e objetivo
- Histórico de avaliações com gráficos de evolução
- Badges conquistados
- Histórico de sessões recentes

---

### 27. TEMA (APARÊNCIA)

O portal suporta três modos de exibição, alteráveis diretamente pelo ícone de lua/sol/sistema no rodapé do menu lateral ou em **Configurações → Aparência**:

- **Escuro** — fundo escuro (padrão)
- **Claro** — fundo claro
- **Automático** — segue a preferência do sistema operacional do dispositivo

---

### 28. INSTALAR O PORTAL COMO APP

O portal do personal também é um PWA — você pode instalá-lo na tela inicial do celular ou como app no desktop:
- Clique em **"Instalar app"** no rodapé do menu lateral (aparece apenas em navegadores que suportam PWA)
- Ou use o ícone de instalação na barra de endereço do navegador

---

### 29. ASSINATURA DA PLATAFORMA (PLANO)

Esta é a assinatura do **seu** acesso ao CoachPilot — diferente do Financeiro dos alunos (seção 18), que é a cobrança que você faz aos seus alunos.

Acesse **Plano** no menu lateral.

**Planos disponíveis:**
- **Plano Grátis (Trial)** — até **3 alunos** cadastrados, sem custo
- **Gestão Pro** — alunos ilimitados, pago via Pix

**Como assinar ou renovar:**
1. Na página **Plano**, clique em **"Assinar Gestão Pro"** (ou **"Renovar mais um mês"**, se já for Pro)
2. Escaneie o QR Code Pix exibido ou copie o código copia-e-cola
3. O sistema confirma o pagamento automaticamente e libera o plano por mais 30 dias

**O que acontece quando o limite é atingido ou o plano vence:**
- No Plano Grátis, ao atingir 3 alunos, novos cadastros ficam bloqueados até você assinar o Gestão Pro
- Se a assinatura Gestão Pro vencer, os alunos que excederem o limite de 3 ficam marcados como **"Bloqueado"** — você não consegue mais abrir o perfil deles até renovar
- Um banner no topo do portal avisa quando o plano está no grátis, quando a assinatura Pro está perto de vencer (7 dias ou menos) ou quando já venceu

**Add-ons:** Canal WhatsApp e Assistente IA do aluno são contratados separadamente da gestão de alunos. (A operação por IA do personal — cadastrar e montar treinos conversando com o ChatGPT — é grátis e não é um add-on.)

**Histórico de pagamentos:** A seção "Histórico de pagamentos" lista todos os pagamentos do Gestão Pro confirmados, com data, dias concedidos e validade resultante.

#### Código promocional

Se você tiver um código promocional (gerado por uma campanha ou indicação), pode usá-lo para ganhar dias grátis do Gestão Pro.

**Como resgatar:**
- Na página **Plano**, no campo "Tenho um código promocional", cole o código e clique em **"Resgatar"**
- Ou na **tela de bloqueio** (quando o limite de 3 alunos foi atingido), toque em **"Tenho um código promocional"**
- Ou no **modal de renovação** (ao clicar em "Renovar"), toque em **"Tenho um código promocional"**

Cada código tem um limite de usos definido no momento da geração e não pode ser usado pelo próprio criador.

#### Indique e Ganhe

Na página **Plano**, você tem um **código de indicação exclusivo**:
- Compartilhe seu código com outros personais
- Quem usar o código ganha 30 dias grátis de Gestão Pro
- Quando essa pessoa virar assinante paga, você também ganha 30 dias grátis

A seção mostra o total de indicações realizadas e os meses grátis que você já ganhou.

#### Benefício FinPilot
A cada mês pago no **Gestão Pro**, você recebe automaticamente um código para **1 mês grátis no FinPilot** — um gerenciador financeiro pessoal com assistente de IA em português. O código fica no histórico de pagamentos. Quando o Gestão Pro está ativo, um banner no topo do portal mostra **"1 mês grátis no FinPilot"** com o botão **"Ver código"**.

---

### 30. ADMINISTRAÇÃO (SUPERADMIN)

Acesse **Admin** no menu (visível apenas para o administrador do sistema).

**Funcionalidades:**
- Listar todos os personals cadastrados
- Emitir token de impersonação para visualizar o portal como um personal específico
- Útil para suporte técnico

---

## PERGUNTAS FREQUENTES (FAQ)

**P: Como faço para que o aluno acesse o app?**
R: Na página do aluno (aba Perfil), clique em "Enviar via WhatsApp" ou "Copiar link". O aluno recebe o link e acessa sem precisar criar conta.

**P: O aluno precisa instalar algo?**
R: Não. O app do aluno é um PWA. Ele abre direto no navegador do celular. Opcionalmente, o aluno pode instalar na tela inicial pelo ícone de download.

**P: Como funciona o agente de IA no WhatsApp?**
R: Após configurar a integração W-API, o aluno pode enviar mensagens ao número do WhatsApp cadastrado. O agente entende contexto de treino, registra séries, responde dúvidas e alerta o personal quando necessário.

**P: O aluno pode ter mais de um treino ativo?**
R: Sim. Você pode criar vários treinos para o mesmo aluno com datas de início/fim diferentes. O treino "ativo" é o que está dentro da vigência.

**P: Qual a diferença entre template, rotina e pacote?**
R: Template = 1 treino modelo (ex.: "Treino A — Superiores"). Rotina = split completo com vários templates na ordem correta (ex.: "Rotina ABC"). Pacote (.cpkg) = arquivo que inclui exercícios de biblioteca + templates + rotinas, tudo junto, importável com um clique.

**P: Como funciona o streak?**
R: Streak conta semanas seguidas em que o aluno treinou pelo menos uma vez. Ele aumenta o multiplicador de pontos: 3–8 semanas = 2x, 9+ semanas = 3x pontos.

**P: Como exporto os dados dos alunos?**
R: A exportação disponível é o relatório em PDF individual. Acesse a página do aluno e clique em "Exportar PDF".

**P: Posso ter mais de um número de WhatsApp conectado?**
R: Sim. Cada instância W-API corresponde a um número. Você pode conectar múltiplas instâncias.

**P: Como funciona a comparação before/after?**
R: Vá até as avaliações do aluno, clique em "Comparar Fotos", selecione a foto mais antiga (antes) e a mais recente (depois). O sistema exibe as duas lado a lado.

**P: Os alunos conseguem ver o ranking uns dos outros?**
R: Sim. O ranking é visível para todos os alunos do mesmo personal.

**P: Qual a diferença entre o Financeiro do aluno e a página Plano?**
R: Financeiro (aba na página do aluno) é a mensalidade que você cobra dos seus alunos. Plano (menu lateral) é a sua assinatura do CoachPilot — Trial grátis até 3 alunos ou Gestão Pro ilimitado.

**P: O que acontece com meus alunos se eu não renovar o Gestão Pro?**
R: Os alunos que excedem o limite de 3 ficam com o perfil bloqueado (você não consegue mais abri-lo) até a renovação. Os dados não são apagados.

**P: Sou obrigado a configurar o Mercado Pago para cobrar meus alunos?**
R: Não. Sem o Access Token configurado, você gerencia cobranças e pagamentos manualmente. O Mercado Pago só adiciona a opção de o aluno pagar via Pix sozinho.

**P: O que é o FinPilot?**
R: É um benefício exclusivo para assinantes do Gestão Pro — um gerenciador financeiro pessoal (separado do CoachPilot) que você ganha gratuitamente por 1 mês a cada mensalidade paga. O código fica no histórico de pagamentos da página Plano.

**P: Para que serve o exercício substituto?**
R: Permite que o aluno troque um exercício prescrito por uma alternativa equivalente durante a sessão (por falta de equipamento, por exemplo). Você cadastra os substitutos na Biblioteca ou diretamente no treino do aluno.

**P: Como funciona o campo % 1RM?**
R: Ao cadastrar um exercício de Força, preencha o "1RM (kg)" com o máximo do aluno e o "% 1RM" com o percentual desejado (ex: 75). O sistema calcula automaticamente a carga prescrita. O aluno verá a carga calculada e o percentual ao lado.

**P: O que é o IRM?**
R: IRM (Intensidade Relativa Média) é o percentual médio do 1RM que o aluno utilizou em uma sessão. É exibido como gráfico na evolução do aluno quando o exercício tem 1RM cadastrado.

**P: Como funciona o tipo Cardio?**
R: Exercícios do tipo Cardio usam RPE (esforço percebido, 0–10) como campo de carga, e as repetições são registradas em minutos ou quilômetros. O aluno pode alternar entre min e km com um toque durante o registro.

**P: Posso instalar o portal como app no celular ou computador?**
R: Sim. O portal do personal também é um PWA — clique em "Instalar app" no rodapé do menu lateral ou use o ícone na barra de endereço do navegador.

**P: O que é um código promocional e onde inserir?**
R: É um código que concede dias grátis do Gestão Pro. Você pode inserir na página Plano no campo "Tenho um código promocional".

**P: O que é o programa Indique e Ganhe?**
R: Você tem um código de indicação exclusivo na página Plano. Compartilhe com outros personais: quem usar ganha 30 dias grátis, e quando essa pessoa virar assinante paga, você também ganha 30 dias.

**P: Como mudo o tema do portal para claro?**
R: Clique no ícone de sol/lua/sistema no rodapé do menu lateral para alternar entre escuro, claro e automático.

**P: Qual a diferença entre um pacote livre e um pacote licenciado?**
R: Pacotes livres são gerados via JSON (com ajuda de IA) e podem ser exportados e editados. Pacotes licenciados são arquivos .cpkg com token de uso único — não podem ser exportados e o token é consumido na importação. Use pacotes licenciados para distribuir conteúdo protegido para outros personais.

**P: Como conecto o WhatsApp por código de pareamento em vez de QR?**
R: Em Configurações → WhatsApp, selecione a aba "Código de pareamento", informe o número de telefone e use o código exibido para vincular no WhatsApp (Menu → Dispositivos conectados → Vincular dispositivo → Vincular com número de telefone).

---

## SUPORTE

Em caso de dúvidas não respondidas por este guia, entre em contato com o suporte via WhatsApp pelo link disponível na tela de configurações do portal.
