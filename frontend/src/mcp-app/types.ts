export interface Serie { series: number; reps: string; carga?: string | null; aquecimento?: boolean | null }
export interface Exercicio {
  chave_historico?: string
  origem_id?: string | null; nome: string; tipo_exercicio: string; bloco_id?: string | null
  grupos?: string[] | null; grupo?: string | null; aquecimento?: boolean
  series_prescritas?: Serie[] | null; intervalo_s?: number | null; observacoes?: string | null
  unidade_carga?: string | null; unidade_reps?: string | null; metrica_direcao?: string | null
  video_url?: string | null; substitutos: { nome: string; video_url?: string | null; observacao?: string | null; series_prescritas?: Serie[] | null }[]
}
export interface Treino {
  origem_id?: string | null; ref?: string | null; nome: string; foco?: string | null
  observacoes?: string | null; ativo: boolean; data_inicio?: string | null; data_fim?: string | null
  blocos: Record<string, unknown>[]; exercicios: Exercicio[]
}
export interface Programa { version: string; treinos: Treino[]; revisao?: number }
export interface Aluno {
  aluno_id: string; nome: string; objetivos?: string[] | null; status?: string | null
  ultimo_treino_em?: string | null; urgencia: number; updated_at?: string | null
  pendencias: { tipo: string; titulo: string; detalhe?: string }[]; filtros: string[]; vigencia_informada: boolean
}
export interface Carteira { items: Aluno[]; next_cursor: string | null; cobertura: { completa: boolean; alunos_examinados: number }; criterios: { proximos_dias: number; sem_treinar_dias: number; hoje: string } }
export interface Contexto {
  gerado_em: string; secoes_indisponiveis: string[]
  anamnese?: { preenchido_em?: string | null; respostas: { pergunta: string; resposta: string }[] } | null
  perfil: { nome?: string | null; idade?: number | null; objetivos: string[]; descricao?: string | null; observacoes_do_personal?: string | null }
  dores_e_duvidas: { tipo: string; data?: string | null; descricao: string; exercicio?: string | null; respondido?: boolean; resposta_do_personal?: string | null }[]
  estatisticas_treino?: { total_sessoes: number; sessoes_semana_atual: number; media_sessoes_por_semana: number; ultimo_treino_em?: string | null } | null
  avaliacoes_fisicas?: { data?: string | null; peso_kg?: number | null; altura_cm?: number | null; percentual_gordura?: number | null; observacoes?: string | null }[]
  metas?: { titulo: string; status?: string; valor_alvo?: number | null; unidade?: string | null; exercicio?: string | null; data_limite?: string | null }[]
  notas_do_personal?: { data?: string | null; texto: string }[]
}
export interface Evolucao { tipo: string; nome: string; direcao?: string | null; serie: { data: string; carga_max?: number | null; volume?: number | null; metrica_max?: number | null; unidade_carga?: string | null; unidade_reps?: string | null }[]; total_sessoes: number }
export interface Resumo {
  carteira_tool?: string
  version: string; tela: 'carteira' | 'aluno'; aluno_id?: string | null; nome?: string | null; revisao?: number | null
}
export interface Detalhes { programa?: Programa; contexto_aluno?: Contexto; sessao_em_andamento?: { treino_nome?: string; desde?: string } | null }
export interface ToolResult { content?: { type: string; text?: string }[]; structuredContent?: Record<string, unknown>; _meta?: Record<string, unknown>; isError?: boolean }
export interface Selecao { aluno_id?: string | null; nome?: string | null; tela: string }
