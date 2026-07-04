# Plano de Negócio — CoachPilot

> Documento-mestre do negócio. Consolida visão, mercado, produto, modelo de receita, go-to-market,
> operação, finanças e riscos. Detalhes de execução nos documentos irmãos:
> `ANALISE_MERCADO_CONCORRENTES.md` (mercado), `PITCH_VENDAS.md` (comercial),
> `PLANO_BOOTSTRAP.md` (execução sem aporte), `PITCH_INVESTIDORES.md` (com aporte),
> `PARCERIAS_CANAIS.md` (canais) e `../CUSTO_ESCALA.md` (modelo financeiro unitário).
> Elaborado em jul/2026. Status do negócio: produto em produção, fase de aquisição dos primeiros
> clientes pagantes.

---

## 1. Sumário executivo

O **CoachPilot** é um SaaS brasileiro de gestão para personal trainers: alunos, treinos, agenda,
avaliações físicas, evolução, financeiro e engajamento do aluno — com dois diferenciais que nenhum
concorrente possui (verificado em pesquisa de jul/2026): **operação por linguagem natural**
(o personal monta e migra treinos conversando com o próprio ChatGPT/Claude/Gemini e importa com 1
clique) e **assistente de IA do aluno via WhatsApp** com contexto do treino real prescrito.

- **Modelo:** freemium (grátis até 3 alunos) → **Gestão Pro R$ 39,90/mês** (alunos ilimitados) →
  add-ons Canal WhatsApp (+R$ 29,90/mês) e Assistente IA (+R$ 4,90/aluno/mês). ARPU projetado
  **R$ 65,37/mês**; margem de contribuição **61%**.
- **Mercado:** ~100 mil personal trainers ativos no Brasil (+33% a.a.), dentro de um setor fitness
  de R$ 8,6 bi que tem no país o 2º maior parque de academias do mundo. TAM bottom-up do segmento:
  ~R$ 78 mi/ano.
- **Economics:** break-even com **4 clientes Pro**; custo de infra marginal de ~R$ 0,70/personal/mês
  (serverless AWS); lucro líquido projetado de ~R$ 14 mil/mês com 500 assinantes Pro.
- **Estágio:** produto completo em produção (portal, app do aluno PWA, loja de pacotes, agente
  WhatsApp, financeiro PIX), primeiros usuários conhecidos, zero clientes pagantes — pré-receita.
- **Caminhos de crescimento:** orgânico/bootstrap (caixa positivo desde ~o mês 2, meta 100 Pro em
  12–18 meses) ou acelerado com aporte de **R$ 500 mil** (meta 1.500–2.000 Pro em 24 meses).

---

## 2. O problema e a solução

### 2.1 Problema

O personal trainer brasileiro médio gerencia 5–30 alunos com **planilha + papel + WhatsApp
manual**. Consequências: horas semanais digitando treino série a série; informação espalhada
(ficha num lugar, fotos noutro, conversa perdida no chat); aluno sem visibilidade de evolução
desengaja e cancela; renovações esquecidas viram receita perdida; dúvidas de treino chegam a
qualquer hora e exigem resposta manual; imagem amadora para um serviço que custa R$ 70–300/sessão.

### 2.2 Solução

Uma plataforma única onde:

1. **O trabalho braçal vira conversa** — a IA (do próprio personal, grátis) gera treinos, pacotes
   ABC/ABCDE e migrações em massa; o personal revisa e importa com 1 clique.
2. **O aluno tem um app** (PWA, sem loja) com treino do dia, sessão guiada, evolução, ranking,
   conquistas, streak e notificações — engajamento que retém o aluno e, portanto, o personal.
3. **Nada se perde** — todo dado (carga, foto, vídeo, dor, pagamento) nasce vinculado a
   aluno+treino+exercício; relato de dor alerta o personal na hora.
4. **O WhatsApp trabalha a favor** — lembretes automáticos e, como add-on, um assistente IA que
   atende o aluno 24h sabendo exatamente qual treino ele está executando.
5. **O dinheiro flui** — cobrança dos alunos via PIX direto na conta do personal (Mercado Pago
   dele, sem taxa da plataforma).

### 2.3 Por que agora

- IA generativa acabou de virar commodity acessível — e o mercado fitness BR começou a adotá-la
  (o líder MFIT lançou IA em 2025/26); a janela para se posicionar como "a plataforma IA-nativa"
  é curta.
- Mercado de personal trainers cresceu 33% em um ano; academias quase triplicaram em 10 anos.
- Internacionais (Everfit, Hevy) ainda não localizaram para PT-BR/Pix — janela de 12–24 meses.

---

## 3. Produto (estado atual — tudo em produção)

