"""Mídia recebida pela W-API: baixa o arquivo (link temporário), sobe no S3 (o link da
W-API expira) e/ou transcreve áudio via Whisper. ESPEC §7 / FUNCIONAL §10.

⚠️ Nomes de campos da W-API (download-media e o link de retorno) a confirmar no 1º teste real.
"""
import logging
import uuid

import boto3
import httpx

from app.config import settings
from app.models.enums import Ator
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services.wapi_service import WAPIClient
from app.utils import new_id, now_iso

logger = logging.getLogger(__name__)
_s3 = None


def _s3c():
    global _s3
    if _s3 is None:
        _s3 = boto3.client("s3", region_name=settings.cognito_region)
    return _s3


def gerar_presigned_upload_url(aluno_id: str, filename: str, content_type: str,
                               expires_in: int = 900) -> dict | None:
    """Presigned PUT URL p/ upload direto do navegador (portal) — sem passar pela Lambda.
    CORS (PUT) e IAM (S3CrudPolicy) já liberados no bucket de mídia (template.yaml)."""
    if not settings.media_bucket_name:
        return None
    key = f"midia/{aluno_id}/{uuid.uuid4()}/{filename}"
    try:
        url = _s3c().generate_presigned_url(
            "put_object",
            Params={"Bucket": settings.media_bucket_name, "Key": key, "ContentType": content_type},
            ExpiresIn=expires_in,
        )
        return {"upload_url": url, "s3_key": key}
    except Exception as e:
        logger.warning("[media] presigned upload url falhou: %s", e)
        return None


def gerar_presigned_upload_url_perfil(entity_type: str, entity_id: str, filename: str,
                                       content_type: str, expires_in: int = 900) -> dict | None:
    """Presigned PUT URL para foto de perfil (personal ou aluno).
    entity_type: 'personal' | 'aluno'. Key: perfil/{entity_type}/{entity_id}/avatar.{ext}"""
    if not settings.media_bucket_name:
        return None
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "jpg"
    key = f"perfil/{entity_type}/{entity_id}/avatar.{ext}"
    try:
        url = _s3c().generate_presigned_url(
            "put_object",
            Params={"Bucket": settings.media_bucket_name, "Key": key, "ContentType": content_type},
            ExpiresIn=expires_in,
        )
        return {"upload_url": url, "s3_key": key}
    except Exception as e:
        logger.warning("[media] presigned perfil url falhou: %s", e)
        return None


def registrar_midia_vinculada(aluno_id: str, exercicio_id: str, exercicio_nome: str | None,
                              tipo: str, s3_key: str, ator: Ator = Ator.ALUNO) -> dict:
    """Registra uma mídia já enviada (via presigned URL) — pelo próprio app do aluno ou
    pelo personal (vídeo/foto de correção) — o exercício já é conhecido nesse fluxo, então
    a mídia nasce vinculada (sem pendência)."""
    midia_id = new_id()
    item = {
        "midia_id": midia_id, "tipo": tipo, "s3_key": s3_key,
        "exercicio_id": exercicio_id, "exercicio_nome": exercicio_nome,
        "status": "VINCULADA", "data_hora": now_iso(), "ator": ator.value,
    }
    repo.put_item(keys.pk_aluno(aluno_id), f"MIDIA#{exercicio_id}#{midia_id}", item)
    return item


def list_midia_exercicio(aluno_id: str, exercicio_id: str) -> list[dict]:
    """Mídias vinculadas a um exercício, com URL de visualização privada (presigned)."""
    items = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=f"MIDIA#{exercicio_id}#")
    out = []
    for i in items:
        c = repo.clean(i)
        c["url"] = gerar_presigned_view_url(c["s3_key"])
        out.append(c)
    return out


def gerar_presigned_view_url(s3_key: str, expires_in: int = 3600) -> str | None:
    """Presigned GET URL p/ exibir mídia privada (fotos de avaliação, anexo de bio)."""
    if not settings.media_bucket_name:
        return None
    try:
        return _s3c().generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.media_bucket_name, "Key": s3_key},
            ExpiresIn=expires_in,
        )
    except Exception as e:
        logger.warning("[media] presigned view url falhou: %s", e)
        return None


