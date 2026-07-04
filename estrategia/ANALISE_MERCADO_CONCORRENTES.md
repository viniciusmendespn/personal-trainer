# Análise de Mercado e Concorrentes — CoachPilot

> **Data da pesquisa:** julho/2026. Preços e dados verificados nas fontes citadas (páginas oficiais
> de preço, App Store/Google Play, Reclame Aqui, imprensa especializada). Revisitar a cada 6 meses.
> Câmbio usado: US$ 1 = R$ 5,21.

---

## 1. O Mercado

### 1.1 Tamanho e crescimento (Brasil)

| Indicador | Valor | Fonte/ano |
|---|---|---|
| Academias no Brasil (CNPJs ativos) | **62.718** (2º maior do mundo, atrás só dos EUA) | Fitness Brasil, 2025 |
| Crescimento do nº de academias | Quase **3x em 10 anos** (22.581 em 2015 → 62.718 em 2025); projeção 70 mil até 2027 | Fitness Brasil |
| Faturamento do setor fitness BR | **R$ 8,6 bi** (2022, ACAD Brasil); projeção US$ 4,2 bi (2023) → **US$ 6,8 bi (2028)** | ACAD Brasil / Sebrae |
| População que frequenta academia | **>9%** da população brasileira | Sebrae/ACAD |
| Profissionais de Ed. Física registrados (CREF) | **~690 mil** | CONFEF/CREF, 2024-2025 |
| Atuando como personal trainers | **~100 mil** (crescimento de **+32,8%** entre 2022 e 2023) | Saúde Digital News, 2024 |
| Mercado global de software de gestão fitness | **US$ 1,2–2,2 bi (2025)**, CAGR 9–12% a.a.; fitness software amplo US$ 13,4 bi, CAGR 15,8% | Verified Market Reports / Cognitive MR, 2025 |

### 1.2 O cliente (personal trainer brasileiro)

| Indicador | Valor |
|---|---|
| Sessão avulsa | Média **R$ 100** (faixa R$ 70–150; capitais até R$ 200–300) |
| Consultoria online mensal | R$ 100–300/mês (premium R$ 300–400+) |
| Renda mensal | R$ 2.000–10.000; média R$ 4.000–5.000 com clientela fixa. Cauda longa: 26% ganham < R$ 1.000/mês |
| Carteira de alunos | 40% têm 1–5 clientes; agenda cheia = **20–30 alunos** |
| Fidelidade do aluno | **99,3%** dos alunos mantêm o mesmo personal (PersonalGO, 2025) — churn do personal é baixo; o risco é o personal largar a profissão, não trocar de personal |
| WhatsApp | **147 milhões de usuários** no Brasil; instalado em **99% dos smartphones**; 97% acessam diariamente |

**Leituras estratégicas:**

1. **O mercado comporta o modelo freemium do CoachPilot**: 40% dos personais têm ≤5 alunos
   (usariam o plano grátis de 3 alunos como porta de entrada), e o personal "de agenda cheia"
   (20–30 alunos) é exatamente a persona do Gestão Pro (premissa de 25 alunos do `CUSTO_ESCALA.md`).
2. **R$ 39,90/mês é <0,5% da renda média do personal com clientela** e equivale a menos de meia
   sessão avulsa. O argumento "1 aluno retido paga 3 meses de plataforma" é matematicamente forte.
3. **WhatsApp é o sistema operacional do brasileiro** — o add-on de canal WhatsApp + assistente IA
   ataca o canal onde aluno e personal já vivem. Nenhum concorrente faz isso (ver §3.4).
4. **TAM bottom-up (segmento personal):** 100 mil personais × ARPU R$ 65,37 × 12 = **R$ 78 mi/ano**.
   Com os ~690 mil profissionais CREF como teto de expansão (estúdios, professores de academia),
   o mercado endereçável total supera **R$ 500 mi/ano**.

---

## 2. Concorrentes Nacionais

### 2.1 MFIT Personal — o líder de mercado

