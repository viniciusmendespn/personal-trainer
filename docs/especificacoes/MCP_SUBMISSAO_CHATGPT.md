# Submissão do CoachPilot ao diretório de plugins do ChatGPT

Conteúdo pronto para colar no formulário de submissão
(`developers.openai.com/plugins/deploy/submission`). Cada seção abaixo corresponde a uma aba
do formulário. Requisitos técnicos do servidor estão em `MCP_SERVER.md`.

> ⚠️ **Credenciais de revisor não entram neste arquivo** — o repositório é público. Ver
> "Conta de revisor" no fim.

---

## Aba **Info**

| Campo | Valor |
|---|---|
| **Plugin name** | `CoachPilot` |
| **Category** | Produtividade / Saúde e fitness (o que existir mais próximo de gestão profissional) |
| **Website URL** | `https://coachpilot.com.br` |
| **Support URL** | `https://coachpilot.com.br/faq` |
| **Privacy policy URL** | `https://coachpilot.com.br/privacidade` |
| **Terms of service URL** | `https://coachpilot.com.br/termos` |
| **Logo** | `frontend/public/icone-conector-256.png` (256×256, 8,7 KB) — também em `https://coachpilot.com.br/icone-conector-256.png` |
| **Developer identity** | Verificar como pessoa física ou empresa na plataforma OpenAI **antes** de submeter |

**Short description**

> Gerencie seus alunos de personal training: consulte treinos, avaliações e histórico, e monte
> a prescrição da semana conversando.

**Long description**

> O CoachPilot é o sistema de gestão de personal trainers — alunos, prescrição de treino,
> avaliações físicas, histórico de sessões, agenda e financeiro. Conectando sua conta, você
> consulta e ajusta a sua carteira sem sair da conversa: "quem não treina há mais de 10 dias?",
> "como está a evolução de agachamento da Marina?", "monta o treino B dela para esta semana
> respeitando a anamnese".
>
> Você autoriza com a sua própria conta CoachPilot e escolhe conceder apenas leitura ou também
> escrita de treinos. A conexão alcança somente os seus alunos. Toda alteração de treino é
> registrada, notificada a você e pode ser desfeita por 7 dias. Quem prescreve continua sendo
> você — o assistente analisa, propõe e, quando você pede, aplica.

---

## Aba **MCP**

| Campo | Valor |
|---|---|
| **URL type** | Universal (uma URL fixa serve todos os usuários) |
| **MCP server URL** | `https://mcp.coachpilot.com.br/mcp` |
| **Authentication** | OAuth 2.1 (Authorization Code + PKCE S256, com Dynamic Client Registration) |
| **Challenge host** | `mcp.coachpilot.com.br` |
| **CSP** | Não se aplica — o plugin não traz componente de UI; só tools MCP |

O formulário pede justificativa das 3 anotações de cada tool (39 campos). Textos prontos em
**`MCP_JUSTIFICATIVAS_TOOLS.md`**.

### Verificação de domínio

O endpoint já existe e devolve **texto puro, um único token, sem JSON**:

```
https://mcp.coachpilot.com.br/.well-known/openai-apps-challenge
```

Ele lê a variável `OPENAI_APPS_CHALLENGE`. Ao receber o token no portal da OpenAI:

