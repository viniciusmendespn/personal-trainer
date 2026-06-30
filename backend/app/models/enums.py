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


class AlertaStatus(str, Enum):
    ABERTO = "ABERTO"
    VISTO = "VISTO"
    RESOLVIDO = "RESOLVIDO"


class InstanceStatus(str, Enum):
    CONNECTED = "CONNECTED"
    DISCONNECTED = "DISCONNECTED"


class AlunoStatus(str, Enum):
    ATIVO = "ATIVO"
    INATIVO = "INATIVO"


class AgendamentoStatus(str, Enum):
    AGENDADO = "AGENDADO"
    CONFIRMADO = "CONFIRMADO"
    CANCELADO = "CANCELADO"
    CONCLUIDO = "CONCLUIDO"


class CustomFieldType(str, Enum):
    """Tipos de atributo customizável que o personal pode definir (ESPEC §2.4)."""
    TEXT = "TEXT"
    NUMBER = "NUMBER"
    BOOL = "BOOL"
    SELECT = "SELECT"
    DATE = "DATE"


class CobrancaStatus(str, Enum):
    PENDENTE = "PENDENTE"
    PAGA = "PAGA"
    VENCIDA = "VENCIDA"


class Recorrencia(str, Enum):
    MENSAL = "MENSAL"
    ANUAL = "ANUAL"


class FormaPagamento(str, Enum):
    MANUAL = "MANUAL"
    PIX_MP = "PIX_MP"


class TipoExercicio(str, Enum):
    FORCA = "FORCA"
    PERFORMANCE = "PERFORMANCE"
    # Legados — unificados em PERFORMANCE. Mantidos só para validar payloads/pacotes antigos;
    # normalizados via normalizar_tipo_exercicio(). Não oferecer mais na UI.
    CARDIO = "CARDIO"
    PESO_CORPORAL = "PESO_CORPORAL"


# Direção da métrica de exercícios PERFORMANCE: se um valor maior ou menor representa evolução.
MAIOR = "MAIOR"   # mais reps/km/voltas/tempo aguentado = melhor (default)
MENOR = "MENOR"   # menos tempo/pace = melhor (ex.: tempo nos 5 km)


def normalizar_tipo_exercicio(t) -> str:
    """Mapeia os tipos legados CARDIO/PESO_CORPORAL para PERFORMANCE e None para FORCA.
    Aceita str ou TipoExercicio. Usar em todo ponto que LÊ o tipo de um item persistido."""
    v = t.value if isinstance(t, TipoExercicio) else t
    if v in ("CARDIO", "PESO_CORPORAL"):
        return TipoExercicio.PERFORMANCE.value
    return v or TipoExercicio.FORCA.value