| Dimensão | Dado |
|---|---|
| Preços | Grátis (1 aluno) · **R$ 10,90/mês (3 alunos)** · **R$ 39,90/mês (ilimitado)**; anual ~R$ 406,90 (≈R$ 33,90/mês). Trial 10 dias |
| Tração | 1M+ installs Google Play; **4,9★ com ~146 mil avaliações** na App Store BR; claim de "200 mil personais e 5 milhões de alunos" |
| IA | **Sim ("MFIT IA")**: gera treino revisável dentro do app, analisa anamneses, redige push, chat de suporte |
| Financeiro | "Carteira MFIT": aluno paga Pix/boleto/cartão in-app; Pix D+1 com **taxa de 2,59%** |
| Biblioteca | **1.800+ vídeos** demonstrativos |
| Agenda | Simples ("estilo Google Agenda") |
| Gamificação | **Não encontrada** (sem ranking, badges, streak) |
| WhatsApp | Sem integração real (só compartilhar link de anamnese) |
| Fraquezas (Reclame Aqui, nota 7,8) | Instabilidade/quedas do app; cobranças de renovação não autorizadas e reembolso difícil; suporte lento que "culpa o aparelho do usuário" |

**Como o CoachPilot ganha do MFIT:** mesmo preço no ilimitado (R$ 39,90), mas com gamificação
completa (ranking + badges + streak), assistente IA do aluno no WhatsApp (inexistente no MFIT),
financeiro PIX **sem taxa da plataforma** (personal usa o próprio Mercado Pago ~0,99% vs 2,59% da
Carteira MFIT), marketplace de pacotes de treino e operação por IA muito mais profunda (migração
em massa de alunos via planilha/PDF/print, pacotes ABC/ABCDE completos — a MFIT IA gera 1 treino
por vez dentro do app).

**Onde o MFIT ganha (ser honesto no discurso):** marca consolidada e prova social gigante; app
nativo nas lojas; 1.800 vídeos de exercício; plano intermediário de R$ 10,90 (degrau de preço que
o CoachPilot não tem — nosso free de 3 alunos cobre esse degrau, de graça).

### 2.2 Tecnofit Personal

| Dimensão | Dado |
|---|---|
| Preços | Grátis (**5 alunos** — reduzido de 10, gerou reclamação) · Performance "a partir de **R$ 24,90/mês**" no anual (~R$ 29,90 mensal), cobrado **somente via In-App Purchase** Google/Apple |
| Tração | 100k+ installs; 4,9★ com ~3,4 mil avaliações iOS (≈10x menor que MFIT) |
| IA | **Não tem no produto Personal** (a IA da Tecnofit — estruturar ficha a partir de texto — é só do sistema de academias, R$ 269+/mês) |
| Diferencial | Marketplace **"Encontre seu personal"** (perfil público para captar alunos) |
| Gamificação | Só ranking mensal |
| Fraquezas | Suporte ruim (resposta média **7d18h** no Reclame Aqui; reclamação literal "não há suporte para clientes do Tecnofit Personal"); aluno perde acesso ao trocar de personal; atrito de cobrança via IAP; downgrade do free tier |

**Como o CoachPilot ganha:** produto Personal é negócio secundário da Tecnofit (o core dela é
academia); sem IA, sem WhatsApp, financeiro fraco (registro/lembrete, sem recebimento), e a
cobrança via IAP encarece e trava o preço deles nas taxas de 15–30% da Apple/Google — nós cobramos
via PIX direto, sem loja no meio.

### 2.3 Nexur — o que cobra por faixa de alunos

Preços oficiais (aplicativonexur.com.br/planos): **R$ 19,90/mês (9 alunos)** · R$ 49,90 (25) ·
R$ 79,90 (50) · R$ 149,90 (100) · R$ 199,90 (150) · **R$ 249,90 (250)**. App próprio publicado:
+R$ 789/ano. Sem IA. 500+ exercícios, chat, ranking, financeiro.

**Ângulo de ataque:** o modelo por faixa **pune o crescimento do personal**. Um personal com 50
alunos paga R$ 79,90 na Nexur e R$ 39,90 no CoachPilot — e nunca muda de faixa. "Seu software não
deveria ganhar mais só porque você trabalhou mais."

### 2.4 Demais nacionais (faixa de referência)

| Player | Preço | Observação |
|---|---|---|
| TreinoAI | R$ 24,90/mês (5 alunos) → R$ 69,90 (15) | Aposta em educação sobre IA (TreinoAI Academy) |
| Mobitrainer | a partir de R$ 29,90/mês (10 alunos) | Genérico |
| Wiki4Fit | a partir de R$ 29/mês | Sem IA nativa confirmada |
| VFIT (ex-IA+Personal) | R$ 29,90–129,90/mês | IA gera treino para o aluno; claim 2.500 personais |
| PersonalGO | Freemium com anúncios | Diferencial: Body Scan (avaliação corporal por foto) |
| Tecnofit (academias), EVO/W12, Next Fit, Pacto | R$ 269+/mês ou sob consulta | Outro segmento (ERP de academia) — não competem pelo personal autônomo, mas mostram o teto do mercado: **Next Fit captou R$ 50 mi (Série A, mai/2025) com ARR de R$ 52 mi e 13 mil clientes** |

