# Plugin visual CoachPilot — implementação e ativação

Implementação do fluxo prioritário do [plano](../../PLANO_COACHPILOT_PLUGIN_VISUAL.md): carteira → aluno → proposta → revisão → aplicação → restauração. Inclui evolução com gráfico e tabela. A entrega de 01/10/2026 permite consulta visual junto do plugin publicado: carteira, ficha, treinos e evolução. Propostas e aplicação pela tela continuam bloqueadas. A validação no cliente ChatGPT depende do Rescan e permanece pendente.

## Interface e transporte

`frontend/src/mcp-app` é uma entrada React independente do portal. O adaptador `host.ts` usa `@modelcontextprotocol/ext-apps` para inicialização, resultados, tools, seleção mínima no contexto, pedidos explícitos à conversa e expansão. Preferências de ordenação e fallback de tela cheia usam extensões opcionais isoladas no adaptador. Não há chamada à API OpenAI para navegação ou renderização.

`npm run build:mcp` verifica TypeScript e gera `backend/app/mcp/ui_dist/v1.html`, com JS/CSS/ícone inline, aproximadamente 558 KB (159 KB gzip). O `deploy.ps1` executa esse build antes do SAM. O recurso autenticado é `ui://coachpilot/workspace/v1.html`, MIME `text/html;profile=mcp-app`, com CSP sem origens externas de conexão/recursos. Vídeos são links explícitos; não são embeds.

**Identidade visual: cores do portal, tipografia do host.** A tela usa o mesmo Tailwind e as cores do portal (`src/theme.css`) e reusa os componentes de `components/ui` (Button, Card, Badge, Tabs, Input/Select, StatChip, EmptyState, Skeleton). `styles.css` sobrepõe os tokens de fonte com a do sistema (diretriz de UI do ChatGPT) — Sora/Inter ficam só no portal. O card na conversa não repete marca nem selo "Conectado" (o host já mostra nome e ícone); a marca aparece só no cabeçalho da tela cheia. O tema segue o do ChatGPT via `data-theme`. O gráfico de evolução é um SVG próprio (`GraficoArea.tsx`) com o mesmo desenho do AreaChart do portal — `recharts` dobrava o HTML. Componente novo do portal só entra aqui se não depender de router/contexto do portal. O build falha se o CSS não entrar no HTML.

O transporte JSON-RPC stateless existente continua com Mangum sem lifespan. Foram acrescentados `resources/list`, `resources/read` e `resources/templates/list`; a autenticação OAuth e a resolução de tenant continuam compartilhadas. `abrir_coachpilot` anuncia entrypoints global/thread e aceita aluno/proposta explicitamente autorizados. Links nativos da extensão OpenAI ainda não foram registrados.

Os detalhes de programa e contexto ficam em `_meta.coachpilot`; `structuredContent` mantém contrato conciso, IDs, revisão, estado e permissões. `obter_proposta_programa`, `exportar_programa_treino` e `detalhar_aluno` fornecem dados completos quando solicitados. Anotações privadas e conversas não entram na consulta compacta inicial. Falhas por seção são distinguidas de ausência de dados.

A carteira normaliza acentos/caixa, aplica filtros antes de preencher a página e mantém cursor quando a busca é parcial. Examina até oito páginas por chamada. Os resumos e a ordenação da interface se referem aos alunos carregados; não são totais globais inferidos. Filtros usam a data local do personal, sete dias para vencimento próximo e a regra existente de dez dias sem treino.

A evolução carrega até 200 registros e separa kg, lb e outras unidades registradas. Registros legados sem unidade ficam na tabela com indicação de unidade desconhecida e não entram no gráfico. Novos registros de sessão preservam tipo e unidade do snapshot. CrossFit/HIIT mantêm blocos e parâmetros; mudanças complexas seguem pelo pedido explícito ao chat.

## Contratos e permissões

