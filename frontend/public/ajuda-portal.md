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

O CoachPilot é uma plataforma SaaS para personal trainers gerenciarem seus alunos de forma completa. O personal trainer acessa via portal web (desktop ou mobile) e os alunos acessam via app móvel separado (PWA, sem instalação de loja de apps).

O portal é o painel de controle do personal. Tudo começa aqui.

---

## VISÃO GERAL DO PORTAL

### Navegação
O portal possui um **menu lateral (sidebar)** com as seguintes seções:

- **Visão geral** — dashboard com KPIs e atividade recente
- **Alunos** — lista e gestão de todos os alunos
- **Agenda** — agendamento de sessões
- **Templates** — biblioteca de treinos modelo
- **Feed** — feed unificado de publicações
- **Ranking** — gamificação e ranking de frequência
- **Notificações** — central de alertas e pendências
- **Plano** — assinatura da plataforma (Trial grátis x Gestão Pro)
- **Biblioteca** — upload de materiais para os alunos
- **Base de IA** — arquivos de conhecimento para o agente de IA
- **Ajuda** — esta central de ajuda

No canto superior esquerdo está o **menu do usuário** (foto de perfil + nome) com acesso a:
- Meu Perfil
- Configurações
- Sair

Em dispositivos móveis, o menu lateral vira um **drawer** acessado pelo ícone de hambúrguer no topo.

---

## FUNCIONALIDADES DETALHADAS

### 1. DASHBOARD (Visão Geral)

A página inicial do portal exibe:

**KPIs no topo:**
- Total de alunos cadastrados
- Alunos ativos
- Notificações não lidas

**Gráfico de sessões:**
- Linha do tempo dos últimos 14 dias
- Mostra quantas sessões foram realizadas por dia

**Atividade recente:**
- Lista dos últimos alunos que treinaram
- Mostra nome, foto, treino atual, exercício que estão fazendo e status (em treino / finalizado)
- Timestamp da última atividade

---

### 2. GESTÃO DE ALUNOS

#### Como cadastrar um novo aluno
1. Acesse **Alunos** no menu lateral
2. Clique em **"+ Novo Aluno"**
3. Preencha: nome completo, telefone (WhatsApp), e-mail (opcional), data de nascimento, objetivo
4. O sistema sincroniza automaticamente a foto de perfil do WhatsApp
5. Clique em **Salvar**

#### Como gerar o link de acesso do aluno
1. Na lista de alunos, clique no aluno desejado
2. Clique em **"Gerar Link"** ou **"Enviar via WhatsApp"**
3. O link é único e permite que o aluno acesse o app sem precisar criar conta

#### Visualizar perfil do aluno
Clique no aluno na lista. A página de perfil mostra:
- Dados pessoais
- Treino atual
- Histórico de sessões
- Avaliações físicas
- Metas
- Frequência e badges

#### Editar dados do aluno
Na página do aluno, clique em **"Editar"** para atualizar nome, telefone, status (ativo/inativo).

#### Desativar aluno
Edite o aluno e mude o status para **Inativo**. O aluno perde acesso ao app até ser reativado.

---

### 3. TREINOS

#### Como criar um treino para o aluno
1. Acesse a página do aluno
2. Clique em **"+ Novo Treino"**
3. Preencha: nome do treino, data de início, data de fim (opcional)
4. Clique em **Salvar**

#### Como adicionar exercícios ao treino
1. Abra o treino criado
2. Clique em **"+ Exercício"**
3. Preencha:
   - Nome do exercício
   - Número de séries
   - Número de repetições
   - Carga prescrita (kg)
   - Intervalo entre séries (segundos)
   - Link de vídeo de referência (opcional)
4. Arraste para reordenar os exercícios

#### Copiar treino (templates)
1. Na página do aluno, clique no treino que deseja copiar
2. Clique em **"Copiar Treino"**
3. Selecione o aluno de destino
4. O treino é duplicado com todos os exercícios

#### Templates reutilizáveis
Acesse **Templates** no menu. Aqui você cria treinos modelo sem vínculo a aluno específico. Para usar, acesse o aluno e importe o template desejado.

---

### 4. AVALIAÇÕES FÍSICAS

#### Como criar uma avaliação
1. Acesse a página do aluno → aba **"Avaliações"** ou acesse pelo menu lateral
2. Clique em **"+ Nova Avaliação"**
3. Preencha os campos disponíveis:
   - Peso (kg)
   - Medidas corporais: cintura, quadril, coxa, braço, etc.
   - Percentual de gordura
   - Dados de bioimpedância (opcional)
