// Precificação do personal trainer. Não há literatura aqui — é modelagem de negócio.
//
// Regra dura: NENHUMA alíquota ou valor fiscal fica embutido na conta. Eles vivem em
// PRESETS_IMPOSTO, com verificadoEm obrigatório, e entram como parâmetro.
import { arredondar, arredondarComercial } from './numero'
import { erro, sucesso, type Aviso, type Calc } from './tipos'

export interface PresetImposto {
  id: 'mei' | 'simples-anexo-iii' | 'sem-imposto'
  rotulo: string
  aliquota: number
  /** DAS do MEI é valor fixo, não percentual. */
  valorFixoMensal?: number
  tetoFaturamentoAnual?: number
  observacao?: string
  /** 'AAAA-MM' — obrigatório. Regra fiscal muda; dado sem data é dado errado esperando acontecer. */
  verificadoEm: string
}

export const PRESETS_IMPOSTO: readonly PresetImposto[] = [
  {
    id: 'mei',
    rotulo: 'MEI',
    aliquota: 0,
    valorFixoMensal: 86.05,
    tetoFaturamentoAnual: 81000,
    observacao: 'DAS de serviços fixo por mês, com teto de faturamento anual.',
    verificadoEm: '2026-08',
  },
  {
    id: 'simples-anexo-iii',
    rotulo: 'Simples Nacional',
    aliquota: 0.06,
    observacao: 'Alíquota inicial do Anexo III. Varia por faixa de receita — confirme com o contador.',
    verificadoEm: '2026-08',
  },
  { id: 'sem-imposto', rotulo: 'Não pago imposto', aliquota: 0, verificadoEm: '2026-08' },
]

export interface ReferenciaMercado {
  rotulo: string
  min: number
  max: number
  unidade: string
  verificadoEm: string
}

/** Exibido como contexto ao lado do resultado. NUNCA entra na conta. */
export const REFERENCIAS_MERCADO: readonly ReferenciaMercado[] = [
  { rotulo: 'Sessão presencial', min: 50, max: 250, unidade: 'por sessão', verificadoEm: '2026-08' },
  { rotulo: 'Concentração da sessão presencial', min: 86, max: 150, unidade: 'por sessão', verificadoEm: '2026-08' },
  { rotulo: 'Consultoria online', min: 90, max: 320, unidade: 'por mês', verificadoEm: '2026-08' },
]

export interface EntradaPrecificacao {
  custoFixoMensal: number
  horasDisponiveisSemana: number
  /** 0 a 1. */
  taxaOcupacao: number
  /** 0 a 1. */
  aliquotaImposto?: number
  tributoFixoMensal?: number
  rendaLiquidaDesejada: number
  /** 4,33 é a média real do mês. 4 perde quase uma sessão por aluno. */
  semanasPorMes?: number
  duracaoSessaoMin?: number
  frequenciasSemanais?: number[]
  tetoFaturamentoAnual?: number
}

export interface MensalidadeEquivalente {
  vezesPorSemana: number
  sessoesMes: number
  valorMensal: number
}

export interface AlunosParaMeta {
  vezesPorSemana: number
  alunos: number
  sessoesExigidas: number
}

export interface ResultadoPrecificacao {
  capacidade: { horasMes: number; sessoesMesTeorico: number; sessoesMesRealista: number }
  faturamentoBrutoBreakEven: number
  faturamentoBrutoMeta: number
  precoMinimoSessao: number
  precoMetaSessao: number
  precoMetaSessaoComercial: number
  mensalidades: MensalidadeEquivalente[]
  alunosParaMeta: AlunosParaMeta[]
  faturamentoAnualProjetado: number
  referenciasMercado: readonly ReferenciaMercado[]
}

