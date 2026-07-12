# Pitch para Investidores — CoachPilot

> Roteiro completo de apresentação (estrutura de deck, slide a slide, com narrativa) + memória de
> cálculo do valuation e do uso do aporte. Rodada-alvo: **anjo/pré-seed de R$ 500 mil por 10%**
> (post-money R$ 5 mi). Elaborado em jul/2026, estágio pré-receita com produto completo em produção.
> Números de mercado com fontes em `ANALISE_MERCADO_CONCORRENTES.md`; economics em `CUSTO_ESCALA.md`.

---

## Slide 1 — Abertura

> **CoachPilot — o copiloto de IA do personal trainer brasileiro.**
> O personal monta treinos conversando com a IA, o aluno é atendido por IA no WhatsApp,
> e nenhum dado do aluno se perde.

*Narrativa de 20 segundos:* "Existem 100 mil personal trainers no Brasil gerenciando alunos com
planilha e WhatsApp manual. Nós transformamos esse trabalho braçal em conversa com IA — e somos a
única plataforma do mundo, até onde a pesquisa competitiva alcança, com um assistente de IA que
atende o aluno no WhatsApp sabendo exatamente qual treino ele está fazendo."

---

## Slide 2 — O problema

- O personal médio perde **horas por semana digitando treino série a série** e respondendo dúvidas
  repetidas de alunos a qualquer hora no WhatsApp.
- A informação vive espalhada: ficha na planilha, fotos no celular, conversa perdida no chat.
- Aluno sem visibilidade de evolução **desengaja e cancela** — e a renovação esquecida vira receita
  perdida para um profissional que fatura R$ 4–5 mil/mês.
- As ferramentas atuais digitalizaram a planilha, mas **não eliminaram a digitação nem atenderam o
  aluno** — o líder de mercado (MFIT) não tem gamificação nem WhatsApp.

## Slide 3 — A solução (demo ao vivo — 3 momentos)

1. **Operação por IA (grátis):** o personal fala com o próprio ChatGPT — "monte um ABCDE de
   hipertrofia para o João" ou "migre esta planilha de 30 alunos" — e importa tudo com 1 clique.
   *(Fazer ao vivo: leva 2 minutos e é o momento "uau".)*
2. **App do aluno (PWA):** treino do dia, sessão guiada, evolução, ranking, conquistas, streak —
   o aluno engajado é o motivo pelo qual o personal não cancela.
3. **Assistente IA no WhatsApp (add-on):** o aluno pergunta "quanto de carga no supino hoje?" e a
   IA responde com o contexto do treino real, registra a execução e **alerta o personal se o aluno
   relatar dor**.

## Slide 4 — Por que agora

- IA generativa virou commodity em 2024–26; o mercado fitness BR começou a adotá-la agora — a
  categoria "plataforma IA-nativa" ainda está vaga.
- Personal trainers em atividade cresceram **+32,8% em um ano** (~100 mil hoje).
- Brasil = **2º maior parque de academias do mundo** (62,7 mil CNPJs, quase 3x em 10 anos), setor
  de R$ 8,6 bi caminhando para US$ 6,8 bi em 2028.
- Concorrentes internacionais (Everfit, Hevy Coach) ainda não localizaram PT-BR/Pix — janela de
  12–24 meses para consolidar marca antes da entrada deles.

## Slide 5 — Mercado (TAM / SAM / SOM)

| Camada | Base | Valor |
|---|---|---|
| **TAM** | 100 mil personais ativos BR × ARPU R$ 65,37 × 12 (teto: 690 mil profissionais CREF) | **R$ 78 mi/ano** (teto > R$ 500 mi) |
| **SAM** | 40–50 mil personais digitalizáveis (5+ alunos, presença digital) | **R$ 31–39 mi/ano** |
| **SOM (36 meses)** | 2.000–5.000 assinantes Pro (2–5% do SAM) | **R$ 1,6–3,9 mi/ano** |

