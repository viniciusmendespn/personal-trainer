"""Transcode de vídeo disparado por evento S3 (ObjectCreated em midia/).

Estratégia **overwrite-in-place**: comprime o vídeo (H.264 720p + faststart) e regrava no
MESMO s3_key. Assim nada muda no DynamoDB nem nas telas — o mesmo URL passa a servir bytes
menores. Ver o plano em ../../plans (fase "transcode server-side").

Anti-loop: a regravação dispara outro ObjectCreated; a metadata `transcoded=true` no objeto
faz a segunda invocação sair como no-op. Também pulamos imagens (Content-Type != video/*).

O binário ffmpeg vem de um layer arm64 em /opt/bin/ffmpeg. Como o zip do layer é montado no
Windows (sem bit de execução) e /opt é read-only, copiamos pra /tmp e damos chmod +x lá.
"""
import logging
import os
import shutil
import stat
import subprocess
from urllib.parse import unquote_plus

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

_s3 = None
_FFMPEG_TMP = "/tmp/ffmpeg"   # cópia executável do binário do layer
_FFMPEG_SRC = "/opt/bin/ffmpeg"
CACHE_CONTROL = "public, max-age=31536000, immutable"   # após transcode o objeto é estável


def _s3c():
    global _s3
    if _s3 is None:
        _s3 = boto3.client("s3")
    return _s3


def _ffmpeg_bin() -> str:
    """Garante um ffmpeg executável em /tmp (o layer em /opt pode não ter o bit +x)."""
    if not os.path.exists(_FFMPEG_TMP):
        shutil.copy(_FFMPEG_SRC, _FFMPEG_TMP)
        os.chmod(_FFMPEG_TMP, os.stat(_FFMPEG_TMP).st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    return _FFMPEG_TMP


def _mark_transcoded(bucket: str, key: str, content_type: str):
    """Marca o objeto original como já processado (copy sobre si mesmo) — evita reprocessar
    em loop quando não dá pra comprimir (falha do ffmpeg ou saída não menor)."""
    _s3c().copy_object(
        Bucket=bucket, Key=key, CopySource={"Bucket": bucket, "Key": key},
        MetadataDirective="REPLACE", Metadata={"transcoded": "true"},
        ContentType=content_type or "video/mp4", CacheControl=CACHE_CONTROL,
    )


def _process(bucket: str, key: str):
    if not key.startswith("midia/"):
        return
    s3 = _s3c()
    try:
        head = s3.head_object(Bucket=bucket, Key=key)
    except Exception as e:
        logger.warning("[transcode] head_object falhou %s/%s: %s", bucket, key, e)
        return

    content_type = head.get("ContentType", "") or ""
    metadata = head.get("Metadata", {}) or {}
    size = head.get("ContentLength", 0)

    if metadata.get("transcoded") == "true":
        return   # anti-loop: já processado (nossa própria regravação)
    if not content_type.startswith("video/"):
        return   # imagens já são comprimidas no cliente; ignorar

    ffmpeg = _ffmpeg_bin()
    ext = os.path.splitext(key)[1] or ".mp4"
    src = f"/tmp/in{ext}"
    out = "/tmp/out.mp4"
    try:
        s3.download_file(bucket, key, src)
        # Mesmos parâmetros validados no cliente: 720p, dimensão PAR (força divisível por 2 —
        # celular 19.5:9/20:9 gerava dimensão ímpar e o libx264+yuv420p falha), CRF 30, faststart.
        cmd = [
            ffmpeg, "-y", "-i", src,
            "-vf", "scale=w=720:h=1280:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30",
            "-c:v", "libx264", "-profile:v", "high", "-level", "4.0",
            "-preset", "veryfast", "-crf", "30", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "64k", "-ac", "1",
            "-movflags", "+faststart",
            out,
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=580)
        if proc.returncode != 0:
            logger.error("[transcode] ffmpeg exit=%s key=%s tail=%s",
                         proc.returncode, key, (proc.stderr or "")[-800:])
            _mark_transcoded(bucket, key, content_type)
            return

        out_size = os.path.getsize(out) if os.path.exists(out) else 0
        if out_size < 1024 or out_size >= size:
            logger.warning("[transcode] saída inválida/maior key=%s in=%s out=%s → mantém original",
                           key, size, out_size)
            _mark_transcoded(bucket, key, content_type)
            return

        with open(out, "rb") as f:
            s3.put_object(
                Bucket=bucket, Key=key, Body=f,
                ContentType="video/mp4", CacheControl=CACHE_CONTROL,
                Metadata={"transcoded": "true"},
            )
        logger.info("[transcode] OK key=%s %.1fMB → %.1fMB (%.0f%%)",
                    key, size / 1048576, out_size / 1048576, 100 * out_size / size)
    except subprocess.TimeoutExpired:
        logger.error("[transcode] timeout key=%s size=%s", key, size)
        _mark_transcoded(bucket, key, content_type)
    except Exception as e:
        logger.exception("[transcode] erro key=%s: %s", key, e)
        # não marca: permite retry numa próxima (erro transitório de rede/S3)
    finally:
        for p in (src, out):
            try:
                if os.path.exists(p):
                    os.remove(p)
            except OSError:
                pass


def handler(event, context):
    """Entry point do evento S3 (pode trazer múltiplos Records)."""
    for record in event.get("Records", []):
        s3rec = record.get("s3", {})
        bucket = s3rec.get("bucket", {}).get("name")
        key = unquote_plus(s3rec.get("object", {}).get("key", ""))
        if bucket and key:
            _process(bucket, key)
    return {"ok": 1}
