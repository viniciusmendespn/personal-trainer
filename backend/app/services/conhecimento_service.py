"""Base de conhecimento para IA: arquivos que o personal anexa (PDFs, docs, etc.) sobre
exercícios/treino, e que o aluno baixa como um único .zip + um arquivo de instruções
(INICIO_PARA_IA.txt) pra colar em qualquer LLM e tirar dúvidas só com base nesse material.

O zip é cacheado em S3 (kb/{personal_id}/bundle.zip) e só reconstruído quando o conjunto de
arquivos muda — evita reconstruir a cada download de aluno."""
import logging
import os
import uuid
import zipfile

import boto3

from app.config import settings
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.utils import new_id, now_iso

logger = logging.getLogger(__name__)
_s3 = None

MAX_FILE_SIZE = 25 * 1024 * 1024     # 25MB por arquivo
MAX_FILES = 60                       # nº máx. de arquivos na base
MAX_TOTAL_SIZE = 150 * 1024 * 1024   # 150MB somados — mantém a reconstrução do zip dentro do timeout


def _s3c():
    global _s3
    if _s3 is None:
        _s3 = boto3.client("s3", region_name=settings.cognito_region)
    return _s3


def gerar_presigned_upload_url(personal_id: str, filename: str, content_type: str,
                               expires_in: int = 900) -> dict | None:
    if not settings.media_bucket_name:
        return None
    key = f"kb/{personal_id}/files/{uuid.uuid4()}/{filename}"
    try:
        url = _s3c().generate_presigned_url(
            "put_object",
            Params={"Bucket": settings.media_bucket_name, "Key": key, "ContentType": content_type},
            ExpiresIn=expires_in,
        )
        return {"upload_url": url, "s3_key": key}
    except Exception as e:
        logger.warning("[conhecimento] presigned upload url falhou: %s", e)
        return None


def list_arquivos(personal_id: str) -> list[dict]:
    items = repo.query_pk(keys.pk_personal(personal_id), sk_prefix=keys.KB_PREFIX)
    items.sort(key=lambda i: i.get("uploaded_at", ""), reverse=True)
    return repo.clean_all(items)


def registrar_arquivo(personal_id: str, filename: str, content_type: str, size_bytes: int,
                      s3_key: str, descricao: str | None = None) -> dict:
    if size_bytes > MAX_FILE_SIZE:
        raise ValueError(f"Arquivo maior que o limite de {MAX_FILE_SIZE // (1024 * 1024)}MB.")
    existentes = repo.query_pk(keys.pk_personal(personal_id), sk_prefix=keys.KB_PREFIX)
    if len(existentes) + 1 > MAX_FILES:
        raise ValueError(f"Limite de {MAX_FILES} arquivos na base de conhecimento atingido.")
    total_atual = sum(i.get("size_bytes", 0) for i in existentes)
    if total_atual + size_bytes > MAX_TOTAL_SIZE:
        raise ValueError(f"Limite de {MAX_TOTAL_SIZE // (1024 * 1024)}MB somados na base de conhecimento atingido.")

    arquivo_id = new_id()
    item = {
        "arquivo_id": arquivo_id, "filename": filename, "content_type": content_type,
        "size_bytes": size_bytes, "descricao": descricao, "s3_key": s3_key,
        "uploaded_at": now_iso(),
    }
    repo.put_item(keys.pk_personal(personal_id), keys.sk_kb(arquivo_id), item)
    _invalidar_bundle(personal_id)
    return item


def deletar_arquivo(personal_id: str, arquivo_id: str) -> bool:
    item = repo.get_item(keys.pk_personal(personal_id), keys.sk_kb(arquivo_id))
    if not item:
        return False
    repo.delete_item(keys.pk_personal(personal_id), keys.sk_kb(arquivo_id))
    if settings.media_bucket_name and item.get("s3_key"):
        try:
            _s3c().delete_object(Bucket=settings.media_bucket_name, Key=item["s3_key"])
        except Exception as e:
            logger.warning("[conhecimento] delete do objeto S3 falhou: %s", e)
    _invalidar_bundle(personal_id)
    return True


def _invalidar_bundle(personal_id: str) -> None:
    repo.delete_item(keys.pk_personal(personal_id), keys.SK_KB_BUNDLE)


