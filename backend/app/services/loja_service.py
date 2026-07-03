"""Marketplace de pacotes (loja.coachpilot.com.br).

Modelagem (sem Scan, sem GSI):
  - Anúncio canônico:  LOJAAN#{anuncio_id} / META  (+ AVAL#{comprador} + COMPRADOR#{comprador})
  - Catálogo público:  LOJA#CATALOGO / AN#{epoch}#{anuncio_id} — cópia leve, só PUBLICADOS
  - Pedido canônico:   LOJAPED#{pedido_id} / META  (lookup global O(1))
  - Visões:            PT#{comprador}/LOJACOMPRA#... e PT#{vendedor}/LOJAVENDA#... (denormalizadas)

Entrega: token de licença emitido SOMENTE na transição para ENTREGUE (condicional no Dynamo —
duplo webhook/duplo clique geram uma entrega só; token órfão de um race perdido é inofensivo,
nunca é referenciado). O comprador instala server-side (importar_pacote) ou baixa o .cpkg fino.
"""
import json
import logging
import time

from botocore.exceptions import ClientError
from fastapi import HTTPException

from app.models.loja import (
    ANUNCIO_PAUSADO,
    ANUNCIO_PUBLICADO,
    ANUNCIO_REMOVIDO_ADMIN,
    PEDIDO_AGUARDANDO_PAGAMENTO,
    PEDIDO_AGUARDANDO_VENDEDOR,
    PEDIDO_CANCELADO,
    PEDIDO_ENTREGUE,
    PEDIDO_EXPIRADO,
    AvaliarBody,
    CriarAnuncioBody,
    EditarAnuncioBody,
)
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import media_service, mp_service, notif_service, pacote_service
from app.utils import epoch_ms, new_id, now_iso

logger = logging.getLogger(__name__)

_ESTADOS_ABERTOS = (PEDIDO_AGUARDANDO_PAGAMENTO, PEDIDO_AGUARDANDO_VENDEDOR)
_LOCK_TTL_S = 60 * 24 * 3600   # idempotência webhook — igual ao mp_service


# ── Helpers ──────────────────────────────────────────────────────────────────

def _nome_personal(personal_id: str) -> str:
    perfil = repo.get_item(keys.pk_personal(personal_id), keys.SK_PROFILE)
    return (perfil or {}).get("nome") or "Personal Trainer"


def _card_catalogo(anuncio: dict) -> dict:
    """Subset do anúncio que vive na cópia do catálogo (card da listagem)."""
    return {
        "anuncio_id": anuncio["anuncio_id"],
        "titulo": anuncio["titulo"],
        "preco_centavos": anuncio["preco_centavos"],
        "capa_s3_key": anuncio.get("capa_s3_key"),
        "vendedor_id": anuncio["vendedor_id"],
        "vendedor_nome": anuncio.get("vendedor_nome"),
        "stats": anuncio.get("stats") or {},
        "avaliacao_soma": anuncio.get("avaliacao_soma", 0),
        "avaliacao_count": anuncio.get("avaliacao_count", 0),
        "vendas_count": anuncio.get("vendas_count", 0),
        "criado_em": anuncio.get("criado_em"),
    }


def _sync_catalogo(anuncio: dict) -> None:
    """Cópia do catálogo existe apenas enquanto PUBLICADO."""
    sk = anuncio["catalogo_sk"]
    if anuncio.get("status") == ANUNCIO_PUBLICADO:
        repo.put_item(keys.PK_LOJA_CATALOGO, sk, _card_catalogo(anuncio))
    else:
        repo.delete_item(keys.PK_LOJA_CATALOGO, sk)


def _com_capa_url(item: dict) -> dict:
    if item.get("capa_s3_key"):
        item["capa_url"] = media_service.gerar_presigned_view_url(item["capa_s3_key"])
    return item


def _publico(anuncio: dict) -> dict:
    """Visão pública do anúncio (detalhe) — sem catalogo_sk interno."""
    out = {k: v for k, v in anuncio.items() if k != "catalogo_sk"}
    count = out.get("avaliacao_count") or 0
    soma = out.get("avaliacao_soma") or 0
    out["avaliacao_media"] = round(soma / count, 1) if count else None
    return _com_capa_url(out)


