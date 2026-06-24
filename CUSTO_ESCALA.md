# Custo, Escala e Rentabilidade — CoachPilot

> **Última revisão:** jun/2026 — refaz as contas com o modelo comercial atual (Gestão Pro R$39,90
> + add-ons) e inclui análise de faturamento/lucro por cenário e seção de comissão de divulgadores.
>
> Mantém o detalhamento de custo AWS original (apêndice §A), revisado sem free tier indevido
> e já incorporando as otimizações de Fase 1–7 do `PERFORMANCE_ESCALA.md`.

---

## 1. Modelo Comercial Atual

| Produto | Preço | Quem paga |
|---|---|---|
| Plano Grátis | R$0/mês | Personal com até 3 alunos |
| **Gestão Pro** | **R$39,90/mês** | Personal com alunos ilimitados |
| Add-on Canal WhatsApp | +R$29,90/mês | Personal que quer canal de WA |
| Add-on Assistente IA | +R$4,90/aluno/mês | Personal que ativa IA por aluno |

> Comissão de divulgadores **incide apenas sobre Gestão Pro** (R$39,90). Add-ons não geram
> comissão. Plano Grátis não gera comissão.

---

## 2. Premissas Globais

| Premissa | Valor | Justificativa |
|---|---|---|
| Taxa de câmbio | 1 USD = **R$5,80** | Conservador, revisável |
| Alunos por personal Pro | **25** | Roster típico de personal individual |
| Adoção de WhatsApp entre Pro | **45%** | Add-on com custo percebido, adoção parcial |
| Adoção de IA entre Pro | **35%** | Apenas personais que querem o diferencial |
| Alunos com IA por personal-AI | **7** | Sub-seleção dos 25 alunos |
| Mensagens IA / aluno / mês | **900** (30 msgs/dia) | uso intenso previsto — ver alerta em §4.1 |
| Processamento de pagamento | **1,5%** | PIX (Mercado Pago ~0,99%) + cartão |
| % Pro adquiridos via divulgadores | varia por cenário | 20% → 40% conforme escala |
| Comissão média divulgador | **27%** | Mix Inicial (25%) / Oficial (30%) |
| Clientes Free por cada Pro | ~3:1 | Freemium com teto de 3 alunos — conversão alta |

---

## 3. ARPU — Receita Média por Personal Pro

O **ARPU** (Average Revenue Per User) considera a adoção parcial dos add-ons distribuída sobre
todos os personais Pro:

| Componente | Cálculo | Valor médio/Personal/mês |
|---|---|---|
| Gestão Pro (100% dos Pro) | R$39,90 × 1,00 | **R$39,90** |
| Canal WhatsApp (45%) | R$29,90 × 0,45 | **R$13,46** |
| Assistente IA (35% × 7 alunos) | R$4,90 × 0,35 × 7 | **R$12,01** |
| **ARPU total** | | **R$65,37/mês** |

> Se a adoção de IA dobrar (70% dos Pro, 10 alunos cada), o ARPU sobe para **R$87,66/mês**
> — a IA é o maior alavancador de receita a custo marginal baixo.

---

## 4. Custo Variável por Personal Pro

| Componente | Cálculo | Custo médio/Personal/mês |
|---|---|---|
| LLM (Assistente IA) | 0,35 × 7 × R$6,11 | **R$14,97** |
| W-API WhatsApp (por personal com WA) | 0,45 × R$19,90 | **R$8,96** |
| Infra AWS (DynamoDB + Lambda + S3) | ver §A | **R$0,40–0,50** |
| Processamento de pagamento (1,5%) | R$65,37 × 1,5% | **R$0,98** |
| **Custo variável total** | | **~R$25,35/mês** |
| **Margem de contribuição bruta** | R$65,37 − R$25,35 | **R$40,02/mês (61,2%)** |

> Com 30 msgs/dia de IA, o LLM vira o maior custo variável — R$14,97/personal em média,
> superando o W-API. Ver §4.1 para o alerta crítico de precificação.

### 4.1 Margem por linha de produto (análise individual)

