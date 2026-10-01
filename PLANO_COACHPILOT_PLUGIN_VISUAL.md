# CoachPilot — planejamento do plugin visual no ChatGPT

Data: 30/09/2026; atualização em 01/10/2026. Status: fluxo prioritário implementado. Consulta visual compatível preparada com `MCP_COMPAT_MODE=true`, `MCP_UI_ENABLED=true` e propostas/aplicação desabilitadas. As 13 ferramentas e escritores publicados permanecem no snapshot v1. Carteira, aluno, treinos e evolução usam consultas adicionais de leitura. Publicado em 01/10/2026 (commit `c03f8d7`, `McpUiEnabled=true`); Rescan e validação no ChatGPT pendentes.

Entrega e ativação: [MCP_PLUGIN_VISUAL.md](docs/especificacoes/MCP_PLUGIN_VISUAL.md). Os itens marcados abaixo representam código e verificação local; não substituem os critérios de aceite no ChatGPT. Etapas de lotes e eventos permanecem posteriores ao fluxo principal.

Repositório: [viniciusmendespn/personal-trainer](https://github.com/viniciusmendespn/personal-trainer). Base analisada: branch `main`, commit `62e8ebbe5305f8ae3bc440d231dbb5087336af58`.

## 1. Decisão de produto

Transformar o plugin em uma área de trabalho para o personal: consultar o aluno, conversar sobre ajustes, revisar visualmente uma proposta e aplicar o programa no CoachPilot.

A primeira versão completa deve reunir três experiências:

1. **Card na conversa:** síntese do aluno, evolução ou proposta, com ação para abrir os detalhes.
2. **Painel ao lado do chat:** aluno e programa selecionados, com comparação entre o treino atual e o proposto.
3. **Entrada pela barra lateral:** carteira de alunos e pendências, com navegação para as mesmas telas.

A interface deve facilitar decisões que hoje exigem ler respostas longas ou abrir o portal. A IA continua sendo usada para analisar e propor. Navegar, filtrar, conferir e editar campos são interações diretas, sem exigir uma nova mensagem para cada clique.

**Principal entrega:** “Peço a alteração, vejo exatamente o que mudou, ajusto se necessário e aplico”.

### Limites da primeira versão

- Atender o personal autenticado, usando a carteira e as permissões existentes.
- Trabalhar com um aluno por proposta.
- Permitir consultar, propor, revisar, aplicar e restaurar programas.
- Oferecer gráficos de evolução e visão de pendências.
- Manter o fluxo textual funcional em clientes sem interface.
- Deixar execução de treino pelo aluno, financeiro completo, loja, checkout, mensagens automáticas e eventos para etapas posteriores.

## 2. Base existente e implicações

| Parte do repositório | Evidência encontrada | Decisão para a implementação |
|---|---|---|
| `backend/app/mcp/jsonrpc.py` | Transporte manual, stateless, protocolo `2025-06-18`; tools e prompts; sem handlers de recursos UI | Acrescentar recursos e metadados de interface de forma compatível |
| `backend/app/mcp/asgi.py` | FastAPI + Mangum, Lambda MCP separada do portal | Preservar a separação e validar o ciclo de vida de qualquer SDK antes de adotá-lo |
| `backend/app/mcp/tools.py` | 13 ferramentas, autorização por aluno, escopos, validação, snapshot e auditoria | Reutilizar os serviços; adicionar propostas e ferramentas de apresentação |
| `backend/app/services/programa_service.py` | Exporta programa; aplicação apaga e recria itens em chamadas de batch distintas | Resolver concorrência e falha parcial antes de liberar a nova escrita |
| `backend/app/services/validacao_programa.py` | Regras de formato, blocos, unidades e biblioteca | Reutilizar a validação no servidor em todos os canais |
| `backend/app/services/contexto_aluno_service.py` | Agrega perfil, anamnese, avaliações, sessões e relatos; falhas por seção viram valores vazios | Identificar seção indisponível separadamente de ausência real de dados |
| `frontend/src/components/AtualizarTreinoIAModal.tsx` | Exportação/importação de JSON e validação | Reaproveitar lógica; criar fluxo visual específico para o plugin |
| `frontend/src/components/RelatorioImportIA.tsx` | Relatório com erros, avisos e ações | Extrair componente apresentacional adaptável à UI do plugin |
| `frontend/src/index.css` | Temas claro/escuro, roxo, verde, fontes Sora/Inter e paleta categórica | Usar identidade de marca com tokens adaptados ao host |
| `frontend/package.json` | React 19, Vite, Tailwind, React Query, Recharts e Lucide | Criar entrada de build dedicada aproveitando dependências úteis |
| `backend/template.yaml` | Lambda MCP com DynamoDB; timeout global de 29 s; frontend S3/CloudFront | Manter operações curtas e empacotar o primeiro recurso UI junto da Lambda |
| `backend/tests/test_mcp_*.py` | Testes de protocolo, OAuth, tenant, escrita, validação e submissão | Estender os testes de contrato e regras críticas |

As ferramentas atuais são: `guia_de_prescricao`, `listar_alunos`, `detalhar_aluno`, `exportar_programa_treino`, `listar_biblioteca_exercicios`, `historico_sessoes`, `evolucao_exercicio`, `resumo_carteira`, `agenda_periodo`, `validar_programa_treino`, `aplicar_programa_treino`, `atualizar_treino` e `desfazer_alteracao_treino`.

Essa análise é estática. Não comprova disponibilidade, desempenho ou comportamento do plugin publicado. Revalidar o commit e as instruções do repositório antes de implementar.

## 3. Uso das funcionalidades atuais da OpenAI

As capacidades abaixo foram conferidas na documentação oficial indicada ao final. São capacidades documentadas, sujeitas à disponibilidade no cliente e à aprovação do plugin.

| Capacidade | Aplicação proposta | Etapa |
|---|---|---|
| MCP Apps UI | Cards, revisão e gráficos | Primeira versão |
| Entrada global | Abrir carteira pela barra lateral | Primeira versão |
| Entrada de conversa | Manter aluno e proposta ao lado do chat | Primeira versão |
| Tela cheia | Comparações extensas e carteira | Primeira versão |
| Contexto entre modelo e app | Compartilhar aluno/proposta selecionados | Primeira versão |
| Deep links | Reabrir aluno ou proposta | Após o fluxo principal |
| Configurações | Preferências de exibição e parâmetros padrão do personal | Após o fluxo principal |
| Menções no compositor | Selecionar alunos sem ambiguidade | Evolução desktop |
| Formulários ricos | Selecionar aluno ou preencher dados essenciais ausentes | Evolução opcional |
| Arquivos | Importação assistida de programa compatível | Evolução opcional |
| Picture-in-picture | Eventual acompanhamento de atividade contínua | Sem uso inicial convincente |
| MCP Events | Monitorar check-ins, relatos e vencimentos | Fase independente |
| Skills no pacote | Ensinar fluxos consistentes de revisão | Após estabilizar contratos |

Fontes: [extensões][1], [MCP Apps UI][2], [referência][3], [skills][5] e [eventos][6].

### Disponibilidade e alternativas

A documentação informa que menções no compositor são exclusivas do desktop e que extensões web ainda estão previstas para Free e Go. Não anunciar paridade universal. Detectar capacidades e oferecer caminhos equivalentes: card e tela cheia quando o painel não existir; busca interna quando não houver menções; resposta textual quando não houver UI. [1]

## 4. Arquitetura de informação

### 4.1 Carteira — entrada global

Abrir com uma tela útil, sem tour obrigatório:

- Cabeçalho compacto com CoachPilot e busca por aluno.
- Resumo: alunos ativos, treinos que precisam de revisão e alunos sem atividade recente.
- Filtros: todos, sem treino vigente, vencidos, próximos do vencimento e sem treinar.
- Lista com nome, objetivo resumido, última atividade e pendência principal.
- Ação por linha: “Abrir aluno”.
- Busca e filtros preservados quando o personal volta da ficha.

Ordenar por urgência verificável, com opção de ordem alfabética. Explicar critérios de filtros, incluindo a janela de “próximos do vencimento”. Mensalidades ficam em uma seção secundária, pois não são o foco da prescrição.

### 4.2 Aluno — painel de conversa

Cabeçalho fixo: nome, objetivo, última atualização e estado da conexão. Abas propostas:

| Aba | Conteúdo | Ação principal |
|---|---|---|
| Visão geral | Frequência, pendências, restrições informadas e dados recentes | Pedir revisão do programa |
| Treinos | Divisão, exercícios, séries, intervalos e vigência | Preparar alteração |
| Evolução | Histórico e gráficos por exercício | Analisar período |

As restrições relevantes aparecem também na revisão, sem depender da abertura da aba de anamnese. Mostrar origem/data dos dados quando disponíveis. Ausência de informação deve aparecer como “Não informado”; erro de consulta como “Não foi possível carregar”.

Anotações privadas, respostas completas de anamnese e conversas ficam recolhidas e são carregadas conforme necessidade. Não colocar o dossiê inteiro em todas as respostas.

### 4.3 Proposta — tela de revisão

- Cabeçalho com aluno, objetivo da alteração e estado “Proposta — ainda não aplicada”.
- Resumo determinístico das alterações: treinos, exercícios e campos afetados.
- Filtro “Somente alterações”, ativo inicialmente, e opção “Programa completo”.
- Agrupamento por treino; itens sem mudanças recolhidos.
- Comparação “Atual / Proposto” em telas largas; blocos empilhados no painel estreito.
- Erros bloqueantes próximos ao campo; avisos em seção própria.
- Ação principal: “Aplicar programa”. Secundária: “Pedir ajuste”.
- Depois de aplicar: confirmação com horário, resumo, “Ver programa” e acesso a desfazer.

Não mostrar um diff de JSON ao personal. Séries, repetições, intervalos, observações, vigência, substitutos, vídeos, unidades e blocos precisam ser compreensíveis em linguagem de treino.

Edições diretas da primeira versão: séries, repetições, carga, intervalo, observação e vigência, quando compatíveis com o tipo de exercício. Alterações complexas em CrossFit/HIIT e substituição de exercícios podem começar pelo chat. Não converter todas as modalidades em uma tabela de musculação genérica.

## 5. Fluxos prioritários

### F01 — Consultar um aluno

1. Personal pede “Como está a Mariana?” ou a seleciona na carteira.
2. Resolver a identidade usando dados atuais. Havendo homônimos, apresentar opções.
3. Consultar contexto e mostrar resumo com botão “Abrir aluno”.
4. Ao abrir, compartilhar com o modelo a identificação explícita da seleção.
5. Trocar de aluno atualiza o contexto; propostas anteriores permanecem vinculadas ao aluno original.

### F02 — Ajustar um programa

1. Carregar guia de prescrição, dados relevantes e programa atual com revisão.
2. Modelo prepara programa completo, preservando partes não solicitadas.
3. Servidor normaliza, valida, calcula diferenças e salva proposta.
4. Card informa o resumo e permite abrir a revisão.
5. Personal edita campos ou pede ajustes; cada alteração cria nova revisão da proposta.
6. Ao aplicar, servidor confere novamente autorização, escopo, revisão base, validade e sessão em andamento.
7. Grava de forma consistente; retorna identificador da operação e revisão resultante.
8. UI confirma somente após o servidor confirmar; modelo recebe resultado suficiente para relatar o ocorrido.

Não exigir confirmação adicional para salvar um rascunho quando a ação já foi pedida. A revisão visual deve ser a confirmação de produto para a aplicação; respeitar eventuais aprovações exigidas pelo host sem criar modais redundantes.

### F03 — Criar o primeiro programa

Mostrar estado vazio com ação “Montar primeiro programa”. Consultar perfil e biblioteca; perguntar apenas o que faltar para cumprir o pedido, como frequência e objetivo. Aplicar pelo mesmo fluxo de proposta, usando “Sem programa atual” na comparação.

### F04 — Evolução de exercício

Selecionar exercício e período; apresentar carga, repetições, volume ou métrica apropriada. Exibir unidade, datas e quantidade de registros. Se dados faltarem, mostrar os pontos existentes e explicar a cobertura. Disponibilizar tabela acessível equivalente ao gráfico. Valores de força, tempo, distância e calorias não podem ser misturados em uma única escala.

### F05 — Restaurar alteração

Associar o desfazer à operação exata, mostrando o que será restaurado. Se o programa mudou depois, bloquear restauração silenciosa e abrir comparação para nova decisão. Respeitar a janela de sete dias e verificá-la na aplicação, sem depender da remoção física por TTL.

### F06 — Revisar vários alunos, em fase posterior

Selecionar alunos, gerar uma proposta individual para cada um e acompanhar estados por linha. Aplicar apenas o conjunto explicitamente escolhido. Falha em um aluno não transforma o lote inteiro em sucesso ou em rollback implícito. Permitir retomar pendentes e repetir falhas sem reaplicar itens concluídos.

## 6. Padrão visual e interação

As medidas abaixo são decisões propostas para o CoachPilot, não requisitos oficiais da OpenAI. A referência oficial recomenda interfaces focadas e oferece `@openai/apps-sdk-ui` como biblioteca opcional. [4]

### Identidade e tokens

| Elemento | Padrão proposto |
|---|---|
| Marca | Ícone existente e nome em cabeçalho discreto |
| Ação principal | Roxo da marca `#6366F1`, com estados acessíveis |
| Cor secundária | Verde da marca apenas em destaques pontuais; evitar usá-lo como decoração geral |
| Superfícies e textos | Tokens compatíveis com tema claro/escuro informado pelo host |
| Tipografia | Fonte do sistema/host; Sora opcional em título de marca, sem carregamento externo obrigatório |
| Tamanho de texto | Corpo 14–16 px; título de seção 18–20 px; evitar informação essencial abaixo de 12 px |
| Espaçamento | Escala 4, 8, 12, 16, 24 e 32 px |
| Bordas | Sutis, raio sugerido de 8–12 px; evitar excesso de cards aninhados |
| Ícones | Lucide, já usado no projeto; controles com rótulos acessíveis |
| Gráficos | Preservar mapeamento estável por categoria, com ajustes de contraste por tema |
| Movimento | Transições curtas e opcionais; respeitar redução de movimento |

Não importar diretamente o `index.css` inteiro: ele altera `body`, fontes, gradientes e seletores globais. Extrair tokens e estilos locais para o bundle do plugin. Evitar fundo com brilho, gradientes decorativos, menu de navegação duplicado e banners promocionais no fluxo de trabalho.

Avaliar os componentes básicos do Apps SDK UI no protótipo. Usar componentes existentes quando forem apresentacionais e acessíveis; adaptar dependências de router, autenticação, toast e modal. Evitar duas bibliotecas concorrentes para os mesmos controles.

### Regras de usabilidade

- No card, uma decisão principal e no máximo uma ação secundária visível.
- No painel, revelar detalhes progressivamente; expansão deve ser escolha do usuário.
- Não abrir tela cheia apenas por carregar um aluno.
- Manter nome do aluno e estado da proposta visíveis durante revisão.
- Usar “Salvar proposta”, “Aplicar programa” e “Restaurar programa” para ações distintas.
- Carregamento por seção, sem apagar conteúdo útil durante atualização.
- Persistir edições de proposta no servidor; sinalizar “Salvando”, “Salvo” e falha real.
- Não substituir foco ou rolar a página quando o modelo atualizar dados.
- Ações de gravação não recebem sucesso otimista.
- Cliques em filtro/aba não geram mensagens do assistente.
- Pedido à IA é uma ação explícita, como “Analisar evolução” ou “Pedir ajuste”.

### Responsividade e acessibilidade

Testar largura de 320 px até tela cheia. Usar container queries para adaptar a interface ao espaço disponível. No mobile, trocar tabelas extensas por grupos de campos e evitar rolagem horizontal. Rodapé de ações deve respeitar teclado e áreas seguras.

Meta de acessibilidade: WCAG 2.2 AA, incluindo contraste, teclado, foco visível, rótulos, mensagens de erro associadas aos campos e estados anunciados sem interrupção excessiva. Alvos de toque preferencialmente com 44 px. Distinguir “adicionado”, “removido” e “alterado” por texto/ícone, além da cor.

## 7. Arquitetura proposta

### 7.1 Backend e transporte

Preservar os serviços Python compartilhados. Criar módulo de recursos UI e estender o registro de ferramentas para metadados e schemas de saída. Implementar descoberta/leitura dos recursos conforme a versão MCP efetivamente suportada e verificada no protótipo.

O transporte atual foi escrito para contornar requisitos de lifespan incompatíveis com a Lambda existente. Não trocar automaticamente para um servidor stateful. Comparar o adaptador atual estendido com um SDK compatível; decidir com base no teste real de inicialização, OAuth, tools e leitura de recurso no ChatGPT.

MCP Apps usa `_meta.ui.resourceUri` e a ponte `ui/*`; recursos HTML usam `text/html;profile=mcp-app`. Priorizar APIs padronizadas e isolar extensões específicas da OpenAI em um adaptador. Manter ferramentas úteis sem UI. Versionar a URI quando o contrato do bundle mudar. [2][3]

### 7.2 Frontend

Criar uma entrada de build dedicada, sugerida em `frontend/src/mcp-app/`, sem iniciar router/autenticação/PWA do portal. Compartilhar tipos e componentes independentes de transporte.

Separar três camadas:

1. **Apresentação:** carteira, aluno, revisão, evolução, estados vazios e erros.
2. **Casos de uso:** carregar aluno, salvar revisão da proposta, aplicar e consultar operação.
3. **Adaptador host:** receber resultados, chamar tools, sincronizar contexto, solicitar apresentação e abrir links.

Os componentes não devem acessar diretamente `window.openai`. O adaptador detecta capacidades e oferece alternativas. Navegação local e alterações de filtros não dependem de inferência.

### 7.3 Publicação dos recursos

Primeira opção: gerar bundle HTML/JS/CSS autocontido e copiá-lo para o pacote da Lambda MCP antes do SAM build. A Lambda entrega o HTML por recurso MCP, com cache em memória por versão. Evita uma nova distribuição obrigatória na primeira entrega.

Medir tamanho e tempo de carregamento. Carregar gráficos sob demanda ou dividir recursos se o bundle crescer; nesse caso, publicar assets versionados no S3/CloudFront existente e declarar os domínios exatos. Não remover assets ainda referenciados por definições aprovadas.

Declarar domínio próprio da UI e CSP conforme o host. Evitar frames internos na primeira versão; vídeos podem ser links externos ou thumbnails autorizadas. Um embed futuro precisa de CSP e justificativa próprias. Não enviar tokens OAuth para JavaScript nem depender de cookies do portal dentro do iframe.

### 7.4 Recurso e entrypoints

Proposta de recurso: `ui://coachpilot/workspace/v1.html`. Os nomes são novos e devem ser confirmados na implementação.

Registrar uma ferramenta de abertura com entrypoints global e de conversa, usando os metadados documentados `openai/ui` e tipos `global` / `thread`. O recurso também pode ser apresentado por ferramentas dedicadas a aluno e proposta. [1]

Separar leitura de dados de renderização para evitar abrir um card a cada chamada interna. Uma revisão de treino pode consultar várias tools e apresentar somente o resultado final.

## 8. Contratos de ferramentas e dados

### Novas ferramentas propostas

| Nome sugerido | Responsabilidade | Efeito |
|---|---|---|
| `abrir_coachpilot` | Abrir workspace com rota opcional autorizada | Leitura/UI |
| `mostrar_aluno` | Apresentar aluno selecionado | Leitura/UI |
| `salvar_proposta_programa` | Normalizar, validar e persistir rascunho com revisão base | Escrita de rascunho |
| `obter_proposta_programa` | Ler proposta, diff, validação e revisão | Leitura |
| `mostrar_proposta_programa` | Apresentar uma proposta por ID | Leitura/UI |
| `aplicar_proposta_programa` | Aplicar revisão exata de proposta | Escrita do programa |
| `consultar_operacao_programa` | Recuperar resultado após timeout ou reconexão | Leitura |

Evitar tool por componente ou por botão. Cancelamento e atualização de rascunho podem usar operações explícitas em contratos pequenos, sem uma ferramenta genérica capaz de alterar qualquer entidade.

Uma proposta persistida é uma escrita, mesmo sem alterar o treino ativo: não marcá-la como `readOnlyHint`. No início, usar o escopo de escrita de treinos existente para salvar propostas. Conexão somente leitura pode analisar e exibir sugestões, mas não persistir/aplicar proposta sem a permissão correspondente. Qualquer granularidade adicional exige migração de escopos e consentimento.

### Conteúdo retornado

- `structuredContent`: resultado conciso, IDs autorizados, estado, revisão e resumo necessário ao modelo.
- `content`: mensagem breve, evitando repetir o JSON completo.
- `_meta`: detalhes autorizados destinados à interface, quando dispensáveis ao raciocínio do modelo.
- `outputSchema`: contratos versionados e consistentes para as novas ferramentas.

`_meta` não substitui autorização e não deve conter segredos. Quando o modelo precisar raciocinar sobre um detalhe, fornecê-lo por tool de leitura explícita. A separação dos canais é descrita na referência oficial. [3]

### Proposta persistida

Campos mínimos sugeridos: ID, personal derivado da autenticação, aluno, revisão da proposta, revisão/hash base, programa normalizado, resumo do pedido, diferenças calculadas, relatório de validação, data de criação/atualização, expiração, estado e operação aplicada.

Persistir somente dados necessários à proposta; evitar cópia integral de chat e anamnese. TTL sugerido de sete dias para rascunhos, configurável. Validar expiração por timestamp a cada uso.

Estados: `rascunho`, `valida`, `invalida`, `desatualizada`, `aplicando`, `aplicada`, `descartada`, `expirada`. A apresentação usa rótulos em português. Revisar um rascunho invalida qualquer aprovação ligada à revisão anterior.

### Diferenças e normalização

Calcular diff no servidor usando programa normalizado, incluindo substituições de vídeo feitas pela regra de biblioteca. A revisão deve mostrar o que será realmente gravado.

O export atual usa referências de posição e a aplicação gera novos IDs. Não tratar nome ou posição como identidade garantida. Acrescentar identificadores estáveis de origem no contrato interno da proposta, sem quebrar o formato de importação existente. Quando o pareamento for ambíguo, mostrar remoção/adição explicitamente. Ordenação, valores nulos e campos calculados devem ser normalizados para evitar diferenças falsas.

## 9. Consistência da escrita — requisito antes do lançamento

### Problemas concretos a endereçar

1. O serviço atual remove itens antigos e depois grava os novos em batches separados. Uma falha pode deixar o programa incompleto.
2. Não há revisão base no contrato atual de aplicação; portal e plugin podem sobrescrever alterações feitas após a leitura.
3. A proteção de replay atual cria a marca de idempotência antes de concluir a aplicação. O novo fluxo precisa distinguir operação em execução, falha e sucesso confirmado.
4. Restaurar a última snapshot sem verificar alterações posteriores pode desfazer trabalho mais recente.

### Estratégia recomendada

Adicionar revisão do programa por aluno e coordenar todas as escritas que o alterem, inclusive portal, importação, tools legadas e restauração. A checagem e a mudança da revisão devem fazer parte da operação consistente; comparar hash fora da gravação não resolve a corrida.

Para programas que couberem nos limites transacionais vigentes do DynamoDB, implementar commit transacional com condição de revisão, alteração dos itens essenciais, registro da operação e informação necessária à recuperação. Calcular tamanho e quantidade antes de escrever. Validar os limites na documentação AWS durante a implementação.

Se programas reais excederem esses limites, adotar versões imutáveis com troca atômica de ponteiro ativo e adaptar todos os leitores/escritores envolvidos. Não simular atomicidade dividindo uma transação em vários batches. Esse caminho é uma decisão arquitetural da fase 0 e pode ampliar o esforço.

Auditoria, notificações, agenda e catálogo precisam de estratégia idempotente de pós-commit, com registro persistido de pendências e retomada. Não retornar falha genérica após programa aplicado só porque a notificação falhou. Snapshot deve existir de forma recuperável antes da substituição.

### Repetições e sessões ativas

Usar chave de idempotência vinculada a tenant, aluno, proposta e revisão. Repetição retorna o resultado da mesma operação. Timeout ambíguo leva a consultar status; não reaplica imediatamente.

Manter a regra de sessão em andamento: explicar o efeito observado no código, pedir decisão quando necessário e checar novamente ao aplicar. Desfazer exige o mesmo cuidado de sessão ativa e concorrência.

O validador atual verifica estrutura e regras de prescrição codificadas; não equivale a uma avaliação clínica automática de todas as restrições. A interface deve apresentar restrições e exigir revisão profissional sem chamar o programa de “clinicamente seguro” apenas porque passou na validação técnica.

## 10. Contexto, busca e desempenho

### Contexto entre chat e interface

Compartilhar seleção mínima: aluno, nome, treino/proposta, revisão e tela. Contexto ajuda a resolver “esse treino”; não concede autorização nem vale como confirmação. Cada escrita referencia IDs e revisão explícitos.

Propostas não mudam de aluno quando o usuário navega. Duas conversas abertas podem ter seleções diferentes. Ao receber atualização externa, recarregar dados sem apagar edições locais; sinalizar conflito quando necessário.

### Correções de busca

`listar_alunos` promete ignorar acentos, mas atualmente usa apenas `lower()`. Corrigir normalização de acento e caixa. O filtro de nome ocorre após a paginação, portanto a UI deve continuar usando o cursor mesmo se uma página filtrada vier vazia.

Na implementação, buscar páginas até atingir quantidade útil ou limite de trabalho, retornando cursor e cobertura de busca. Não declarar “nenhum aluno” enquanto houver páginas relevantes não examinadas. Para carteiras maiores, avaliar índice de busca apropriado; evitar scans globais.

### Carregamento e limites

- Usar resumo de carteira para a lista; não buscar dossiê de todos os alunos.
- Carregar histórico e gráficos ao abrir a seção.
- Evitar repetir contexto em `detalhar_aluno` e `exportar_programa_treino`; neste último usar `incluir_contexto=false` quando já consultado.
- Medir o volume do guia e da biblioteca; carregar trechos e exercícios necessários sem perder regras obrigatórias.
- Cache por tenant/aluno/revisão, com invalidação após gravação e limpeza ao desconectar.
- Debounce de busca sugerido em 250–350 ms; agrupar salvamento de campos.
- Limitar payloads e retornar totais/cobertura; nunca truncar restrições silenciosamente.
- A geração da proposta ocorre na conversa, sem manter uma chamada Lambda aberta aguardando o modelo.

## 11. Organização sugerida do código

Os caminhos novos abaixo são propostas. Ajustar às convenções do repositório na execução.

| Área | Arquivos/pastas | Trabalho |
|---|---|---|
| Transporte | `backend/app/mcp/jsonrpc.py` | Recursos, capacidades e contratos compatíveis |
| Registro | `backend/app/mcp/tools.py` | Metadados UI, schemas e encaminhamento aos serviços |
| Recursos | `backend/app/mcp/ui_resources.py`, `backend/app/mcp/ui_dist/` | Catálogo e bundle versionado |
| Propostas | `backend/app/models/proposta_programa.py`, `backend/app/services/proposta_programa_service.py` | Revisões, diff e validação |
| Escrita | `programa_service.py`, repositório e todos os callers | Commit consistente, concorrência, idempotência e restauração |
| Frontend | `frontend/src/mcp-app/` | Entrada, adaptador host, telas e tokens |
| Reuso | Componentes de relatório, gráficos, tipos e utilitários | Extrair apresentação sem acoplar autenticação do portal |
| Build | Configuração Vite dedicada, `deploy.ps1`, `backend/template.yaml` | Gerar/copiar bundle e manter assets antigos |
| Testes | Testes MCP existentes e novos testes de proposta/UI | Fluxos críticos e compatibilidade |
| Documentação | `docs/especificacoes/MCP_*.md` | Atualizar descrição, contratos, permissões e revisão do plugin |

Não adicionar chamada paga à API OpenAI apenas para renderizar a UI ou operar filtros. O planejamento usa a inferência da conversa e o backend atual; custos adicionais esperados são computação, armazenamento e tráfego, a medir no piloto. Eventos e processamento de lotes podem exigir infraestrutura adicional.

## 12. Etapas e entregáveis

### Etapa 0 — Confirmar integração e desenho da escrita

- [ ] Revalidar repositório, documentação e disponibilidade das extensões.
- [x] Fazer protótipo mínimo de recurso UI autenticado no ambiente de desenvolvimento local, com backend controlado.
- [ ] Testar card, tela cheia, entrypoints e fallback sem UI.
- [x] Confirmar estratégia de transporte sem incompatibilidade com Lambda: preservar JSON-RPC stateless/Mangum e adicionar recursos.
- [ ] Levantar tamanhos reais de programa e todos os caminhos de escrita.
- [x] Decidir commit transacional ou programa versionado com ponteiro ativo: transação única com limites verificados; programas excedentes recusados sem gravação parcial.
- [x] Documentar decisão e critérios de compatibilidade.

Documentação oficial revalidada. Disponibilidade real das extensões, OAuth/CSP/entrypoints no ChatGPT e tamanhos reais de produção ainda precisam ser verificados antes do lançamento.

**Saída:** integração comprovada e desenho de consistência aprovado tecnicamente; não apenas um mockup.

### Etapa 1 — Consulta visual

- [x] Build dedicado e adaptador host.
- [x] Carteira com busca e filtros corretos.
- [x] Card e painel de aluno.
- [x] Estados de erro, dados parciais, desconexão e somente leitura.
- [x] Temas claro/escuro, teclado e responsividade.

**Saída:** versão utilizável para consultar alunos, inclusive em conexão somente leitura.

### Etapa 2 — Propostas e aplicação confiável

- [x] Propostas persistidas, revisões e expiração.
- [x] Normalização/diff no servidor.
- [x] Revisão visual e edição dos campos definidos.
- [x] Escrita consistente compartilhada com portal e tools legadas.
- [x] Status de operação e idempotência: resultado confirmado/sem confirmação; timeout consulta antes de qualquer repetição.
- [x] Restauração vinculada à operação e protegida por revisão.
- [x] Testes de concorrência, falha parcial e sessão ativa.

**Saída:** fluxo completo de ajuste de treino. Esta é a principal entrega comercial.

### Etapa 3 — Evolução e navegação avançada

- [x] Gráficos e tabela de evolução, com separação de unidades e cobertura informada.
- [ ] Deep links autorizados para aluno/proposta.
- [x] Melhorias de contexto entre conversa e UI.
- [x] Preferências de exibição no plugin: ordenação via estado do host quando disponível.
- [ ] Skill de revisão com os contratos estabilizados.

**Saída:** experiência diária de acompanhamento e prescrição.

### Etapa 4 — Lotes

- [ ] Seleção múltipla e propostas independentes.
- [ ] Progresso persistido e retomada.
- [ ] Aplicação apenas dos itens selecionados.
- [ ] Tratamento de resultados parciais e limites de execução.

**Saída:** revisão de carteira sem uma chamada longa ou transação global.

### Etapa 5 — Eventos e extensões opcionais

MCP Events exige protocolo `2026-07-28`/MCP 2.0, assinaturas persistentes e webhooks. É uma migração de capacidade, não uma troca de constante. Implementar descoberta, inscrição/cancelamento, verificação de callback, deduplicação, expiração e revogação. [6]

Começar com check-in recebido e programa vencendo, mediante pedido do personal. O backend precisa produzir eventos de calendário por scheduler e eventos de mudança após commit. Evitar que uma ação acionada pelo evento gere um ciclo de novas ações. A primeira automação deve analisar e propor; escrita de treino segue a autorização do fluxo.

Menções, formulários ricos e arquivos entram apenas quando resolverem fricção observada. Não registrar o plugin como visualizador de todo JSON ou PDF. Importação deve reconhecer um formato específico e validar antes de persistir/aplicar.

## 13. Testes e critérios de aceite

| Cenário | Resultado exigido |
|---|---|
| Usuário somente leitura | Consulta funciona; servidor recusa escrita mesmo com chamada manual |
| Aluno/proposta de outro personal | Acesso recusado sem vazar conteúdo |
| Busca com acento e aluno em página posterior | Localiza corretamente ou informa busca parcial com continuação |
| Seleção muda com proposta aberta | Proposta continua vinculada ao aluno original |
| Edição da proposta | Nova revisão; diff e validação recalculados |
| Alteração concorrente pelo portal | Aplicação recusa base antiga e apresenta atualização necessária |
| Duplo clique/retry/timeout | Uma aplicação; resultado recuperável por operação |
| Falha durante commit | Programa anterior ou novo íntegro; nunca sucesso com programa parcial |
| Notificação falha após commit | Programa consta aplicado; pendência é retomada sem reaplicar |
| Sessão em andamento | Regra é exibida e revalidada no momento da escrita |
| Programa inválido | Erros por campo; nenhuma alteração no programa ativo |
| Biblioteca altera vídeo | Revisão mostra o vídeo efetivo que será usado |
| Seção de contexto falha | UI distingue indisponível de “sem restrições” |
| Desfazer após outra alteração | Não sobrescreve silenciosamente o programa novo |
| Proposta/snapshot expirada ainda no banco | Expiração respeitada mesmo antes da limpeza TTL |
| Sem recursos de UI no cliente | Tools e fluxo textual continuam funcionais |
| Tema e mobile | Conteúdo legível, sem corte de ações ou rolagem horizontal obrigatória |
| Teclado/leitor de tela | Campos, navegação, erros e estados acessíveis |
| CrossFit/HIIT/PERFORMANCE | Blocos, métricas, unidades e campos preservados |

Executar pytest para contratos e serviços, Vitest para estado/adaptação/apresentação e um fluxo integrado de UI com backend controlado. Se necessário, adicionar Playwright para os caminhos de navegação e revisão. Validar também dentro do ChatGPT: um harness local não prova funcionamento de OAuth, CSP, entrypoints e aprovações do host.

Reexecutar regressão de importação/exportação do portal, uso textual do MCP, histórico e app do aluno, pois a escrita do programa é compartilhada. Não transformar todo o projeto em escopo de refatoração.

## 14. Publicação e adoção

1. Usar ambiente e conexão de desenvolvimento com dados de teste.
2. Liberar leitura visual primeiro; nova escrita só após critérios da etapa 2.
3. Manter contratos aprovados enquanto novas definições aguardam análise.
4. Versionar recurso e bundle; manter compatibilidade com cards já abertos.
5. Atualizar descrições e documentação de submissão para refletir UI, efeitos e permissões reais.
6. Após deploy, solicitar Rescan do MCP e verificar as definições efetivamente disponíveis.
7. Alterações no pacote/skills exigem nova versão do ZIP e revisão correspondente; usar o mesmo plugin. [7]
8. Fazer piloto pequeno com tarefas reais: consultar aluno, ajustar treino, identificar conflito e desfazer.
9. Expandir após avaliar erros e tempo para concluir as tarefas.

Usar feature flags separadas para consulta UI, propostas e aplicação nova. Desabilitar UI não deve quebrar tools textuais. Rollback de apresentação pode apontar para recurso anterior; rollback da escrita não pode reintroduzir um caminho incompatível com revisões já gravadas.

### Métricas propostas

- Tempo entre pedido de ajuste e proposta válida.
- Tempo entre abertura da revisão e aplicação.
- Percentual de propostas aplicadas, ajustadas e descartadas.
- Erros de validação, conflitos e operações recuperadas após timeout.
- Uso de painel versus abertura do portal.
- P95 das tools de consulta, salvamento e aplicação.
- Taxa de sucesso separada por cliente/superfície quando essa informação estiver disponível.

Registrar IDs de correlação e estados, sem armazenar anamnese ou conteúdo completo de chat em logs analíticos. Definir metas numéricas após medir a versão atual e o piloto.

## 15. Orientação para execução com Codex

Implementar por etapa, com entregas pequenas e verificáveis. Começar lendo o MCP, os serviços de programa, os testes existentes e este documento. Revalidar a documentação oficial das APIs usadas, especialmente extensões e transporte.

Preservar regras de biblioteca, tipos de exercício, anamnese como dado não confiável, isolamento por personal e histórico de sessões. Evitar duplicar regras no frontend. A primeira prova deve ser uma UI real autenticada; o primeiro fluxo de escrita deve incluir concorrência, idempotência e recuperação.

Não começar por eventos, lote ou reconstrução do portal inteiro. A sequência de valor é: consulta visual → revisão/aplicação confiável → evolução → lotes → monitoramento.

## 16. Fontes e rastreabilidade

Documentação oficial consultada em 30/09/2026. Recursos podem mudar; conferir novamente na implementação.

[1]: https://developers.openai.com/plugins/build/extensions
[2]: https://developers.openai.com/plugins/build/chatgpt-ui
[3]: https://developers.openai.com/plugins/reference
[4]: https://developers.openai.com/plugins/concepts/ui-guidelines
[5]: https://developers.openai.com/plugins/build/skills
[6]: https://developers.openai.com/plugins/build/mcp-events
[7]: https://developers.openai.com/plugins/deploy/submission

- [Extensões: sidebar, painéis, contexto, formulários e menções][1]
- [MCP Apps, ponte com host e recursos de UI][2]
- [Metadados, resultados, modos de apresentação e CSP][3]
- [Diretrizes oficiais de interface][4]
- [Skills para fluxos repetíveis][5]
- [Eventos MCP][6]
- [Atualização e publicação do plugin][7]
- [Código MCP analisado](https://github.com/viniciusmendespn/personal-trainer/tree/62e8ebbe5305f8ae3bc440d231dbb5087336af58/backend/app/mcp)
- [Serviço de programa analisado](https://github.com/viniciusmendespn/personal-trainer/blob/62e8ebbe5305f8ae3bc440d231dbb5087336af58/backend/app/services/programa_service.py)
- [Estilos analisados](https://github.com/viniciusmendespn/personal-trainer/blob/62e8ebbe5305f8ae3bc440d231dbb5087336af58/frontend/src/index.css)

Os nomes de ferramentas novas, a organização de arquivos, os padrões visuais e a ordem das etapas são recomendações deste planejamento. Não representam funcionalidades já implementadas no CoachPilot.
