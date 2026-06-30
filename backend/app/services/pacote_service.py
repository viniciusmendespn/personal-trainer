"""Serviço de importação e gerenciamento de pacotes de treino (.cpkg).

Dois formatos de arquivo:
  - LICENCIADO (Opção A): arquivo "fino" {fmt, pacote_id, token} — zero conteúdo. O conteúdo
    real mora no servidor em PACOTEDISTRIB#{pacote_id}. Importar = validar token → servidor
    busca conteúdo → instala com origem_licenciada=True. Nada copiável do arquivo + revogável.
  - LIVRE (draft .json): JSON legível, editável pela IA. Sem assinatura, origem_licenciada=False.

Instalação (comum aos dois): IDs determinísticos via det_id(pacote_id, ref) → reimportar
sobrescreve (upsert), nunca duplica. Dedup de exercício por nome DENTRO do pacote.
"""
import json
import logging
import re
import unicodedata
from typing import Optional

from botocore.exceptions import ClientError
from fastapi import HTTPException

from app.models.pacote import ImportarPacoteResponse, PacoteFile, PacoteRefFile
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.utils import det_id, new_id, now_iso

logger = logging.getLogger(__name__)

REF_FMT = "cpkg-ref-1"   # discriminador do arquivo licenciado "fino"


def _chave_exercicio(nome: Optional[str]) -> str:
    """Chave canônica do nome (sem acento/caixa/espaços extras) — dedup de exercício
    dentro de um pacote. Espelha sessao_service.chave_exercicio (inline p/ evitar import)."""
    if not nome:
        return ""
    sem_acento = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode()
    return " ".join(sem_acento.lower().split())


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
        "unidade_reps": item.get("unidade_reps"),
        "metrica_direcao": item.get("metrica_direcao") or "MAIOR",
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


def _draft_json(pacote_meta: dict, exercicios: list, templates: list, rotinas: list,
                pacote_id: Optional[str] = None) -> dict:
    """Monta o JSON draft. `pacote_id` preserva a identidade (export→editar→reimport faz
    upsert nos mesmos IDs); omitido → novo (draft genuinamente novo)."""
    return {
        "version": "1",
        "pacote": {
            "id": pacote_id or new_id(),
            "nome": pacote_meta.get("nome", ""),
            "descricao": pacote_meta.get("descricao", ""),
            "autor": pacote_meta.get("autor", ""),
            "versao": pacote_meta.get("versao", "1"),
        },
        "exercicios": exercicios,
        "templates": templates,
        "rotinas": rotinas,
    }


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
    """Dispatcher por formato: arquivo fino licenciado (fmt) vs draft JSON livre."""
    try:
        conteudo_dict = json.loads(conteudo_str)
    except json.JSONDecodeError as exc:
        raise HTTPException(400, detail={"code": "ARQUIVO_INVALIDO", "detail": str(exc)})

    if isinstance(conteudo_dict, dict) and conteudo_dict.get("fmt") == REF_FMT:
        return _importar_licenciado(personal_id, conteudo_dict)
    return _importar_livre(personal_id, conteudo_dict)