| Produto | Receita/unid | Custo direto/unid | Resultado | Papel no modelo |
|---|---|---|---|---|
| Gestão Pro | R$39,90 | — | **+R$39,90** | Centro de lucro |
| Canal WhatsApp | R$29,90 | R$19,90 (W-API) | **+R$10,00** | Cobre custo + margem de segurança |
| Assistente IA (900 msgs/mês — 30/dia) | R$4,90/aluno | R$6,11 (LLM) | **-R$1,21/aluno** | Subsidado pelo Gestão Pro |

> **Lógica do modelo:** o add-on de IA é precificado para cobrir custos, não para gerar
> lucro. O resultado líquido de cada assinatura é basicamente o **Gestão Pro (R$39,90)**,
> com os add-ons se equilibrando (WA contribui R$10, IA consome R$1,21 por aluno ativado).
>
> A 30 msgs/dia com 7 alunos de IA por personal, o subsídio médio da IA é:
> **7 × R$1,21 = R$8,47/personal** — absorvido com folga pelo Gestão Pro.
>
> O rate limiting (10 msg/aluno/min) protege contra picos patológicos que
> explodiriam o LLM além dessas premissas.

---

## 5. Três Cenários Financeiros

Cada escala é analisada em **duas faixas**: só o plano base (cenário conservador, sem add-ons)
e com add-ons (WhatsApp + IA), para mostrar o piso e o teto de receita em cada patamar.

### 5.1 Definição dos cenários

| Cenário | Pro | Free | Total | Pro via divulgadores | Comissão avg |
|---|---|---|---|---|---|
| **Arranque** | 25 | 75 | 100 | 20% = 5 | 25% |
| **Crescimento** | 100 | 300 | 400 | 30% = 30 | 27% |
| **Escala** | 500 | 1.000 | 1.500 | 40% = 200 | 29% |

Adoção dos add-ons (faixa "com add-ons"): WA 45% → 50%; IA 35% × 7 alunos → 40% × 8 alunos.

---

### Cenário 1 — Arranque (25 Pro)

#### 1A — Só Gestão Pro (sem WhatsApp, sem IA)

| Componente | Qtd | Preço | Subtotal |
|---|---|---|---|
| Gestão Pro | 25 | R$39,90 | R$997,50 |
| **Receita total** | | | **R$997,50** |

| Item de custo | Valor |
|---|---|
| LLM | R$0 |
| Infra AWS (~100 personais, leve) | R$35,00 |
| Processamento de pagamento (1,5%) | R$14,96 |
| Comissão divulgadores (5 × 25% × R$39,90) | R$49,88 |
| Custos fixos (domínio, ferramentas) | R$100,00 |
| **Total custos** | **R$199,84** |

| | Valor/mês | Valor/ano |
|---|---|---|
| Faturamento | R$998 | R$11.970 |
| Custos totais | R$200 | R$2.400 |
| Lucro antes dos impostos | R$798 | R$9.576 |
| Imposto (MEI ~R$70/mês fixo) | R$70 | R$840 |
| **Lucro líquido** | **≈ R$728/mês** | **≈ R$8.736/ano** |
| Margem líquida | **72,9%** | |

#### 1B — Com Add-ons (WhatsApp + IA)

| Componente | Qtd | Preço | Subtotal |
|---|---|---|---|
| Gestão Pro | 25 | R$39,90 | R$997,50 |
| Canal WhatsApp (45% = 11) | 11 | R$29,90 | R$328,90 |
| Assistente IA (35%=9 × 7 alunos = 63) | 63 | R$4,90 | R$308,70 |
| **Receita total** | | | **R$1.635,10** |

| Item de custo | Valor |
|---|---|
| W-API WhatsApp (11 × R$19,90) | R$218,90 |
| LLM IA (63 alunos × R$6,11) | R$384,93 |
| Infra AWS | R$35,00 |
| Processamento de pagamento (1,5%) | R$24,53 |
| Comissão divulgadores | R$49,88 |
| Custos fixos | R$100,00 |
| **Total custos** | **R$813,24** |

