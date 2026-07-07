"""Construtores de chave do single-table (ESPEC §2). Centralizar aqui evita
strings mágicas espalhadas e mantém os prefixos curtos consistentes.

Famílias de partição:
  PT#{personal_id}  -> dados/visões do personal (leve, baixo volume de escrita)
  AL#{aluno_id}     -> tudo do aluno (alto volume, distribuído por partição)
Lookups globais:
  WAPI#{instance_id}        -> roteia o webhook para o personal
  PHONE#{personal_id}#{e164} -> resolve telefone -> aluno (escopo por personal)
"""


# ── Partições ────────────────────────────────────────────────────────────────
def pk_personal(personal_id: str) -> str:
    return f"PT#{personal_id}"


def pk_aluno(aluno_id: str) -> str:
    return f"AL#{aluno_id}"


def pk_wapi(instance_id: str) -> str:
    return f"WAPI#{instance_id}"


def pk_phone(personal_id: str, e164: str) -> str:
    return f"PHONE#{personal_id}#{e164}"


# ── SKs do personal (partição PT#) ───────────────────────────────────────────
SK_PROFILE = "PROFILE"
SK_WAPI_CONFIG = "WAPI#CONFIG"
SK_CUSTOM_FIELDS = "CONFIG#CUSTOMFIELDS"   # definições de atributos custom (ESPEC §2.4)
EXLIB_PREFIX = "EXLIB#"                     # biblioteca de exercícios do personal


def sk_exlib(exlib_id: str) -> str:
    return f"EXLIB#{exlib_id}"


def sk_aluno_pointer(aluno_id: str) -> str:
    return f"ALUNO#{aluno_id}"


SK_STATS_ALUNOS = "STATS#ALUNOS"   # contador agregado: total/ativos (ARCHITECTURE §5.5 Nível A)
SK_STATS_OBJETIVOS = "STATS#OBJETIVOS"   # mapa objetivo_key→count (PT# partition)


def normalize_objetivo(raw: str) -> str:
    """Normaliza string de objetivo para uso seguro como atributo DynamoDB (sem espaços/acentos)."""
    import unicodedata
    sem_acento = unicodedata.normalize("NFKD", raw).encode("ascii", "ignore").decode()
    return "_".join(sem_acento.lower().split()) or "outros"


def sk_atividade(aluno_id: str) -> str:
    return f"ATIVIDADE#{aluno_id}"


def gsi1_atividade(personal_id: str) -> str:
    return f"PT#{personal_id}#ATIVIDADE"


def sk_alerta(ts: str, alerta_id: str) -> str:
    return f"ALERT#{ts}#{alerta_id}"


NOTIF_PREFIX = "NOTIF#"
SK_STATS_NOTIF = "STATS#NOTIF"   # contador agregado de não-lidas (ARCHITECTURE §5.5 Nível A)


def sk_notif(ts: str, notif_id: str) -> str:
    return f"NOTIF#{ts}#{notif_id}"


def sk_dedup_msgdireto(aluno_id: str) -> str:
    return f"DEDUP#MSGDIRETO#{aluno_id}"


def sk_quota_agente(minuto: str) -> str:
    return f"QUOTA#AGENTE#{minuto}"


# ── Agenda do personal (compromissos com alunos, partição PT#) ──────────────
AGENDA_PREFIX = "AGENDA#"


def sk_agenda(data_hora_inicio: str, agendamento_id: str) -> str:
    return f"AGENDA#{data_hora_inicio}#{agendamento_id}"


# ── Lembretes de agenda (scheduler a cada 5 min, partição SCHED#) ────────────
AGENDA_NOTIF_PREFIX = "AGENDA_NOTIF#"


def sk_agenda_notif(notif_iso: str, agendamento_id: str) -> str:
    return f"AGENDA_NOTIF#{notif_iso}#{agendamento_id}"


