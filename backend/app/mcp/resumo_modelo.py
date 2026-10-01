"""Resumo da ficha visível ao modelo (`content`), com o que a interface mostra no card.

O dossiê da ficha vai em `_meta`, que o modelo não recebe. Sem este resumo, abrir a ficha
deixaria o ChatGPT achando que já "leu" o aluno. Só fatos registrados e contagens: texto livre
escrito pelo aluno (descrição de dor, respostas de anamnese) fica fora — o modelo lê via
`detalhar_aluno`, que traz o aviso de conteúdo de terceiros.
"""


def _situacao_programa(programa: dict, hoje: str) -> str:
    ativos = [t for t in programa.get("treinos") or [] if t.get("ativo", True)]
    if not ativos:
        return "sem programa vigente"
    fins = sorted(t["data_fim"] for t in ativos if t.get("data_fim"))
    texto = f"{len(ativos)} treino(s) ativo(s)"
    if not fins:
        return texto + ", sem data de vencimento"
    vencidos = sum(1 for t in ativos if t.get("data_fim") and t["data_fim"] < hoje)
    if vencidos:
        return texto + f", {vencidos} vencido(s)"
    return texto + f", vence em {fins[0]}"


def ficha_aluno(nome: str | None, contexto: dict, programa: dict, *, hoje: str) -> str:
    """`hoje`: data civil do personal (`locale_service.hoje`), a mesma régua da carteira."""
    perfil = contexto.get("perfil") or {}
    partes = [f"Objetivo: {', '.join(perfil.get('objetivos') or []) or 'não informado'}",
              f"Programa: {_situacao_programa(programa, hoje)}"]
    est = contexto.get("estatisticas_treino") or {}
    if est.get("total_sessoes"):
        partes.append(f"Frequência: {est.get('sessoes_semana_atual', 0)} sessão(ões) nesta semana, "
                      f"média {est.get('media_sessoes_por_semana', 0)}/semana, "
                      f"último treino em {(est.get('ultimo_treino_em') or '')[:10] or 'sem data'}")
    elif "estatisticas" not in (contexto.get("secoes_indisponiveis") or []):
        partes.append("Frequência: nenhuma sessão registrada")
    dores = [r for r in contexto.get("dores_e_duvidas") or [] if r.get("tipo") == "DOR" and not r.get("respondido")]
    if dores:
        datas = sorted((r.get("data") or "") for r in dores)
        partes.append(f"Atenção: {len(dores)} relato(s) de dor em aberto"
                      + (f", o mais recente em {datas[-1]}" if datas[-1] else ""))
    anamnese = contexto.get("anamnese")
    partes.append(f"Anamnese respondida em {anamnese.get('preenchido_em') or 'data não registrada'}"
                  if anamnese else "Anamnese não respondida")
    indisponiveis = contexto.get("secoes_indisponiveis") or []
    if indisponiveis:
        partes.append(f"Seções indisponíveis nesta consulta: {', '.join(indisponiveis)}")
    return (f"CoachPilot: ficha de {nome or 'aluno'} aberta para consulta. " + ". ".join(partes) + ". "
            "Este resumo não substitui a leitura: antes de propor treino, leia detalhar_aluno "
            "(restrições e relatos completos) e exportar_programa_treino.")