4. Adicione fotos de evolução (opcional)
5. Clique em **Salvar**

#### Comparação before/after
1. Na aba de avaliações do aluno, clique em **"Comparar Fotos"**
2. Passo 1: selecione a foto "antes"
3. Passo 2: selecione a foto "depois"
4. Passo 3: visualize as duas imagens lado a lado

#### Gráficos automáticos
Ao ter 2 ou mais avaliações, o sistema gera automaticamente gráficos de evolução de peso e medidas.

---

### 5. METAS E OBJETIVOS

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

### 6. NOTIFICAÇÕES

Acesse **Notificações** no menu. A central lista todos os eventos que precisam da sua atenção:

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

---

### 7. RELATOS DE DOR E DÚVIDAS

Quando um aluno reporta dor ou dúvida, aparece em **Notificações**. Ao clicar:

1. Você vê o exercício afetado, a descrição do aluno e a data
2. Clique em **"Responder"** para abrir a thread
3. Escreva sua resposta (pode incluir mídias)
4. O aluno recebe uma notificação push com sua resposta
5. Clique em **"Resolver"** quando o assunto for tratado

---

### 8. FEED

O feed unificado mostra as publicações de todos os alunos e do personal. Acesse **Feed** no menu.

**Tipos de conteúdo no feed:**
- **Execução** — registro de série com detalhes de carga
- **Dor** — relato de dor/lesão
- **Dúvida** — pergunta sobre exercício
- **Correção** — feedback do personal sobre execução
- **Recurso Educacional** — publicação de conteúdo (texto, foto, vídeo) que pode ser vinculada a exercícios como material de apoio (ver seção **LINKS ÚTEIS NOS EXERCÍCIOS**)
- **Outro** — postagem genérica

**Como publicar:**
1. Clique em **"Nova Publicação"** (ou ícone de composição)
2. Selecione o tipo, o exercício (se aplicável) e escreva o conteúdo
3. Adicione mídia (foto/vídeo) se quiser
4. Clique em **Publicar**

**Comentários:** Clique em qualquer postagem para abrir a thread e comentar.

---

### 9. GAMIFICAÇÃO E RANKING

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

### 10. BADGES (CONQUISTAS)

Os alunos podem desbloquear 8 badges:

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

Os badges são desbloqueados automaticamente quando o aluno atinge o critério.

---

### 11. FREQUÊNCIA DO ALUNO

Na página do aluno, acesse a aba **"Frequência"** para ver:
- Total de sessões realizadas
- Média semanal de sessões
- Streak atual (semanas seguidas treinando)
- Melhor streak de todos os tempos
- Gráfico de barras das últimas 16 semanas
- Galeria de badges conquistados

---

### 12. BIBLIOTECA

Acesse **Biblioteca** no menu para gerenciar materiais compartilhados com todos os alunos.

**Para adicionar arquivo:**
1. Clique em **"+ Upload"**
2. Selecione o arquivo (PDF, imagem, vídeo, etc.)
3. O arquivo é salvo e fica disponível para download pelos alunos

**Para remover:** Clique no ícone de lixeira ao lado do arquivo.

Os alunos baixam os arquivos em formato ZIP pelo app deles.

---

### 13. BASE DE IA (CONHECIMENTO)

Acesse **Base de IA** no menu. Aqui você faz upload de arquivos que serão usados como contexto pelo agente de IA no WhatsApp do aluno.

Exemplos de arquivos úteis: protocolos de treino, explicações de exercícios, orientações nutricionais, FAQs personalizadas.

**Como adicionar:** Clique em **"+ Upload"** e selecione o arquivo.

---

### 14. ANAMNESE (FICHA DE SAÚDE)

Acesse **Configurações** → aba **"Anamnese"** para configurar o questionário de saúde.

**Como funciona:**
1. Você cria o questionário uma vez (ou edita quando quiser)
2. O sistema gera um link público de cadastro
3. Você envia o link ao novo aluno antes do primeiro treino
4. O aluno preenche o formulário sem precisar de login
5. As respostas ficam salvas na aba "Anamnese" da página do aluno

**Para ver as respostas:** Acesse a página do aluno → aba **"Anamnese"** ou **"Perfil"**.

---

### 15. AGENDAMENTO

Acesse **Agenda** no menu para gerenciar sessões agendadas.

**Como agendar uma sessão:**
1. Clique em um horário no calendário (ou em **"+ Agendar"**)
2. Selecione o aluno e o treino
3. Defina data e hora
4. Salve — o aluno recebe notificação automática

