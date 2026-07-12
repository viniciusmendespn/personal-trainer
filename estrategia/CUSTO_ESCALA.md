# Custo e Margem — CoachPilot (Gestão Pro, visão pessimista)

> **Última revisão:** jul/2026 (v3) — documento **simplificado**. Foco exclusivo no plano
> **Gestão Pro (R$39,90), sem add-ons**, com premissas pessimistas: personal **bem ativo**
> com **30 alunos** e carteira adquirida **via divulgadores** (comissão 30%, teto normal da
> escada v3 — ver `PROGRAMA_DIVULGADORES_REGRAS.md`).
>
> A versão anterior (v2, completa: add-ons WhatsApp/IA, análises de sensibilidade, ROI vs
> mídia paga e apêndice AWS detalhado) está no histórico git
> (`git log -- estrategia/CUSTO_ESCALA.md`).

---

## 1. O que entra na conta

| Produto | Preço | Na análise? |
|---|---|---|
| **Gestão Pro** | **R$39,90/mês** | ✅ Único produto considerado |
| Plano Grátis (até 3 alunos) | R$0 | Fora (não gera receita nem comissão) |
| Add-ons (WhatsApp, Assistente IA) | R$29,90 / R$4,90-aluno | Fora (ver nota abaixo) |

> **Por que os add-ons ficam de fora:** são precificados para cobrir o próprio custo e o
> resultado líquido deles é ~neutro (WA contribui ~R$10/personal, IA a 30 msg/dia consome
> ~R$1,21/aluno ativado). Excluí-los deixa a análise mais conservadora, não menos.
> **Add-ons não geram comissão** — comissão de divulgador incide **somente sobre o Gestão Pro**.

---

## 2. Margem por personal — o caso base

**Personal bem ativo (30 alunos, uso intenso do portal e do app), adquirido via divulgador
a 30% de comissão:**

| Item | Valor/mês |
|---|---|
| Receita Gestão Pro | R$39,90 |
| Comissão divulgador (30%) | −R$11,97 |
| Infra AWS (uso intenso, 30 alunos)¹ | −R$1,00 |
| Processamento de pagamento (1,5%) | −R$0,60 |
| **Margem de contribuição** | **R$26,33/mês (66,0%)** |
| Imposto rateado (Simples ~6% da receita) | −R$2,39 |
| **Margem líquida por personal** | **≈ R$23,94/mês (60,0%)** |

¹ Estimativa **pessimista**: a v2 estimava R$0,60–0,75/personal (25 alunos, incluindo tráfego
do agente IA). Aqui, sem agente mas com 30 alunos em uso intenso (4–5 sessões/semana/aluno,
portal ~3h/dia, mídia acumulada 12 meses): DynamoDB ~R$0,45 + S3 ~R$0,45 + API GW/Lambda/
CloudFront ~R$0,10 ≈ **R$1,00**.

**Pior caso absoluto por cliente** (Embaixador da Marca a 35%, só por convite):
R$39,90 − R$13,97 − R$1,00 − R$0,60 = **R$24,34/mês (61,0%)** antes de imposto.

> **Resumo:** mesmo pagando o teto normal de 30% e assumindo o personal mais "caro" possível
> em infra, **cada assinante via divulgador deixa ~R$26/mês líquidos de custos variáveis**
> (~R$24 após imposto). Um cliente direto (sem comissão) deixa R$38,30 — a diferença de
> R$11,97 é o custo de aquisição recorrente do canal.

---

## 3. Piso de lucro — carteira 100% via divulgadores (pessimista)

Premissas: **todos** os assinantes vindos de divulgadores a **30%** (na prática a escada v3
paga 20/25/30 — o custo real será igual ou menor), todos bem ativos com 30 alunos
(infra R$1,00/personal).

| | 25 Pro | 100 Pro | 500 Pro |
|---|---|---|---|
| Receita | R$997,50 | R$3.990,00 | R$19.950,00 |
| Comissões (30%) | −R$299,25 | −R$1.197,00 | −R$5.985,00 |
| Infra AWS | −R$25,00 | −R$100,00 | −R$500,00 |
| Pagamento (1,5%) | −R$14,96 | −R$59,85 | −R$299,25 |
| Custos fixos (ferramentas etc.) | −R$120,00 | −R$150,00 | −R$250,00 |
| Lucro antes de imposto | R$538 | R$2.483 | R$12.916 |
| Imposto | −R$70 (MEI) | −R$239 (Simples 6%) | −R$2.594 (Simples ~13%) |
| **Lucro líquido/mês** | **≈ R$468** | **≈ R$2.244** | **≈ R$10.322** |
| **Lucro líquido/ano** | ≈ R$5.620 | ≈ R$26.925 | ≈ R$123.867 |
| Margem líquida | 46,9% | 56,2% | 51,7% |