# ── Anúncios (vendedor) ──────────────────────────────────────────────────────

def criar_anuncio(vendedor_id: str, body: CriarAnuncioBody) -> dict:
    meta = pacote_service.metadados_distrib(body.pacote_id)
    if not meta or not meta.get("ativo"):
        raise HTTPException(404, detail={"code": "PACOTE_INDISPONIVEL"})
    if meta.get("autor_personal_id") != vendedor_id:
        raise HTTPException(403, detail={"code": "PACOTE_NAO_E_SEU"})

    anuncio_id = new_id()
    agora = now_iso()
    anuncio = {
        "anuncio_id": anuncio_id,
        "vendedor_id": vendedor_id,
        "vendedor_nome": _nome_personal(vendedor_id),
        "titulo": body.titulo,
        "descricao": body.descricao,
        "preco_centavos": body.preco_centavos,
        "capa_s3_key": body.capa_s3_key,
        "pacote_id": body.pacote_id,
        "pacote_nome": meta.get("nome"),
        "pacote_versao": meta.get("versao"),
        "stats": {
            "n_exercicios": meta["n_exercicios"],
            "n_templates": meta["n_templates"],
            "n_rotinas": meta["n_rotinas"],
        },
        "status": ANUNCIO_PUBLICADO,
        "avaliacao_soma": 0,
        "avaliacao_count": 0,
        "vendas_count": 0,
        "catalogo_sk": keys.sk_loja_catalogo(epoch_ms(), anuncio_id),
        "criado_em": agora,
        "atualizado_em": agora,
    }
    repo.put_item(keys.pk_loja_anuncio(anuncio_id), keys.SK_META, anuncio)
    # Ponteiro na partição do vendedor (lista "meus anúncios" sem Scan)
    repo.put_item(keys.pk_personal(vendedor_id), keys.sk_loja_meu_anuncio(anuncio_id),
                  {"anuncio_id": anuncio_id, "criado_em": agora})
    _sync_catalogo(anuncio)
    return _publico(anuncio)


def _get_anuncio(anuncio_id: str) -> dict:
    item = repo.get_item(keys.pk_loja_anuncio(anuncio_id), keys.SK_META)
    if not item:
        raise HTTPException(404, detail={"code": "ANUNCIO_NAO_ENCONTRADO"})
    return repo.clean(item)


def editar_anuncio(vendedor_id: str, anuncio_id: str, body: EditarAnuncioBody) -> dict:
    anuncio = _get_anuncio(anuncio_id)
    if anuncio["vendedor_id"] != vendedor_id:
        raise HTTPException(403, detail={"code": "ANUNCIO_NAO_E_SEU"})
    if anuncio.get("status") == ANUNCIO_REMOVIDO_ADMIN:
        raise HTTPException(409, detail={"code": "ANUNCIO_REMOVIDO_ADMIN"})

    fields = body.model_dump(exclude_none=True)
    if "pacote_id" in fields:
        meta = pacote_service.metadados_distrib(fields["pacote_id"])
        if not meta or not meta.get("ativo"):
            raise HTTPException(404, detail={"code": "PACOTE_INDISPONIVEL"})
        if meta.get("autor_personal_id") != vendedor_id:
            raise HTTPException(403, detail={"code": "PACOTE_NAO_E_SEU"})
        fields["pacote_nome"] = meta.get("nome")
        fields["pacote_versao"] = meta.get("versao")
        fields["stats"] = {
            "n_exercicios": meta["n_exercicios"],
            "n_templates": meta["n_templates"],
            "n_rotinas": meta["n_rotinas"],
        }
    if not fields:
        raise HTTPException(400, detail={"code": "NADA_A_ATUALIZAR"})
    fields["atualizado_em"] = now_iso()

    repo.update_item(keys.pk_loja_anuncio(anuncio_id), keys.SK_META, fields)
    anuncio.update(fields)
    _sync_catalogo(anuncio)
    return _publico(anuncio)


