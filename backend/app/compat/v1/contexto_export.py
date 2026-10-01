"""Seção `contexto_aluno` do export do programa de treino (somente SAÍDA — o import
ignora o bloco inteiro via extra='ignore' do Pydantic).

Pensado para leitura por LLM externa (ChatGPT/Claude/Gemini via copy-paste): chaves
autoexplicativas em pt-BR, datas legíveis (YYYY-MM-DD), valores compactos. Sem IDs
internos, sem S3 keys/presigned URLs, sem dados de contato (telefone/email/endereço)
nem financeiros — o arquivo é baixado pelo personal e colado em serviço de terceiros."""
from typing import Any

from pydantic import BaseModel, Field


class PerfilContexto(BaseModel):
    nome: str | None = None
    idade: int | None = None                       # derivada de data_nascimento
    objetivos: list[str] = Field(default_factory=list)
    descricao: str | None = None
    observacoes_do_personal: str | None = None     # Aluno.observacoes (cadastro)


class RespostaAnamnese(BaseModel):
    pergunta: str                                  # label do template (fallback: a key)
    resposta: str


class AnamneseContexto(BaseModel):
    preenchido_em: str | None = None
    respostas: list[RespostaAnamnese] = Field(default_factory=list)


class AvaliacaoContexto(BaseModel):
    data: str | None = None
    peso_kg: float | None = None
    altura_cm: float | None = None
    percentual_gordura: float | None = None
    medidas_cm: dict[str, Any] = Field(default_factory=dict)      # ex.: {"cintura": 80}
    metricas_customizadas: list[dict] = Field(default_factory=list)  # [{nome, unidade, valor}]
    observacoes: str | None = None


class MetaContexto(BaseModel):
    titulo: str = ""
    tipo: str = "LIVRE"                            # CARGA | PESO | MEDIDA | LIVRE
    status: str = ""                               # APROVADA | PENDENTE
    valor_alvo: float | None = None
    unidade: str | None = None
    exercicio: str | None = None
    data_limite: str | None = None
    descricao: str | None = None


class SemanaContexto(BaseModel):
    semana: str                                    # semana ISO, ex.: "2026-W26"
    sessoes: int = 0
    volume_kg: float = 0


class EstatisticasTreino(BaseModel):
    total_sessoes: int = 0
    media_sessoes_por_semana: float = 0            # sobre as últimas 16 semanas com treino
    sessoes_semana_atual: int = 0
    streak_semanas_consecutivas: int = 0
    streak_maximo_semanas: int = 0
    ultimo_treino_em: str | None = None
    volume_total_kg: float = 0
    volume_por_grupo_muscular: list[dict] = Field(default_factory=list)  # [{grupo, volume}]
    ultimas_semanas: list[SemanaContexto] = Field(default_factory=list)


class ExercicioSessaoContexto(BaseModel):
    nome: str | None = None
    series_realizadas: str = ""                    # compacto: "20kg x 10 | 22kg x 8 @RPE8"
    substituto_executado: str | None = None        # nome do substituto, se o aluno trocou
    pse: float | None = None                       # percepção de esforço do exercício (0-10); None = não informado


class SessaoContexto(BaseModel):
    data: str | None = None
    treino: str | None = None
    duracao_min: int | None = None
    total_series: int | None = None
    volume_kg: float | None = None
    novos_recordes: list[str] = Field(default_factory=list)   # "Supino reto: 80kg"
    exercicios: list[ExercicioSessaoContexto] = Field(default_factory=list)


class EvolucaoExercicioContexto(BaseModel):
    exercicio: str
    recorde_carga: float | None = None             # PR all-time (STATS#PR#)
    recorde_em: str | None = None
    sessoes_no_periodo: int = 0                    # nas últimas ~20 sessões exportadas
    carga_max_primeira_sessao: float | None = None
    carga_max_ultima_sessao: float | None = None
    tendencia: str = "SEM_DADOS"                   # SUBINDO | ESTAVEL | CAINDO | SEM_DADOS


class RelatoContexto(BaseModel):
    tipo: str                                      # DOR | DUVIDA
    data: str | None = None
    exercicio: str | None = None
    descricao: str = ""
    respondido: bool = False
    resposta_do_personal: str | None = None


class PostagemContexto(BaseModel):
    data: str | None = None
    autor: str = ""                                # ALUNO | PERSONAL
    exercicio: str | None = None
    texto: str | None = None
    tinha_midia: bool = False


class NotaContexto(BaseModel):
    data: str | None = None
    texto: str = ""


class MensagemChatContexto(BaseModel):
    data: str | None = None
    autor: str = ""                                # ALUNO | PERSONAL | ASSISTENTE_IA
    mensagem: str = ""


class GamificacaoContexto(BaseModel):
    pontos_totais: int = 0
    conquistas: list[str] = Field(default_factory=list)   # "Dedicação (10 sessões completadas)"


class ContextoAluno(BaseModel):
    descricao_do_bloco: str = (
        "Contexto completo do aluno (perfil, saúde, histórico de treinos, feedbacks) para a IA "
        "analisar antes de montar/ajustar o programa. NÃO incluir este bloco na resposta."
    )
    gerado_em: str = ""
    perfil: PerfilContexto = Field(default_factory=PerfilContexto)
    anamnese: AnamneseContexto | None = None
    avaliacoes_fisicas: list[AvaliacaoContexto] = Field(default_factory=list)
    metas: list[MetaContexto] = Field(default_factory=list)
    estatisticas_treino: EstatisticasTreino | None = None
    ultimas_sessoes: list[SessaoContexto] = Field(default_factory=list)
    evolucao_por_exercicio: list[EvolucaoExercicioContexto] = Field(default_factory=list)
    dores_e_duvidas: list[RelatoContexto] = Field(default_factory=list)
    postagens_recentes: list[PostagemContexto] = Field(default_factory=list)
    notas_do_personal: list[NotaContexto] = Field(default_factory=list)
    chat_recente: list[MensagemChatContexto] = Field(default_factory=list)
    gamificacao: GamificacaoContexto | None = None