# ── Templates de treino reutilizáveis (partição PT#) ─────────────────────────
TEMPLATE_PREFIX = "TEMPLATE#"


def sk_template(template_id: str) -> str:
    return f"TEMPLATE#{template_id}"


# ── Rotinas de treino (split ABC/ABCDE — vários treinos, partição PT#) ────────
ROTINA_PREFIX = "ROTINA#"


def sk_rotina(rotina_id: str) -> str:
    return f"ROTINA#{rotina_id}"


# ── Agenda de vencimentos (scheduler diário) — 1 partição por dia de vencimento,
# evita hot-partition global (1 só PK pra todo o sistema, ESPEC §2.1 risco identificado).
DUE_PREFIX = "DUE#"


def pk_sched(data_fim: str) -> str:
    return f"SCHED#{data_fim}"   # data_fim = YYYY-MM-DD (1 partição por dia)


def sk_due(treino_id: str) -> str:
    return f"DUE#{treino_id}"


# ── SKs do aluno (partição AL#) ──────────────────────────────────────────────
SK_SESSION_ACTIVE = "SESSION#ACTIVE"
SK_CHAT = "CHAT"   # memória conversacional do agente (com TTL) — só p/ prompt da LLM

CHAT_MSG_PREFIX = "CMSG#"   # histórico durável do chat (sem TTL) — só p/ exibição na UI


def sk_chat_msg(ts: str, msg_id: str) -> str:
    return f"CMSG#{ts}#{msg_id}"


SK_TREINO_PREFIX = "TREINO#"


def sk_treino(treino_id: str) -> str:
    return f"TREINO#{treino_id}"


def sk_exercicio(treino_id: str, exercicio_id: str) -> str:
    return f"EX#{treino_id}#{exercicio_id}"


# Catálogo permanente de exercícios do aluno (1 item pequeno por nome canônico já visto).
# Diferente de EX# (prescrição do programa atual, apagada a cada reimport), o EXCAT# nunca
# é apagado: é a fonte de "todos os exercícios que o aluno já fez" no seletor de evolução.
# A SK usa a chave canônica (lowercase sem acento) → Query begins_with retorna em ordem
# alfabética nativa. Prefixo não colide com "EX#" (3º char 'C' ≠ '#').
EXCAT_PREFIX = "EXCAT#"


def sk_excat(chave: str) -> str:
    return f"EXCAT#{chave}"


def sk_exercicio_prefix(treino_id: str) -> str:
    return f"EX#{treino_id}#"


def sk_sessao_hist(ts: str, sessao_id: str) -> str:
    return f"SESSION#{ts}#{sessao_id}"


def sk_sessao_idx(sessao_id: str) -> str:
    return f"SESSAO_IDX#{sessao_id}"


def sk_registro(sessao_id: str, exercicio_id: str) -> str:
    return f"REG#{sessao_id}#{exercicio_id}"


def sk_dor(exercicio_id: str, ts: str, dor_id: str) -> str:
    return f"DOR#{exercicio_id}#{ts}#{dor_id}"


NOTA_PREFIX = "NOTA#"


def sk_nota(ts: str, nota_id: str) -> str:
    return f"NOTA#{ts}#{nota_id}"


AVAL_PREFIX = "AVAL#"


def sk_avaliacao(ts: str, avaliacao_id: str) -> str:
    return f"AVAL#{ts}#{avaliacao_id}"


def sk_msg(message_id: str) -> str:
    return f"MSG#{message_id}"


# ── Agregados (indicadores mantidos na escrita — ESPEC §3.1) ─────────────────
SK_STATS_ALUNO = "STATS#ALUNO"


def sk_stats_week(week: str) -> str:
    return f"STATS#W#{week}"


def sk_stats_pr(exercicio_id: str) -> str:
    return f"STATS#PR#{exercicio_id}"