export function precificar(e: EntradaPrecificacao): Calc<ResultadoPrecificacao> {
  const avisos: Aviso[] = []
  const semanasPorMes = e.semanasPorMes ?? 4.33
  const duracaoSessaoMin = e.duracaoSessaoMin ?? 60
  const aliquota = e.aliquotaImposto ?? 0
  const tributoFixo = e.tributoFixoMensal ?? 0
  const frequencias = e.frequenciasSemanais ?? [1, 2, 3]

  if (!Number.isFinite(e.horasDisponiveisSemana) || e.horasDisponiveisSemana <= 0) {
    return erro([campoInvalido('horasDisponiveisSemana', 'Informe quantas horas por semana você tem disponíveis.')])
  }
  if (!Number.isFinite(e.taxaOcupacao) || e.taxaOcupacao <= 0 || e.taxaOcupacao > 1) {
    return erro([campoInvalido('taxaOcupacao', 'A ocupação precisa ficar entre 0 e 100%.')])
  }
  if (!Number.isFinite(aliquota) || aliquota < 0 || aliquota >= 1) {
    return erro([campoInvalido('aliquotaImposto', 'A alíquota precisa ficar abaixo de 100%.')])
  }
  if (!Number.isFinite(e.custoFixoMensal) || e.custoFixoMensal < 0) {
    return erro([campoInvalido('custoFixoMensal', 'Informe o custo fixo mensal.')])
  }
  if (!Number.isFinite(e.rendaLiquidaDesejada) || e.rendaLiquidaDesejada < 0) {
    return erro([campoInvalido('rendaLiquidaDesejada', 'Informe quanto quer receber por mês.')])
  }

  if (e.taxaOcupacao > 0.9) {
    avisos.push({
      codigo: 'OCUPACAO_IRREAL',
      nivel: 'atencao',
      campo: 'taxaOcupacao',
      mensagem: 'Ocupação acima de 90% é rara: a demanda se concentra no começo da manhã e no fim da tarde.',
      correcao: 'Contar com agenda quase cheia costuma ser o motivo de o preço sair baixo demais.',
      contexto: { ocupacao: arredondar(e.taxaOcupacao * 100, 1) },
    })
  }

  const horasMes = e.horasDisponiveisSemana * semanasPorMes
  const sessoesMesTeorico = horasMes / (duracaoSessaoMin / 60)
  const sessoesMesRealista = sessoesMesTeorico * e.taxaOcupacao

  // O imposto incide sobre o bruto, então ele entra dividindo — não como desconto no fim.
  const faturamentoBrutoBreakEven = (e.custoFixoMensal + tributoFixo) / (1 - aliquota)
  const faturamentoBrutoMeta = (e.custoFixoMensal + tributoFixo + e.rendaLiquidaDesejada) / (1 - aliquota)

  const precoMinimoSessao = faturamentoBrutoBreakEven / sessoesMesRealista
  const precoMetaSessao = faturamentoBrutoMeta / sessoesMesRealista

  const mensalidades: MensalidadeEquivalente[] = frequencias.map((v) => {
    const sessoesMes = v * semanasPorMes
    return {
      vezesPorSemana: v,
      sessoesMes: arredondar(sessoesMes, 4),
      valorMensal: arredondar(sessoesMes * precoMetaSessao, 4),
    }
  })

  const alunosParaMeta: AlunosParaMeta[] = mensalidades.map((m) => {
    const alunos = Math.ceil(faturamentoBrutoMeta / m.valorMensal)
    return {
      vezesPorSemana: m.vezesPorSemana,
      alunos,
      sessoesExigidas: arredondar(alunos * m.sessoesMes, 4),
    }
  })

  const estouraCapacidade = alunosParaMeta.filter((a) => a.sessoesExigidas > sessoesMesRealista)
  if (estouraCapacidade.length) {
    const pior = estouraCapacidade[0]
    avisos.push({
      codigo: 'META_ACIMA_DA_CAPACIDADE',
      nivel: 'atencao',
      mensagem: `Para essa meta com ${pior.vezesPorSemana}× por semana seriam necessárias ${arredondar(pior.sessoesExigidas, 1)} sessões por mês, e a sua capacidade real é ${arredondar(sessoesMesRealista, 1)}.`,
      correcao: 'Não dá para atender mais horas do que existem no dia: o caminho é subir o preço ou mudar o formato (dupla, pequeno grupo, consultoria).',
      contexto: { exigidas: arredondar(pior.sessoesExigidas, 2), capacidade: arredondar(sessoesMesRealista, 2) },
    })
  }

  const faturamentoAnualProjetado = faturamentoBrutoMeta * 12
  const teto = e.tetoFaturamentoAnual
  if (teto && faturamentoAnualProjetado > teto) {
    avisos.push({
      codigo: 'TETO_MEI_ESTOURADO',
      nivel: 'atencao',
      mensagem: `O faturamento projetado (R$ ${arredondar(faturamentoAnualProjetado, 2)} por ano) passa do teto de R$ ${teto}.`,
      correcao: 'Nesse patamar o enquadramento precisa mudar. Confirme com o seu contador.',
      contexto: { anual: arredondar(faturamentoAnualProjetado, 2), teto },
    })
  }

  const refSessao = REFERENCIAS_MERCADO[0]
  if (precoMetaSessao < refSessao.min || precoMetaSessao > refSessao.max) {
    avisos.push({
      codigo: 'PRECO_FORA_DA_REFERENCIA_DE_MERCADO',
      nivel: 'info',
      mensagem: `O preço calculado (R$ ${arredondar(precoMetaSessao, 2)}) fica fora da faixa praticada de R$ ${refSessao.min} a R$ ${refSessao.max} por sessão.`,
      correcao: 'Isso é contexto, não impedimento: abaixo costuma indicar custo subestimado; acima exige proposta de valor clara.',
      contexto: { preco: arredondar(precoMetaSessao, 2), min: refSessao.min, max: refSessao.max },
    })
  }

  return sucesso(
    {
      capacidade: {
        horasMes: arredondar(horasMes, 4),
        sessoesMesTeorico: arredondar(sessoesMesTeorico, 4),
        sessoesMesRealista: arredondar(sessoesMesRealista, 4),
      },
      faturamentoBrutoBreakEven: arredondar(faturamentoBrutoBreakEven, 4),
      faturamentoBrutoMeta: arredondar(faturamentoBrutoMeta, 4),
      precoMinimoSessao: arredondar(precoMinimoSessao, 4),
      precoMetaSessao: arredondar(precoMetaSessao, 4),
      precoMetaSessaoComercial: arredondarComercial(precoMetaSessao, 5),
      mensalidades,
      alunosParaMeta,
      faturamentoAnualProjetado: arredondar(faturamentoAnualProjetado, 2),
      referenciasMercado: REFERENCIAS_MERCADO,
    },
    avisos,
  )
}

function campoInvalido(campo: string, mensagem: string): Aviso {
  return { codigo: 'FORA_DO_DOMINIO', nivel: 'erro', campo, mensagem }
}