*Validação de que o segmento paga:* MFIT declara **200 mil personais** na base (146 mil avaliações
na App Store) cobrando os mesmos R$ 39,90; Next Fit (ERP fitness) chegou a **ARR de R$ 52 mi** e
captou **R$ 50 mi de Série A em 2025**.

## Slide 6 — Produto e diferenciais (vs. concorrência)

| | CoachPilot | MFIT (líder) | Tecnofit Personal | Internacionais |
|---|---|---|---|---|
| IA gera treino | ✅ | ✅ | ❌ | ✅ (2 de 4) |
| **Migração em massa via IA** | ✅ único | ❌ | ❌ | ❌ |
| **IA do aluno no WhatsApp** | ✅ único | ❌ | ❌ | ❌ |
| Gamificação completa | ✅ | ❌ | parcial | parcial |
| Marketplace de treinos licenciados | ✅ único | ❌ | ❌ | ❌ |
| Pix sem taxa da plataforma | ✅ | 2,59% | via IAP | sem Pix |
| Português + preço em R$ | ✅ | ✅ | ✅ | ❌ |

*Produto 100% em produção:* portal, app do aluno, loja/marketplace, agente WhatsApp, financeiro
PIX, landing com SEO. Não é protótipo — **o aporte não compra desenvolvimento, compra distribuição**.

## Slide 7 — Modelo de negócio

- Freemium: grátis até 3 alunos → **Gestão Pro R$ 39,90/mês** (ilimitado) → add-ons: Canal
  WhatsApp +R$ 29,90/mês · Assistente IA +R$ 4,90/aluno/mês.
- **ARPU R$ 65,37 (com add-ons) · margem de contribuição sobre o Gestão Pro de 66% (cliente
  via divulgador a 30%) a 96% (direto) · break-even com 4–5 clientes.**
- Infra serverless com custo marginal de **~R$ 1,00/cliente/mês** (premissa pessimista de uso
  intenso) — menos de 3% da receita do plano; escala validada em arquitetura até 1.000+ personais.
- LTV (18 meses) R$ 718 só no Gestão Pro (R$ 1.176 com add-ons) · CAC via divulgadores ~R$ 215
  (18m) · **LTV/CAC ≥ 3** já no modelo atual.
- Canal proprietário: **programa de divulgadores com comissão recorrente (20–35%)** — personais
  vendendo para pares, CAC 100% variável, sem queima de caixa antecipada.

## Slide 8 — Tração e estágio (transparência total)

- Produto completo em produção (12+ módulos), custo de reprodução estimado ≥ R$ 700 mil em
  desenvolvimento contratado.
- Fase atual: lançamento — primeiros usuários (personais conhecidos) ativos na plataforma,
  **+500 alunos gerenciados**, zero pagantes ainda. Landing, SEO e Instagram no ar.
- Modelo financeiro unitário completo e conservador (documento público no repositório), com três
  cenários auditáveis.
- *Postura na sala:* não vendemos tração que não temos; vendemos **um produto pronto com economics
  provados no modelo e o mapa exato de onde cada real do aporte vira cliente.*

## Slide 9 — Projeções com o aporte (24 meses)

Premissas: conversão free→Pro 30% · churn 4%/mês · 40% das vendas via divulgadores ·
CAC misto ≤ R$ 250 · adoção de add-ons conforme `CUSTO_ESCALA.md` (WA 45–50%, IA 35–40%).

| Marco | M6 | M12 | M18 | M24 |
|---|---|---|---|---|
| Assinantes Pro | 150 | 500 | 1.000 | **1.500–2.000** |
| MRR | R$ 9,8 mil | R$ 33 mil | R$ 65 mil | **R$ 98–131 mil** |
| ARR | R$ 118 mil | R$ 392 mil | R$ 784 mil | **R$ 1,2–1,6 mi** |
| Resultado operacional | −R$ 12 mil/mês (investindo) | ~neutro | +R$ 20 mil/mês | +R$ 35–50 mil/mês |

