# Documentação Técnica — CoachPilot

> Documentos técnicos e funcionais do produto. Regras operacionais do projeto (AWS, deploy,
> DynamoDB): `../CLAUDE.md`. Documentos de negócio/estratégia: `../estrategia/`.
> **Não mover** os `.md` de `../frontend/public/` (ajuda-portal, ajuda-aluno, prompt-cpkg) — são
> arquivos do sistema, servidos ao usuário em produção.

## Hierarquia em caso de conflito
Regra de negócio → `FUNCIONAL.md` · Modelo de dados/API deste produto → `ESPEC_TECNICA.md` ·
Padrão genérico de stack → `ARCHITECTURE.md` · Regra operacional → `../CLAUDE.md`.

| Documento | O que contém |
|---|---|
| [FUNCIONAL.md](FUNCIONAL.md) | Documentação funcional: visão, atores, domínio, requisitos e regras de negócio, comportamento do agente |
| [ESPEC_TECNICA.md](ESPEC_TECNICA.md) | Diretrizes técnicas do produto: tenancy, single-table, padrões de API, custo/tokens |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack genérica reutilizável: estrutura de código, infra SAM, padrões, SEO, separação de custos (§12) |
| [PERFORMANCE_ESCALA.md](PERFORMANCE_ESCALA.md) | Investigação de performance/escala (10→100→1.000 personais) com status de implementação |

## Especificações de features (`especificacoes/`)

| Documento | O que contém |
|---|---|
| [especificacoes/MERCADOPAGO_PIX.md](especificacoes/MERCADOPAGO_PIX.md) | Integração PIX via Mercado Pago (REST, webhook, idempotência) |
| [especificacoes/PROMO_CODES.md](especificacoes/PROMO_CODES.md) | Promo codes e programa Indique e Ganhe |
| [especificacoes/FINANCEIRO.md](especificacoes/FINANCEIRO.md) | Feature Financeiro (mensalidades dos alunos, cobranças, PIX opcional) |
| [especificacoes/PUSH_PENDENCIAS.md](especificacoes/PUSH_PENDENCIAS.md) | Checklist de correções de push notifications — **parcialmente pendente** |