def sk_stats_week_grupo(week: str, grupo: str) -> str:
    return f"STATS#WG#{week}#{grupo}"   # prefixo distinto de "STATS#W#" (8º char diverge: 'G' vs '#')


def sk_stats_grupo(grupo: str) -> str:
    return f"STATS#G#{grupo}"   # cumulativo all-time por grupo muscular


# ── Dúvidas do aluno (partição AL#) ─────────────────────────────────────────
DUVIDA_PREFIX = "DUVIDA#"


def sk_duvida(exercicio_id: str, ts: str, duvida_id: str) -> str:
    return f"DUVIDA#{exercicio_id}#{ts}#{duvida_id}"


# ── Correções do personal (post rico: texto + mídias) ────────────────────────
CORRECAO_PREFIX = "CORRECAO#"


def sk_correcao_ex(exercicio_id: str, ts: str, correcao_id: str) -> str:
    return f"CORRECAO#{exercicio_id}#{ts}#{correcao_id}"


# ── Postagens unificadas (aluno + personal) — texto + mídias + tipo ──────────
POST_PREFIX = "POST#"


def sk_post(exercicio_id: str, ts: str, post_id: str) -> str:
    return f"POST#{exercicio_id}#{ts}#{post_id}"


# ── Notificações para o aluno (partição AL#, espelho do NOTIF# do personal) ──
ANOTIF_PREFIX = "ANOTIF#"


def sk_anotif(ts: str, notif_id: str) -> str:
    return f"ANOTIF#{ts}#{notif_id}"


SK_STATS_ANOTIF = "STATS#ANOTIF"   # contador agregado de não-lidas do aluno


# ── Feed global do personal (partição PT#) ──────────────────────────────────
FEED_GLOBAL_PREFIX = "FEED#"


def sk_feed_global(ts: str, post_id: str) -> str:
    return f"FEED#{ts}#{post_id}"


def sk_curtida_feed(post_id: str) -> str:
    return f"CURTIDA#FEED#{post_id}"


# ── Pontos e ranking de alunos ───────────────────────────────────────────────
SK_PONTOS = "PONTOS#"
PONTO_LOG_PREFIX = "PONTO_LOG#"
RANKING_PREFIX = "RANKING#"


def sk_ponto_log(ts: str) -> str:
    return f"PONTO_LOG#{ts}"


def sk_ranking_aluno(aluno_id: str) -> str:
    return f"RANKING#{aluno_id}"


# ── Badges / conquistas do aluno (partição AL#) ──────────────────────────────
BADGE_PREFIX = "BADGE#"


def sk_badge(tipo: str) -> str:
    return f"BADGE#{tipo}"


# ── Metas / objetivos do aluno (partição AL#) ────────────────────────────────
META_PREFIX = "META#"


def sk_meta(ts: str, meta_id: str) -> str:
    return f"META#{ts}#{meta_id}"


# ── Anamnese (ficha de saúde) ─────────────────────────────────────────────────
SK_ANAMNESE_TEMPLATE = "CONFIG#ANAMNESE"   # PT#{personal_id}
SK_ANAMNESE_ALUNO = "ANAMNESE#"            # AL#{aluno_id}


# ── Base de conhecimento para IA (arquivos do personal, partição PT#) ────────
KB_PREFIX = "KB#"
SK_KB_BUNDLE = "KB_BUNDLE"   # metadado do zip cacheado: s3_key, built_at, file_count, total_size


def sk_kb(arquivo_id: str) -> str:
    return f"KB#{arquivo_id}"


# ── Push subscriptions do aluno (partição AL#) ──────────────────────────────
PUSH_PREFIX = "PUSH#"


def sk_push(sub_id: str) -> str:
    return f"PUSH#{sub_id}"


# ── GSI1: "registros por exercício no tempo" (ESPEC §4.1) ────────────────────
def gsi1_registro(aluno_id: str, exercicio_id: str) -> str:
    return f"AL#{aluno_id}#EX#{exercicio_id}"


