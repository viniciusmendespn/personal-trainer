# Contrato publicado antes do plugin visual

Snapshot capturado das Lambdas de `personal-trainer-prod` em 01/10/2026 UTC.
`manifest.json` registra o hash do pacote e de cada fonte original. As únicas
adaptações nos módulos Python são imports para este namespace; o prompt é original.

`MCP_COMPAT_MODE=true` (padrão) seleciona este transporte MCP e os routers de
treinos, templates e rotinas. Mantém as 13 ferramentas, schemas, snapshots de
desfazer e escrita em lotes já publicados. OAuth, URL e segredos são compartilhados
e preservados. O modo bloqueia propostas, recursos visuais, commits transacionais
e o processamento de sua outbox, mesmo se as outras flags estiverem ligadas.

Não modificar este snapshot para implementar funcionalidades novas. Correções
necessárias também neste fluxo devem vir com teste de regressão e atualização
do hash `adapted_sha256`. Não habilitar escrita transacional no mesmo conjunto de
dados enquanto houver writers legados. A migração futura exige validar programas
grandes, desfazer antigo e revisão de todos os writers antes de desligar o modo.

O harness local desliga explicitamente a compatibilidade e usa somente dados fake.

Correção aplicada em 01/10/2026: `openWorldHint` das tools de escrita passou a `true`
(apontado pela revisão do ChatGPT). Teste: `test_snapshot_marks_writers_as_open_world_and_keeps_the_rest_published`.