- O negócio **atinge o break-even operacional ~M12** mesmo mantendo o investimento em aquisição —
  a queima é decisão, não necessidade (margem de 66–96% sobre o plano desde o 1º cliente).
- **M24 → gatilho da rodada seed:** ARR R$ 1,2–1,6 mi × múltiplo 5–8x (benchmark SaaS BR early:
  SaaS Capital 4,8–5,3x privado; seed BR R$ 10–30 mi) = **valuation R$ 6–13 mi** — step-up de
  1,2–2,6x sobre o post-money desta rodada, com opção de seguir lucrativo sem nova rodada
  (o "duplo caminho" reduz o risco do investidor).

## Slide 10 — O pedido: R$ 500 mil por 10%

### Valuation — memória de cálculo (pre-money R$ 4,5 mi)

| Método | Resultado |
|---|---|
| **Custo de reposição do ativo** | Produto (portal + PWA + marketplace + agente IA + financeiro): 18–24 meses de squad mínimo (2 devs + PM/design) ≈ **R$ 700 mil–1,2 mi** |
| **Berkus adaptado BR** (ideia validada + protótipo funcional em produção + qualidade de execução + relacionamentos/canal + produto lançado) | 5 fatores × R$ 750 mil–1 mi (cap) ≈ **R$ 3,5–5 mi** |
| **Benchmark de mercado** | Rodadas anjo BR: R$ 400–800 mil (Anjos do Brasil: R$ 919 mi investidos em 2025, ticket médio R$ 114 mil/anjo); pre-money pré-tração tipicamente **R$ 3–6 mi** (seed com tração: R$ 10–30 mi — Bossa Invest) |
| **Sanidade vs projeção** | Post R$ 5 mi = 3–4x o ARR projetado de M24 — dentro da banda 3–8x de SaaS BR early |

**Estrutura sugerida:** mútuo conversível (instrumento padrão anjo BR) com cap de R$ 5 mi e
desconto de 20% na próxima rodada — evita discussão de valuation exato pré-receita e protege ambos.
Aceitável também equity direto: 10% post-money.

### Uso do aporte (runway de 24 meses)

| Destino | % | R$ | Detalhe |
|---|---|---|---|
| **Crescimento (mídia + conteúdo + eventos)** | 40% | R$ 200 mil | Meta Ads com CAC ≤ R$ 300; produção de vídeo; stands em feiras fitness regionais; influencers de nicho |
| **Comercial** | 20% | R$ 100 mil | 1 SDR/closer PJ a partir do M4; painel do divulgador; incentivos de campanha |
| **Produto/tecnologia** | 20% | R$ 100 mil | 1 dev PJ part-time (bus factor + velocidade); biblioteca de vídeos de exercícios; assinatura recorrente automática |
| **Fundador dedicado** | 12% | R$ 60 mil | Pró-labore de R$ 2,5 mil/mês — dedicação integral ao negócio |
| **Operação/legal/reserva** | 8% | R$ 40 mil | Contador, LGPD, marca no INPI, contingência |

### O que o investidor leva

- 10% de um SaaS com margem de contribuição de 66–96%, break-even estrutural em 4–5 clientes e **dois caminhos de
  retorno**: (a) rodada seed em 24 meses com step-up, ou (b) empresa lucrativa distribuindo
  resultados (isentos de IR no Simples).
- Comparáveis de saída no setor: W12/EVO adquirida pela ABC Financial (2019); Tecnofit (seed
  R$ 13 mi em 2021); Next Fit (Série A R$ 50 mi, 2025); Wellhub avaliada em US$ 2,4 bi — o setor
  fitness-tech BR tem histórico consistente de M&A e rodadas.

## Slide 11 — Time

- Fundador técnico: concebeu, construiu e opera sozinho o produto completo (engenharia, produto,
  marca) — evidência de capacidade de execução com capital mínimo.
