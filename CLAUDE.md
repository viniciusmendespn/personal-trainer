# CLAUDE.md — Personal Trainer

## Projeto
SaaS serverless para gestão de personal training (alunos, treinos, avaliações, agenda).
Segue o mesmo padrão arquitetural de `wa-automation` e `gerenciador-financeiro`.
Arquitetura: **React 19 + FastAPI + DynamoDB + Cognito + AWS SAM**. Ver `ARCHITECTURE.md`.

## AWS Account
- **Mesma conta** do `gerenciador-financeiro` (conta pessoal).
- Account ID: `421219980792`
- Region: `us-east-1`
- **Profile AWS: `pessoal-hotmail`** — todos os comandos `aws`/`sam` usam `--profile pessoal-hotmail`
- Stack: `personal-trainer-prod`

> ⚠️ Não confundir com a conta do `wa-automation` (`651447471262` / profile `smartafiliado`).

## Separação de custos (requisito do projeto)
Esta conta hospeda **vários apps**. O custo deste app é rastreado de forma 100% isolada via:
- **Tag `Project: personal-trainer`** em todos os recursos (Lambda, DynamoDB, API GW, Cognito, S3, CloudFront)
- **AppRegistry Application** (`myApplications`) → dashboard de custo por app no console
- **Cost Allocation Tag `Project` ativada** em Billing (passo manual 1x — ver `ARCHITECTURE.md` §12.5)

Conferir custo do mês:
```powershell
aws ce get-cost-and-usage `
  --time-period Start=2026-06-01,End=2026-07-01 --granularity MONTHLY --metrics "UnblendedCost" `
  --filter '{"Tags":{"Key":"Project","Values":["personal-trainer"]}}' `
  --group-by Type=DIMENSION,Key=SERVICE --profile pessoal-hotmail
```

Detalhes completos em **`ARCHITECTURE.md` §12 — Separação de Custos**.

## Convenção de nomes (evita colisão na conta compartilhada)
| Recurso | Nome |
|---|---|
| Stack | `personal-trainer-prod` |
| DynamoDB | `personal-trainer-{stage}` |
| UserPool | `personal-trainer-users-{stage}` |
| Bucket frontend | `personal-trainer-frontend-{stage}-{accountId}` |
| Tag de custo | `Project = personal-trainer` |

## Deploy
> Replicar o `deploy.ps1` do gerenciador-financeiro com `$Profile = "pessoal-hotmail"` e os nomes acima.

### ⚠️ REGRA OBRIGATÓRIA — Commit antes do deploy
O SAM faz build a partir do disco local, não do git. Nunca rodar deploy com arquivos não commitados.
Sempre: `git status` → `git diff` → `git add <arquivos>` → `git commit` → `deploy`.
Nunca `git add -A` em backend/infra sem revisar o diff.

### Regra do usuário — comitar e deployar automaticamente ao final de cada tarefa
Confirmado pelo usuário (2026-06-17): ao concluir uma tarefa (backend e/ou frontend), **comitar
e fazer deploy automaticamente**, sem precisar perguntar a cada vez — o objetivo é manter tudo
sempre no ar. Isso substitui a exigência antiga de "perguntar antes de commitar backend/". Ainda
assim: sempre revisar o changeset do CloudFormation antes de executar (`--no-execute-changeset`
→ revisar → `execute-change-set`), nunca pular hooks, e pausar para perguntar se a mudança for
genuinamente arriscada/destrutiva (ex.: troca de parâmetro que apague infraestrutura).

## Regras obrigatórias (herdadas do padrão)
- `user_id` sempre via JWT (`Depends(get_current_user_id)`) — nunca do body
- Single-table DynamoDB: PK = `USER#{user_id}`, SK = `{TIPO}#{id}`
- TTL em todos os itens temporários
- Evitar `get_item` antes de `update_item` — usar `update_item_if_exists`
- Lambda arm64, `MemorySize: 256`, `Timeout: 29`, HTTP API v2
- Enums espelhados backend ↔ frontend
- Comandos AWS sempre com `--profile pessoal-hotmail`
- Backend alterado → oferecer deploy

## Estado atual
Projeto recém-iniciado. Até agora existe apenas a documentação de arquitetura.
Próximos passos sugeridos (ainda não feitos):
- [ ] Scaffold `backend/` (template.yaml com tags + AppRegistry, app/ FastAPI)
- [ ] Scaffold `frontend/` (Vite + React 19 + Amplify)
- [ ] `deploy.ps1` adaptado para profile `pessoal-hotmail`
- [ ] `sam deploy --guided` (gera samconfig.toml) e anotar outputs
- [ ] Ativar Cost Allocation Tag `Project` no Billing
- [ ] Definir entidades do domínio (Aluno, Treino, Exercício, Avaliação, Agenda…)
