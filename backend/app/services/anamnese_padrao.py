"""Modelo de anamnese pronto, servido a quem ainda não montou o próprio.

Não é gravado no banco: é devolvido na leitura enquanto o personal não salvar um template.
Assim todo personal — inclusive os que já existiam — nasce com um questionário usável, e
melhorias neste modelo chegam a quem nunca o editou. Ao salvar, vira dele.

Base: PAR-Q (triagem de risco para atividade física) + histórico, rotina e hábitos que mudam
a prescrição. Obrigatórias só as que o personal não pode deixar de saber antes do 1º treino.
"""
from app.repositories import dynamo_repo as repo
from app.repositories import keys

_SIM_NAO_HINT = "Se não tiver, escreva “não”"

PERGUNTAS_PADRAO: list[dict] = [
    # ── Triagem de saúde (PAR-Q) ─────────────────────────────────────────────
    {"key": "parq_coracao", "type": "BOOL", "required": True,
     "label": "Algum médico já disse que você tem problema no coração ou pressão alta?"},
    {"key": "parq_dor_peito", "type": "BOOL", "required": True,
     "label": "Sente dor no peito durante atividade física (ou sentiu em repouso no último mês)?"},
    {"key": "parq_tontura", "type": "BOOL", "required": True,
     "label": "Já perdeu o equilíbrio por tontura ou chegou a desmaiar?"},
    {"key": "doencas", "type": "TEXT", "required": False, "placeholder": _SIM_NAO_HINT,
     "label": "Tem alguma doença diagnosticada? (diabetes, asma, tireoide, colesterol…)"},
    {"key": "medicamentos", "type": "TEXT", "required": False, "placeholder": _SIM_NAO_HINT,
     "label": "Usa algum medicamento contínuo? Qual?"},
    {"key": "lesoes_dores", "type": "TEXT", "required": True, "placeholder": _SIM_NAO_HINT,
     "label": "Tem ou já teve lesão, dor articular ou problema na coluna? Onde?"},
    {"key": "cirurgias", "type": "TEXT", "required": False, "placeholder": _SIM_NAO_HINT,
     "label": "Já fez alguma cirurgia? Qual e quando?"},
    {"key": "restricao_medica", "type": "TEXT", "required": False, "placeholder": _SIM_NAO_HINT,
     "label": "Tem alguma restrição médica para atividade física?"},
    {"key": "gestante", "type": "BOOL", "required": False,
     "label": "Está grávida ou teve bebê nos últimos 6 meses?"},
    # ── Histórico e disponibilidade ──────────────────────────────────────────
    {"key": "experiencia", "type": "SELECT", "required": True,
     "label": "Há quanto tempo você treina?",
     "options": ["Nunca treinei", "Parado(a) há mais de 6 meses", "Menos de 1 ano",
                 "1 a 3 anos", "Mais de 3 anos"]},
    {"key": "outras_atividades", "type": "TEXT", "required": False, "placeholder": _SIM_NAO_HINT,
     "label": "Pratica outra atividade física ou esporte? Qual e quantas vezes por semana?"},
    {"key": "dias_semana", "type": "SELECT", "required": True,
     "label": "Quantos dias por semana pode treinar?",
     "options": ["2", "3", "4", "5", "6"]},
    {"key": "tempo_treino", "type": "SELECT", "required": False,
     "label": "Quanto tempo tem disponível por treino?",
     "options": ["30 minutos", "45 minutos", "1 hora", "Mais de 1 hora"]},
    {"key": "local_treino", "type": "SELECT", "required": False,
     "label": "Onde vai treinar?",
     "options": ["Academia completa", "Academia de condomínio/prédio", "Em casa", "Ao ar livre"]},
    # ── Rotina e hábitos ─────────────────────────────────────────────────────
    {"key": "rotina_trabalho", "type": "TEXT", "required": False,
     "placeholder": "Ex.: escritório, 8h sentado(a)",
     "label": "Qual sua profissão? Passa muito tempo sentado(a) ou em pé?"},
    {"key": "horas_sono", "type": "NUMBER", "required": False, "placeholder": "Ex.: 7",
     "label": "Quantas horas dorme por noite, em média?"},
    {"key": "estresse", "type": "SELECT", "required": False,
     "label": "Como está seu nível de estresse?",
     "options": ["Baixo", "Moderado", "Alto"]},
    {"key": "fumante", "type": "BOOL", "required": False, "label": "É fumante?"},
    {"key": "alcool", "type": "SELECT", "required": False,
     "label": "Consome bebida alcoólica?",
     "options": ["Não", "Socialmente", "Frequentemente"]},
    # ── Preferências ─────────────────────────────────────────────────────────
    {"key": "preferencias", "type": "TEXT", "required": False,
     "label": "Tem algum exercício que gosta muito ou não gosta de fazer?"},
    {"key": "observacoes", "type": "TEXT", "required": False,
     "label": "Algo mais que seu personal precisa saber?"},
]


def template_padrao() -> dict:
    return {
        "perguntas": [dict(p) for p in PERGUNTAS_PADRAO],
        "mensagem_boas_vindas": "Bem-vindo(a)! Preencha sua ficha de saúde para eu montar "
                                "o treino certo para você.",
        "solicitar_email": True,
        "solicitar_nascimento": True,
        "solicitar_objetivo": True,
        "padrao": True,
    }


def carregar_template(personal_id: str) -> dict:
    """Template do personal, ou o padrão se ele ainda não tem anamnese.

    "Não tem" = nunca salvou, ou salvou sem perguntas antes do `salvo_em` existir (o editor
    antigo começava vazio e gravava assim). Quem esvaziar o template de propósito agora fica
    com o vazio — o `salvo_em` marca que foi escolha dele.
    """
    item = repo.clean(repo.get_item(keys.pk_personal(personal_id), keys.SK_ANAMNESE_TEMPLATE))
    if not item or (not item.get("perguntas") and not item.get("salvo_em")):
        return template_padrao()
    return item