def gsi1sk_registro(ts: str) -> str:
    return f"R#{ts}"


# ── GSI1: "itens de feed por exercício (nome canônico) no tempo" ─────────────
# Mesmo padrão de gsi1_registro: itens POST#/DOR#/DUVIDA#/CORRECAO#/MIDIA# carimbam
# essas chaves na escrita → feed de um exercício = 1 Query no GSI1, mesmo quando o
# exercicio_id embutido na SK já saiu do programa.
def gsi1_feed(aluno_id: str, chave: str) -> str:
    return f"AL#{aluno_id}#FEED#{chave}"


def gsi1sk_feed(ts: str) -> str:
    return f"F#{ts}"


# ── Financeiro: config e cobranças por aluno (partição AL#) ──────────────────
SK_COBRANCA_CFG = "COBRANCA_CONFIG"   # underscore evita colisão com begins_with("COBRANCA#")
COBRANCA_PREFIX = "COBRANCA#"
COBRANCA_IDX_PREFIX = "COBRANCA_IDX#"


def sk_cobranca(ano_mes: str, cobranca_id: str) -> str:
    return f"COBRANCA#{ano_mes}#{cobranca_id}"


def sk_cobranca_idx(cobranca_id: str) -> str:
    return f"COBRANCA_IDX#{cobranca_id}"


# ── Financeiro: ponteiro de alunos com cobrança ativa (partição PT#) ─────────
COBRANCA_ALUNO_PREFIX = "COBRANCA_ALUNO#"


def sk_cobranca_aluno(aluno_id: str) -> str:
    return f"COBRANCA_ALUNO#{aluno_id}"


# ── Financeiro: agregados do painel (partição PT#, mesma família STATS# do dashboard) ─
# Snapshot do saldo em aberto (recebíveis) — atualizado a cada transição de cobrança.
SK_STATS_FIN_OPEN = "STATS#FINOPEN"
# Fluxo mensal de recebimentos (regime de caixa) — 1 item por mês de pagamento.
STATS_FIN_MES_PREFIX = "STATS#FINM#"


def sk_stats_fin_mes(ano_mes: str) -> str:
    return f"STATS#FINM#{ano_mes}"


# ── Financeiro: config Mercado Pago (partição PT#) ───────────────────────────
SK_CONFIG_MP = "CONFIG#MERCADOPAGO"


# ── Financeiro: entradas do scheduler (partição SCHED#) ─────────────────────
BILLING_GERAR_PREFIX = "BILLING_GERAR#"
BILLING_AVISO_PREFIX = "BILLING_AVISO#"
BILLING_VENCER_PREFIX = "BILLING_VENCER#"
BILLING_LEMBRETE_PREFIX = "BILLING_LEMBRETE#"


def sk_sched_billing_gerar(aluno_id: str) -> str:
    return f"BILLING_GERAR#{aluno_id}"


def sk_sched_billing_aviso(aluno_id: str, cobranca_id: str) -> str:
    # Aviso "dia de pagamento" (D-0), só para o aluno.
    return f"BILLING_AVISO#{aluno_id}#{cobranca_id}"


def sk_sched_billing_vencer(aluno_id: str, cobranca_id: str) -> str:
    return f"BILLING_VENCER#{aluno_id}#{cobranca_id}"


def sk_sched_billing_lembrete(aluno_id: str, cobranca_id: str) -> str:
    # D+5 e D+10 caem em partições SCHED# de dias diferentes — sem colisão de SK.
    return f"BILLING_LEMBRETE#{aluno_id}#{cobranca_id}"


# ── Mercado Pago: idempotência de webhook ────────────────────────────────────
def pk_mp_lock(payment_id: str) -> str:
    return f"MP_LOCK#{payment_id}"


# ── Assinatura da plataforma (cobrança do personal, não do aluno) ────────────
SK_ASSINATURA = "ASSINATURA"   # partição PT#{personal_id}


