# Plugin visual CoachPilot — consulta na tela, ação pela conversa

A tela do plugin no ChatGPT **só lê**. Os botões dela enviam um pedido de texto à conversa, e quem
grava é o ChatGPT com as 13 tools já publicadas (`aplicar_programa_treino`, `atualizar_treino`,
`desfazer_alteracao_treino`…), depois da confirmação do personal. Não existe escrita própria da UI,
nem contrato novo de escrita.

## Decisão (01/10/2026)

Uma versão anterior implementou um fluxo transacional próprio (propostas, revisão, commit
atômico, outbox) e congelou o código publicado em `app/compat/v1`, atrás da flag
`McpCompatMode`. Isso deixava duas versões dos mesmos writers no repositório e exigia uma virada
global (portal + plugin + scheduler) para ser ativado. Foi descartado: o `main` voltou a ter uma
versão só, idêntica à que roda. Os arquivos restaurados batem com os hashes das Lambdas de
produção; o histórico do fluxo transacional fica no git (commit `239041d`).

## Arquitetura

| Peça | Onde | Papel |
|---|---|---|
| 13 tools publicadas | `backend/app/mcp/tools.py`, transporte `app/mcp/jsonrpc.py` | Leitura e escrita (snapshot, desfazer, idempotência, auditoria, notificação) |
| 3 consultas visuais | `app/mcp/visual_tools.py` | `abrir_coachpilot`, `mostrar_aluno`, `consultar_carteira_visual`; somente leitura |
| Transporte com UI | `app/mcp/visual_jsonrpc.py` | Delega as 13 tools ao transporte base; acrescenta resources e as consultas |
| Recurso da UI | `app/mcp/ui_resources.py`, `ui_dist/v1.html` | HTML autocontido (`ui://coachpilot/workspace/v1.html`), CSP sem origens externas |
| Resumo ao modelo | `app/mcp/resumo_modelo.py` | `content` factual da ficha (objetivo, programa, frequência, dores em aberto, anamnese); sem texto livre do aluno |
| UI | `frontend/src/mcp-app/` | React; `npm run build:mcp` gera `v1.html` |

`McpUiEnabled` é o interruptor de emergência: com `false`, o servidor volta a anunciar só as 13
tools.

**Contrato travado.** `backend/tests/test_mcp_contrato.py` compara `tools/list`, `instructions`,
prompts e resources com `tests/fixtures/mcp_contrato_publicado.json` (gravado de produção).
Qualquer mudança de contrato exige atualizar o fixture de propósito e fazer Rescan no ChatGPT.

## Telas

- **Card do aluno:** contexto para prescrever. Mostra atenção de saúde (dores em aberto com
  data e origem, histórico das dores já respondidas agrupado por exercício — responder não
  quer dizer que a dor passou —, respostas de saúde da anamnese), objetivo, rotina lida da anamnese, situação
  do programa e frequência. Restrição nunca é truncada em silêncio. Ações: "Ver ficha" e
  "Revisar treino".
- **Ficha (tela cheia):**
  - abas Visão geral, Treinos e Evolução;
  - dados completos (avaliações, metas, notas) só sob pedido;
  - anamnese com as respostas relevantes em destaque e os "não" resumidos;
  - só o treino vigente aberto;
  - blocos CrossFit/HIIT com os próprios exercícios.
- **Evolução:**
  - melhor valor respeita a direção da métrica;
  - "Melhor no período", nunca "PR";
  - aviso quando a consulta bate o teto de 200 registros;
  - carga sem unidade conta como kg.
- **Carteira:**
  - busca sem acento/caixa, filtros e cursor;
  - contagens valem para os alunos carregados.
- **Navegação:**
  - "mostra a ficha da Márcia" abre direto, sem passar pela carteira: o modelo resolve o id
    com `listar_alunos` (busca sem acento/caixa, pagina além da primeira página) e chama
    `mostrar_aluno`; com homônimos, pergunta qual antes de abrir. `aluno_id` segue
    obrigatório — nome não é chave;
  - a carteira de fallback do card não entra quando a tool pediu um aluno, nem sobrescreve o
    resultado entregue pelo host;
  - o card é a foto do momento da consulta — gravar pela conversa não o avisa. Botão
    "Atualizar" (card e cabeçalho da ficha) recarrega a tela atual mantendo a aba, e voltar ao
    card (foco ou aba visível) recarrega sozinho se a última carga tem mais de 20 s. Sem
    polling; card novo após cada gravação exigiria UI na tool de escrita (mudança de contrato);
  - abrir aluno pelo card mantém o card;
  - a tela cheia só abre por escolha e volta a card ao sair;
  - sem tela cheia no host, oferece o portal (`openLink`).

## Ações pela conversa

Todos os pedidos estão em `pedidos` (`frontend/src/mcp-app/Workspace.tsx`) e seguem três regras:

- citam o nome e o `aluno_id`;
- só nomeiam tools publicadas;
- pedem confirmação antes de gravar.

`useCases.test.ts` garante isso.

| Botão | Onde | Tool que o ChatGPT usa |
|---|---|---|
| Revisar treino / Montar primeiro treino | Card e ficha | `guia_de_prescricao`, `detalhar_aluno`, `exportar_programa_treino` → `aplicar_programa_treino` |
| Ajustar este treino | Cada treino | `exportar_programa_treino` → `aplicar_programa_treino` (preserva os outros) |
| Renovar vigência | Treino vencido | `atualizar_treino` |
| trocar | Cada exercício | `listar_biblioteca_exercicios` → `aplicar_programa_treino` |
| Desfazer última alteração | Aba Treinos | `desfazer_alteracao_treino` |
| Atualizar estes N alunos com o chat | Carteira filtrada (sem treino, vencidos, vencendo) | Um aluno por vez, confirmando cada aplicação |
| Analisar evolução na conversa | Aba Evolução | Leitura |

O botão trava por alguns segundos após o envio ("Pedido enviado na conversa"). Sem capacidade
de mensagem no host, os botões somem e a tela orienta a pedir na conversa.

## Testes

- **Backend:**
  - `test_mcp_contrato.py` (contrato);
  - `test_writers_publicados.py` (programa grande, idempotência, desfazer, portal
    CRUD/templates/rotinas, sessão ativa, tenant, anamnese legível);
  - `test_mcp_visual.py` (consultas não gravam, tenant errado, resumo ao modelo, carteira,
    seção indisponível, evolução);
  - `test_mcp_tenant.py`.
- **Frontend:**
  - Vitest (`src/mcp-app`);
  - Playwright `npm run test:mcp-ui`, sobre `backend/tests/visual_harness.py` (MCP real em
    memória, sem AWS). Verifica que nenhum botão grava (`/_test/status` igual) e que cada um
    envia exatamente o pedido esperado.

## Deploy

- A UI vai embutida no backend: `.\deploy.ps1 backend` roda o `build:mcp` antes do SAM.
- Fluxo: changeset com `--no-execute-changeset`, revisar, executar.
- Não há deploy de frontend do portal.