**Lembretes automáticos:** O sistema envia lembretes de treino via WhatsApp/push conforme as datas configuradas no treino.

---

### 16. INTEGRAÇÃO WHATSAPP (W-API)

Acesse **Configurações** → aba **"WhatsApp"**.

**Para configurar:**
1. Insira o ID da instância e o token da W-API
2. Clique em **"Conectar"**
3. Escaneie o QR Code com o WhatsApp do celular que será o assistente
4. Aguarde o status mudar para **"Conectado"**

Após conectar, os alunos podem enviar mensagens ao número cadastrado e o agente de IA responderá automaticamente.

**Agente de IA por aluno:** Na página do aluno é possível ativar/desativar o agente individualmente. Quando desativado, as mensagens chegam diretamente ao personal sem processamento pela IA.

---

### 17. NOTIFICAÇÕES PUSH (WEB PUSH)

O portal suporta notificações push nativas do navegador. Para receber alertas mesmo com o portal fechado:
1. Ao acessar o portal, clique em **"Permitir notificações"** quando o navegador solicitar
2. Pronto — você receberá notificações de atividade dos alunos em tempo real

---

### 18. PERFIL DO PERSONAL

Acesse **Meu Perfil** no menu do usuário (canto superior do sidebar).

**Campos disponíveis:**
- Nome completo e foto de perfil
- Descrição/tagline profissional
- Biografia completa
- Especialidades e formação
- Links de redes sociais: Instagram, TikTok, YouTube, LinkedIn, Facebook, X (Twitter), website

Essas informações ficam visíveis para os alunos na aba **"Personal"** do app.

---

### 19. EXPORTAR RELATÓRIO PDF

Na página do aluno, clique em **"Exportar PDF"** (ou ícone de impressora). O relatório inclui:
- Dados do aluno e objetivo
- Histórico de avaliações com gráficos de evolução
- Badges conquistados
- Histórico de sessões recentes

---

### 20. ADMINISTRAÇÃO (SUPERADMIN)

Acesse **Admin** no menu (visível apenas para o administrador do sistema).

**Funcionalidades:**
- Listar todos os personals cadastrados
- Emitir token de impersonação para visualizar o portal como um personal específico
- Útil para suporte técnico

---

### 21. LINKS ÚTEIS NOS EXERCÍCIOS

Você pode vincular publicações do tipo **Recurso Educacional** (feitas no **Feed**) a exercícios, para que o aluno veja esse material de apoio direto na execução do treino.

**Como funciona a vinculação automática (biblioteca):**
1. Acesse **Biblioteca** ou edite um exercício na página do aluno
2. No campo **"Links Úteis"**, busque e selecione os Recursos Educacionais do feed que deseja associar àquele exercício
3. Todo treino que use um exercício com esse nome passa a exibir automaticamente esses recursos para o aluno

**Como personalizar por aluno:**
Na página do aluno, ao editar um exercício do treino:
- Em **"Recursos da biblioteca"**, desmarque os recursos que não quer exibir para aquele aluno específico (exclusão individual, sem afetar os outros alunos)
- Em **"Links Úteis"**, adicione recursos extras só para aquele aluno, além dos vindos da biblioteca

O aluno vê os recursos vinculados tocando no ícone de livro ao lado do exercício, durante a sessão de treino.

---

### 22. FINANCEIRO DOS ALUNOS (MENSALIDADES E COBRANÇAS)

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

**Criar cobrança avulsa:** Clique em **"Nova cobrança"** e preencha valor e vencimento, sem precisar configurar faturamento recorrente.

**Registrar pagamento manualmente:** Na cobrança pendente/vencida, clique em **"Pagar"** (ícone de pagamento) e confirme os dados.

**Cancelar cobrança:** Disponível no card da cobrança, com confirmação.

**Filtros:** Todas, Pendentes, Vencidas, Pagas.

#### Pagamento via Pix (Mercado Pago)

Se você configurar a integração com o Mercado Pago (ver **Configurações → Pagamentos**), o aluno pode pagar a mensalidade via Pix direto pelo app dele, sem precisar de pagamento manual. O sistema confirma o pagamento automaticamente assim que o Mercado Pago notifica.

**Como configurar:**
1. Acesse **Configurações** → aba **"Pagamentos"**
2. Informe o **Access Token** da sua conta Mercado Pago (clique no ícone de informação para ver o passo a passo de como obter)
3. Salve