| | Valor/mês | Valor/ano |
|---|---|---|
| Faturamento | R$1.635 | R$19.620 |
| Custos totais | R$813 | R$9.756 |
| Lucro antes dos impostos | R$822 | R$9.864 |
| Imposto (MEI) | R$70 | R$840 |
| **Lucro líquido** | **≈ R$752/mês** | **≈ R$9.024/ano** |
| Margem líquida | **46,0%** | |

---

### Cenário 2 — Crescimento (100 Pro)

#### 2A — Só Gestão Pro (sem WhatsApp, sem IA)

| Componente | Qtd | Preço | Subtotal |
|---|---|---|---|
| Gestão Pro | 100 | R$39,90 | R$3.990,00 |
| **Receita total** | | | **R$3.990,00** |

| Item de custo | Valor |
|---|---|
| LLM | R$0 |
| Infra AWS (~400 personais, leve) | R$70,00 |
| Processamento de pagamento (1,5%) | R$59,85 |
| Comissão divulgadores (30 × 27% × R$39,90) | R$323,19 |
| Custos fixos | R$150,00 |
| **Total custos** | **R$603,04** |

| | Valor/mês | Valor/ano |
|---|---|---|
| Faturamento | R$3.990 | R$47.880 |
| Custos totais | R$603 | R$7.236 |
| Lucro antes dos impostos | R$3.387 | R$40.644 |
| Imposto (Simples Nac. ~6%) | R$239 | R$2.868 |
| **Lucro líquido** | **≈ R$3.148/mês** | **≈ R$37.776/ano** |
| Margem líquida | **78,9%** | |

#### 2B — Com Add-ons (WhatsApp + IA)

| Componente | Qtd | Preço | Subtotal |
|---|---|---|---|
| Gestão Pro | 100 | R$39,90 | R$3.990,00 |
| Canal WhatsApp (45% = 45) | 45 | R$29,90 | R$1.345,50 |
| Assistente IA (35%=35 × 7 = 245 alunos) | 245 | R$4,90 | R$1.200,50 |
| **Receita total** | | | **R$6.536,00** |

| Item de custo | Valor |
|---|---|
| W-API WhatsApp (45 × R$19,90) | R$895,50 |
| LLM IA (245 alunos × R$6,11) | R$1.496,95 |
| Infra AWS | R$100,00 |
| Processamento de pagamento (1,5%) | R$98,04 |
| Comissão divulgadores | R$323,19 |
| Custos fixos | R$150,00 |
| **Total custos** | **R$3.063,68** |

| | Valor/mês | Valor/ano |
|---|---|---|
| Faturamento | R$6.536 | R$78.432 |
| Custos totais | R$3.064 | R$36.768 |
| Lucro antes dos impostos | R$3.472 | R$41.664 |
| Imposto (Simples Nac. ~6%) | R$392 | R$4.704 |
| **Lucro líquido** | **≈ R$3.080/mês** | **≈ R$36.960/ano** |
| Margem líquida | **47,1%** | |

---

### Cenário 3 — Escala (500 Pro)

#### 3A — Só Gestão Pro (sem WhatsApp, sem IA)

| Componente | Qtd | Preço | Subtotal |
|---|---|---|---|
| Gestão Pro | 500 | R$39,90 | R$19.950,00 |
| **Receita total** | | | **R$19.950,00** |

| Item de custo | Valor |
|---|---|
| LLM | R$0 |
| Infra AWS (~1.500 personais, leve) | R$200,00 |
| Processamento de pagamento (1,5%) | R$299,25 |
| Comissão divulgadores (200 × 29% × R$39,90) | R$2.314,20 |
| Custos fixos | R$250,00 |
| **Total custos** | **R$3.063,45** |

| | Valor/mês | Valor/ano |
|---|---|---|
| Faturamento | R$19.950 | R$239.400 |
| Custos totais | R$3.063 | R$36.756 |
| Lucro antes dos impostos | R$16.887 | R$202.644 |
| Imposto (Simples Nac. ~13%) | R$2.593 | R$31.116 |
| **Lucro líquido** | **≈ R$14.294/mês** | **≈ R$171.528/ano** |
| Margem líquida | **71,6%** | |

#### 3B — Com Add-ons (WhatsApp + IA)