| Tool | Permissão e comportamento |
|---|---|
| `abrir_coachpilot` | Leitura; carteira ou rota autorizada |
| `mostrar_aluno` | Leitura; programa, restrições relatadas, contexto compacto |
| `salvar_proposta_programa` | `treinos:write`; rascunho completo; criação exige `revisao_base`; edição exige `proposta_id` e `revisao_proposta` |
| `obter_proposta_programa` | Leitura; programa, base, diff e validação completos |
| `mostrar_proposta_programa` | Leitura; revisão visual da proposta |
| `aplicar_proposta_programa` | `treinos:write`; destrutiva; exige aluno/proposta/revisão exatos e decisão explícita |
| `consultar_operacao_programa` | Leitura pura; resultado confirmado ou `nao_confirmada` |
| `retomar_operacao_programa` | `treinos:write`; somente efeitos pendentes de uma aplicação já confirmada |
| `desfazer_alteracao_treino` | Tool legada; aceita `operation_id`; revisão e janela de restauração verificadas |

Os contratos de entrada/saída estão nos modelos de `mcp/tools.py`. Todo acesso verifica o aluno e o tenant autenticado; nenhum argumento aceita `personal_id`. Flags e escopos são verificados também em chamadas manuais. Interface somente leitura não salva/aplica/restaura propostas. Seleção/contexto não concede permissão nem confirma escrita. O guia orienta a salvar proposta quando o fluxo está habilitado; clientes textuais continuam atendidos.

## Consistência do programa

Foi adotado commit transacional sobre o modelo de itens existente. `PROGRAMA#REVISAO`, programa, resultado da operação, snapshot, estado da proposta, auditoria e notificação MCP são gravados em uma única transação. A revisão base e a existência do vínculo do aluno são condições da gravação. Portais, importação, CRUD, cópia, templates, rotinas e tools legadas usam o mesmo coordenador. Programa legado começa em revisão zero; a primeira gravação cria revisão um. Atualizações parciais preservam agregados de execução.

A aplicação usa ID determinístico vinculado a tenant, aluno, proposta e revisão. Uma repetição devolve a operação confirmada. Após timeout a UI lê proposta/operação; não reaplica automaticamente. `nao_confirmada` significa que não há registro confirmado disponível, não uma prova de que o host concluiu ou falhou. O estado transitório de processamento fica na UI; não há fila de aplicação assíncrona.

Propostas têm revisão própria, normalização com a biblioteca, diff no servidor e TTL configurável de sete dias. Edição recalcula diff/validação. Vídeo efetivo e regras são revalidados antes de aplicar. Pareamento usa `origem_id` ou nome único nos dois conjuntos; homônimos ambíguos viram adição/remoção. TTL é verificado por timestamp antes da limpeza do DynamoDB. Sessão ativa é verificada antes e como condição da transação; substituir/restaurar exige confirmação explícita quando o aluno está treinando.

Restaurar exige a operação exata, snapshot disponível por sete dias e revisão resultante ainda atual. Não sobrescreve uma edição posterior. A restauração também recebe ID determinístico e revisão nova. Importação do portal carrega a revisão ao abrir/exportar e respeita a revisão embutida no arquivo; um arquivo antigo não recebe silenciosamente a revisão atual do modal.

Agenda, catálogo e ponteiro têm pendências persistidas na operação e outbox `SCHED#dia / PROGRAMA_EFEITO#operation_id`. São retomados após commit, por tool de escrita ou pelo scheduler horário. Falha nesses efeitos não muda o sucesso do programa. Progresso é registrado por conjunto de efeitos; agenda/ponteiro usam condição de revisão e biblioteca usa ID determinístico/escrita condicional para tolerar retomadas concorrentes. Auditoria mantém TTL de 180 dias; notificações, 30 dias. Retomada não cria nova notificação nem incrementa revisão.

### Limites e decisão de lançamento

A transação permite até 100 chaves distintas, incluindo programa antigo/novo e controles. Há guardas conservadores de tamanho por item (390.000 bytes serializados) e conjunto (3.900.000 bytes). Programas/propostas acima dos limites recebem erro antes de alterar o programa. Não há divisão em batches para simular atomicidade.