Sem o token configurado, a gestão financeira continua funcionando normalmente — o aluno só não terá a opção de pagar via Pix, e os pagamentos seguem sendo manuais.

> Pagamentos via Pix pelo Mercado Pago podem ter taxa de processamento cobrada pelo próprio Mercado Pago.

---

### 23. ASSINATURA DA PLATAFORMA (PLANO)

Esta é a assinatura do **seu** acesso ao CoachPilot — diferente do Financeiro dos alunos (seção anterior), que é a cobrança que você faz aos seus alunos.

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
- Se a assinatura Gestão Pro vencer, os alunos que excederem o limite de 3 ficam marcados como **"Bloqueado"** na lista de Alunos — você não consegue mais abrir o perfil deles até renovar
- Um banner no topo do portal avisa quando o plano está no grátis, quando a assinatura Pro está perto de vencer (7 dias ou menos) ou quando já venceu

**Add-ons:** Canal WhatsApp e Assistente IA são contratados separadamente da gestão de alunos. A página **Plano** mostra se cada um está ativo na sua conta.

**Histórico de pagamentos:** Na página **Plano**, a seção "Histórico de pagamentos" lista todos os pagamentos do Gestão Pro confirmados via Pix (ou concedidos manualmente pelo suporte), com data, dias concedidos e validade resultante.

---

## PERGUNTAS FREQUENTES (FAQ)

**P: Como faço para que o aluno acesse o app?**
R: Na página do aluno, clique em "Gerar Link" ou "Enviar via WhatsApp". O aluno recebe o link no WhatsApp e acessa sem precisar criar conta.

**P: O aluno precisa instalar algo?**
R: Não. O app do aluno é um PWA (Progressive Web App). Ele abre direto no navegador do celular. Opcionalmente, o aluno pode "instalar" na tela inicial pelo ícone de download, mas não é obrigatório.

**P: Como funciona o agente de IA no WhatsApp?**
R: Após configurar a integração W-API, o aluno pode enviar mensagens ao número do WhatsApp cadastrado. O agente entende contexto de treino, registra séries, responde dúvidas e alerta o personal quando necessário.

**P: O aluno pode ter mais de um treino ativo?**
R: Sim. Você pode criar vários treinos para o mesmo aluno com datas de início/fim diferentes. O treino "ativo" é o que está dentro da vigência.

**P: Como funciona o streak?**
R: Streak conta semanas seguidas em que o aluno treinou pelo menos uma vez. Ele aumenta o multiplicador de pontos do aluno: 3–8 semanas = 2x, 9+ semanas = 3x pontos.

**P: O que acontece se o aluno não treinar uma semana?**
R: O streak zera e o multiplicador volta para 1x.

**P: Como exporto os dados dos alunos?**
R: Por enquanto, a exportação disponível é o relatório em PDF individual. Acesse a página do aluno e clique em "Exportar PDF".

**P: Posso ter mais de um número de WhatsApp conectado?**
R: Sim. Cada instância W-API corresponde a um número. Você pode conectar múltiplas instâncias, mas cada aluno é roteado pela instância do seu personal.

**P: Como funciona a comparação before/after?**
R: Vá até as avaliações do aluno, clique em "Comparar Fotos", selecione a foto mais antiga (antes) e a mais recente (depois). O sistema exibe as duas lado a lado em uma modal.

**P: Os alunos conseguem ver o ranking uns dos outros?**
R: Sim. O ranking é visível para todos os alunos do mesmo personal. Mostra nome, foto, pontuação e badges dos demais.

**P: Qual a diferença entre o Financeiro do aluno e a página Plano?**
R: Financeiro (aba na página do aluno) é a mensalidade que você cobra dos seus alunos. Plano (menu lateral) é a sua assinatura do CoachPilot — Trial grátis até 3 alunos ou Gestão Pro ilimitado.

**P: O que acontece com meus alunos se eu não renovar o Gestão Pro?**
R: Os alunos que excedem o limite de 3 ficam com o perfil bloqueado (você não consegue mais abri-lo) até a renovação. Os dados não são apagados.

**P: Sou obrigado a configurar o Mercado Pago para cobrar meus alunos?**
R: Não. Sem o Access Token configurado, você gerencia cobranças e pagamentos manualmente. O Mercado Pago só adiciona a opção de o aluno pagar via Pix sozinho.

---

## SUPORTE

Em caso de dúvidas não respondidas por este guia, entre em contato com o suporte via WhatsApp pelo link disponível na tela de configurações do portal.