- Com o aporte: +1 dev PJ, +1 comercial — time enxuto por desenho; o modelo não precisa de
  headcount para escalar (infra serverless, aquisição por canal comissionado).
- *Objeção esperada ("founder único") — resposta:* documentação e automação extensivas; primeiro
  uso do capital inclui redundância técnica; conselho informal de 2–3 advisors do setor fitness
  (a recrutar — pedir intro aos próprios investidores).

## Slide 12 — Encerramento

> "O MFIT provou que 200 mil personais pagam R$ 39,90 por gestão. Nós construímos a plataforma
> que faz o que a deles não faz — IA que elimina a digitação, aluno atendido no WhatsApp,
> gamificação que segura o aluno — com margem acima de 60% mesmo pagando 30% de comissão, e
> custo de infraestrutura de centavos.
> Com R$ 500 mil, em 24 meses transformamos isso em R$ 1,5 milhão de ARR ou em uma empresa
> lucrativa que não precisa de mais ninguém. Os dois cenários pagam a aposta."

---

## Anexo A — Perguntas difíceis e respostas ensaiadas

| Pergunta | Resposta |
|---|---|
| "Vocês não têm nenhum pagante. Por que agora?" | "Porque o produto está pronto e o custo de esperar é a janela competitiva (MFIT acabou de lançar IA; Everfit está localizando idiomas). O aporte compra velocidade de distribuição, não risco de produto." |
| "E se o MFIT copiar o WhatsApp IA?" | "A arquitetura deles não nasceu com dado vinculado a treino/exercício — replicar exige refazer fundações. Nossa defesa é velocidade + custo de troca (gamificação do aluno + loja de conteúdo). E cada mês de vantagem vira base instalada com comissão recorrente defendendo o território." |
| "WhatsApp não-oficial (W-API) é sustentável?" | "Risco mapeado: o produto funciona 100% sem WhatsApp (push nativo do PWA) e o plano B é a API oficial da Meta com custo repassado no add-on. O add-on já é precificado como neutro, não como centro de lucro." |
| "Por que só 10%? / valuation alto para pré-receita" | "O ativo já existe — R$ 700 mil+ de produto construído e um modelo unitário auditável. Aceitamos mútuo conversível com cap R$ 5 mi + desconto 20%: se estivermos certos, você converte com vantagem; se demorarmos, o desconto te protege." |
| "Qual o seu churn?" | "Ainda não temos coorte estatisticamente válida — planejamos com 4%/mês (benchmark SMB 3–5%) e os mitigadores estruturais: aluno engajado (ranking/badges), add-ons, anual com desconto. Meta: < 3,5% no M12; é a métrica nº 1 do board mensal." |
| "Exit?" | "Consolidadores comprando no setor: ABC Fitness (comprou W12/EVO e Trainerize), Wellhub, e os próprios líderes locais capitalizados (Next Fit com R$ 50 mi em caixa). Um SaaS de nicho com 2–5 mil assinantes e IA proprietária é alvo natural de M&A a 4–8x ARR." |

## Anexo B — Condições da rodada (term sheet resumido)

| Item | Proposta |
|---|---|
| Instrumento | Mútuo conversível (padrão anjo BR) ou equity direto |
| Aporte | R$ 500 mil (aceita composição por 2–4 anjos; ticket mínimo R$ 125 mil) |
| Cap / pre-money | R$ 4,5 mi (post R$ 5 mi) |
| Participação equivalente | 10% |
| Desconto na conversão (se mútuo) | 20% na próxima rodada qualificada |
| Governança | Report mensal de métricas (MRR, Pro ativos, churn, CAC por canal); veto em matérias relevantes (venda, endividamento, mudança de objeto) |
| Runway | 24 meses |
| Marcos de release de tranches (opcional, se exigido) | T1 R$ 250 mil na assinatura · T2 R$ 250 mil ao atingir 150 Pro ou MRR R$ 10 mil |