Tamanhos reais de produção não foram medidos. Isso é um critério de lançamento pendente: levantar quantidade de ações e tamanho de proposta/snapshot em uma amostra autorizada. Se programas reais excederem os limites, a próxima decisão deve ser versões imutáveis com ponteiro ativo e adaptação de todos os leitores/escritores, conforme o plano. Não ativar escrita visual para esses programas sem essa decisão. A outbox retoma até 50 operações por dia consultado, dentro do orçamento do scheduler, por até sete dias; monitorar backlog no piloto.

## Flags e validação em desenvolvimento

A compatibilidade começa ligada; as flags do fluxo visual começam desabilitadas:

| Ambiente | SAM | Efeito |
|---|---|---|
| `MCP_COMPAT_MODE` | `McpCompatMode` | Padrão `true`: contrato publicado e writers legados; bloqueia escritores novos |
| `MCP_UI_ENABLED` | `McpUiEnabled` | Recursos e metadados UI |
| `MCP_PROPOSTAS_ENABLED` | `McpPropostasEnabled` | Consulta/salvamento de propostas |
| `MCP_APLICACAO_ENABLED` | `McpAplicacaoEnabled` | Aplicação de propostas |
| `MCP_UI_DOMAIN` | `McpUiDomain` | Origem de isolamento declarada para a UI |
| `MCP_PROPOSTA_TTL_S` | variável de ambiente | TTL do rascunho; padrão 604800 segundos |

Para consulta visual compatível, manter `MCP_COMPAT_MODE=true`, ligar `MCP_UI_ENABLED=true` e manter propostas/aplicação desligadas. Em ambiente dev isolado, desligar compatibilidade para testar o fluxo novo de propostas; liberar aplicação somente após testes de escrita. Configurar o domínio de isolamento aceito pelo host antes da submissão. A conexão MCP continua exigindo OAuth; o bundle não contém credenciais. Desabilitar UI remove as três consultas novas e mantém as ferramentas publicadas.

`MCP_COMPAT_MODE=true` seleciona as ferramentas e routers capturados diretamente das Lambdas publicadas (`app/compat/v1`, com hashes em `manifest.json`). Mantém os 13 contratos existentes, importações grandes por batch e desfazer com snapshots anteriores ao deploy. Bloqueia propostas, commit transacional e sua outbox, mesmo com outras flags ligadas. OAuth, URL e segredos continuam os atuais. O portal aceita exports sem revisão nesse modo. Não alternar writers legados e transacionais nos mesmos dados sem um procedimento de migração/rollback: as revisões não refletem alterações feitas pelo legado.

Com UI habilitada, `mcp/compat_visual_jsonrpc.py` acrescenta recursos e três ferramentas somente leitura: `abrir_coachpilot`, `mostrar_aluno` e `consultar_carteira_visual`. As chamadas antigas continuam delegadas integralmente ao snapshot. A carteira usa uma ferramenta distinta para preservar o schema e o resultado de `listar_alunos`. A ficha exporta o programa legado e acrescenta `chave_historico` somente ao resultado privado da consulta visual, permitindo consultar evolução sem IDs novos. Nenhuma revisão, snapshot ou proposta é criada pela consulta. A interface oculta controles de proposta e aplicação, inclusive para tokens de escrita; as ferramentas antigas continuam podendo gravar pelo chat conforme a autorização existente.

Após deploy, no painel do plugin: **MCPs → servidor conectado → Issues → Rescan**. A publicação das novas definições depende da validação automática do host. Em modo desenvolvedor, atualizar as ferramentas e abrir uma conversa nova para testar. Pedir “Abra minha carteira no CoachPilot”, buscar um aluno e verificar Treinos/Evolução. Não é necessário gerar um ZIP novo para uma atualização somente do MCP. Se o visual ainda não aparecer, conferir as definições aprovadas e os Issues; o deploy sozinho não comprova a renderização no ChatGPT.

Comandos locais, a partir da raiz:

```powershell
Push-Location backend
python -m pytest -q
Pop-Location
Push-Location frontend
npm ci
npm run build:mcp
npm test
npm run test:mcp-ui
npm run build
Pop-Location
sam validate --lint --template-file backend/template.yaml --region us-east-1
```