### 2.5 Síntese de preços do mercado BR (segmento personal)

- **Faixa de mercado:** R$ 10–250/mês; âncora em **R$ 25–80/mês** para carteiras de 25–50 alunos.
- **CoachPilot (R$ 39,90 ilimitado)** fica exatamente na mediana do mercado com a proposta mais
  agressiva de limite (ilimitado desde o primeiro real pago) — só o MFIT iguala isso no preço.
- Ninguém no Brasil cobra IA como add-on separado; a IA embutida virou feature de retenção do
  plano pago. O CoachPilot segue o padrão (operação por IA grátis) e **monetiza a IA onde ninguém
  tem produto: no WhatsApp do aluno** (R$ 4,90/aluno/mês).

---

## 3. Concorrentes Internacionais (referência e ameaça futura)

| | Hevy Coach | ABC Trainerize | TrueCoach | Everfit |
|---|---|---|---|---|
| Preço entrada | US$ 25/mês (~R$ 130, 10 alunos) | Grátis (1 aluno) / US$ 9 → US$ 248 | US$ 26,34/mês (5 alunos) → US$ 136,99 (50) | Grátis (5) / US$ 19 → US$ 430 |
| Preço em BRL / Pix | ❌ (USD via Paddle) | ❌ | ❌ | ❌ |
| App do aluno em PT | ✅ (app Hevy, popular no BR) | ❌ (pedido aberto há anos no fórum) | ❌ (inglês-only oficial) | ❌ (ES/DE/IT/NL/FR; PT ausente) |
| Painel do coach em PT | ❌ | ❌ | ❌ | ❌ |
| Cobrança de alunos no BR | ❌ (não tem) | ⚠️ Stripe add-on +US$ 10, BR não confirmado, sem Pix | ❌ (só US/UK/AU/CA) | ❌ (17 países, BR fora) |
| IA | ❌ (no coach) | ✅ AI Workout Builder | ⚠️ AI Builder (detalhes opacos) | ✅ AI Builder (texto→treino) |
| WhatsApp | ❌ | ❌ | ❌ | ❌ |
| Gamificação | Social do Hevy | Desafios | ~Nenhuma | Leaderboards |

**Conclusões:**

1. **Nenhum internacional tem**: preço em BRL, Pix, português no painel, ou WhatsApp. A barreira
   de localização protege o mercado brasileiro por ora — players locais dominam.
2. **Maior ameaça futura:** Hevy Coach (o app consumer Hevy já é popular entre alunos brasileiros
   e está em PT-BR) e Everfit (cadência agressiva de localização em 2026 — PT-BR é questão de tempo).
3. **Validação de preço:** os players US cobram 5–10x mais em dólar pela mesma carteira de alunos.
   Há espaço para o CoachPilot subir preço com o tempo (o preço "de tabela" R$ 69,90 já ancora isso).

---

## 4. Panorama de IA no segmento (o campo de batalha de 2026)

- **Geração de treino por IA dentro do app já é commodity emergente**: MFIT tem, Trainerize e
  Everfit têm (em beta, incluso no plano pago). Tecnofit e Nextfit têm versões fracas.
- **Gap verificado e não ocupado por ninguém (BR ou global): assistente de IA para o ALUNO via
  WhatsApp, com contexto do treino real prescrito** (o que o CoachPilot vende a R$ 4,90/aluno/mês).
  O que existe são chatbots comerciais genéricos para academias (vendas/agendamento), nenhum
  integrado ao programa de treino do aluno. **Este é o diferencial mais defensável do CoachPilot.**
- **Gap secundário: importação/migração em massa via IA** (alunos de planilha/PDF/print, pacotes
  ABC/ABCDE completos). Os "AI builders" dos concorrentes geram 1 treino por vez; nenhum resolve a
  migração — que é exatamente a maior fricção para trocar de software. **A operação por IA do
  CoachPilot é, além de diferencial, uma arma de switching cost reverso** (facilita sair do MFIT).
- **Pressão indireta:** o aluno tem acesso a apps consumer de IA (Fitbod ~US$ 80/ano, Freeletics,
  Zing) e ao ChatGPT grátis. Narrativa de defesa do setor (usar a favor do CoachPilot): "IA sem
  validação de um profissional CREF gera treino genérico e risco" — o CoachPilot posiciona a IA
  como **multiplicador do personal**, nunca como substituto.
