"""Serviço de importação e gerenciamento de pacotes de treino (.cpkg).

Fluxo de importação (importar_pacote):
  1. Desserializa e valida JSON do .cpkg
  2. Verifica assinatura HMAC-SHA256 (obrigatória em ambos os tipos)
  3. Se token presente (pacote licenciado): consome token atomicamente
  4. Cria exercícios via put_item dedup-por-nome
  5. Cria templates resolvendo ex_ref → exlib_id real
  6. Cria rotinas (snapshot dos treinos buildados)
  7. Grava PACOTE#{pacote_id} com metadados e listas de IDs
"""
import hashlib
import hmac
import json
import logging
import re
import unicodedata
from typing import Optional

from botocore.exceptions import ClientError
from fastapi import HTTPException

from app.config import settings
from app.models.pacote import ImportarPacoteResponse, PacoteFile, PacoteInstalado
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.utils import new_id, now_iso

logger = logging.getLogger(__name__)


# ── Helpers de exportação ────────────────────────────────────────────────────

def _nome_para_ref(prefix: str, nome: str) -> str:
    """Deriva um ref estável a partir do nome (normaliza acentos, espaços → _)."""
    nfkd = unicodedata.normalize("NFKD", nome)
    ascii_str = nfkd.encode("ASCII", "ignore").decode("ASCII")
    slug = re.sub(r"[^a-z0-9]+", "_", ascii_str.lower()).strip("_")
    return f"{prefix}{slug}"


def _build_exercicio_out(nome: str, item: dict) -> dict:
    return {
        "ref": _nome_para_ref("ex_", nome),
        "nome": nome,
        "grupo": item.get("grupo"),
        "tipo_exercicio": item.get("tipo_exercicio", "FORCA"),
        "video_url": item.get("video_url"),
        "descricao": item.get("descricao"),
        "recomendacoes": item.get("recomendacoes"),
        "substitutos": item.get("substitutos") or [],
    }


def _build_template_out(tmpl: dict, nome_lower_to_ref: dict[str, str]) -> dict:
    exercicios_tmpl = []
    for ex in tmpl.get("exercicios") or []:
        ex_nome = (ex.get("nome") or "").strip()
        ex_ref = nome_lower_to_ref.get(ex_nome.lower()) or _nome_para_ref("ex_", ex_nome)
        exercicios_tmpl.append({
            "ex_ref": ex_ref,
            "ordem": ex.get("ordem", 0),
            "series_prescritas": ex.get("series_prescritas"),
            "intervalo_s": ex.get("intervalo_s"),
            "observacoes": ex.get("observacoes"),
        })
    return {
        "ref": _nome_para_ref("tmpl_", tmpl["nome"]),
        "nome": tmpl["nome"],
        "foco": tmpl.get("foco"),
        "exercicios": exercicios_tmpl,
    }


def _build_rotina_out(rot: dict, tmpl_nome_lower_to_ref: dict[str, str]) -> dict:
    treinos_refs = [
        tmpl_nome_lower_to_ref[t["nome"].strip().lower()]
        for t in (rot.get("treinos") or [])
        if t.get("nome") and t["nome"].strip().lower() in tmpl_nome_lower_to_ref
    ]
    return {
        "ref": _nome_para_ref("rot_", rot["nome"]),
        "nome": rot["nome"],
        "descricao": rot.get("descricao"),
        "treinos": treinos_refs,
    }


def _draft_json(pacote_meta: dict, exercicios: list, templates: list, rotinas: list) -> dict:
    from app.utils import new_id
    return {
        "version": "1",
        "pacote": {
            "id": new_id(),
            "nome": pacote_meta.get("nome", ""),
            "descricao": pacote_meta.get("descricao", ""),
            "autor": pacote_meta.get("autor", ""),
            "versao": pacote_meta.get("versao", "1"),
        },
        "exercicios": exercicios,
        "templates": templates,
        "rotinas": rotinas,
    }


# ── Assinatura HMAC ──────────────────────────────────────────────────────────