def _importar_licenciado(personal_id: str, conteudo_dict: dict) -> ImportarPacoteResponse:
    """Arquivo fino: valida token → busca conteúdo server-side → instala (origem_licenciada)."""
    try:
        ref = PacoteRefFile(**conteudo_dict)
    except Exception as exc:
        raise HTTPException(400, detail={"code": "ARQUIVO_INVALIDO", "detail": str(exc)})

    distrib = repo.get_item(keys.pk_pacote_distrib(ref.pacote_id), keys.SK_CONTENT)
    if not distrib or distrib.get("ativo") is False:
        raise HTTPException(404, detail={"code": "PACOTE_INDISPONIVEL"})

    # token precisa existir e apontar para o mesmo pacote do arquivo
    token_uuid = ref.token.removeprefix("tok_")
    tok = repo.get_item(keys.pk_token(token_uuid), keys.SK_META)
    if not tok or tok.get("pacote_id") != ref.pacote_id:
        raise HTTPException(404, detail={"code": "TOKEN_INVALIDO"})

    # Já possui o pacote → refresh (upsert) sem consumir token. Senão → consome (1ª aquisição).
    pk_pt = keys.pk_personal(personal_id)
    ja_possui = repo.get_item(pk_pt, keys.sk_pacote(ref.pacote_id)) is not None
    if not ja_possui:
        _consumir_token(ref.token, personal_id)

    conteudo = repo.clean(distrib).get("conteudo") or {}
    try:
        pacote_file = PacoteFile(**conteudo)
    except Exception as exc:
        raise HTTPException(500, detail={"code": "CONTEUDO_CORROMPIDO", "detail": str(exc)})

    return _instalar(personal_id, pacote_file, ref.pacote_id,
                     licenciado=True, origem_licenciada=True, token=ref.token)


def _importar_livre(personal_id: str, conteudo_dict: dict) -> ImportarPacoteResponse:
    """Draft JSON livre (IA): sem token/assinatura, origem_licenciada=False."""
    if not isinstance(conteudo_dict, dict):
        raise HTTPException(400, detail={"code": "ARQUIVO_INVALIDO"})
    conteudo_dict.pop("token", None)
    conteudo_dict.pop("assinatura", None)
    try:
        pacote_file = PacoteFile(**conteudo_dict)
    except Exception as exc:
        raise HTTPException(400, detail={"code": "ESTRUTURA_INVALIDA", "detail": str(exc)})

    return _instalar(personal_id, pacote_file, pacote_file.pacote.id,
                     licenciado=False, origem_licenciada=False, token=None)