| Módulo | Status |
|---|---|
| Portal do personal (dashboard, alunos, treinos, templates, rotinas, agenda, avaliações, anamnese, financeiro, biblioteca, feed, ranking, pendências, perfil público, relatórios PDF) | ✅ no ar |
| App do aluno (PWA `app.coachpilot.com.br`): treino do dia, sessão ativa, evolução, histórico, feed, chat IA, conquistas, push | ✅ no ar |
| Operação por IA (prompts prontos + import 1-clique: pacotes, migração em massa, update de programa) | ✅ no ar |
| Assistente IA do aluno (WhatsApp/chat, contexto de treino, registro por conversa, alerta de dor, rate-limited) | ✅ no ar |
| Loja de pacotes (`loja.coachpilot.com.br`): anúncios, checkout PIX, avaliações ★, pacotes licenciados .cpkg com token de uso único | ✅ no ar |
| Financeiro do aluno (cobranças recorrentes/avulsas, PIX via MP do personal) | ✅ no ar |
| Assinatura da plataforma (trial 3 alunos sem prazo, upgrade Pro via PIX, promo codes/indicação) | ✅ no ar |
| Landing + 11 páginas SEO + página de divulgadores | ✅ no ar |
| Infra: AWS serverless (Lambda arm64, DynamoDB single-table sem Scan, S3+CloudFront, Cognito), custo isolado por tag | ✅ |

**Roadmap de produto orientado a vendas (prioridade):**

1. **Painel do divulgador** (hoje o programa é manual via WhatsApp/cupom) — necessário antes de
   escalar o canal nº 1 de aquisição.
2. **Biblioteca de vídeos de exercícios ampliada** — maior gap objetivo vs MFIT (1.800 vídeos);
   caminho: parceria de conteúdo ou geração assistida + biblioteca gratuita já existente.
3. **Assinatura recorrente automática** (hoje renovação = novo PIX) — reduz churn involuntário.
4. **Lifecycle S3** (obrigatório antes de 100 personais — risco de custo, ver CUSTO_ESCALA §A.4.5).
5. Onboarding guiado in-app (wizard primeiro-aluno-em-5-minutos) — hoje a ativação depende de
   acompanhamento manual.

---

## 4. Mercado e posicionamento

Resumo (análise completa em `ANALISE_MERCADO_CONCORRENTES.md`):

- **TAM** (personais BR): 100 mil × R$ 65,37 × 12 ≈ **R$ 78 mi/ano** — teto de expansão para
  ~690 mil profissionais CREF (estúdios/professores) > R$ 500 mi/ano.
- **SAM** (personais digitalizáveis, com 5+ alunos e presença digital): ~40–50 mil → R$ 31–39 mi/ano.
- **SOM 36 meses:** 2.000–5.000 Pro (2–5% do SAM) → **R$ 1,6–3,9 mi/ano** de receita.
- **Concorrente-alvo:** MFIT (líder, R$ 39,90 ilimitado, IA in-app, sem gamificação/WhatsApp/loja).
  Posicionamento do CoachPilot: **"a plataforma IA-nativa que engaja o aluno"** — não brigar por
  preço, brigar por categoria (IA profunda + WhatsApp + gamificação + marketplace).
- **Cunha de entrada:** migração assistida por IA — a maior fricção do mercado (trocar de app) é
  exatamente o que o produto faz melhor.

---

## 5. Modelo de receita e economics unitários

(Fonte: `CUSTO_ESCALA.md` — resumo.)

| Métrica | Valor |
|---|---|
| ARPU (Pro + adoção parcial de add-ons) | **R$ 65,37/mês** |
| Custo variável/personal | ~R$ 25,50/mês (LLM + W-API + AWS + pagamento) |
| Margem de contribuição | **R$ 39,87/mês (61%)** |
| Lucro líquido por escala | 25 Pro ≈ R$ 750/mês · 100 Pro ≈ R$ 3.100/mês · 500 Pro ≈ R$ 12–14 mil/mês |
| Break-even | **4 clientes Pro** (custos fixos ~R$ 120/mês) |
| LTV (18 meses de vida média) | **R$ 1.176** · LTV líquido via divulgador R$ 982 |
| CAC alvo | Divulgador: R$ 10,77/mês recorrente (≈R$ 194 em 18m) · Mídia paga: R$ 150–500 único |
| LTV/CAC | **> 3** em ambos os canais (saudável para SaaS SMB) |
| Churn de referência (benchmark SaaS SMB) | 3–5%/mês — premissa de planejamento: 4%/mês, mitigado por gamificação do aluno (o app do aluno cria custo de troca para o personal) |

**Lógica central do modelo:** o lucro vem do Gestão Pro; os add-ons (WhatsApp/IA) são
diferenciais de retenção precificados para se pagarem (contribuição líquida ≈ neutra). **A métrica
que governa tudo é o número de assinantes Pro ativos.**

---

## 6. Go-to-market

### 6.1 Canais (por ordem de prioridade)

1. **Divulgadores (comissão recorrente 25–35%)** — canal principal. Personais influentes,
   professores e donos de estúdio vendendo para os pares. CAC recorrente ~R$ 10,77/mês, sem caixa
   antecipado — ideal para bootstrap. Requisito: construir o painel do divulgador.
2. **Indique e Ganhe (viral loop)** — 30 dias grátis para os dois lados; já implementado.
3. **Conteúdo orgânico + SEO** — Instagram (@coachpilotoficial) com demonstrações da IA em vídeo
   (o momento "ChatGPT montou o ABCDE em 2 min" é inerentemente viral); 11 páginas SEO já no ar
   ("software para personal trainer" etc.).