O Playwright inicia `backend/tests/visual_harness.py` em `127.0.0.1:8766`, com TestClient do MCP real, token de teste e DynamoDB em memória. O harness desliga explicitamente a compatibilidade; não usa AWS/contas reais e não faz parte das rotas publicadas. Usa Edge instalado; `CP_BROWSER_CHANNEL=chrome` seleciona Chrome instalado. Para inspeção manual, executar `python backend/tests/visual_harness.py` e abrir a URL local. Os testes cobrem consulta, restrições, card de contexto inline, pedido explícito ao chat, fallback sem tela cheia (`?nofs=1`), dados completos por aluno, edição/revisão, aplicação/restauração, somente leitura, teclado/320 px/tema escuro, atualização externa com edição pendente e unidades/direção da evolução.

Em 30/09/2026: pytest com 553 testes aprovados (incluindo 13 regressões de compatibilidade); Vitest com 229 testes aprovados; Playwright com seis fluxos aprovados; UI e portal compilados; validação SAM aprovada. Os testes boto3 verificam a serialização única e uma única chamada transacional, além dos fakes de serviço.

Antes de ativar o visual: testar OAuth, CSP, global/thread, tela cheia, tema e confirmação de escrita dentro do ChatGPT; validar conexão somente leitura e conflitos em dev; conferir amostras de tamanho e latência; atualizar submissão com flags/efeitos reais; fazer Rescan e piloto. Alteração incompatível de bundle/contrato deve ganhar novo URI/versionamento e preservar recursos necessários aos cards existentes.

## Publicação com compatibilidade

Manter `McpCompatMode=true`, `McpUiEnabled=true` (consulta visual; fixado em `deploy.ps1` e `samconfig.toml`), `McpPropostasEnabled=false` e `McpAplicacaoEnabled=false` no deploy de produção. Preservar os segredos do stack: parâmetros omitidos reutilizam os valores existentes. Gerar o changeset com `sam deploy --no-execute-changeset`, verificar ausência de remoções/substituições e só então executá-lo. Publicar o frontend com `deploy.ps1 frontend`, que trata os quatro manifests/CloudFronts.

Os testes de compatibilidade verificam seleção dos routers no boot, integridade do snapshot, 13 schemas publicados, token OAuth existente, importação de 110 exercícios pelos dois canais, retry, desfazer antigo, CRUD/templates/rotinas, confirmação de sessão e isolamento de tenant. Esse modo bloqueia o fluxo novo de propostas/aplicação pela tela; a consulta visual (carteira, ficha, treinos, evolução) funciona com `MCP_UI_ENABLED=true`. Para testá-las localmente, executar `python backend/tests/visual_harness.py` e abrir `http://127.0.0.1:8766`.

Deploy do commit `239041d` concluído em 01/10/2026 UTC (30/09 no Brasil): changeset inspecionado antes da execução, stack `personal-trainer-prod` em `UPDATE_COMPLETE` e quatro invalidações CloudFront concluídas. As 29 configurações anteriores de API/MCP foram comparadas por hash e preservadas, incluindo segredos OAuth; os outputs do stack também ficaram iguais. O pacote instalado foi conferido contra os snapshots e entrypoints locais. MCP/API health retornaram 200, descoberta OAuth 200, GET `/mcp` 405 e POST sem token 401 com desafio OAuth. HTML, manifest e bundle dos quatro frontends foram verificados. As verificações em produção não alteraram treinos ou dados de alunos; chamadas autenticadas e escrita foram exercitadas com dados fake nos testes locais.

Deploy do commit `c03f8d7` em 01/10/2026: consulta visual ligada (`McpCompatMode=true`, `McpUiEnabled=true`, propostas/aplicação `false`). Changeset só com modificações (nenhuma remoção/substituição); único parâmetro alterado foi `McpUiEnabled`, segredos preservados. Stack `UPDATE_COMPLETE`, Lambda MCP com as flags esperadas, health/descoberta OAuth 200, GET `/mcp` 405, POST sem token 401 com desafio OAuth, sem erros no log. Frontend não mudou (a UI do MCP vai embutida no backend). Pendente: Rescan e teste no ChatGPT.

