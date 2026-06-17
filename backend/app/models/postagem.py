from enum import Enum

from pydantic import BaseModel, model_validator


class PostagemTipo(str, Enum):
    DOR = "DOR"
    DUVIDA = "DUVIDA"
    EXECUCAO = "EXECUCAO"    # mídia de execução do aluno
    CORRECAO = "CORRECAO"    # correção do personal


class MidiaRef(BaseModel):
    s3_key: str
    tipo: str   # "foto_exercicio" | "video_execucao" | "foto_correcao" | "video_correcao"


class PostagemCreate(BaseModel):
    tipo: PostagemTipo
    exercicio_id: str
    exercicio_nome: str | None = None
    descricao: str | None = None
    midias: list[MidiaRef] = []
    sessao_id: str | None = None

    @model_validator(mode="after")
    def ao_menos_texto_ou_midia(self):
        if not self.descricao and not self.midias:
            raise ValueError("Informe um texto ou ao menos uma mídia.")
        return self


class PostagemPersonalCreate(BaseModel):
    exercicio_nome: str | None = None
    descricao: str | None = None
    midias: list[MidiaRef] = []

    @model_validator(mode="after")
    def ao_menos_texto_ou_midia(self):
        if not self.descricao and not self.midias:
            raise ValueError("Informe um texto ou ao menos uma mídia.")
        return self
