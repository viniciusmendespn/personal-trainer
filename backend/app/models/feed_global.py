from enum import Enum
from pydantic import BaseModel

from app.models.postagem import MidiaRef


class PostGlobalTipo(str, Enum):
    ARTIGO = "ARTIGO"
    DICA = "DICA"
    MOTIVACAO = "MOTIVACAO"
    AVISO = "AVISO"
    OUTRO = "OUTRO"
    RECURSO = "RECURSO"   # conteúdo educacional vinculado a exercícios (explica siglas de carga)


class PostGlobalCreate(BaseModel):
    tipo: PostGlobalTipo = PostGlobalTipo.OUTRO
    texto: str
    midias: list[MidiaRef] = []
