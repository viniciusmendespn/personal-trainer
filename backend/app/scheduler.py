"""Lambda horária (EventBridge): processa vencimentos de treino, geração de cobranças
e transições de status financeiro. Agenda particionada por dia (`SCHED#{data}`).

Cada entrada é gravada na partição da DATA CIVIL em que deve disparar, e carrega o fuso
(`tz`) de quem vai receber. Este handler roda de hora em hora e só age nas entradas cujo
horário local já chegou — assim uma única agenda serve todos os fusos, sem partição por
região e sem uma Lambda por país (docs/TIMEZONE.md §7, Passo 5).

Antes rodava 1x/dia em `cron(0 9 UTC)` = 06:00 no BRT. Para quem está em São Paulo nada
muda: o gate dispara na primeira execução a partir das 06:00 locais. Para quem está fora,
é a diferença entre receber o aviso de manhã e recebê-lo às 18h.

Entrada sem `tz` (gravada antes desta mudança) cai no padrão — que é justamente o fuso em
que ela foi agendada. Nenhuma migração.
"""
import logging
from datetime import datetime, timedelta, timezone

from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import financeiro_service, locale_service, notif_service

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

_JANELA_DIAS = 30   # cobre entradas não processadas em execuções anteriores
# Um dia à frente do "hoje UTC": para um personal em UTC+13, as 06:00 locais de amanhã
# acontecem enquanto em UTC ainda é hoje. Sem isso, a entrada dele só seria vista com um
# dia de atraso.
_JANELA_FUTURO_DIAS = 1
_HORA_DISPARO = 6   # manhã local de quem recebe


def _na_hora(item: dict, dia_local: str) -> bool:
    """Já passou das 06:00 locais de `dia_local` para o dono desta entrada?"""
    return locale_service.ja_passou(dia_local, item.get("tz"), _HORA_DISPARO)


def _processar_dia_treinos(data: str, dia_disparo: str) -> int:
    """`data` é a partição (= data_fim do treino); o aviso "vence amanhã" sai em D-1."""
    n = 0
    cursor = None
    while True:
        items, cursor = repo.query_pk_page(keys.pk_sched(data), keys.DUE_PREFIX, limit=50, cursor=cursor)
        for it in items:
            if not _na_hora(it, dia_disparo):
                continue
            # Delete first — atomic claim prevents duplicate notifications on Lambda retries
            if not repo.delete_item_if_exists(keys.pk_sched(data), it["SK"]):
                continue
            personal_id = it.get("personal_id")
            if personal_id:
                nome = it.get("aluno_nome") or "um aluno"
                tnome = it.get("treino_nome") or "Treino"
                notif_service.criar(
                    personal_id, "TREINO_FIM", "Treino vence amanhã",
                    f"O treino '{tnome}' de {nome} vence amanhã ({it.get('data_fim')}). "
                    f"Atualize ou renove antes que expire.", aluno_id=it.get("aluno_id"))
            n += 1
        if cursor is None:
            break
    return n


def _processar_prefixo(data: str, prefixo: str, acao, rotulo: str) -> int:
    """Varre uma partição/prefixo, respeita o horário local e aplica `acao(item)`.

    O gate vem ANTES do claim de propósito: deletar uma entrada cuja hora ainda não chegou
    a perderia para sempre."""
    n = 0
    cursor = None
    while True:
        items, cursor = repo.query_pk_page(keys.pk_sched(data), prefixo, limit=50, cursor=cursor)
        for it in items:
            if not _na_hora(it, data):
                continue
            if not repo.delete_item_if_exists(keys.pk_sched(data), it["SK"]):
                continue
            try:
                acao(it)
            except Exception as exc:
                logger.error("[scheduler] %s falhou aluno=%s: %s", rotulo, it.get("aluno_id"), exc)
            n += 1
        if cursor is None:
            break
    return n


def _billing_gerar(it: dict) -> None:
    financeiro_service._gerar_cobranca_agendada(it["aluno_id"], it["personal_id"], it["vencimento"])


def _billing_aviso(it: dict) -> None:
    financeiro_service._avisar_dia_pagamento(
        it["aluno_id"], it["cobranca_id"], it["vencimento"], it["personal_id"])


def _billing_vencer(it: dict) -> None:
    financeiro_service._marcar_vencida(
        it["aluno_id"], it["cobranca_id"], it["vencimento"], it["personal_id"])


def _billing_lembrete(it: dict) -> None:
    financeiro_service._lembrar_vencida(
        it["aluno_id"], it["cobranca_id"], it["personal_id"], int(it.get("dias", 0)))


def _assinatura_aviso(it: dict) -> None:
    personal_id = it.get("personal_id")
    if personal_id:
        notif_service.criar(
            personal_id, "ASSINATURA_VENCENDO", "Sua assinatura vence em breve",
            "Seu plano Gestão Pro vence em 7 dias. Renove para manter alunos ilimitados.")


_TAREFAS = (
    (keys.BILLING_GERAR_PREFIX,    _billing_gerar,     "billing_gerar"),
    (keys.BILLING_AVISO_PREFIX,    _billing_aviso,     "billing_aviso"),
    (keys.BILLING_VENCER_PREFIX,   _billing_vencer,    "billing_vencer"),
    (keys.BILLING_LEMBRETE_PREFIX, _billing_lembrete,  "billing_lembrete"),
    (keys.ASSINATURA_AVISO_PREFIX, _assinatura_aviso,  "assinatura_aviso"),
)


def handler(event, context):
    hoje = datetime.now(timezone.utc).date()
    totais: dict[str, int] = {"treinos": 0}
    for prefixo, _acao, rotulo in _TAREFAS:
        totais[rotulo] = 0

    for i in range(_JANELA_DIAS, -_JANELA_FUTURO_DIAS - 1, -1):
        data = (hoje - timedelta(days=i)).isoformat()
        # O aviso de treino sai um dia ANTES do vencimento: a partição é `data_fim`, mas
        # quem manda no horário é a véspera.
        data_treino = (hoje - timedelta(days=i - 1)).isoformat()
        totais["treinos"] += _processar_dia_treinos(data_treino, data)
        for prefixo, acao, rotulo in _TAREFAS:
            totais[rotulo] += _processar_prefixo(data, prefixo, acao, rotulo)

    logger.info("[scheduler] %s", totais)
    return totais
