"""Base de conhecimento para IA — arquivos do personal, baixados pelo aluno como .zip."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_personal_id
from app.services import conhecimento_service

router = APIRouter(prefix="/v1/conhecimento", tags=["conhecimento"])


class UploadUrlBody(BaseModel):
    filename: str
    content_type: str


class ArquivoCreate(BaseModel):
    filename: str
    content_type: str
    size_bytes: int
    s3_key: str
    descricao: str | None = None


@router.get("")
def listar(personal_id: str = Depends(get_current_personal_id)):
    return conhecimento_service.list_arquivos(personal_id)


@router.post("/upload-url")
def upload_url(body: UploadUrlBody, personal_id: str = Depends(get_current_personal_id)):
    result = conhecimento_service.gerar_presigned_upload_url(personal_id, body.filename, body.content_type)
    if not result:
        raise HTTPException(502, "Não foi possível gerar a URL de upload.")
    return result


@router.post("", status_code=201)
def registrar(body: ArquivoCreate, personal_id: str = Depends(get_current_personal_id)):
    try:
        item = conhecimento_service.registrar_arquivo(
            personal_id, body.filename, body.content_type, body.size_bytes, body.s3_key, body.descricao,
        )
    except ValueError as e:
        raise HTTPException(413, str(e))
    return {"ok": 1, "arquivo_id": item["arquivo_id"]}


@router.delete("/{arquivo_id}", status_code=204)
def deletar(arquivo_id: str, personal_id: str = Depends(get_current_personal_id)):
    if not conhecimento_service.deletar_arquivo(personal_id, arquivo_id):
        raise HTTPException(404, "Arquivo não encontrado")


@router.get("/download")
def download(personal_id: str = Depends(get_current_personal_id)):
    try:
        url = conhecimento_service.gerar_zip_download_url(personal_id)
    except ValueError as e:
        raise HTTPException(413, str(e))
    if not url:
        raise HTTPException(404, "Nenhum arquivo na base de conhecimento ainda.")
    return {"download_url": url}