def pk_system() -> str:
    return "SYSTEM#PLATFORM"


SK_CONFIG_PLANOS = "CONFIG#PLANOS"   # catálogo de planos (preço, limite de alunos)


def pk_mp_lock_assinatura(payment_id: str) -> str:
    # Prefixo distinto de pk_mp_lock: contas Mercado Pago diferentes (token da
    # plataforma vs. token configurado por cada personal para cobrar seus alunos).
    return f"MP_LOCK_ASSINATURA#{payment_id}"


ASSINATURA_AVISO_PREFIX = "ASSINATURA_AVISO#"


def sk_sched_assinatura_aviso(personal_id: str) -> str:
    return f"ASSINATURA_AVISO#{personal_id}"


PAGAMENTO_ASSINATURA_PREFIX = "PAGAMENTO_ASSINATURA#"   # histórico, partição PT#{personal_id}


def sk_pagamento_assinatura(ts: str, payment_id: str) -> str:
    return f"PAGAMENTO_ASSINATURA#{ts}#{payment_id}"


# ── Cupons / promo codes (indicação + campanhas futuras) ─────────────────────
# Lookup global O(1) por código (mesmo padrão de TOKEN#/WAPI#/PHONE# — sem GSI).
# O registro carrega campanha/plano/dias/dono/limites; o código em si é opaco.
def pk_cupom(codigo: str) -> str:
    return f"CUPOM#{codigo}"


SK_META = "META"
SK_CUPOM_PROPRIO = "CUPOM#PROPRIO"   # PT#{personal_id}: código fixo de indicação + stats


def sk_cupom_uso(campanha: str) -> str:
    # PT#{personal_id}: guarda "1 cupom por campanha" (put_if_absent).
    return f"CUPOM_USO#{campanha}"


INDICACAO_PREFIX = "INDICACAO#"


def sk_indicacao(indicado_id: str) -> str:
    # PT#{owner_id}: ledger de quem usou o código do owner (idempotência da recompensa).
    return f"INDICACAO#{indicado_id}"


# ── Programa de divulgadores (comissão em dinheiro — distinto de INDICACAO#) ──
# Tudo na partição PT#{divulgador_id} (divulgador = conta CoachPilot comum,
# marcada pelo admin). Regras de negócio: estrategia/PROGRAMA_DIVULGADORES_REGRAS.md.
SK_DIVULGADOR = "DIVULGADOR"                 # perfil: cupom, embaixador, pix_key, ativo
SK_STATS_DIVGERAL = "STATS#DIVGERAL"          # contadores vivos: contas_total, assinantes_total
DIVCLIENTE_PREFIX = "DIVCLIENTE#"
STATS_COMISSAO_PREFIX = "STATS#COMISSAO#"


def sk_div_cliente(personal_id: str) -> str:
    # PT#{divulgador_id}: ledger de contas criadas com o cupom do divulgador.
    return f"DIVCLIENTE#{personal_id}"


def sk_stats_comissao_mes(ano_mes: str) -> str:
    # PT#{divulgador_id}: agregado mensal (base_valor, vendas_novas, repasse) —
    # mesmo padrão de STATS#FINM# do financeiro.
    return f"STATS#COMISSAO#{ano_mes}"


# Registro global de divulgadores (partição única, baixa cardinalidade/escrita rara —
# mesmo racional do LOJA#CATALOGO) para o admin listar sem Scan.
PK_DIVULGADOR_REGISTRY = "DIVULGADOR#REGISTRY"


def sk_div_registry(divulgador_id: str) -> str:
    return f"DIV#{divulgador_id}"


# ── Canal de feedback/sugestões do personal (admin lê tudo, partição única) ──
# Baixo volume/escrita rara → 1 partição global (mesmo racional de PK_DIVULGADOR_REGISTRY
# e LOJA#CATALOGO): admin lista tudo com 1 Query begins_with, sem Scan e sem GSI novo.
PK_FEEDBACK = "FEEDBACK#REGISTRY"
FEEDBACK_PREFIX = "FEEDBACK#"


