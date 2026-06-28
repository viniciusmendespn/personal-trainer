import re
from typing import Optional

from pydantic import BaseModel, field_validator

from app.models.exercicio import ExercicioSubstituto


class ExLibCreate(BaseModel):
    """Exercício do catálogo reutilizável do personal (com vídeo de referência)."""
    nome: str
    grupo: Optional[str] = None                # ex.: "Peito", "Pernas"
    video_url: Optional[str] = None
    descricao: Optional[str] = None
    recomendacoes: Optional[str] = None        # texto livre do personal (técnica, cuidados…)
    links_uteis: list[str] = []                # post_sks de posts RECURSO do feed vinculados
    substitutos: list[ExercicioSubstituto] = []  # conjunto padrão de substitutos deste exercício
    pacote_id: Optional[str] = None            # preenchido quando criado via importação de pacote
    ativo: bool = True                         # False = oculto na montagem de treinos

    @field_validator("video_url")
    @classmethod
    def normaliza_video_url(cls, v: Optional[str]) -> Optional[str]:
        """Sem isso, um link colado sem http(s):// vira href relativo e resolve para o domínio do app."""
        if not v:
            return None
        v = v.strip()
        if not v:
            return None
        if not re.match(r"^https?://", v, re.IGNORECASE):
            v = f"https://{v}"
        return v


class ExLib(ExLibCreate):
    exlib_id: str


class ImportarExerciciosBody(BaseModel):
    exercicios: list[ExLibCreate]


class ImportarResult(BaseModel):
    importados: int
    pulados: int
    erros: list[str]