## Experiência no chat (replanejamento de 01/10/2026)

Aplicação da 1ª entrega e de parte da 2ª do [replanejamento](../../PLANO_UX_COACHPILOT_CHATGPT.md) — a conversa é o caminho principal; card só quando ajuda a decidir.

- **Card do aluno = contexto para prescrever**, não cadastro: atenção de saúde (dores em aberto com data e origem; respostas positivas de saúde da anamnese, com a pergunta original), objetivo/idade, rotina lida da anamnese (dias por semana, tempo por treino, local, experiência — "não informado" quando falta), situação do programa e frequência. Nada inferido; o card nunca trunca restrição calado ("+ N itens — veja na ficha"). Ações: "Ver ficha" e "Analisar para revisar" (pedido explícito ao chat com nome e `aluno_id`, que diz para não aplicar nada) — ou "Preparar revisão" quando propostas estão ligadas.
- **Navegar não amplia.** Do card da carteira, o aluno abre como card. A tela cheia só por escolha ("Ver ficha"/"Abrir carteira"); ao sair dela, volta a card. Sem tela cheia no host, carteira e ficha oferecem o portal (`openLink`); só a revisão de proposta cresce dentro do chat. `host.ts` expõe `capabilities()`, e `context()`/`expand()` dizem se o host atendeu.
- **Modelo recebe resumo factual.** `mostrar_aluno`/`abrir_coachpilot` com aluno devolvem em `content` objetivo, programa, frequência, contagem de dores em aberto e status da anamnese (`app/mcp/resumo_modelo.py`), e apontam `detalhar_aluno`/`exportar_programa_treino` para prescrever. Texto livre do aluno não vai nesse resumo.
- **Diff por decisão.** `agruparDiferencas` junta os campos do mesmo exercício e agrupa por treino ("3 exercícios com mudança em 2 treinos · 1 treino incluído"); séries são formatadas com as unidades de cada lado (PERFORMANCE em s/m não vira reps/kg). Sem verde/vermelho para "melhor/pior". "Pedir ajuste" com contexto compartilhado só seleciona a proposta e orienta a escrever o ajuste — não inicia turno vazio.
- **Evolução honesta.** Melhor valor respeita `direcao` (MENOR = tempo de prova); rótulo "Melhor no período/nos registros", nunca "PR"; consulta no teto de 200 avisa que pode haver registros mais antigos.
- **Ficha.** Indicadores coloridos viraram uma linha de frequência; dados completos em seções humanas (avaliações, metas, notas), recarregados a cada aluno; programa abre só o treino vigente e cada bloco CrossFit/HIIT mostra os próprios exercícios com os parâmetros em linguagem de treino.

Fora deste ciclo, por decisão do plano: ativação de escrita (etapa 3 — migração dos writers legados), alteração focal com aplicação, lote e eventos.

## Etapas posteriores

O código entrega o fluxo principal das etapas 1–2 e a evolução da etapa 3. A integração hospedada da etapa 0 ainda depende do ambiente dev/ChatGPT. Deep links nativos, preferências completas de prescrição e skill empacotada ficam após estabilização do contrato no host. Lotes, eventos, menções, formulários ricos e arquivos continuam nas fases posteriores explicitamente previstas; não foram adicionados ao transporte atual.

## Referências verificadas

- [UI de plugins OpenAI](https://developers.openai.com/plugins/build/chatgpt-ui), [referência](https://developers.openai.com/plugins/reference) e [extensões](https://developers.openai.com/plugins/build/extensions).
- [Transações DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html), [permissões IAM](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis-iam.html) e [políticas SAM](https://github.com/aws/serverless-application-model/blob/develop/samtranslator/policy_templates_data/policy_templates.json). `DynamoDBCrudPolicy` já inclui `ConditionCheckItem`; Put/Update/Delete usam as permissões das operações correspondentes.
