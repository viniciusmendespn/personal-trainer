"""Contador de visitas do site institucional — aba **Campanhas** do painel admin.

De onde a visita veio (origem) e que página foi vista, somados por dia com `ADD` atômico
(chaves em `keys.pk_campanhas`). Molde: o contador de campanhas do Presentou.

A **origem** é deduzida no cliente (`frontend/src/utils/campanha.ts`): link marcado
(`?campanha-instagram`, `?utm_source=`), link de divulgador (`?ref=`/`?cupom=` →
`cupom-{codigo}`), auto-tagging de anúncio (`gclid` → `google-ads`, `fbclid` → `meta`),
referrer (`google-busca`, `instagram`, …) ou nada (`direto`).

O painel lê o mês inteiro numa Query. **Nenhum GSI, nenhum Scan, 1 WCU por visita.**

⚠️ Este número NÃO é o do Google Ads/Meta: lá conta quem tocou no anúncio; aqui só quem
chegou com a página carregada e o JS rodando. O vão entre os dois é o que se perde no
caminho (desistência no carregamento, bloqueador, bot) — esperar que batam é ler errado.

⚠️ O endpoint é anônimo, então o número é inflável por quem o descobrir. O que o segura é
o rate limit por IP (`checar_limite`, chamado ANTES da escrita) e a validação abaixo, que
mantém a chave curta e sem lixo. Métrica de marketing não merece mais defesa que isso.
"""
import hashlib
import logging
import re
import time

from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import locale_service
from app.utils import now_iso, ttl_em

logger = logging.getLogger(__name__)

# ⚠️ ESPELHO de `ORIGEM_VALIDA` em `frontend/src/utils/campanha.ts`. O `campanha.test.ts`
# lê a regex DESTE arquivo e reprova o `npm test` se divergirem: uma origem que o cliente
# aceita e o servidor recusa é enviada e descartada em silêncio (204 nos dois casos).
ORIGEM_VALIDA = re.compile(r"^[a-z0-9][a-z0-9-]{0,23}$")

# ⚠️ ESPELHO de `CAMINHO_VALIDO` no `campanha.ts` (o teste compara). Até dois segmentos:
# `/blog/{artigo}` e `/calculadoras/{slug}` são o mais fundo do site institucional.
# `/@slug` (página de captação do personal) nunca passa: o `@` não está no alfabeto —
# é tráfego do aluno-prospect daquele personal, não aquisição do CoachPilot.
CAMINHO_VALIDO = re.compile(r"^/(?:[a-z0-9-]{1,80}(?:/[a-z0-9-]{1,80})?)?$")

# Primeiro segmento que é portal/app, não site. Quem escolhe as páginas é o cliente (lista
# de rotas públicas); isto aqui só impede que o endpoint anônimo grave rota de portal.
NAO_E_PAGINA = frozenset({
    "dashboard", "alunos", "captacao", "agenda", "templates", "rotinas", "biblioteca",
    "conhecimento", "pacotes", "loja-vendas", "financeiro", "feed", "ranking",
    "notificacoes", "plano", "config", "perfil", "admin", "ajuda", "aluno", "cadastro",
    "login", "forgot-password", "oauth", "token", "v1", "assets",
})

DIAS_RETENCAO = 730          # 2 anos de série — comparar ano contra ano

# Rate limit por IP: 60 eventos em 10 min cobre com folga quem lê o blog navegando, e
# barra a martelada. Estourar NÃO vira erro (o router responde 204 do mesmo jeito).
JANELA_S = 600
LIMITE_POR_JANELA = 60


class LimiteExcedido(Exception):
    pass


def normalizar(bruta: str | None) -> str | None:
    """A origem aceitável, ou `None`. Nunca levanta: o chamador é telemetria."""
    origem = (bruta or "").strip().lower()
    return origem if ORIGEM_VALIDA.match(origem) else None