> Adoção maior na escala: WA 50%, IA 40% × 8 alunos.

| Componente | Qtd | Preço | Subtotal |
|---|---|---|---|
| Gestão Pro | 500 | R$39,90 | R$19.950,00 |
| Canal WhatsApp (50% = 250) | 250 | R$29,90 | R$7.475,00 |
| Assistente IA (40%=200 × 8 = 1.600 alunos) | 1.600 | R$4,90 | R$7.840,00 |
| **Receita total** | | | **R$35.265,00** |

| Item de custo | Valor |
|---|---|
| W-API WhatsApp (250 × R$19,90) | R$4.975,00 |
| LLM IA (1.600 alunos × R$6,11) | R$9.776,00 |
| Infra AWS | R$350,00 |
| Processamento de pagamento (1,5%) | R$528,98 |
| Comissão divulgadores | R$2.314,20 |
| Custos fixos | R$300,00 |
| **Total custos** | **R$18.244,18** |

| | Valor/mês | Valor/ano |
|---|---|---|
| Faturamento | R$35.265 | R$423.180 |
| Custos totais | R$18.244 | R$218.928 |
| Lucro antes dos impostos | R$17.021 | R$204.252 |
| Imposto (Simples Nac. ~13%) | R$4.585 | R$55.020 |
| **Lucro líquido** | **≈ R$12.436/mês** | **≈ R$149.232/ano** |
| Margem líquida | **35,3%** | |

---

### 5.2 Resumo comparativo — piso vs. teto por escala

| Cenário | Pro | Faturamento/mês | Lucro líquido/mês | Margem |
|---|---|---|---|---|
| Arranque — Só Pro | 25 | R$998 | **~R$728** | 73% |
| Arranque — Com add-ons (30 msgs/dia) | 25 | R$1.635 | **~R$752** | 46% |
| Crescimento — Só Pro | 100 | R$3.990 | **~R$3.148** | 79% |
| Crescimento — Com add-ons (30 msgs/dia) | 100 | R$6.536 | **~R$3.080** | 47% |
| Escala — Só Pro | 500 | R$19.950 | **~R$14.294** | 72% |
| Escala — Com add-ons (30 msgs/dia) | 500 | R$35.265 | **~R$12.436** | 35% |

> **Leitura principal:** o lucro real vem do Gestão Pro. Os add-ons aumentam o faturamento
> bruto, mas o WA e a IA juntos ficam quase neutros — WA contribui R$10/personal, IA consome
> ~R$8,47/personal (7 alunos × R$1,21 de subsídio). Resultado líquido dos add-ons: **+R$1,53**
> por personal em média. O bloco de add-ons não atrapalha nem salva — é neutro.
>
> Por isso o cenário "Só Pro" e "Com add-ons" chegam a lucros parecidos: a diferença vem
> do faturamento bruto maior (receita de WA + IA), parcialmente cancelada pelo custo de
> W-API + LLM. O que muda o lucro de verdade é o **número de assinantes Pro**.

---

## 6. Programa de Divulgadores — Análise Completa

### 6.1 Níveis e comissões

| Nível | Clientes ativos indicados | Comissão | Sobre o quê |
|---|---|---|---|
| Divulgador Inicial | 1–4 | 25% | Gestão Pro (R$39,90) |
| Divulgador Oficial | 5–14 | 30% | Gestão Pro (R$39,90) |
| Divulgador Master | 15+ | 35% | Gestão Pro (R$39,90) |

> **Regra de ouro:** comissão incide **somente** sobre o plano Gestão Pro. Canal WhatsApp,
> Assistente IA e qualquer add-on futuro **não** geram comissão.

### 6.2 Quanto o divulgador ganha

| Clientes ativos | Nível | Comissão | Ganho mensal |
|---|---|---|---|
| 3 | Inicial | 25% | **R$29,93** |
| 5 | Oficial | 30% | **R$59,85** |
| 10 | Oficial | 30% | **R$119,70** |
| 15 | Master | 35% | **R$209,48** |
| 30 | Master | 35% | **R$418,95** |
| 50 | Master | 35% | **R$698,25** |