def _download_link(cfg: dict, media: dict) -> str | None:
    """Pede o link temporário do arquivo à W-API (download-media)."""
    try:
        data = WAPIClient(cfg["instance_id"], cfg["token"]).download_media(
            media.get("mediaKey"), media.get("directPath"),
            media.get("type") or media.get("tipo"), media.get("mimetype"))
    except Exception as e:
        logger.warning("[media] download-media falhou: %s", e)
        return None
    return data.get("link") or data.get("fileLink") or data.get("url")


def _bytes(url: str) -> bytes | None:
    try:
        with httpx.Client(timeout=30) as c:
            r = c.get(url)
            r.raise_for_status()
            return r.content
    except Exception as e:
        logger.warning("[media] download do arquivo falhou: %s", e)
        return None


class _StreamReader:
    """Adapta um httpx.Response em streaming para a interface file-like que
    boto3 upload_fileobj espera (.read(size)) — evita materializar o arquivo
    inteiro em memória de uma vez (relevante para vídeos, PERFORMANCE_ESCALA.md §2.4)."""

    def __init__(self, response: httpx.Response):
        self._iter = response.iter_bytes()
        self._buf = b""

    def read(self, size: int = -1) -> bytes:
        if size is None or size < 0:
            chunks = [self._buf, *self._iter]
            self._buf = b""
            return b"".join(chunks)
        while len(self._buf) < size:
            try:
                self._buf += next(self._iter)
            except StopIteration:
                break
        data, self._buf = self._buf[:size], self._buf[size:]
        return data


def _stream_to_s3(url: str, key: str, content_type: str | None) -> bool:
    """Baixa via streaming e sobe ao S3 sem carregar o arquivo inteiro em memória."""
    try:
        with httpx.Client(timeout=30) as c:
            with c.stream("GET", url) as r:
                r.raise_for_status()
                extra = {"ContentType": content_type} if content_type else {}
                _s3c().upload_fileobj(_StreamReader(r), settings.media_bucket_name, key, ExtraArgs=extra)
        return True
    except Exception as e:
        logger.warning("[media] stream upload falhou: %s", e)
        return False


def transcrever_audio(cfg: dict, media: dict) -> str | None:
    """Áudio -> texto via OpenAI Whisper. Retorna a transcrição ou None."""
    if not settings.openai_api_key:
        return None
    link = _download_link(cfg, media)
    if not link:
        return None
    audio = _bytes(link)
    if not audio:
        return None
    try:
        with httpx.Client(timeout=60) as c:
            r = c.post("https://api.openai.com/v1/audio/transcriptions",
                       headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                       data={"model": "whisper-1"},
                       files={"file": ("audio.ogg", audio, media.get("mimetype") or "audio/ogg")})
        if not r.is_success:
            logger.warning("[media] whisper %d: %s", r.status_code, r.text[:200])
            return None
        return (r.json().get("text") or "").strip()
    except Exception as e:
        logger.warning("[media] whisper erro: %s", e)
        return None


def salvar_midia(cfg: dict, media: dict, aluno_id: str, exercicio_id: str | None,
                 exercicio_nome: str | None, tipo: str) -> dict | None:
    """Baixa foto/vídeo (streaming) e sobe no S3, cria o item MIDIA (vinculada se há exercício)."""
    link = _download_link(cfg, media)
    if not link or not settings.media_bucket_name:
        return None
    key = f"midia/{aluno_id}/{uuid.uuid4()}"
    ok = _stream_to_s3(link, key, media.get("mimetype") or "application/octet-stream")
    if not ok:
        return None
    midia_id = new_id()
    item = {
        "midia_id": midia_id, "tipo": tipo, "s3_key": key,
        "exercicio_id": exercicio_id, "exercicio_nome": exercicio_nome,
        "status": "VINCULADA" if exercicio_id else "PENDENTE", "data_hora": now_iso(),
    }
    repo.put_item(keys.pk_aluno(aluno_id), f"MIDIA#{exercicio_id or 'NA'}#{midia_id}", item)
    return item
