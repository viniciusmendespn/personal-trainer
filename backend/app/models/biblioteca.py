from typing import Optional

from pydantic import BaseModel


class ExLibCreate(BaseModel):
    """Exercício do catálogo reutilizável do personal (com vídeo de referência)."""
    nome: str
    grupo: Optional[str] = None                # ex.: "Peito", "Pernas"
    video_url: Optional[str] = None
    descricao: Optional[str] = None


class ExLib(ExLibCreate):
    exlib_id: str