def meus_anuncios(vendedor_id: str) -> list[dict]:
    ponteiros = repo.query_pk(keys.pk_personal(vendedor_id),
                              sk_prefix=keys.LOJA_MEU_ANUNCIO_PREFIX)
    if not ponteiros:
        return []
    chaves = [(keys.pk_loja_anuncio(p["anuncio_id"]), keys.SK_META) for p in ponteiros]
    encontrados = repo.batch_get_items(chaves)
    out = [_publico(repo.clean(i)) for i in encontrados.values()]
    out.sort(key=lambda a: a.get("criado_em") or "", reverse=True)
    return out


def despublicar_admin(anuncio_id: str) -> None:
    anuncio = _get_anuncio(anuncio_id)
    repo.update_item(keys.pk_loja_anuncio(anuncio_id), keys.SK_META,
                     {"status": ANUNCIO_REMOVIDO_ADMIN, "atualizado_em": now_iso()})
    anuncio["status"] = ANUNCIO_REMOVIDO_ADMIN
    _sync_catalogo(anuncio)
    notif_service.criar(
        anuncio["vendedor_id"], "LOJA_ANUNCIO_REMOVIDO",
        "Anúncio removido da loja",
        f"Seu anúncio \"{anuncio['titulo']}\" foi removido do catálogo pela administração.",
    )


# ── Catálogo (público) ───────────────────────────────────────────────────────

def listar_catalogo(limit: int = 24, cursor: str | None = None) -> dict:
    items, next_cursor = repo.query_pk_page(
        keys.PK_LOJA_CATALOGO, keys.LOJA_CATALOGO_PREFIX, limit, cursor, forward=False
    )
    anuncios = []
    for i in items:
        card = _com_capa_url(repo.clean(i))
        count = card.get("avaliacao_count") or 0
        soma = card.get("avaliacao_soma") or 0
        card["avaliacao_media"] = round(soma / count, 1) if count else None
        anuncios.append(card)
    return {"anuncios": anuncios, "cursor": next_cursor}


def detalhe_publico(anuncio_id: str) -> dict:
    anuncio = _get_anuncio(anuncio_id)
    if anuncio.get("status") != ANUNCIO_PUBLICADO:
        raise HTTPException(404, detail={"code": "ANUNCIO_NAO_ENCONTRADO"})
    out = _publico(anuncio)
    out["mp_disponivel"] = mp_service.is_configured(anuncio["vendedor_id"])
    return out


def listar_avaliacoes(anuncio_id: str, limit: int = 20, cursor: str | None = None) -> dict:
    items, next_cursor = repo.query_pk_page(
        keys.pk_loja_anuncio(anuncio_id), keys.LOJA_AVAL_PREFIX, limit, cursor, forward=False
    )
    return {"avaliacoes": repo.clean_all(items), "cursor": next_cursor}


# ── Pedidos ──────────────────────────────────────────────────────────────────

def _get_pedido(pedido_id: str) -> dict:
    item = repo.get_item(keys.pk_loja_pedido(pedido_id), keys.SK_META)
    if not item:
        raise HTTPException(404, detail={"code": "PEDIDO_NAO_ENCONTRADO"})
    return repo.clean(item)


def _pedido_view(pedido: dict) -> dict:
    """Visão do pedido devolvida à API — o token de licença NUNCA sai aqui
    (só via /instalar e /download, validados por comprador+status)."""
    return {k: v for k, v in pedido.items() if k not in ("token", "compra_sk", "venda_sk")}


def _atualizar_copias(pedido: dict, fields: dict) -> None:
    repo.update_item_if_exists(keys.pk_personal(pedido["comprador_id"]), pedido["compra_sk"], fields)
    repo.update_item_if_exists(keys.pk_personal(pedido["vendedor_id"]), pedido["venda_sk"], fields)