def _instalar(
    personal_id: str,
    pacote_file: PacoteFile,
    pacote_id: str,
    licenciado: bool,
    origem_licenciada: bool,
    token: Optional[str],
) -> ImportarPacoteResponse:
    """Instala o conteúdo com IDs determinísticos (det_id) e upsert — reimportar sobrescreve,
    nunca duplica. Exercícios deduplicados por nome DENTRO do pacote."""
    pk_pt = keys.pk_personal(personal_id)
    now = now_iso()

    # 1. Exercícios — exlib_id = det_id(pacote_id, chave_nome) → dedup por nome no pacote
    ref_to_exlib: dict[str, str] = {}
    ref_to_grupo: dict[str, str] = {}
    ref_to_tipo: dict[str, str] = {}
    ref_to_unidade: dict[str, str | None] = {}
    ref_to_direcao: dict[str, str] = {}
    exlib_id_to_nome: dict[str, str] = {}
    exlib_puts: list[dict] = []
    seen_exlib: set[str] = set()

    for ex_pkg in pacote_file.exercicios:
        nome = ex_pkg.nome.strip()
        exlib_id = det_id(pacote_id, _chave_exercicio(nome))
        ref_to_exlib[ex_pkg.ref] = exlib_id
        ref_to_grupo[ex_pkg.ref] = ex_pkg.grupo or ""
        ref_to_tipo[ex_pkg.ref] = ex_pkg.tipo_exercicio.value
        ref_to_unidade[ex_pkg.ref] = ex_pkg.unidade_reps
        ref_to_direcao[ex_pkg.ref] = ex_pkg.metrica_direcao or "MAIOR"
        exlib_id_to_nome[exlib_id] = nome
        if exlib_id in seen_exlib:
            continue
        seen_exlib.add(exlib_id)
        exlib_puts.append({
            "PK": pk_pt,
            "SK": keys.sk_exlib(exlib_id),
            "exlib_id": exlib_id,
            "nome": nome,
            "grupo": ex_pkg.grupo,
            "tipo_exercicio": ex_pkg.tipo_exercicio.value,
            "unidade_reps": ex_pkg.unidade_reps,
            "metrica_direcao": ex_pkg.metrica_direcao or "MAIOR",
            "video_url": ex_pkg.video_url,
            "descricao": ex_pkg.descricao,
            "recomendacoes": ex_pkg.recomendacoes,
            "links_uteis": [],
            "substitutos": [s.model_dump() for s in ex_pkg.substitutos],
            "pacote_id": pacote_id,
            "ativo": True,
            "origem_licenciada": origem_licenciada,
        })

    for i in range(0, len(exlib_puts), 25):
        repo.batch_write(puts=exlib_puts[i:i + 25])

    # 2. Templates — template_id = det_id(pacote_id, ref)
    ref_to_template: dict[str, str] = {}
    template_puts: list[dict] = []

    for tmpl_pkg in pacote_file.templates:
        template_id = det_id(pacote_id, tmpl_pkg.ref)
        exercicios: list[dict] = []
        for ex_ref_item in tmpl_pkg.exercicios:
            exlib_id = ref_to_exlib.get(ex_ref_item.ex_ref, "")
            nome_ex = exlib_id_to_nome.get(exlib_id, ex_ref_item.ex_ref)
            exercicios.append({
                "nome": nome_ex,
                "grupo": ref_to_grupo.get(ex_ref_item.ex_ref),
                "ordem": ex_ref_item.ordem,
                "series_prescritas": [s.model_dump() for s in (ex_ref_item.series_prescritas or [])],
                "intervalo_s": ex_ref_item.intervalo_s,
                "observacoes": ex_ref_item.observacoes,
                "tipo_exercicio": ref_to_tipo.get(ex_ref_item.ex_ref, "FORCA"),
                "unidade_reps": ref_to_unidade.get(ex_ref_item.ex_ref),
                "metrica_direcao": ref_to_direcao.get(ex_ref_item.ex_ref, "MAIOR"),
                "origem_licenciada": origem_licenciada,
            })
        template_puts.append({
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
            "origem_licenciada": origem_licenciada,
        })
        ref_to_template[tmpl_pkg.ref] = template_id

    for i in range(0, len(template_puts), 25):
        repo.batch_write(puts=template_puts[i:i + 25])

    # 3. Rotinas — rotina_id = det_id(pacote_id, ref); snapshot dos treinos buildados
    rotina_puts: list[dict] = []
    rotina_ids: list[str] = []

    for rot_pkg in pacote_file.rotinas:
        rotina_id = det_id(pacote_id, rot_pkg.ref)
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
        rotina_puts.append({
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
            "origem_licenciada": origem_licenciada,
        })
        rotina_ids.append(rotina_id)

    for i in range(0, len(rotina_puts), 25):
        repo.batch_write(puts=rotina_puts[i:i + 25])

    # 4. Metadados do pacote — upsert (sobrescreve no refresh)
    pacote_meta = {
        "pacote_id": pacote_id,
        "nome": pacote_file.pacote.nome,
        "descricao": pacote_file.pacote.descricao,
        "autor": pacote_file.pacote.autor,
        "versao": pacote_file.pacote.versao,
        "licenciado": licenciado,
        "origem_licenciada": origem_licenciada,
        "ativo": True,
        "exlib_ids": [e["exlib_id"] for e in exlib_puts],
        "template_ids": [t["template_id"] for t in template_puts],
        "rotina_ids": rotina_ids,
        "importado_em": now,
        "token": token or "",
    }
    repo.put_item(pk_pt, keys.sk_pacote(pacote_id), pacote_meta)

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
    """Aceita JSON de draft livre (gerado por LLM) e importa como pacote livre.
    Colar aqui um arquivo licenciado (fino) falha na validação de estrutura — sem brecha."""
    try:
        conteudo_dict = json.loads(conteudo_str)
    except json.JSONDecodeError as exc:
        raise HTTPException(400, detail={"code": "ARQUIVO_INVALIDO", "detail": str(exc)})
    return _importar_livre(personal_id, conteudo_dict)


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
    if meta.get("licenciado") or meta.get("origem_licenciada"):
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

    # Preserva o pacote_id → reimportar o editado faz upsert nos mesmos IDs (sem duplicar)
    return _draft_json(meta, exercicios_out, templates_out, rotinas_out, pacote_id=pacote_id)


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
        # Proveniência: a flag sobrevive a edição/aplicação/salvamento e nunca é limpa.
        # Bloqueia qualquer item de origem licenciada (direta ou via aluno) na redistribuição.
        if item.get("origem_licenciada"):
            raise HTTPException(400, detail={"code": "PACOTE_LICENCIADO_NAO_PERMITIDO",
                                             "detail": f"{kind} '{item.get('nome')}' tem origem licenciada e não pode ser redistribuído"})

    # Busca templates selecionados
    templates_data: list[dict] = []
    for tid in template_ids:
        item = repo.get_item(pk_pt, keys.sk_template(tid))
        if not item:
            raise HTTPException(404, detail={"code": "TEMPLATE_NAO_ENCONTRADO", "detail": tid})
        _assert_nao_licenciado(item, "Template")
        templates_data.append(repo.clean(item))

    # Busca rotinas selecionadas
    rotinas_data: list[dict] = []
    for rid in rotina_ids:
        item = repo.get_item(pk_pt, keys.sk_rotina(rid))
        if not item:
            raise HTTPException(404, detail={"code": "ROTINA_NAO_ENCONTRADA", "detail": rid})
        _assert_nao_licenciado(item, "Rotina")
        rotinas_data.append(repo.clean(item))

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
                    "unidade_reps": ex.get("unidade_reps"),
                    "metrica_direcao": ex.get("metrica_direcao") or "MAIOR",
                }

    # Enriquece com dados do ExLib (descricao, recomendacoes, video_url, substitutos)
    all_exlib = repo.clean_all(repo.query_pk(pk_pt, sk_prefix=keys.EXLIB_PREFIX))
    exlib_by_name: dict[str, dict] = {
        (e.get("nome") or "").strip().lower(): e
        for e in all_exlib
        if (e.get("nome") or "").strip()
    }

    nome_lower_to_ref: dict[str, str] = {}
    exercicios_out: list[dict] = []
    for nl, base in exercise_info.items():
        exlib = exlib_by_name.get(nl, {})
        if exlib.get("origem_licenciada"):
            raise HTTPException(400, detail={"code": "PACOTE_LICENCIADO_NAO_PERMITIDO",
                                             "detail": f"Exercício '{base['nome']}' tem origem licenciada e não pode ser redistribuído"})
        merged = {**base, **{k: v for k, v in exlib.items() if k in ("grupo", "tipo_exercicio", "unidade_reps", "metrica_direcao", "video_url", "descricao", "recomendacoes", "substitutos") and v}}
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
    """Gera pacote licenciado (Opção A): grava o conteúdo no servidor + token de uso único,
    e retorna o arquivo FINO {fmt, pacote_id, token} — sem conteúdo copiável."""
    draft = gerar_pacote(personal_id, nome, descricao, autor, versao, template_ids, rotina_ids)
    pacote_id = draft["pacote"]["id"]

    # Conteúdo real fica no servidor (legível entre personais só na importação com token válido)
    repo.put_item(keys.pk_pacote_distrib(pacote_id), keys.SK_CONTENT, {
        "conteudo": draft,
        "autor_personal_id": personal_id,
        "criado_em": now_iso(),
        "ativo": True,
    })

    token_uuid = new_id()
    token = f"tok_{token_uuid}"
    repo.put_item(keys.pk_token(token_uuid), keys.SK_META, {
        "token": token,
        "pacote_id": pacote_id,
        "max_usos": max_usos,
        "usos_count": 0,
        "usado_por": [],
        "criado_em": now_iso(),
    })

    # Arquivo fino — é isso que o personal baixa como .cpkg
    return {"fmt": REF_FMT, "pacote_id": pacote_id, "token": token}
