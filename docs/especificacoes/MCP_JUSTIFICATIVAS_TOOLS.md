# Tool annotation justifications — formulário de submissão do ChatGPT

Texto pronto para colar em cada campo "Describe why … is set to …" da aba MCP.

**Em inglês de propósito**: quem lê é o revisor da OpenAI. Os campos voltados ao usuário final
(nome, descrições da listagem) seguem em português, que é o público do produto.

Fonte da verdade das anotações: `backend/app/mcp/tools.py`; a correspondência entre anotação e
comportamento real é travada por `tests/test_mcp_submissao.py::test_anotacoes_batem_com_o_comportamento_real`.

> **Texto comum a todas as tools (Open World: False)** — as 13 usam a mesma justificativa,
> porque o servidor inteiro opera dentro de um sistema fechado:
>
> All data is read from and written to the authenticated user's own CoachPilot account only.
> The account is derived from the OAuth access token, never from a tool argument, so the tool
> cannot reach another user's data. The server makes no outbound calls to third-party
> services, posts nothing online, publishes nothing, and sends no messages to third parties.

---

## 1. `guia_de_prescricao`

**Read Only: True**
> Returns static reference documentation about how to structure a training program, optionally
> interpolated with the user's own exercise library, which is read from the database. It
> performs no create, update or delete operation of any kind — the only database access is a
> single read query of the user's exercise library.

**Destructive: False**
> The tool only reads and formats text. It changes no state at all, so nothing can be lost or
> overwritten by calling it, at any frequency.

---

## 2. `listar_alunos`

**Read Only: True**
> Runs a single paginated read query over the authenticated user's client list and returns
> name, status, goals and last training date. No write operation exists in this code path.

**Destructive: False**
> Read-only lookup. Repeated calls return the same data and change nothing.

---

## 3. `detalhar_aluno`

**Read Only: True**
> Assembles a read-only profile of one client (profile, health questionnaire, physical
> assessments, goals, recent sessions, progression, reported pain, trainer notes) from existing
> records. Every underlying call is a read; nothing is created or modified.

**Destructive: False**
> No state is changed. The tool only aggregates records that already exist.

---

## 4. `exportar_programa_treino`

**Read Only: True**
> Reads the client's current training program (workouts, blocks, exercises) and returns it as
> JSON. Despite the name "export", nothing is generated, stored or removed — it is a formatted
> read of existing records.

**Destructive: False**
> Reading the program leaves it untouched. This tool is the recommended step *before* any write,
> precisely so the model can send back a complete program.

---

## 5. `listar_biblioteca_exercicios`

**Read Only: True**
> Single read query over the user's exercise library, returning exercise name, muscle group and
> reference video URL. No write path exists.

**Destructive: False**
> Read-only lookup; the library is not modified.

---

## 6. `historico_sessoes`

**Read Only: True**
> Paginated read of the client's completed training sessions, with the loads and repetitions
> that were recorded. Historical records are returned as stored and never edited.

**Destructive: False**
> No state is changed. Session history is immutable through this tool.

---

## 7. `evolucao_exercicio`

**Read Only: True**
> Reads the historical series for one exercise (load, repetitions, volume, personal records) and
> returns it. The computation happens in memory from existing records; nothing is persisted.

**Destructive: False**
> Derived read. No record is created or modified.

---

## 8. `resumo_carteira`

**Read Only: True**
> Reads the user's client pointers and outstanding-payment counters and computes, in memory, a
> summary of the portfolio (active clients, clients without an active program, clients inactive
> for N days, overdue payments). The pending-status rules are a pure function; results are not
> persisted.

**Destructive: False**
> Aggregated read only. Nothing is written back, not even a cached copy.

---

## 9. `agenda_periodo`

**Read Only: True**
> Range read of the user's appointments between two dates. No appointment is created, changed or
> cancelled through this tool.

**Destructive: False**
> Read-only query over a date range.

---

## 10. `validar_programa_treino`

**Read Only: True**
> Validates a candidate training program supplied as an argument and returns errors and warnings.
> It exists specifically so the model can check its output *before* writing. It performs read
> queries (the user's exercise library, to compare names and videos) and never writes.

**Destructive: False**
> The candidate program is only inspected. Nothing is saved, and the client's current program is
> not touched — calling this tool can never change what the client sees.

---

## 11. `aplicar_programa_treino`

**Read Only: False**
> This tool writes. It persists the training program of one client, replacing the existing
> workouts and exercises with the ones supplied.

**Destructive: True**
> It is a **full replacement**: the client's current workouts and exercises are deleted and
> recreated from the submitted program. A workout that the model omits from the payload is
> removed. We therefore report it as destructive even though the effect is mitigated — before
> writing, the previous program is snapshotted for 7 days and can be restored via
> `desfazer_alteracao_treino`; an empty program is rejected; identical payloads within 60
> seconds are deduplicated instead of rewritten; and every write is written to an audit log and
> notified to the account owner. Completed session history is stored separately and is never
> affected.

---

## 12. `atualizar_treino`

**Read Only: False**
> This tool writes. It performs a partial update of a single workout's descriptive fields.

**Destructive: False**
> It can only change name, focus, notes, start/end date and the active flag of one existing
> workout, through a conditional partial update. It cannot remove a workout, remove or alter
> exercises, or affect any other record. Any field it changes can be set back to its previous
> value by calling the tool again, so no information is irreversibly lost.

---

## 13. `desfazer_alteracao_treino`

**Read Only: False**
> This tool writes. It restores the client's training program to the snapshot taken before the
> last change made through this connector.

**Destructive: True**
> Restoring overwrites the program currently in place, using the same full-replacement path as
> `aplicar_programa_treino` — so any change made after the snapshot is discarded. It is reported
> as destructive for that reason, even though its purpose is recovery. It only works within 7
> days of the snapshot, and the restore itself is audited and notified to the account owner.

---

## Nota sobre notificações (relevante para Open World nas três tools de escrita)

Toda escrita gera uma notificação in-app para o **próprio dono da conta**, avisando o que mudou.
Quando o personal tem push habilitado, essa notificação também sai por Web Push para os
dispositivos **dele mesmo**. Entendemos que isso não caracteriza Open World: não há publicação,
nem mensagem a terceiros — é o sistema informando ao próprio usuário a alteração que ele acabou
de pedir. Se o revisor discordar dessa leitura, a mudança é de uma linha em
`app/mcp/tools.py` (`openWorldHint`), sem alterar comportamento.

Se preferir mencionar isso na justificativa das três tools de escrita, acrescente ao texto comum:

> The only outbound effect is an in-app notification — and, if the user has enabled it, a web
> push notification — delivered to the account owner's own devices, informing them of the change
> they just requested. Nothing is sent to any third party.
