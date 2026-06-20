"""Anamnese / ficha de saúde do aluno."""
from typing import Any
from pydantic import BaseModel


class PerguntaAnamnese(BaseModel):
    key: str
    label: str
    type: str = "TEXT"                 # TEXT | NUMBER | BOOL | SELECT | DATE
    options: list[str] | None = None
    required: bool = False
    placeholder: str | None = None


class AnamneseTemplate(BaseModel):
    """Configuração do questionário salvo em PT#{personal_id}/CONFIG#ANAMNESE."""
    perguntas: list[PerguntaAnamnese] = []
    mensagem_boas_vindas: str = ""
    solicitar_email: bool = True
    solicitar_nascimento: bool = True
    solicitar_objetivo: bool = True


class AnamneseResposta(BaseModel):
    """Respostas preenchidas. Salvo em AL#{aluno_id}/ANAMNESE#."""
    respostas: dict[str, Any] = {}
    preenchido_em: str | None = None
    preenchido_por: str = "ALUNO"       # "ALUNO" | "PERSONAL"