- **Regulatório:** não há norma CONFEF/CREF sobre IA (até jul/2026). O CFM já regulou IA na
  medicina (Res. 2.454/2026) — provável precedente. O posicionamento "a IA gera, o personal revisa
  e aprova" já deixa o CoachPilot do lado certo de qualquer regulação futura.

---

## 5. Matriz competitiva resumida

| Funcionalidade | CoachPilot | MFIT | Tecnofit Personal | Nexur | Internacionais |
|---|---|---|---|---|---|
| Preço ilimitado | R$ 39,90 | R$ 39,90 | ~R$ 29,90* | ❌ (por faixa, até R$ 249,90) | 5–10x mais caro |
| IA para gerar treino | ✅ (via ChatGPT próprio, grátis) | ✅ (in-app) | ❌ | ❌ | ✅ (Trainerize/Everfit) |
| Migração em massa via IA | ✅ **único** | ❌ | ❌ | ❌ | ❌ |
| IA do aluno no WhatsApp | ✅ **único no mundo (verificado)** | ❌ | ❌ | ❌ | ❌ |
| Lembretes via WhatsApp | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gamificação (ranking+badges+streak) | ✅ | ❌ | ⚠️ só ranking | ⚠️ ranking | ⚠️ parcial |
| Financeiro com Pix | ✅ (MP do personal, ~0,99%) | ✅ (Carteira, 2,59%) | ⚠️ registro | ✅ | ❌ |
| Marketplace de pacotes de treino | ✅ **único** (loja .cpkg licenciados) | ❌ | ⚠️ (de personais, não de conteúdo) | ❌ | ❌ |
| App do aluno | ✅ PWA (sem loja) | ✅ nativo | ✅ nativo | ✅ | ✅ |
| Relatórios PDF / avaliações / anamnese | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| Biblioteca de vídeos de exercício | ⚠️ (recursos educacionais próprios + links) | ✅ 1.800+ | ✅ 600+ | ✅ 500+ | ✅ |

\* Tecnofit Performance ~R$ 24,90–29,90 mas via IAP e com produto inferior (sem IA, sem WhatsApp, suporte ruim).

## 6. SWOT do CoachPilot

**Forças:** único com IA do aluno no WhatsApp; operação por IA mais profunda do mercado (migração
em massa = destrava troca de software); gamificação completa; marketplace de conteúdo licenciado
único; alunos ilimitados a R$ 39,90; PIX direto sem taxa de plataforma nem IAP; custo de infra
marginal ~R$ 0,70/personal (margem 61%+, escala sem gargalo); financeiro do aluno integrado.

**Fraquezas:** marca desconhecida vs 146 mil avaliações do MFIT; sem app nas lojas (PWA exige
educação do usuário — Tecnofit/MFIT usam a presença na loja como canal de aquisição); biblioteca
de vídeos menor que MFIT/Tecnofit; sem prova social real (depoimentos atuais são ilustrativos);
time de 1 fundador (risco-chave para investidor); programa de divulgadores ainda operado manualmente.

**Oportunidades:** 100 mil personais (+33%/ano) e só ~1 player relevante bem servido de IA; gap
mundial do assistente WhatsApp; Everfit/Hevy ainda sem PT completo (janela de 12–24 meses);
mercado de academias dobrou de tamanho e puxa demanda por personal; marketplace .cpkg pode virar
efeito de rede (conteúdo atrai personal, personal cria conteúdo).

**Ameaças:** MFIT copiar o assistente WhatsApp (mitigação: velocidade + profundidade do vínculo
treino↔dado, difícil replicar sobre a arquitetura deles); entrada localizada de Everfit/Hevy;
guerra de preço (MFIT tem escala para subsidiar); dependência de W-API (não-oficial) para WhatsApp;
regulação futura de IA por conselhos profissionais.

---

*Fontes principais: mfitpersonal.com.br/pages/assinaturas.html · tecnofit.com.br/solucoes-tecnofit-personal ·
aplicativonexur.com.br/planos · trainerize.com/pricing · truecoach.co/pricing · everfit.io/pricing ·
hevycoach.com/pricing · App Store/Google Play BR · Reclame Aqui · ACAD Brasil/Sebrae · Fitness Brasil ·
CONFEF/CREF · Opinion Box (WhatsApp) · startups.com.br (Next Fit) · SaaS Capital · Anjos do Brasil.*