> Renda passiva recorrente — enquanto o cliente indicado permanecer ativo, o divulgador
> continua recebendo. Um personal influenciador com 50 indicações ativas fatura
> **~R$8.379/ano** só com comissões, sem custo algum para ele.

### 6.3 Impacto no meu resultado (perspectiva da plataforma)

Para cada personal Pro adquirido via divulgador, a receita líquida da plataforma é:

| Item | Diretamente adquirido | Via divulgador (avg 27%) |
|---|---|---|
| Receita do plano | R$39,90 | R$39,90 |
| Comissão paga | — | −R$10,77 |
| Receita líquida do plano | **R$39,90** | **R$29,13** |
| Add-ons (não comissionados) | R$25,47 | R$25,47 |
| **Receita total líquida** | **R$65,37** | **R$54,60** |

> A plataforma "abre mão" de **~R$10,77/mês** por cliente via divulgador, mas obtém
> aquisição gratuita de cliente (sem CAC de mídia paga).

### 6.4 ROI do canal de divulgadores vs. mídia paga

| Métrica | Canal divulgadores | Mídia paga (estimado) |
|---|---|---|
| CAC (custo de aquisição) | Recorrente ~R$10,77/mês | Único R$150–500 |
| LTV médio (18 meses) | R$65,37 × 18 = R$1.176 | R$65,37 × 18 = R$1.176 |
| Comissão total paga (18m) | 18 × R$10,77 = **R$193,86** | — |
| CAC total em 18m | **R$193,86** | **R$150–500** |
| LTV líquido | **R$982** | **R$676–1.026** |

> O canal de divulgadores é competitivo com mídia paga E gera evangelistas engajados que
> usam a própria plataforma — retenção costuma ser maior em clientes indicados por pares.

### 6.5 Custo total de comissões por cenário

| Cenário | Pro via divulgadores | Comissão média | Custo/mês | % da receita total |
|---|---|---|---|---|
| Arranque (25 Pro) | 5 | 25% | R$49,88 | 3,1% |
| Crescimento (100 Pro) | 30 | 27% | R$323,19 | 4,9% |
| Escala (500 Pro) | 200 | 29% | R$2.314,20 | 6,6% |

> O custo de comissões cresce com a escala (mais divulgadores, níveis mais altos), mas
> nunca passa de ~7% da receita — amplamente absorvido pela margem de 96%.

---

## 7. Ponto de Equilíbrio (Break-even)

**Custos fixos mensais mínimos** (sem nenhum usuário pagante):
- Infra AWS baseline: ~R$20
- Ferramentas (GitHub, monitoramento): ~R$100
- **Total fixo: ~R$120/mês**

**Break-even em clientes:**
- 1 cliente Pro = R$39,90/mês
- Precisar cobrir R$120 → **4 clientes Pro** no plano básico (sem add-ons)
- Com ARPU real (add-ons): ~R$65/mês → **2 clientes Pro** com add-ons

**Break-even com primeiro divulgador ativo:**
- Divulgador com 5 clientes no Oficial (30%): comissão = R$59,85/mês
- Receita desses 5 clientes: 5 × R$39,90 = R$199,50
- Menos comissão: R$139,65 → Break-even coberto; somando add-ons, sobra ainda mais.

---

## 8. Sensibilidade — E Se a Adoção Mudar?

### 8.1 Adoção de IA (Cenário Crescimento, 100 Pro fixo)

| IA adoption | Alunos com IA | Receita IA | ARPU total | Lucro líquido/mês |
|---|---|---|---|---|
| 20% × 5 alunos | 100 | R$490 | R$58,29 | ~R$4.700 |
| **35% × 7 alunos (base)** | **245** | **R$1.201** | **R$65,37** | **~R$5.372** |
| 50% × 10 alunos | 500 | R$2.450 | R$77,35 | ~R$7.100 |
| 70% × 12 alunos | 840 | R$4.116 | R$93,96 | ~R$9.500 |

### 8.2 Intensidade de uso da IA (impacto no custo LLM por aluno)