def _transicionar(pedido: dict, novo_status: str, esperados: tuple,
                  extras: dict | None = None) -> bool:
    """Transição condicional no pedido canônico. False se o estado atual não permite
    (ex.: dupla entrega — quem perde o race não faz nada)."""
    names = {"#st": "status", "#at": "atualizado_em"}
    values = {":novo": novo_status, ":agora": now_iso()}
    sets = ["#st = :novo", "#at = :agora"]
    for i, (k, v) in enumerate((extras or {}).items()):
        names[f"#e{i}"] = k
        values[f":e{i}"] = repo._san(v)
        sets.append(f"#e{i} = :e{i}")
    cond_values = {f":esp{i}": e for i, e in enumerate(esperados)}
    try:
        repo._get_table().update_item(
            Key={"PK": keys.pk_loja_pedido(pedido["pedido_id"]), "SK": keys.SK_META},
            UpdateExpression="SET " + ", ".join(sets),
            ConditionExpression="#st IN (" + ", ".join(cond_values) + ")",
            ExpressionAttributeNames=names,
            ExpressionAttributeValues={**values, **cond_values},
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise

    pedido["status"] = novo_status
    pedido.update(extras or {})
    _atualizar_copias(pedido, {"status": novo_status})
    repo.update_item_if_exists(
        keys.pk_loja_anuncio(pedido["anuncio_id"]),
        keys.sk_loja_comprador(pedido["comprador_id"]),
        {"status": novo_status},
    )
    return True


def criar_pedido(comprador_id: str, anuncio_id: str) -> dict:
    anuncio = _get_anuncio(anuncio_id)
    if anuncio.get("status") != ANUNCIO_PUBLICADO:
        raise HTTPException(404, detail={"code": "ANUNCIO_NAO_ENCONTRADO"})
    if anuncio["vendedor_id"] == comprador_id:
        raise HTTPException(400, detail={"code": "COMPRA_PROPRIA"})

    # Marcador do comprador: retoma pedido aberto / bloqueia recompra do mesmo pacote
    marcador = repo.get_item(keys.pk_loja_anuncio(anuncio_id),
                             keys.sk_loja_comprador(comprador_id))
    if marcador:
        marcador = repo.clean(marcador)
        if marcador.get("status") in _ESTADOS_ABERTOS:
            pedido = _get_pedido(marcador["pedido_id"])
            if pedido["status"] in _ESTADOS_ABERTOS and not _expirar_se_vencido(pedido):
                return _retomar_checkout(pedido)
        elif (marcador.get("status") == PEDIDO_ENTREGUE
              and marcador.get("pacote_id") == anuncio["pacote_id"]):
            raise HTTPException(409, detail={"code": "JA_COMPRADO",
                                             "pedido_id": marcador.get("pedido_id")})

    vendedor_id = anuncio["vendedor_id"]
    modo = "MP" if mp_service.is_configured(vendedor_id) else "MANUAL"
    pedido_id = new_id()
    epoch = epoch_ms()
    agora = now_iso()
    pedido = {
        "pedido_id": pedido_id,
        "anuncio_id": anuncio_id,
        "titulo": anuncio["titulo"],
        "pacote_id": anuncio["pacote_id"],            # snapshot — versão vendida
        "preco_centavos": anuncio["preco_centavos"],  # snapshot — preço no servidor
        "vendedor_id": vendedor_id,
        "vendedor_nome": anuncio.get("vendedor_nome"),
        "comprador_id": comprador_id,
        "comprador_nome": _nome_personal(comprador_id),
        "modo": modo,
        "status": PEDIDO_AGUARDANDO_PAGAMENTO if modo == "MP" else PEDIDO_AGUARDANDO_VENDEDOR,
        "compra_sk": keys.sk_loja_compra(epoch, pedido_id),
        "venda_sk": keys.sk_loja_venda(epoch, pedido_id),
        "criado_em": agora,
        "atualizado_em": agora,
    }

    pix = None
    if modo == "MP":
        pix = mp_service.criar_pix_loja(vendedor_id, comprador_id,
                                        pedido["comprador_nome"], pedido)
        pedido["mp_payment_id"] = pix["payment_id"]
        pedido["expira_em"] = pix["expires_at"]

    repo.put_item(keys.pk_loja_pedido(pedido_id), keys.SK_META, pedido)
    copia = {k: pedido[k] for k in (
        "pedido_id", "anuncio_id", "titulo", "pacote_id", "preco_centavos",
        "vendedor_id", "vendedor_nome", "comprador_id", "comprador_nome",
        "modo", "status", "criado_em",
    )}
    repo.put_item(keys.pk_personal(comprador_id), pedido["compra_sk"], copia)
    repo.put_item(keys.pk_personal(vendedor_id), pedido["venda_sk"], copia)
    repo.put_item(keys.pk_loja_anuncio(anuncio_id), keys.sk_loja_comprador(comprador_id), {
        "pedido_id": pedido_id,
        "status": pedido["status"],
        "pacote_id": anuncio["pacote_id"],
        "criado_em": agora,
    })

    if modo == "MANUAL":
        preco = pedido["preco_centavos"] / 100
        notif_service.criar(
            vendedor_id, "LOJA_PEDIDO_MANUAL",
            "Novo pedido na loja",
            f"{pedido['comprador_nome']} quer comprar \"{pedido['titulo']}\" "
            f"(R$ {preco:.2f}). Combine o pagamento e confirme o recebimento no portal.",
        )

    out = _pedido_view(pedido)
    if pix:
        out["pix"] = pix
    return out


def _retomar_checkout(pedido: dict) -> dict:
    """Pedido aberto já existe — devolve com dados de PIX renovados (modo MP)."""
    out = _pedido_view(pedido)
    if pedido["status"] == PEDIDO_AGUARDANDO_PAGAMENTO and pedido.get("mp_payment_id"):
        try:
            out["pix"] = mp_service.consultar_pix(pedido["vendedor_id"],
                                                  pedido["mp_payment_id"])
        except Exception as exc:
            logger.warning("[loja] consultar_pix falhou pedido=%s: %s",
                           pedido["pedido_id"], exc)
    return out


def _expirar_se_vencido(pedido: dict) -> bool:
    """Expiração lazy do PIX (sem scheduler). True se transicionou para EXPIRADO."""
    if (pedido.get("status") == PEDIDO_AGUARDANDO_PAGAMENTO
            and pedido.get("expira_em") and now_iso() > pedido["expira_em"]):
        return _transicionar(pedido, PEDIDO_EXPIRADO, (PEDIDO_AGUARDANDO_PAGAMENTO,))
    return False


def get_pedido(caller_id: str, pedido_id: str) -> dict:
    """Status do pedido (polling do checkout). Se PIX aprovado e webhook ainda não chegou,
    processa inline (mesmo caminho idempotente do webhook)."""
    pedido = _get_pedido(pedido_id)
    if caller_id not in (pedido["comprador_id"], pedido["vendedor_id"]):
        raise HTTPException(403, detail={"code": "PEDIDO_NAO_E_SEU"})

    if pedido["status"] == PEDIDO_AGUARDANDO_PAGAMENTO and pedido.get("mp_payment_id"):
        try:
            status = mp_service.get_payment_status(pedido["vendedor_id"],
                                                   pedido["mp_payment_id"])
            if status.get("status") == "approved":
                mp_service.processar_webhook(
                    {"action": "payment.updated", "data": {"id": pedido["mp_payment_id"]}}
                )
                pedido = _get_pedido(pedido_id)
            else:
                _expirar_se_vencido(pedido)
        except ValueError as exc:
            logger.warning("[loja] poll MP falhou pedido=%s: %s", pedido_id, exc)

    return _retomar_checkout(pedido) if pedido["status"] == PEDIDO_AGUARDANDO_PAGAMENTO \
        else _pedido_view(pedido)


def _entregar(pedido: dict, notificar_vendedor: bool = False) -> None:
    """Entrega idempotente: emite token e transiciona condicionalmente para ENTREGUE."""
    token = pacote_service.emitir_token(pedido["pacote_id"], max_usos=1)
    ok = _transicionar(pedido, PEDIDO_ENTREGUE, _ESTADOS_ABERTOS,
                       extras={"token": token, "entregue_em": now_iso()})
    if not ok:
        atual = _get_pedido(pedido["pedido_id"])
        if atual["status"] == PEDIDO_ENTREGUE:
            return   # já entregue (duplo webhook/duplo clique) — token órfão inofensivo
        raise HTTPException(409, detail={"code": "PEDIDO_NAO_ABERTO", "status": atual["status"]})

    anuncio_atual = repo.add_and_set(
        keys.pk_loja_anuncio(pedido["anuncio_id"]), keys.SK_META,
        add={"vendas_count": 1}, set_={"atualizado_em": now_iso()},
        return_values=True,
    )
    if anuncio_atual:
        _sync_catalogo(repo.clean(anuncio_atual))

    preco = pedido["preco_centavos"] / 100
    notif_service.criar(
        pedido["comprador_id"], "LOJA_PEDIDO_LIBERADO",
        "Pacote liberado!",
        f"Sua compra de \"{pedido['titulo']}\" foi liberada. "
        "Instale o pacote na sua conta em Pacotes ou na loja.",
    )
    if notificar_vendedor:
        notif_service.criar(
            pedido["vendedor_id"], "LOJA_VENDA_PAGA",
            "Venda confirmada na loja",
            f"{pedido['comprador_nome']} pagou R$ {preco:.2f} por \"{pedido['titulo']}\". "
            "O pacote foi liberado automaticamente.",
        )


def processar_pagamento_loja(payment_id: str, routing: dict) -> None:
    """Ramo LOJA do webhook MP (lock de idempotência já checado pelo chamador)."""
    vendedor_id = routing.get("vendedor_id")
    comprador_id = routing.get("comprador_id")
    pedido_id = routing.get("pedido_id")
    if not all([vendedor_id, comprador_id, pedido_id]):
        return

    try:
        status = mp_service.get_payment_status(vendedor_id, payment_id)
    except ValueError as exc:
        logger.error("[loja] webhook re-query falhou payment=%s: %s", payment_id, exc)
        return
    if status.get("status") != "approved":
        return

    ext_ref = status.get("external_reference") or ""
    if ext_ref != f"LOJA|{vendedor_id}|{comprador_id}|{pedido_id}":
        logger.warning("[loja] webhook ext_ref inesperado: %s (pedido=%s)", ext_ref, pedido_id)
        return

    # Lock ANTES de processar (mesmo padrão/TTL do fluxo de cobrança)
    repo.put_item(keys.pk_mp_lock(payment_id), "lock", {
        "payment_id": payment_id,
        "processado_em": now_iso(),
        "ttl": int(time.time()) + _LOCK_TTL_S,
    })

    pedido = _get_pedido(pedido_id)
    _entregar(pedido, notificar_vendedor=True)
    logger.info("[loja] pagamento processado payment=%s pedido=%s", payment_id, pedido_id)


def confirmar_venda(vendedor_id: str, pedido_id: str) -> dict:
    """Fluxo manual: vendedor confirma que recebeu o pagamento por fora."""
    pedido = _get_pedido(pedido_id)
    if pedido["vendedor_id"] != vendedor_id:
        raise HTTPException(403, detail={"code": "PEDIDO_NAO_E_SEU"})
    if pedido["status"] == PEDIDO_ENTREGUE:
        return _pedido_view(pedido)
    if pedido["status"] != PEDIDO_AGUARDANDO_VENDEDOR:
        raise HTTPException(409, detail={"code": "PEDIDO_NAO_ABERTO", "status": pedido["status"]})
    _entregar(pedido)
    return _pedido_view(pedido)


def cancelar_pedido(caller_id: str, pedido_id: str) -> dict:
    pedido = _get_pedido(pedido_id)
    if caller_id not in (pedido["comprador_id"], pedido["vendedor_id"]):
        raise HTTPException(403, detail={"code": "PEDIDO_NAO_E_SEU"})
    if pedido["status"] == PEDIDO_CANCELADO:
        return _pedido_view(pedido)
    if not _transicionar(pedido, PEDIDO_CANCELADO, _ESTADOS_ABERTOS):
        atual = _get_pedido(pedido_id)
        raise HTTPException(409, detail={"code": "PEDIDO_NAO_ABERTO", "status": atual["status"]})
    return _pedido_view(pedido)


# ── Entrega ao comprador ─────────────────────────────────────────────────────

def _pedido_entregue_do_comprador(comprador_id: str, pedido_id: str) -> dict:
    pedido = _get_pedido(pedido_id)
    if pedido["comprador_id"] != comprador_id:
        raise HTTPException(403, detail={"code": "PEDIDO_NAO_E_SEU"})
    if pedido["status"] != PEDIDO_ENTREGUE or not pedido.get("token"):
        raise HTTPException(409, detail={"code": "PEDIDO_NAO_ENTREGUE", "status": pedido["status"]})
    return pedido


def instalar(comprador_id: str, pedido_id: str) -> dict:
    """Instala o pacote comprado direto na conta do comprador (sem baixar arquivo).
    Reimport = refresh sem consumir token (comportamento do importar_pacote)."""
    pedido = _pedido_entregue_do_comprador(comprador_id, pedido_id)
    arquivo_fino = {"fmt": pacote_service.REF_FMT,
                    "pacote_id": pedido["pacote_id"], "token": pedido["token"]}
    resultado = pacote_service.importar_pacote(comprador_id, json.dumps(arquivo_fino))
    return resultado.model_dump() if hasattr(resultado, "model_dump") else resultado


def download(comprador_id: str, pedido_id: str) -> dict:
    """Arquivo .cpkg fino — para quem prefere baixar e importar manualmente."""
    pedido = _pedido_entregue_do_comprador(comprador_id, pedido_id)
    return {"fmt": pacote_service.REF_FMT,
            "pacote_id": pedido["pacote_id"], "token": pedido["token"],
            "filename": f"{pedido['titulo']}.cpkg"}


# ── Minhas compras / minhas vendas ───────────────────────────────────────────

def minhas_compras(comprador_id: str, limit: int = 50, cursor: str | None = None) -> dict:
    items, next_cursor = repo.query_pk_page(
        keys.pk_personal(comprador_id), keys.LOJA_COMPRA_PREFIX, limit, cursor, forward=False
    )
    return {"compras": repo.clean_all(items), "cursor": next_cursor}


def minhas_vendas(vendedor_id: str, limit: int = 50, cursor: str | None = None) -> dict:
    items, next_cursor = repo.query_pk_page(
        keys.pk_personal(vendedor_id), keys.LOJA_VENDA_PREFIX, limit, cursor, forward=False
    )
    return {"vendas": repo.clean_all(items), "cursor": next_cursor}


# ── Avaliações ───────────────────────────────────────────────────────────────

def avaliar(comprador_id: str, anuncio_id: str, body: AvaliarBody) -> dict:
    marcador = repo.get_item(keys.pk_loja_anuncio(anuncio_id),
                             keys.sk_loja_comprador(comprador_id))
    if not marcador or marcador.get("status") != PEDIDO_ENTREGUE:
        raise HTTPException(403, detail={"code": "AVALIACAO_SEM_COMPRA"})

    pk = keys.pk_loja_anuncio(anuncio_id)
    sk = keys.sk_loja_aval(comprador_id)
    anterior = repo.get_item(pk, sk)
    delta_soma = body.nota - int((anterior or {}).get("nota", 0))
    delta_count = 0 if anterior else 1

    agora = now_iso()
    repo.put_item(pk, sk, {
        "anuncio_id": anuncio_id,
        "comprador_id": comprador_id,
        "comprador_nome": _nome_personal(comprador_id),
        "nota": body.nota,
        "comentario": body.comentario,
        "criado_em": (repo.clean(anterior) or {}).get("criado_em") or agora,
        "atualizado_em": agora,
    })
    anuncio_atual = repo.add_and_set(
        pk, keys.SK_META,
        add={"avaliacao_soma": delta_soma, "avaliacao_count": delta_count},
        set_={"atualizado_em": agora},
        return_values=True,
    )
    if anuncio_atual:
        _sync_catalogo(repo.clean(anuncio_atual))
    return {"ok": True}