4. **Parcerias B2B2C** — cursos de educação física, certificações, estúdios, influencers fitness
   (detalhado em `PARCERIAS_CANAIS.md`).
5. **Mídia paga** — só após validar conversão orgânica (fase com aporte): Meta Ads segmentado em
   interesse "personal trainer/CREF", CAC alvo ≤ R$ 300.
6. **Loja de pacotes como aquisição** — pacotes gratuitos de qualidade atraem personais para
   dentro da plataforma (conteúdo → cadastro → ativação).

### 6.2 Motion de conversão

Free (3 alunos, sem prazo) → gatilho natural de upgrade no 4º aluno → migração assistida por IA
como momento "uau" → add-ons oferecidos após 30 dias de uso (quando o hábito existe). Meta de
conversão free→paid: 25–33% (premissa do CUSTO_ESCALA: ~3 free por 1 Pro).

---

## 7. Operação

- **Time atual:** 1 fundador (produto, eng., marketing, vendas). Custo fixo operacional ~R$ 120/mês.
- **Suporte:** WhatsApp + central de ajuda in-app (`ajuda-portal.md` / `ajuda-aluno.md`).
- **Estrutura legal:** MEI até R$ 81 mil/ano de faturamento → migrar para Simples Nacional
  (consultar contador sobre Anexo III vs V; distribuição de lucros isenta de IR).
- **Fornecedores críticos:** AWS (infra), OpenAI/Anthropic/Google (LLM do agente), W-API
  (WhatsApp não-oficial — risco, ver §9), Mercado Pago (PIX).
- **Compliance:** LGPD — dados de saúde de alunos (anamnese) exigem cuidado: base legal, termo de
  consentimento no onboarding do aluno, e política de privacidade publicada. **Pendência a
  resolver antes de escala** (adicionar ao roadmap).

---

## 8. Metas e marcos (visão consolidada)

| Horizonte | Sem aporte (bootstrap) | Com aporte (R$ 500 mil) |
|---|---|---|
| 6 meses | 25 Pro · MRR R$ 1,6 mil | 150 Pro · MRR R$ 9,8 mil |
| 12 meses | 60 Pro · MRR R$ 3,9 mil | 500 Pro · MRR R$ 33 mil |
| 18 meses | 100 Pro · MRR R$ 6,5 mil | 1.000 Pro · MRR R$ 65 mil |
| 24 meses | 150–200 Pro · MRR R$ 10–13 mil | 1.500–2.000 Pro · MRR R$ 98–131 mil (ARR R$ 1,2–1,6 mi) |

(Execução detalhada: `PLANO_BOOTSTRAP.md` e `PITCH_INVESTIDORES.md`.)

---

## 9. Riscos e mitigações

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| MFIT copia o assistente WhatsApp | Média | Alto | Velocidade; aprofundar vínculo dado↔treino (difícil sobre app legado); travar personais com loja/conteúdo (efeito de rede) |
| Dependência W-API (WhatsApp não-oficial, risco de bloqueio) | Média | Alto | Plano B: WhatsApp Business API oficial (Meta) — custo maior, repassar no add-on; o produto funciona 100% sem WhatsApp (push do PWA) |
| Churn alto de SMB (3–5%/mês) | Alta | Médio | Gamificação do aluno = custo de troca; add-ons aumentam stickiness; cobrança anual com desconto (criar) |
| Custo LLM sobe / uso explode | Baixa | Médio | Rate limit 10 msg/aluno/min já limita teto; prompt caching (-25–30%); repactuar preço do add-on |
| Fundador único (bus factor) | — | Alto | Documentação extensa já existente; com aporte, contratar dev nº 2 cedo |
| LGPD / dados de saúde | Média | Médio | Termo de consentimento + política de privacidade + DPO designado (fundador) — fazer antes de 100 personais |
| Regulação de IA (CONFEF/CREF) | Baixa | Baixo | Fluxo "IA gera, personal CREF revisa e aprova" já é o desenho compliant |
| S3 cresce sem lifecycle | Certa (com escala) | Baixo | Implementar lifecycle antes de 100 personais (já mapeado) |

---

## 10. Teses que sustentam o negócio (para revisitar a cada trimestre)

1. O personal paga R$ 39,90 se o produto lhe devolver ≥ 2h/semana e retiver ≥ 1 aluno/trimestre.
2. O canal de divulgadores converte pares melhor e mais barato que mídia paga (validar com 10
   divulgadores ativos antes de investir em ads).
3. A gamificação do aluno reduz churn do personal (medir: churn de personais cujos alunos usam
   ranking vs não usam).
4. O assistente WhatsApp é percebido como mágico o suficiente para justificar +R$ 4,90/aluno
   (validar adoção ≥ 25% dos Pro em 6 meses).
5. A loja .cpkg cria efeito de rede (validar: ≥ 10% dos Pro publicam ou compram pacote no 1º ano).