| Uso | Msgs/aluno/mês | Custo LLM/aluno | Receita/aluno | Margem IA |
|---|---|---|---|---|
| Leve | 10 | R$0,07 | R$4,90 | 98,6% |
| **Médio (base)** | **60** | **R$0,41** | **R$4,90** | **91,6%** |
| Intenso | 200 | R$1,36 | R$4,90 | 72,2% |
| Extremo (rate-limited) | 400 | R$2,71 | R$4,90 | 44,7% |

> Mesmo no cenário extremo (rate limit ativo), a IA não gera prejuízo. O rate limiting de
> 10 msgs/aluno/min garante que o custo nunca escapa do controle.

---

## 9. Impostos — Nota Simplificada

| Faturamento anual | Regime sugerido | Alíquota aprox. | Impacto/mês (Cenário 2) |
|---|---|---|---|
| Até R$81k/ano | MEI | R$70/mês fixo (DAS) | **R$70** |
| R$81k–R$180k/ano | Simples Nac. Faixa 1 | ~6% | ~R$392 |
| R$180k–R$360k/ano | Simples Nac. Faixa 2 | ~11,2% | — |
| R$360k–R$720k/ano | Simples Nac. Faixa 3 | ~13,5% | ~R$4.580 (Cenário 3) |

> **Importante:** a alíquota real do Simples para SaaS depende do CNAE e da estrutura
> (pró-labore vs. distribuição de lucros). Consultar contador antes de escolher o regime.
> Software-as-a-Service pode cair no **Anexo III** ou **Anexo V** do Simples — Anexo V tem
> alíquotas maiores, mas permite maior dedução de IRPJ sobre lucro.
>
> Distribuição de lucros do Simples Nacional é **isenta de IR** (vantagem relevante para
> negócios com margem alta como este).

---

## 10. Conclusões Executivas

1. **O modelo de negócio é simples: lucro = assinantes Pro × ~R$39,90 − custos fixos.**
   Add-ons (WA + IA) são precificados para cobrir seus custos diretos e ficam essencialmente
   neutros no resultado — R$1,53 de contribuição líquida por personal em média.

2. **O produto é lucrativo desde o primeiro personal Pro** — break-even com 2–4 clientes
   considerando apenas os custos fixos de infraestrutura e ferramentas (~R$120/mês).

3. **Add-ons são features de retenção e diferenciação, não centro de lucro.**
   O WhatsApp cobre o W-API com R$10 de folga. A IA a 30 msgs/dia é levemente subsidiada
   (−R$1,21/aluno), absorvida pelo Gestão Pro. Juntos ficam quase neutros.

4. **O programa de divulgadores é eficiente**: custo de comissão de 3–7% da receita contra
   um canal de aquisição orgânico e recorrente. Clientes indicados tendem a ter maior retenção.

5. **A escala de infraestrutura é quase gratuita**: de 25 para 500 personais Pro, o custo
   de infra vai de ~R$35 para ~R$350 (10×), enquanto a receita vai de R$998 para R$19.950
   (20×). A infra nunca é o gargalo de rentabilidade.

6. **O que muda o lucro de verdade é o número de assinantes Pro.** Dobrar de 100 para 200
   Pro vale muito mais do que aumentar a adoção de add-ons.

7. **Risco principal:** S3 sem lifecycle policy cresce indefinidamente (ver §A.4.5).
   Implementar lifecycle antes de atingir 100 personais.

8. **Upside com prompt caching:** se ativado no provider LLM, reduz custo do LLM em 25–30%,
   transformando a IA de levemente deficitária em neutra ou levemente positiva.

---

## Apêndice A — Custo de Infraestrutura AWS Detalhado

> Conteúdo mantido do documento original. Números já revisados: sem free tier indevido
> (API Gateway, S3, DynamoDB on-demand) e com otimizações das Fases 1–7 aplicadas.

### A.1 Premissas de volume (infra)

| Premissa | Valor |
|---|---|
| Alunos por personal | 25 |
| Sessões/aluno/semana | 4 (~17/mês) |
| Portal aberto pelo personal | ~3h/dia, ~21 dias/mês |
| Polling de não-lidas | 60s — **1 `get_item` (O1), pós Fase 1** |
| Polling de chat | 15s, enquanto tela de chat aberta |