def _gerar_instrucoes(personal_nome: str, arquivos: list[dict]) -> str:
    lista = "\n".join(f"- {a['filename']}" for a in arquivos)
    return f"""COMO USAR ESTE MATERIAL COM UMA IA (ChatGPT, Claude, Gemini, etc.)

Este pacote contém a base de conhecimento sobre treino e exercícios reunida por
{personal_nome}. Envie TODOS os arquivos deste zip para a IA (anexando-os na conversa) e
cole as instruções abaixo antes da sua pergunta.

--- INSTRUÇÕES PARA A IA (cole isto na conversa) ---

Você deve responder ÚNICA E EXCLUSIVAMENTE com base no conteúdo dos arquivos anexados nesta
conversa. NÃO utilize conhecimento externo, suposições ou informações que não estejam
explicitamente nos documentos fornecidos.

Se a pergunta não puder ser respondida com base no material fornecido, diga claramente que a
informação não está disponível nos documentos anexados — não tente adivinhar ou complementar
com conhecimento geral.

Sempre que possível, cite o nome do arquivo de onde a informação foi extraída.

--- FIM DAS INSTRUÇÕES ---

Arquivos incluídos neste pacote:
{lista}
"""


def _stream_s3_to_zip(zf: zipfile.ZipFile, s3_key: str, arcname: str) -> None:
    body = _s3c().get_object(Bucket=settings.media_bucket_name, Key=s3_key)["Body"]
    with zf.open(arcname, "w") as dest:
        for chunk in body.iter_chunks(chunk_size=262_144):
            dest.write(chunk)


def _arcnames(arquivos: list[dict]) -> list[str]:
    """Nomes únicos dentro do zip — evita colisão se dois arquivos tiverem o mesmo nome."""
    usados: set[str] = set()
    out = []
    for i, a in enumerate(arquivos):
        nome = a["filename"]
        if nome in usados:
            nome = f"{i}_{nome}"
        usados.add(nome)
        out.append(nome)
    return out


def gerar_zip_download_url(personal_id: str, expires_in: int = 900) -> str | None:
    """Presigned GET do zip cacheado — reconstrói antes se o conjunto de arquivos mudou."""
    if not settings.media_bucket_name:
        return None
    arquivos = repo.clean_all(repo.query_pk(keys.pk_personal(personal_id), sk_prefix=keys.KB_PREFIX))
    if not arquivos:
        return None

    total_size = sum(a.get("size_bytes", 0) for a in arquivos)
    bundle_key = f"kb/{personal_id}/bundle.zip"
    meta = repo.get_item(keys.pk_personal(personal_id), keys.SK_KB_BUNDLE)
    if meta and meta.get("file_count") == len(arquivos) and meta.get("total_size") == total_size:
        return _presigned_get(bundle_key, expires_in)

    if len(arquivos) > MAX_FILES or total_size > MAX_TOTAL_SIZE:
        raise ValueError("Base de conhecimento ultrapassou o limite suportado — remova alguns arquivos.")

    personal = repo.get_item(keys.pk_personal(personal_id), keys.SK_PROFILE) or {}
    nome = personal.get("nome") or "seu personal trainer"

    tmp_path = f"/tmp/kb_bundle_{personal_id}.zip"
    try:
        with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for a, arcname in zip(arquivos, _arcnames(arquivos)):
                _stream_s3_to_zip(zf, a["s3_key"], arcname)
            zf.writestr("INICIO_PARA_IA.txt", _gerar_instrucoes(nome, arquivos))
        _s3c().upload_file(tmp_path, settings.media_bucket_name, bundle_key)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    repo.put_item(keys.pk_personal(personal_id), keys.SK_KB_BUNDLE, {
        "s3_key": bundle_key, "built_at": now_iso(),
        "file_count": len(arquivos), "total_size": total_size,
    })
    return _presigned_get(bundle_key, expires_in)


def _presigned_get(s3_key: str, expires_in: int) -> str | None:
    try:
        return _s3c().generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.media_bucket_name, "Key": s3_key},
            ExpiresIn=expires_in,
        )
    except Exception as e:
        logger.warning("[conhecimento] presigned download url falhou: %s", e)
        return None
