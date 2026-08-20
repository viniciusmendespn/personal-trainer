"""Lambda a cada 5 min (EventBridge): cuida das sessões de treino que ficaram abertas.

Avisa o aluno 4h depois do início e, em 6h, finaliza a sessão sozinha com o que ele já
registrou. Antes disso, o TTL do DynamoDB apagava sessão e registros juntos: quem treinava e
esquecia de finalizar perdia tudo, sem nem virar sessão histórica.

Molde de `agenda_scheduler.py` (partição SCHED#{dia} + claim por delete), com uma diferença
deliberada: a janela é aberta para trás. Perder um lembrete de aula é um aviso a menos; perder
um fechamento é o treino do aluno, então o item vencido tem que continuar sendo processado nas
execuções seguintes — mesmo raciocínio do `_JANELA_DIAS` de `scheduler.py`.
"""
import logging
from datetime import datetime, timedelta, timezone

from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import sessao_service

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Hoje + ontem: cobre virada de meia-noite e a Lambda fora do ar por horas, sempre dentro do
# TTL dos REG (48h), que é o que o fechamento precisa encontrar vivo.
_JANELA_DIAS = 2

_ACOES = {
    "AVISO": sessao_service.avisar_sessao_aberta,
    "FECHAR": sessao_service.encerrar_sessao_aberta,
}


def handler(event, context):
    agora = datetime.now(timezone.utc)
    agora_iso = agora.strftime("%Y-%m-%dT%H:%M:%SZ")
    contagem: dict[str, int] = {}

    for n in range(_JANELA_DIAS):
        dia = (agora - timedelta(days=n)).strftime("%Y-%m-%d")
        pk = keys.pk_sched(dia)
        vencidos = repo.query_between(
            pk,
            keys.SESSAO_SCHED_PREFIX,
            f"{keys.SESSAO_SCHED_PREFIX}{agora_iso}",
        )
        for it in vencidos:
            # Claim antes de agir: se duas execuções se sobrepuserem, só uma processa.
            if not repo.delete_item_if_exists(pk, it["SK"]):
                continue
            acao = it.get("acao")
            fn = _ACOES.get(acao)
            if not fn:
                logger.warning("[sessao-sched] ação desconhecida em %s", it["SK"])
                continue
            try:
                resultado = fn(repo.clean(it))
                chave = f"{acao}:{resultado}"
                contagem[chave] = contagem.get(chave, 0) + 1
            except Exception as exc:
                # Uma sessão problemática não pode impedir o fechamento das demais.
                logger.error("[sessao-sched] falhou %s aluno=%s sessao=%s: %s",
                             acao, it.get("aluno_id"), it.get("sessao_id"), exc, exc_info=True)

    logger.info("[sessao-sched] %s", contagem or "nada a processar")
    return contagem