### A.2 Preços AWS confirmados (`us-east-1`)

| Serviço | Preço | Free tier |
|---|---|---|
| DynamoDB on-demand | $1,25/M WRU + $0,25/M RRU | Apenas armazenamento (25GB, always free) |
| Lambda arm64 | $0,20/M req + $0,0000133/GB-s | 1M req + 400k GB-s **always free** |
| API Gateway HTTP | $1,00/M req | Nenhum (conta antiga) |
| S3 Standard | $0,023/GB-mês + PUTs/GETs | Nenhum (conta antiga) |
| Cognito | — | 50k MAU always free |
| CloudFront | — | 1TB + 10M req always free |

### A.3 Volume mensal por personal por cenário do agente

| Fonte | Leve (10 msg/aluno) | Médio (60 msg) | Intenso (200 msg) |
|---|---|---|---|
| Total WRU / RRU | 2.000 / 7.280 | 11.000 / 13.280 | 36.200 / 30.080 |
| Invocações Lambda / GB-s | 5.530 / 324 | 6.780 / 949 | 10.280 / 2.699 |

### A.4 Custo de infra por escala e cenário (S3 a T=12 meses de operação)

| Escala | Cenário | DynamoDB | Lambda | API GW | S3 (12m) | **Total/mês** |
|---|---|---|---|---|---|---|
| 10 personais | Leve | $0,04 | $0 | $0,05 | $0,41 | **~$0,50** |
| 10 personais | Médio | $0,17 | $0 | $0,05 | $0,41 | **~$0,63** |
| 10 personais | Intenso | $0,53 | $0 | $0,05 | $0,41 | **~$0,99** |
| 100 personais | Leve | $0,43 | $0 | $0,53 | $4,14 | **~$5,10** |
| 100 personais | Médio | $1,71 | $0 | $0,53 | $4,14 | **~$6,38** |
| 100 personais | Intenso | $5,28 | $0,01 | $0,53 | $4,14 | **~$9,96** |
| 1.000 personais | Leve | $4,32 | $0,91 | $5,28 | $41,40 | **~$52** |
| 1.000 personais | Médio | $17,07 | $8,47 | $5,28 | $41,40 | **~$72** |
| 1.000 personais | Intenso | $52,77 | $32,51 | $5,28 | $41,40 | **~$132** |

> **⚠️ S3 sem lifecycle policy** — único item que cresce indefinidamente mesmo com base
> de personais estável. Ao atingir 100 personais, implementar lifecycle para mover mídia
> antiga para Infrequent Access ou expirar após N meses.

### A.5 Custo de LLM (agente IA) por cenário

Modelo: `gpt-5.4-nano` — $0,20/M tokens input · $1,25/M tokens output.
Overhead fixo por mensagem: ~1.900 tokens (system prompt + 12 tool definitions), reenviados em toda chamada.

| Cenário | Custo/aluno/mês | Custo/personal/mês (25 alunos) |
|---|---|---|
| Leve (10 msgs) | $0,0117 ≈ R$0,07 | R$1,73 |
| Médio (60 msgs) | $0,0702 ≈ R$0,41 | R$10,20 |
| Intenso (200 msgs) | $0,234 ≈ R$1,36 | R$34,00 |

> No modelo de negócio atual, **só alunos com add-on de IA geram custo de LLM**. Para
> os cenários financeiros (§5), foram usados 2,45 alunos com IA por personal em média
> (35% dos personais × 7 alunos), resultando em ~R$1,00/personal/mês de custo de LLM.

### A.6 Rate limiting — proteção contra runaway cost

`llm_agent._check_rate_limit`: **10 msgs/aluno/min**. Acima do limite, o agente responde
com aviso sem chamar a LLM — zero custo de API. O cenário "intenso" (200 msgs/mês = 6,7/dia)
está muito abaixo do limite técnico. O custo é limitado superiormente mesmo em uso abusivo.

---

*Documento atualizado em jun/2026. Revisitar ao mudar preços, trocar provider de LLM ou atingir
escala que mude a faixa do Simples Nacional. Câmbio de R$5,80/USD — ajustar se variar ±15%.*