def sk_feedback(ts: str, fid: str) -> str:
    return f"FEEDBACK#{ts}#{fid}"


# ── Pacotes de treino (.cpkg) ────────────────────────────────────────────────
# Lookup global O(1) por token (mesmo padrão de pk_cupom()).
# Metadados de pacotes instalados ficam na partição PT#{personal_id}.
PACOTE_PREFIX = "PACOTE#"


def sk_pacote(pacote_id: str) -> str:
    return f"PACOTE#{pacote_id}"


def pk_token(token_uuid: str) -> str:
    """Lookup global de token de pacote. token_uuid = UUID4 sem o prefixo 'tok_'."""
    return f"PKTOKEN#{token_uuid}"


def pk_cadastro_invite(token: str) -> str:
    return f"CADASTRO#{token}"


def pk_pacote_distrib(pacote_id: str) -> str:
    """Conteúdo do pacote licenciado distribuído (global, legível entre personais no import).
    O arquivo .cpkg licenciado carrega só pacote_id+token; o conteúdo real mora aqui."""
    return f"PACOTEDISTRIB#{pacote_id}"


SK_CONTENT = "CONTENT"


PACOTE_GERADO_PREFIX = "PACGERADO#"


def sk_pacote_gerado(pacote_id: str) -> str:
    """PT#{autor}: registro dos pacotes licenciados que o personal gerou (para anunciar na loja)."""
    return f"PACGERADO#{pacote_id}"


# ── Loja / marketplace de pacotes ────────────────────────────────────────────
# Catálogo: partição única com cópia leve dos anúncios PUBLICADOS. Escrita rara
# (mutação de anúncio + sync de agregados) — bem abaixo do limite por partição;
# leitura pública é cacheada no CloudFront (behavior /v1/public/loja/*).
PK_LOJA_CATALOGO = "LOJA#CATALOGO"
LOJA_CATALOGO_PREFIX = "AN#"


def sk_loja_catalogo(criado_epoch_ms: str, anuncio_id: str) -> str:
    return f"AN#{criado_epoch_ms}#{anuncio_id}"


def pk_loja_anuncio(anuncio_id: str) -> str:
    """Anúncio canônico (SK=META) + avaliações (AVAL#) + marcadores de comprador (COMPRADOR#)."""
    return f"LOJAAN#{anuncio_id}"


LOJA_AVAL_PREFIX = "AVAL#"
LOJA_COMPRADOR_PREFIX = "COMPRADOR#"


def sk_loja_aval(comprador_id: str) -> str:
    return f"AVAL#{comprador_id}"


def sk_loja_comprador(comprador_id: str) -> str:
    return f"COMPRADOR#{comprador_id}"


def pk_loja_pedido(pedido_id: str) -> str:
    """Pedido canônico — lookup global O(1) (SK=META)."""
    return f"LOJAPED#{pedido_id}"


# Visões sem Scan na partição PT# (cópias denormalizadas do pedido):
LOJA_COMPRA_PREFIX = "LOJACOMPRA#"
LOJA_VENDA_PREFIX = "LOJAVENDA#"
LOJA_MEU_ANUNCIO_PREFIX = "LOJAMEU#"


def sk_loja_compra(criado_epoch_ms: str, pedido_id: str) -> str:
    return f"LOJACOMPRA#{criado_epoch_ms}#{pedido_id}"


def sk_loja_venda(criado_epoch_ms: str, pedido_id: str) -> str:
    return f"LOJAVENDA#{criado_epoch_ms}#{pedido_id}"


def sk_loja_meu_anuncio(anuncio_id: str) -> str:
    return f"LOJAMEU#{anuncio_id}"