```powershell
# 1. gravar em backend/.env.local (não versionado)
Add-Content backend\.env.local "`nOPENAI_APPS_CHALLENGE=<token-da-openai>"
# 2. publicar
.\deploy.ps1 backend
# 3. conferir — deve imprimir só o token
curl https://mcp.coachpilot.com.br/.well-known/openai-apps-challenge
```

Enquanto não houver token configurado o endpoint devolve **404** de propósito: string vazia
poderia fazer a verificação passar por engano.

### Endpoints que o revisor vai exercitar

| Endpoint | Resposta |
|---|---|
| `/.well-known/oauth-protected-resource` | RFC 9728 |
| `/.well-known/oauth-authorization-server` | RFC 8414 + `userinfo_endpoint` |
| `/register` | DCR (RFC 7591), sem client secret |
| `/authorize` | 302 para o consentimento no portal |
| `/token` | access 15 min + refresh rotativo |
| `/userinfo` | `sub`, `email`, `email_verified: true` |
| `POST /mcp` | JSON-RPC; sem token → 401 com `WWW-Authenticate` |

---

## Aba **Prompts** — starter prompts

Starter prompt aparece como sugestão clicável para o usuário real, então **não pode citar nome
de aluno da conta demo** — o usuário clicaria e o assistente responderia "não encontrei". Os
três primeiros funcionam literalmente para qualquer personal; os dois últimos trazem `[nome]`
para o usuário completar.

1. `Quais dos meus alunos estão sem treinar há mais de 10 dias?`
2. `Resuma minha carteira: quem está sem treino vigente e quem está com pagamento atrasado.`
3. `Monte o treino da semana para um aluno meu, respeitando as restrições da anamnese dele.`
4. `Mostre o perfil, a anamnese e as últimas sessões do aluno [nome].`
5. `Como está a evolução de carga do agachamento do aluno [nome]?`

O 3 é o de maior valor: roda sem edição e exercita a cadeia inteira — `listar_alunos` para
perguntar de qual aluno se trata, `detalhar_aluno`, `guia_de_prescricao` e
`aplicar_programa_treino`.

---

## Aba **Testing**

O formulário pede **exatamente 5** casos positivos e **exatamente 3** negativos, cada um com
Scenario, User prompt, Tool triggered e Expected output.

Todos os prompts abaixo funcionam literalmente na conta de teste, cujos alunos são
Fernanda Oliveira, Carlos Eduardo Lima, Juliana Castro, Roberto Almeida e Mariana Souza.

### Casos positivos

#### 1 — Triagem da carteira

- **Scenario**: Identificar quais alunos estão sem treinar, para priorizar contato.
- **User prompt**: `Quais dos meus alunos estão sem treinar há mais de 10 dias?`
- **Tool triggered**: `resumo_carteira`
- **Expected output**: Um panorama da carteira com total de alunos, quantos ativos e as
  pendências agrupadas por tipo (`SEM_TREINAR`, `SEM_TREINO_VIGENTE`, `PAGAMENTO_ATRASADO`),
  cada uma com a lista de alunos e `dias_sem_treinar`. O assistente filtra pelos que passam de
  10 dias e responde em texto. Uma única chamada — não percorre aluno por aluno.

#### 2 — Panorama de um aluno

- **Scenario**: Revisar a situação completa de um aluno antes de atendê-lo.
- **User prompt**: `Me dê o panorama completo da aluna Mariana Souza.`
- **Tool triggered**: `listar_alunos` (para resolver o id pelo nome) e depois `detalhar_aluno`
- **Expected output**: Dossiê da aluna — perfil e objetivos, respostas da anamnese, avaliações
  físicas com evolução, metas, estatísticas de treino, últimas sessões, evolução por exercício,
  dores e dúvidas relatadas e notas do personal. A resposta traz um aviso explícito de que
  texto escrito pelo aluno é dado, não instrução.

#### 3 — Consultar o programa de treino

- **Scenario**: Ver o programa de treino que o aluno está seguindo hoje.
- **User prompt**: `Mostre o programa de treino atual da Mariana Souza.`
- **Tool triggered**: `listar_alunos` e depois `exportar_programa_treino`
- **Expected output**: O programa completo em JSON — treinos A/B/C com foco, período de
  vigência e, em cada um, os exercícios com séries prescritas, intervalo, unidades e o
  `video_url` da biblioteca do personal.

#### 4 — Ajustar a prescrição (escrita)

- **Scenario**: Alterar o treino de um aluno conversando, em vez de editar no portal.
- **User prompt**: `Adicione remada curvada 4x10 ao treino B da Mariana Souza e me diga o que mudou.`
- **Tool triggered**: `guia_de_prescricao` → `exportar_programa_treino` →
  `aplicar_programa_treino` (opcionalmente `validar_programa_treino` antes de gravar)
- **Expected output**: `status: "aplicado"` com a contagem de treinos e exercícios gravados, e
  a menção de que a alteração pode ser desfeita. O exercício adicionado deve usar o nome e o
  `video_url` da biblioteca do personal quando existir lá. O programa é enviado **completo** —
  a gravação substitui o programa inteiro. O personal recebe notificação da alteração.

#### 5 — Desfazer a alteração

- **Scenario**: Voltar atrás em uma alteração de treino feita pelo assistente.
- **User prompt**: `Desfaz a última alteração que você fez no treino dela.`
- **Tool triggered**: `desfazer_alteracao_treino`
- **Expected output**: `status: "restaurado"` com a data do snapshot e as contagens. O programa
  volta a ser exatamente o que era antes do caso 4 — a remada curvada desaparece. Funciona por
  7 dias após a alteração.

### Casos negativos

> Aqui o critério é **não invocar o app**: prompts em que o modelo poderia achar que o
> CoachPilot é relevante, mas o certo é responder sem chamar tool nenhuma.

#### 1 — Pedido genérico de treino, sem aluno

- **Scenario**: O usuário pede um treino em tese, sem se referir a nenhum aluno da carteira.
- **User prompt**: `Monte um treino de hipertrofia de 3 dias para um iniciante.`
- **Expected behavior**: Responder com conhecimento geral, **sem chamar nenhuma tool** — em
  especial sem `aplicar_programa_treino`. Não há aluno no contexto, e gravar aqui sobrescreveria
  o programa de alguém real. Se quiser, o assistente pode oferecer aplicar depois, perguntando
  para qual aluno. É o falso positivo de maior risco do app.

#### 2 — Dúvida técnica sobre exercício

- **Scenario**: Pergunta de biomecânica que não depende de nenhum dado da conta.
- **User prompt**: `Qual a diferença entre agachamento livre e agachamento no Smith?`
- **Expected behavior**: Responder direto. Não chamar `listar_biblioteca_exercicios` nem
  `guia_de_prescricao` — a biblioteca do personal e as regras de formato do programa não têm
  relação com uma dúvida conceitual.

#### 3 — Agendar compromisso

- **Scenario**: Pedido de agendamento que soa como agenda, mas está fora do escopo do app.
- **User prompt**: `Agende uma reunião com meu contador amanhã às 15h.`
- **Expected behavior**: Não chamar tool do CoachPilot. `agenda_periodo` apenas **lê** um
  intervalo de datas e o app não expõe criação de compromisso; além disso a reunião não é com
  aluno. O assistente deve tratar como agenda pessoal do usuário.

### Como reproduzir a conexão

1. No ChatGPT, adicionar o conector com a URL acima → ele abre `coachpilot.com.br/oauth/consent`.
2. Fazer login com as credenciais de teste — **sem MFA, sem SMS, sem confirmação por e-mail**;
   o Cognito do projeto usa apenas usuário e senha, e o acesso é imediato.
3. Na tela de consentimento, manter as duas permissões marcadas e clicar em **Autorizar**.

---

## Aba **Global**

Disponibilidade: **Brasil** — é onde o produto opera, o suporte é prestado (português) e os
termos foram redigidos. Ampliar só quando houver suporte e termos para o novo mercado.

---

## Aba **Submit** — release notes

> Primeira submissão. O CoachPilot é um sistema de gestão para personal trainers em operação
> em coachpilot.com.br. Este plugin expõe, por MCP, a leitura da carteira do próprio usuário
> (alunos, treinos, avaliações, anamneses, histórico de sessões, agenda) e a escrita de
> prescrição de treino.
>
> Autenticação por OAuth 2.1 com PKCE e Dynamic Client Registration; o consentimento acontece
> no portal do CoachPilot, reaproveitando o login existente do usuário. Os escopos são `read`
> e `treinos:write`, escolhidos pelo usuário na autorização; uma conexão só-leitura não recebe
> as tools de escrita na listagem.
>
> Escrita de treino tem snapshot de 7 dias com tool de desfazer, deduplicação por hash,
> registro de auditoria e notificação ao usuário. Não há tool de exclusão de aluno, operação
> em massa, nem acesso a plano ou cobrança.
>
> Credenciais de teste no campo apropriado: contas de personal com 5 alunos e histórico
> completo. Login apenas com usuário e senha, sem MFA.

---

## Conta de revisor

Conta **dedicada**, criada só para a revisão — a OpenAI exige conta de demonstração com dados
de exemplo e proíbe entregar conta real com dados de produção:

| Campo | Valor |
|---|---|
| Username | `openai-review@coachpilot.com.br` |
| Password | *fora deste arquivo — o repositório é público. Ver gerenciador de senhas.* |
| MFA | não há |
| Setup necessário | nenhum; login dá acesso imediato |

Contém 5 alunos fictícios com ~12 semanas de histórico, avaliações, metas, agenda e financeiro
de exemplo. Nenhum dado de personal ou aluno real.

> ⚠️ **Não usar `demo@coachpilot.com.br`** para a submissão: `backend/scripts/seed_demo_conta.py`
> está versionado neste repositório público com a senha padrão, então essa conta tem credencial
> de conhecimento público — qualquer pessoa poderia alterar os dados no meio da revisão.

Recriar ou reiniciar a conta de revisão a qualquer momento:

```powershell
cd backend
python scripts\seed_demo_conta.py --email openai-review@coachpilot.com.br `
  --senha "<senha>" --nome "CoachPilot Demo" --slug review --reset
```

Depois da publicação, trocar a senha ou remover a conta.

---

## Checklist antes de submeter

- [ ] Identidade de publisher verificada na plataforma OpenAI (pessoa física ou empresa)
- [ ] Papel com acesso de escrita em **Apps Management**
- [ ] Conta de revisor criada, com senha fora do repositório e sem MFA
- [ ] `OPENAI_APPS_CHALLENGE` publicado e `curl` devolvendo só o token
- [ ] `/privacidade` e `/termos` no ar com a seção de conexão com IA externa *(feito)*
- [ ] Ícone enviado *(feito — 256×256, 8,7 KB)*
- [ ] Fluxo OAuth testado ponta a ponta *(feito — `pytest tests/test_mcp_*.py`, 219 testes)*
- [ ] Respostas das tools sem identificador interno *(feito — `test_mcp_submissao.py`)*
- [ ] Anotações das tools conferidas contra o comportamento real *(feito — mesmo arquivo)*