> Este é o **piso**: não existe cenário em que o lucro fique abaixo disto com essas escalas,
> pois toda premissa foi levada ao extremo desfavorável (100% comissionado no teto normal,
> infra de uso intenso, zero receita de add-ons).

---

## 4. Visão conservadora — 80% via divulgadores (fase inicial)

No começo a grande maioria virá de divulgadores, mas não todos (landing/SEO, indicação
orgânica). Premissa: **80% via divulgador a 30%**, 20% diretos; demais premissas idênticas
ao §3.

| | 25 Pro (20 via div.) | 100 Pro (80 via div.) | 500 Pro (400 via div.) |
|---|---|---|---|
| Receita | R$997,50 | R$3.990,00 | R$19.950,00 |
| Comissões | −R$239,40 | −R$957,60 | −R$4.788,00 |
| Infra + pagamento + fixos | −R$159,96 | −R$309,85 | −R$1.049,25 |
| Lucro antes de imposto | R$598 | R$2.723 | R$14.113 |
| Imposto | −R$70 (MEI) | −R$239 (6%) | −R$2.594 (~13%) |
| **Lucro líquido/mês** | **≈ R$528** | **≈ R$2.483** | **≈ R$11.519** |
| **Lucro líquido/ano** | ≈ R$6.338 | ≈ R$29.798 | ≈ R$138.231 |
| Margem líquida | 52,9% | 62,2% | 57,7% |

---

## 5. Leitura executiva

1. **A margem real por personal via divulgador (30%) é R$26,33/mês (66%)** antes de fixos e
   impostos — **≈ R$24 (60%) líquido**. Esse é o número a memorizar.
2. **Nem no pior caso teórico** (carteira 100% comissionada, uso intenso) a margem líquida
   cai abaixo de ~47%. No cenário conservador (80% divulgadores) fica em 53–62%.
3. **Comissão é de longe o maior custo** do modelo sem add-ons (30% da receita). Infra +
   pagamento somam só ~4% — a operação em si é quase gratuita.
4. **Break-even: 5 personais via divulgador** cobrem os ~R$120/mês de custos fixos
   (5 × R$26,33 = R$131,65).
5. **Cada +10 personais via divulgador ≈ +R$263/mês** de contribuição antes de impostos.
   O que muda o lucro é o número de assinantes, não a otimização de custo.
6. **Risco de custo real não é a comissão** — é o S3 sem lifecycle policy (mídia cresce
   indefinidamente). Implementar antes de 100 personais (item conhecido em
   `../docs/PERFORMANCE_ESCALA.md`).

---

## 6. Premissas

| Premissa | Valor | Nota |
|---|---|---|
| Câmbio | 1 USD = R$5,80 | Conservador |
| Alunos por personal | **30** | Acima da média (25) — pessimista em infra |
| Intensidade de uso | Alta | 4–5 sessões/semana/aluno; portal ~3h/dia |
| Infra AWS por personal | **R$1,00/mês** | ~35–65% acima da estimativa v2 |
| Processamento de pagamento | 1,5% | PIX Mercado Pago + margem p/ cartão |
| Comissão divulgador | **30% flat** | Teto normal da escada v3 (20/25/30); real ≤ isto |
| Custos fixos | R$120–250/mês | Ferramentas, domínio, monitoramento |
| Imposto | MEI R$70 / Simples 6% / ~13% | Conforme faixa de faturamento anual |

### Notas herdadas da v2 (mantidas por referência cruzada)

- **Comissão incide somente sobre o Gestão Pro** — add-ons nunca comissionam (regra de ouro,
  citada em `PARCERIAS_CANAIS.md` e `PROGRAMA_DIVULGADORES_REGRAS.md`).
- **Add-ons são ~neutros no lucro** (WA +R$10/personal; IA −R$1,21/aluno a 30 msg/dia) e a
  adoção estimada era WA 45–50%, IA 35–40% × 7–8 alunos (premissa citada em
  `PITCH_INVESTIDORES.md`).
- **S3 sem lifecycle** é o único custo que cresce indefinidamente — implementar lifecycle
  antes de 100 personais.
- **Prompt caching** no provider LLM reduz o custo da IA em 25–30% se confirmado
  (logging de `cached_tokens` já implementado — só relevante para o add-on de IA).

---

*Documento simplificado em jul/2026 (v3). Revisitar ao mudar preço do plano, percentuais de
comissão ou câmbio (±15%). Análise completa com add-ons: histórico git deste arquivo.*