def normalizar_pagina(bruta: str | None) -> str | None:
    """O caminho de uma página do site, ou `None` (portal, app, lixo)."""
    caminho = (bruta or "").strip().lower()
    if len(caminho) > 1:
        caminho = caminho.rstrip("/")
    if not CAMINHO_VALIDO.match(caminho):
        return None
    if caminho[1:].split("/")[0] in NAO_E_PAGINA:
        return None
    return caminho


def hash_ip(ip: str) -> str:
    """O IP nunca é gravado: só um hash curto, que basta para o balde do rate limit."""
    return hashlib.sha256(ip.encode()).hexdigest()[:20]


def checar_limite(ip: str) -> None:
    """Janela fixa por IP, contador atômico com TTL — mesmo padrão do `_check_rate_limit`
    do agente. Janela por epoch, não por data civil."""
    janela = str(int(time.time()) // JANELA_S)
    attrs = repo.add_and_set(
        keys.pk_quota_visita(hash_ip(ip)), janela,
        add={"n": 1}, set_={"ttl": int(time.time()) + JANELA_S * 2},
        return_values=True,
    ) or {}
    if int(attrs.get("n", 0)) > LIMITE_POR_JANELA:
        raise LimiteExcedido()


def _dia() -> str:
    """O dia de **São Paulo**, não o UTC: a chave é um dia de calendário lido por gente
    num gráfico. Com UTC, toda visita depois das 21h BRT cairia na barra de amanhã —
    justamente no horário de maior tráfego de anúncio. O mês da partição sai daqui também."""
    return locale_service.dia(now_iso(), locale_service.TZ_PADRAO)


def mes_atual() -> str:
    return _dia()[:7]


def registrar(origem: str | None, pagina: str | None) -> None:
    """Soma 1 visita no item do dia da origem e/ou da página. `ADD`, nunca leitura +
    escrita: duas visitas simultâneas contariam uma só, e o erro seria invisível."""
    dia = _dia()
    pk = keys.pk_campanhas(dia[:7])
    ttl = ttl_em(dias=DIAS_RETENCAO)
    if origem:
        repo.add_and_set(pk, keys.sk_campanha_dia(origem, dia),
                         add={"visitas": 1}, set_={"origem": origem, "dia": dia, "ttl": ttl})
    if pagina:
        repo.add_and_set(pk, keys.sk_pagina_dia(pagina, dia),
                         add={"visitas": 1}, set_={"pagina": pagina, "dia": dia, "ttl": ttl})


def resumo(mes: str) -> dict:
    """Origens e páginas do mês, ordenadas por volume, cada uma com a série diária.

    ⚠️ `query_pk` pagina internamente até o fim (trata `LastEvaluatedKey`). A partição tem
    no máximo 31 itens minúsculos por origem/página — cabe folgado.
    """
    por_origem: dict[str, dict] = {}
    por_pagina: dict[str, dict] = {}
    for item in repo.query_pk(keys.pk_campanhas(mes)):
        sk = str(item.get("SK", ""))
        visitas = int(item.get("visitas", 0))
        dia = item.get("dia") or sk.rsplit("#", 1)[-1]
        if sk.startswith(keys.CAMPANHA_PAGINA_PREFIX):
            nome, destino, campo = item.get("pagina") or "?", por_pagina, "pagina"
        else:
            nome, destino, campo = item.get("origem") or sk.split("#")[0], por_origem, "origem"
        registro = destino.setdefault(nome, {campo: nome, "visitas": 0, "por_dia": {}})
        registro["visitas"] += visitas
        registro["por_dia"][dia] = registro["por_dia"].get(dia, 0) + visitas

    origens = sorted(por_origem.values(), key=lambda o: (-o["visitas"], o["origem"]))
    paginas = sorted(por_pagina.values(), key=lambda p: (-p["visitas"], p["pagina"]))
    return {
        "mes": mes,
        "hoje": _dia(),
        "total": sum(o["visitas"] for o in origens),
        "origens": origens,
        "total_paginas": sum(p["visitas"] for p in paginas),
        "paginas": paginas,
    }