def _calcular_assinatura(payload_sem_assinatura: dict) -> str:
    canonical = json.dumps(payload_sem_assinatura, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hmac.new(
        settings.pacote_secret.encode("utf-8"),
        canonical.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _verificar_assinatura(conteudo_dict: dict, assinatura: str) -> None:
    if not settings.pacote_secret:
        raise HTTPException(500, detail={"code": "PACOTE_SECRET_NAO_CONFIGURADO"})
    payload = {k: v for k, v in conteudo_dict.items() if k != "assinatura"}
    expected = _calcular_assinatura(payload)
    if not hmac.compare_digest(expected, assinatura):
        raise HTTPException(400, detail={"code": "ASSINATURA_INVALIDA"})


# ── Token de uso único ───────────────────────────────────────────────────────

def _consumir_token(token: str, personal_id: str) -> None:
    """Consome o token atomicamente. Lança HTTPException se inválido/esgotado/já usado."""
    token_uuid = token.removeprefix("tok_")
    pk = keys.pk_token(token_uuid)
    sk = keys.SK_META

    registro = repo.get_item(pk, sk)
    if not registro:
        raise HTTPException(404, detail={"code": "TOKEN_INVALIDO"})

    table = repo._get_table()
    try:
        table.update_item(
            Key={"PK": pk, "SK": sk},
            UpdateExpression=(
                "SET #uc = #uc + :one, "
                "#up = list_append(if_not_exists(#up, :empty), :pid)"
            ),
            ConditionExpression="#uc < #mu AND NOT contains(#up, :pid_check)",
            ExpressionAttributeNames={
                "#uc": "usos_count",
                "#mu": "max_usos",
                "#up": "usado_por",
            },
            ExpressionAttributeValues={
                ":one": 1,
                ":empty": [],
                ":pid": [personal_id],
                ":pid_check": personal_id,
            },
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            # Distingue "esgotado" de "já usado por este personal"
            registro_atual = repo.get_item(pk, sk)
            if registro_atual and personal_id in (registro_atual.get("usado_por") or []):
                raise HTTPException(409, detail={"code": "TOKEN_JA_USADO"})
            raise HTTPException(409, detail={"code": "TOKEN_ESGOTADO"})
        raise


# ── Importação ────────────────────────────────────────────────────────────────

def importar_pacote(personal_id: str, conteudo_str: str) -> ImportarPacoteResponse:
    # 1. Parse JSON
    try:
        conteudo_dict = json.loads(conteudo_str)
    except json.JSONDecodeError as exc:
        raise HTTPException(400, detail={"code": "ARQUIVO_INVALIDO", "detail": str(exc)})

    # 2. Validar estrutura via Pydantic
    try:
        pacote_file = PacoteFile(**conteudo_dict)
    except Exception as exc:
        raise HTTPException(400, detail={"code": "ARQUIVO_INVALIDO", "detail": str(exc)})

    # 3. Verificar assinatura (obrigatória em ambos os tipos)
    _verificar_assinatura(conteudo_dict, pacote_file.assinatura)

    # 4. Se licenciado: consumir token (atômico)
    licenciado = pacote_file.token is not None
    if licenciado:
        _consumir_token(pacote_file.token, personal_id)

    pk_pt = keys.pk_personal(personal_id)
    pacote_id = pacote_file.pacote.id
    now = now_iso()

    # 5. Exercícios — dedup por nome.lower()
    existentes_raw = repo.query_pk(pk_pt, sk_prefix=keys.EXLIB_PREFIX)
    nomes_existentes: dict[str, str] = {}   # nome_lower → exlib_id
    for item in existentes_raw:
        nome_lower = (item.get("nome") or "").strip().lower()
        if nome_lower:
            nomes_existentes[nome_lower] = item["SK"].removeprefix(keys.EXLIB_PREFIX)

    ref_to_exlib: dict[str, str] = {}       # ref → exlib_id
    ref_to_grupo: dict[str, str] = {}       # ref → grupo muscular
    ref_to_tipo_exercicio: dict[str, str] = {}  # ref → tipo_exercicio
    exlib_puts: list[dict] = []
    exlib_id_to_nome: dict[str, str] = {}   # para resolução nos templates

    for ex_pkg in pacote_file.exercicios:
        nome_lower = ex_pkg.nome.strip().lower()
        if nome_lower in nomes_existentes:
            exlib_id = nomes_existentes[nome_lower]
            ref_to_exlib[ex_pkg.ref] = exlib_id
            ref_to_grupo[ex_pkg.ref] = ex_pkg.grupo or ""
            ref_to_tipo_exercicio[ex_pkg.ref] = ex_pkg.tipo_exercicio.value
            # busca o nome canônico do existente para manter consistência nos templates
            for raw in existentes_raw:
                if raw["SK"] == keys.sk_exlib(exlib_id):
                    exlib_id_to_nome[exlib_id] = raw.get("nome", ex_pkg.nome)
                    break
            else:
                exlib_id_to_nome[exlib_id] = ex_pkg.nome
            continue

        exlib_id = new_id()
        item = {
            "PK": pk_pt,
            "SK": keys.sk_exlib(exlib_id),
            "exlib_id": exlib_id,
            "nome": ex_pkg.nome.strip(),
            "grupo": ex_pkg.grupo,
            "tipo_exercicio": ex_pkg.tipo_exercicio.value,
            "video_url": ex_pkg.video_url,
            "descricao": ex_pkg.descricao,
            "recomendacoes": ex_pkg.recomendacoes,
            "links_uteis": [],
            "substitutos": [s.model_dump() for s in ex_pkg.substitutos],
            "pacote_id": pacote_id,
            "ativo": True,
        }
        exlib_puts.append(item)
        ref_to_exlib[ex_pkg.ref] = exlib_id
        ref_to_grupo[ex_pkg.ref] = ex_pkg.grupo or ""
        ref_to_tipo_exercicio[ex_pkg.ref] = ex_pkg.tipo_exercicio.value
        exlib_id_to_nome[exlib_id] = ex_pkg.nome.strip()
        nomes_existentes[nome_lower] = exlib_id

    for i in range(0, len(exlib_puts), 25):
        repo.batch_write(puts=exlib_puts[i:i + 25])

    # 6. Templates — resolve ex_ref → nome e dados de série
    ref_to_template: dict[str, str] = {}
    template_puts: list[dict] = []

    for tmpl_pkg in pacote_file.templates:
        template_id = new_id()
        exercicios: list[dict] = []
        for ex_ref_item in tmpl_pkg.exercicios:
            exlib_id = ref_to_exlib.get(ex_ref_item.ex_ref, "")
            nome_ex = exlib_id_to_nome.get(exlib_id, ex_ref_item.ex_ref)
            grupo_ex = ref_to_grupo.get(ex_ref_item.ex_ref)
            tipo_ex = ref_to_tipo_exercicio.get(ex_ref_item.ex_ref, "FORCA")
            exercicios.append({
                "nome": nome_ex,
                "grupo": grupo_ex,
                "ordem": ex_ref_item.ordem,
                "series_prescritas": [s.model_dump() for s in (ex_ref_item.series_prescritas or [])],
                "intervalo_s": ex_ref_item.intervalo_s,
                "observacoes": ex_ref_item.observacoes,
                "tipo_exercicio": tipo_ex,
            })

        item = {
            "PK": pk_pt,
            "SK": keys.sk_template(template_id),
            "template_id": template_id,
            "personal_id": personal_id,
            "nome": tmpl_pkg.nome,
            "foco": tmpl_pkg.foco,
            "exercicios": exercicios,
            "pacote_id": pacote_id,
            "ativo": True,
            "created_at": now,
        }
        template_puts.append(item)
        ref_to_template[tmpl_pkg.ref] = template_id

    for i in range(0, len(template_puts), 25):
        repo.batch_write(puts=template_puts[i:i + 25])

    # 7. Rotinas — snapshot dos treinos buildados
    rotina_puts: list[dict] = []
    rotina_ids: list[str] = []

    for rot_pkg in pacote_file.rotinas:
        rotina_id = new_id()
        treinos: list[dict] = []
        for ordem, tmpl_ref in enumerate(rot_pkg.treinos):
            template_id = ref_to_template.get(tmpl_ref)
            if not template_id:
                continue
            tmpl_item = next((t for t in template_puts if t.get("template_id") == template_id), None)
            if tmpl_item:
                treinos.append({
                    "nome": tmpl_item["nome"],
                    "foco": tmpl_item.get("foco"),
                    "ordem": ordem,
                    "exercicios": tmpl_item.get("exercicios", []),
                })

        item = {
            "PK": pk_pt,
            "SK": keys.sk_rotina(rotina_id),
            "rotina_id": rotina_id,
            "personal_id": personal_id,
            "nome": rot_pkg.nome,
            "descricao": rot_pkg.descricao,
            "treinos": treinos,
            "pacote_id": pacote_id,
            "ativo": True,
            "created_at": now,
        }
        rotina_puts.append(item)
        rotina_ids.append(rotina_id)

    for i in range(0, len(rotina_puts), 25):
        repo.batch_write(puts=rotina_puts[i:i + 25])

    # 8. Metadados do pacote
    pacote_meta = {
        "pacote_id": pacote_id,
        "nome": pacote_file.pacote.nome,
        "descricao": pacote_file.pacote.descricao,
        "autor": pacote_file.pacote.autor,
        "versao": pacote_file.pacote.versao,
        "licenciado": licenciado,
        "ativo": True,
        "exlib_ids": [e["exlib_id"] for e in exlib_puts],
        "template_ids": [t["template_id"] for t in template_puts],
        "rotina_ids": rotina_ids,
        "importado_em": now,
        "token": pacote_file.token or "",
    }
    ok = repo.put_item_if_absent(pk_pt, keys.sk_pacote(pacote_id), pacote_meta)
    if not ok:
        raise HTTPException(409, detail={"code": "PACOTE_JA_IMPORTADO"})

    return ImportarPacoteResponse(
        pacote_id=pacote_id,
        nome=pacote_file.pacote.nome,
        licenciado=licenciado,
        exercicios_importados=len(exlib_puts),
        templates_importados=len(template_puts),
        rotinas_importadas=len(rotina_puts),
    )


# ── Importação de rascunho gerado por IA ─────────────────────────────────────

def importar_rascunho(personal_id: str, conteudo_str: str) -> ImportarPacoteResponse:
    """Aceita JSON sem assinatura (gerado por LLM), assina internamente e importa como pacote livre."""
    try:
        conteudo_dict = json.loads(conteudo_str)
    except json.JSONDecodeError as exc:
        raise HTTPException(400, detail={"code": "ARQUIVO_INVALIDO", "detail": str(exc)})

    # Remove campos de segurança — rascunho sempre vira pacote livre
    conteudo_dict.pop("token", None)
    conteudo_dict.pop("assinatura", None)

    # Valida estrutura via Pydantic antes de assinar
    try:
        PacoteFile(**{**conteudo_dict, "assinatura": "placeholder"})
    except Exception as exc:
        raise HTTPException(400, detail={"code": "ESTRUTURA_INVALIDA", "detail": str(exc)})

    if not settings.pacote_secret:
        raise HTTPException(500, detail={"code": "PACOTE_SECRET_NAO_CONFIGURADO"})

    conteudo_dict["assinatura"] = _calcular_assinatura(conteudo_dict)
    return importar_pacote(personal_id, json.dumps(conteudo_dict))


# ── Pacote Manual ─────────────────────────────────────────────────────────────

MANUAL_PACOTE_ID = "manual"


def _get_or_build_pacote_manual(personal_id: str) -> dict:
    pk_pt = keys.pk_personal(personal_id)
    meta = repo.get_item(pk_pt, keys.sk_pacote(MANUAL_PACOTE_ID))
    if not meta:
        meta = {
            "pacote_id": MANUAL_PACOTE_ID,
            "nome": "Criações Manuais",
            "descricao": "Exercícios, templates e rotinas criados manualmente.",
            "autor": "",
            "versao": "",
            "licenciado": False,
            "is_manual": True,
            "ativo": True,
            "importado_em": now_iso(),
        }
        repo.put_item(pk_pt, keys.sk_pacote(MANUAL_PACOTE_ID), meta)

    def is_manual(i: dict) -> bool:
        return i.get("pacote_id") in (MANUAL_PACOTE_ID, None, "")

    exlib_count = sum(1 for i in repo.query_pk(pk_pt, sk_prefix=keys.EXLIB_PREFIX) if is_manual(i))
    tmpl_count = sum(1 for i in repo.query_pk(pk_pt, sk_prefix=keys.TEMPLATE_PREFIX) if is_manual(i))
    rot_count = sum(1 for i in repo.query_pk(pk_pt, sk_prefix=keys.ROTINA_PREFIX) if is_manual(i))

    cleaned = repo.clean(meta)
    cleaned["exlib_ids"] = ["_"] * exlib_count
    cleaned["template_ids"] = ["_"] * tmpl_count
    cleaned["rotina_ids"] = ["_"] * rot_count
    return cleaned


def _toggle_pacote_manual(pk_pt: str, ativo: bool) -> None:
    def is_manual(i: dict) -> bool:
        return i.get("pacote_id") in (MANUAL_PACOTE_ID, None, "")

    for prefix in [keys.EXLIB_PREFIX, keys.TEMPLATE_PREFIX, keys.ROTINA_PREFIX]:
        for item in repo.query_pk(pk_pt, sk_prefix=prefix):
            if is_manual(item):
                repo.update_item_if_exists(pk_pt, item["SK"], {"ativo": ativo})


# ── Listagem e configuração ───────────────────────────────────────────────────

def listar_pacotes(personal_id: str) -> list[dict]:
    pacotes = repo.clean_all(repo.query_pk(keys.pk_personal(personal_id), sk_prefix=keys.PACOTE_PREFIX))
    pacotes = [p for p in pacotes if p.get("pacote_id") != MANUAL_PACOTE_ID]
    manual = _get_or_build_pacote_manual(personal_id)
    return [manual] + pacotes


def toggle_pacote(personal_id: str, pacote_id: str, ativo: bool) -> None:
    pk_pt = keys.pk_personal(personal_id)

    if pacote_id == MANUAL_PACOTE_ID:
        _toggle_pacote_manual(pk_pt, ativo)
        meta = repo.get_item(pk_pt, keys.sk_pacote(MANUAL_PACOTE_ID))
        if not meta:
            _get_or_build_pacote_manual(personal_id)
        repo.update_item_if_exists(pk_pt, keys.sk_pacote(MANUAL_PACOTE_ID), {"ativo": ativo})
        return

    pacote_item = repo.get_item(pk_pt, keys.sk_pacote(pacote_id))
    if not pacote_item:
        raise HTTPException(404, detail="Pacote não encontrado")

    repo.update_item_if_exists(pk_pt, keys.sk_pacote(pacote_id), {"ativo": ativo})

    for exlib_id in (pacote_item.get("exlib_ids") or []):
        repo.update_item_if_exists(pk_pt, keys.sk_exlib(exlib_id), {"ativo": ativo})
    for template_id in (pacote_item.get("template_ids") or []):
        repo.update_item_if_exists(pk_pt, keys.sk_template(template_id), {"ativo": ativo})
    for rotina_id in (pacote_item.get("rotina_ids") or []):
        repo.update_item_if_exists(pk_pt, keys.sk_rotina(rotina_id), {"ativo": ativo})


def toggle_item(personal_id: str, pacote_id: str, item_id: str, ativo: bool) -> None:
    pk_pt = keys.pk_personal(personal_id)
    for sk_fn in [keys.sk_exlib, keys.sk_template, keys.sk_rotina]:
        result = repo.update_item_if_exists(pk_pt, sk_fn(item_id), {"ativo": ativo})
        if result is not None:
            return
    raise HTTPException(404, detail="Item não encontrado")


def remover_pacote(personal_id: str, pacote_id: str) -> None:
    if pacote_id == MANUAL_PACOTE_ID:
        raise HTTPException(400, detail={"code": "PACOTE_MANUAL_NAO_REMOVIVEL"})

    pk_pt = keys.pk_personal(personal_id)
    pacote_item = repo.get_item(pk_pt, keys.sk_pacote(pacote_id))
    if not pacote_item:
        raise HTTPException(404, detail="Pacote não encontrado")

    deletes: list[tuple] = [(pk_pt, keys.sk_pacote(pacote_id))]
    for exlib_id in (pacote_item.get("exlib_ids") or []):
        deletes.append((pk_pt, keys.sk_exlib(exlib_id)))
    for template_id in (pacote_item.get("template_ids") or []):
        deletes.append((pk_pt, keys.sk_template(template_id)))
    for rotina_id in (pacote_item.get("rotina_ids") or []):
        deletes.append((pk_pt, keys.sk_rotina(rotina_id)))

    for i in range(0, len(deletes), 25):
        repo.batch_write(deletes=deletes[i:i + 25])


# ── Exportação ────────────────────────────────────────────────────────────────

def exportar_pacote(personal_id: str, pacote_id: str) -> dict:
    """Reconstrói o JSON draft de um pacote livre para re-edição (ex: via ChatGPT)."""
    if pacote_id == MANUAL_PACOTE_ID:
        raise HTTPException(400, detail={"code": "PACOTE_MANUAL_NAO_EXPORTAVEL"})

    pk_pt = keys.pk_personal(personal_id)
    meta = repo.get_item(pk_pt, keys.sk_pacote(pacote_id))
    if not meta:
        raise HTTPException(404, detail="Pacote não encontrado")
    if meta.get("licenciado"):
        raise HTTPException(400, detail={"code": "PACOTE_LICENCIADO_NAO_EXPORTAVEL"})

    # Exercícios
    nome_lower_to_ref: dict[str, str] = {}
    exercicios_out: list[dict] = []
    for exlib_id in (meta.get("exlib_ids") or []):
        item = repo.get_item(pk_pt, keys.sk_exlib(exlib_id))
        if not item:
            continue
        nome = (item.get("nome") or "").strip()
        ex_out = _build_exercicio_out(nome, item)
        nome_lower_to_ref[nome.lower()] = ex_out["ref"]
        exercicios_out.append(ex_out)

    # Templates
    tmpl_nome_lower_to_ref: dict[str, str] = {}
    templates_out: list[dict] = []
    for template_id in (meta.get("template_ids") or []):
        item = repo.get_item(pk_pt, keys.sk_template(template_id))
        if not item:
            continue
        tmpl_out = _build_template_out(item, nome_lower_to_ref)
        tmpl_nome_lower_to_ref[item["nome"].strip().lower()] = tmpl_out["ref"]
        templates_out.append(tmpl_out)

    # Rotinas
    rotinas_out: list[dict] = []
    for rotina_id in (meta.get("rotina_ids") or []):
        item = repo.get_item(pk_pt, keys.sk_rotina(rotina_id))
        if not item:
            continue
        rotinas_out.append(_build_rotina_out(item, tmpl_nome_lower_to_ref))

    return _draft_json(meta, exercicios_out, templates_out, rotinas_out)


# ── Geração de pacote personalizado ──────────────────────────────────────────

def gerar_pacote(
    personal_id: str,
    nome: str,
    descricao: str,
    autor: str,
    versao: str,
    template_ids: list[str],
    rotina_ids: list[str],
) -> dict:
    """Gera JSON draft de um novo pacote a partir de templates/rotinas selecionados.

    Bloqueia qualquer item de pacote licenciado para evitar plágio.
    """
    pk_pt = keys.pk_personal(personal_id)

    def _assert_nao_licenciado(item: dict, kind: str) -> None:
        pid = item.get("pacote_id")
        if pid and pid not in (MANUAL_PACOTE_ID, None, ""):
            pkg = repo.get_item(pk_pt, keys.sk_pacote(pid))
            if pkg and pkg.get("licenciado"):
                raise HTTPException(400, detail={"code": "PACOTE_LICENCIADO_NAO_PERMITIDO",
                                                 "detail": f"{kind} '{item.get('nome')}' pertence a pacote licenciado"})

    # Busca templates selecionados
    templates_data: list[dict] = []
    for tid in template_ids:
        item = repo.get_item(pk_pt, keys.sk_template(tid))
        if not item:
            raise HTTPException(404, detail={"code": "TEMPLATE_NAO_ENCONTRADO", "detail": tid})
        _assert_nao_licenciado(item, "Template")
        templates_data.append(item)

    # Busca rotinas selecionadas
    rotinas_data: list[dict] = []
    for rid in rotina_ids:
        item = repo.get_item(pk_pt, keys.sk_rotina(rid))
        if not item:
            raise HTTPException(404, detail={"code": "ROTINA_NAO_ENCONTRADA", "detail": rid})
        _assert_nao_licenciado(item, "Rotina")
        rotinas_data.append(item)

    # Coleta nomes únicos de exercícios a partir dos templates
    exercise_info: dict[str, dict] = {}  # nome_lower → {nome, grupo, tipo_exercicio}
    for tmpl in templates_data:
        for ex in tmpl.get("exercicios") or []:
            nl = (ex.get("nome") or "").strip().lower()
            if nl and nl not in exercise_info:
                exercise_info[nl] = {
                    "nome": ex["nome"].strip(),
                    "grupo": ex.get("grupo"),
                    "tipo_exercicio": ex.get("tipo_exercicio", "FORCA"),
                }

    # Enriquece com dados do ExLib (descricao, recomendacoes, video_url, substitutos)
    all_exlib = repo.query_pk(pk_pt, sk_prefix=keys.EXLIB_PREFIX)
    exlib_by_name: dict[str, dict] = {
        (e.get("nome") or "").strip().lower(): e
        for e in all_exlib
        if (e.get("nome") or "").strip()
    }

    nome_lower_to_ref: dict[str, str] = {}
    exercicios_out: list[dict] = []
    for nl, base in exercise_info.items():
        exlib = exlib_by_name.get(nl, {})
        merged = {**base, **{k: v for k, v in exlib.items() if k in ("grupo", "tipo_exercicio", "video_url", "descricao", "recomendacoes", "substitutos") and v}}
        ex_out = _build_exercicio_out(base["nome"], merged)
        nome_lower_to_ref[nl] = ex_out["ref"]
        exercicios_out.append(ex_out)

    # Templates
    tmpl_nome_lower_to_ref: dict[str, str] = {}
    templates_out: list[dict] = []
    for tmpl in templates_data:
        tmpl_out = _build_template_out(tmpl, nome_lower_to_ref)
        tmpl_nome_lower_to_ref[tmpl["nome"].strip().lower()] = tmpl_out["ref"]
        templates_out.append(tmpl_out)

    # Rotinas
    rotinas_out: list[dict] = []
    for rot in rotinas_data:
        rotinas_out.append(_build_rotina_out(rot, tmpl_nome_lower_to_ref))

    return _draft_json(
        {"nome": nome, "descricao": descricao, "autor": autor, "versao": versao},
        exercicios_out,
        templates_out,
        rotinas_out,
    )


def gerar_pacote_licenciado(
    personal_id: str,
    nome: str,
    descricao: str,
    autor: str,
    versao: str,
    template_ids: list[str],
    rotina_ids: list[str],
    max_usos: int,
) -> dict:
    """Gera pacote assinado com HMAC e token de uso único — pronto para distribuição."""
    draft = gerar_pacote(personal_id, nome, descricao, autor, versao, template_ids, rotina_ids)

    token_uuid = new_id()
    token = f"tok_{token_uuid}"
    draft["token"] = token
    draft["assinatura"] = _calcular_assinatura(draft)

    repo.put_item(keys.pk_token(token_uuid), keys.SK_META, {
        "token": token,
        "pacote_id": draft["pacote"]["id"],
        "max_usos": max_usos,
        "usos_count": 0,
        "usado_por": [],
        "criado_em": now_iso(),
    })

    return draft
