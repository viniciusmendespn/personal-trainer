# Documentação Técnica — CoachPilot

> Documentos técnicos e funcionais do produto. Regras operacionais do projeto (AWS, deploy,
> DynamoDB): `../CLAUDE.md`. Documentos de negócio/estratégia: `../estrategia/`.
> **Não mover** os `.md` de `../frontend/public/` (ajuda-portal, ajuda-aluno, prompt-cpkg,
> prompt-treino-aluno) — são arquivos do sistema, servidos ao usuário em produção.

## Hierarquia em caso de conflito
Regra de negócio → `FUNCIONAL.md` · Modelo de dados/API deste produto → `ESPEC_TECNICA.md` ·
Padrão genérico de stack → `ARCHITECTURE.md` · Regra operacional → `../CLAUDE.md`.

| Documento | O que contém |
|---|---|
| [FUNCIONAL.md](FUNCIONAL.md) | Documentação funcional do produto em produção: visão, atores, apps, domínio, regras de negócio, agente IA, módulos e limites |
| [ESPEC_TECNICA.md](ESPEC_TECNICA.md) | Diretrizes técnicas do produto: tenancy, single-table, padrões de API, custo/tokens |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack genérica reutilizável: estrutura de código, infra SAM, padrões, SEO, separação de custos (§12) |
| [PERFORMANCE_ESCALA.md](PERFORMANCE_ESCALA.md) | Investigação de performance/escala (10→100→1.000 personais) com status de implementação |

## Especificações de features (`especificacoes/`)

> Todas implementadas e em produção — servem como registro das regras de negócio e do padrão de
> integração; a fonte de verdade dos detalhes é o código.

| Documento | O que contém |
|---|---|
| [especificacoes/MERCADOPAGO_PIX.md](especificacoes/MERCADOPAGO_PIX.md) | Padrão de integração PIX via Mercado Pago (REST, webhook, idempotência) — usado no financeiro dos alunos, na assinatura Gestão Pro e na loja |
| [especificacoes/PROMO_CODES.md](especificacoes/PROMO_CODES.md) | Regras de promo codes e do programa Indique e Ganhe |
| [especificacoes/CROSSFIT_ADAPTACAO.md](especificacoes/CROSSFIT_ADAPTACAO.md) | Adaptação para CrossFit: blocos, score de WOD, timer, aquecimento, 2ª métrica |
