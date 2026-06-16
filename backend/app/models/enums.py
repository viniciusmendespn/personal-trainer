"""Enums do domínio — espelhar no frontend (types/index.ts). CLAUDE.md / ESPEC §5."""
from enum import Enum


class CanalOrigem(str, Enum):
    WHATSAPP = "WHATSAPP"
    PORTAL = "PORTAL"


class Classificacao(str, Enum):
    AUTO = "AUTO"       # vinculado pelo agente
    MANUAL = "MANUAL"   # vinculado/ajustado pelo personal


class Ator(str, Enum):
    ALUNO = "ALUNO"
    PERSONAL = "PERSONAL"   # personal "atuando como aluno" (ESPEC §1.3)


class SessaoStatus(str, Enum):
    EM_ANDAMENTO = "EM_ANDAMENTO"
    FINALIZADA = "FINALIZADA"
    ABANDONADA = "ABANDONADA"


class MidiaStatus(str, Enum):
    PENDENTE = "PENDENTE"
    VINCULADA = "VINCULADA"


class MidiaTipo(str, Enum):
    VIDEO_EXECUCAO = "VIDEO_EXECUCAO"
    FOTO_EVOLUCAO = "FOTO_EVOLUCAO"
    FOTO_EXERCICIO = "FOTO_EXERCICIO"
    FEEDBACK_VISUAL = "FEEDBACK_VISUAL"
    OUTRO = "OUTRO"


class PendenciaStatus(str, Enum):
    ABERTA = "ABERTA"
    RESOLVIDA = "RESOLVIDA"


class AlertaStatus(str, Enum):
    ABERTO = "ABERTO"
    VISTO = "VISTO"
    RESOLVIDO = "RESOLVIDO"


class InstanceStatus(str, Enum):
    CONNECTED = "CONNECTED"
    DISCONNECTED = "DISCONNECTED"
