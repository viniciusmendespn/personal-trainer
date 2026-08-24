// Percentual de gordura por dobras cutâneas. Cinco protocolos, nove equações.
//
// ⚠ Ponto de atenção que motivou o teste de regressão em dobras.test.ts: a equação
// feminina de Petroski é LOGARÍTMICA. Circulam em calculadoras brasileiras versões
// polinomiais com Σ₄² e sem termo linear — com Σ₄=66 mm e 30 anos, essa forma
// devolve densidade NEGATIVA. A forma correta está confirmada em duas fontes
// independentes (RBAFS e Medicina Esportiva).
import { arredondar } from './numero'
import { erro, sucesso, type Aviso, type Calc, type Proveniencia, type Sexo } from './tipos'

export type SitioDobra =
  | 'peitoral'
  | 'axilarMedia'
  | 'triceps'
  | 'subescapular'
  | 'abdominal'
  | 'suprailiaca'
  | 'coxa'
  | 'panturrilhaMedial'

export type ProtocoloDobras = 'jp3' | 'jp7' | 'yuhasz' | 'guedes' | 'petroski'
export type EquacaoDensidade = 'siri' | 'brozek'
export type Dobras = Partial<Record<SitioDobra, number>>

export const DOBRA_LIMITES = { min: 1, max: 60 } as const
export const IDADE_LIMITES = { min: 10, max: 90 } as const

export const SITIO_LABELS: Record<SitioDobra, string> = {
  peitoral: 'Peitoral',
  axilarMedia: 'Axilar média',
  triceps: 'Tríceps',
  subescapular: 'Subescapular',
  abdominal: 'Abdominal',
  suprailiaca: 'Suprailíaca',
  coxa: 'Coxa',
  panturrilhaMedial: 'Panturrilha medial',
}

/** Onde e como medir. Vai para o rótulo do campo, não para um tooltip escondido. */
export const SITIO_COMO_MEDIR: Record<SitioDobra, string> = {
  peitoral: 'Oblíqua. Homens: ponto médio entre a linha axilar anterior e o mamilo. Mulheres: a um terço dessa distância, a partir da axila',
  axilarMedia: 'Vertical, sobre a linha axilar média, na altura do processo xifoide',
  triceps: 'Vertical, face posterior do braço, no ponto médio entre o acrômio e o olécrano, braço solto',
  subescapular: 'Oblíqua a 45°, dois centímetros abaixo do ângulo inferior da escápula',
  abdominal: 'Vertical, dois centímetros ao lado da cicatriz umbilical',
  suprailiaca: 'Oblíqua, logo acima da crista ilíaca, sobre a linha axilar média',
  coxa: 'Vertical, face anterior, no ponto médio entre a prega inguinal e a borda superior da patela',
  panturrilhaMedial: 'Vertical, face medial da perna, na altura do maior perímetro, joelho a 90°',
}

interface DefinicaoProtocolo {
  id: ProtocoloDobras
  label: string
  /** Descrito pelo custo, não pelo nome — é o que a pessoa precisa para escolher. */
  resumo: string
  sitios: Record<Sexo, SitioDobra[]>
  validade: Record<Sexo, { min: number; max: number }>
  provenienciaId: Record<Sexo, string>
  /** Yuhasz devolve %G direto, sem passar por densidade. */
  densidade: ((sexo: Sexo, soma: number, idade: number) => number) | null
  gorduraDireta?: (soma: number) => number
}

export const PROTOCOLOS: readonly DefinicaoProtocolo[] = [
  {
    id: 'jp3',
    label: 'Jackson & Pollock, 3 dobras',
    resumo: 'O mais rápido: três medidas',
    sitios: {
      M: ['peitoral', 'abdominal', 'coxa'],
      F: ['triceps', 'suprailiaca', 'coxa'],
    },
    validade: { M: { min: 18, max: 61 }, F: { min: 18, max: 55 } },
    provenienciaId: { M: 'jackson-pollock-3-h', F: 'jackson-pollock-3-m' },
    densidade: (sexo, s, idade) =>
      sexo === 'M'
        ? 1.10938 - 0.0008267 * s + 0.0000016 * s * s - 0.0002574 * idade
        : 1.0994921 - 0.0009929 * s + 0.0000023 * s * s - 0.0001392 * idade,
  },
  {
    id: 'jp7',
    label: 'Jackson & Pollock, 7 dobras',
    resumo: 'O mais completo: sete medidas',
    sitios: {
      M: ['peitoral', 'axilarMedia', 'triceps', 'subescapular', 'abdominal', 'suprailiaca', 'coxa'],
      F: ['peitoral', 'axilarMedia', 'triceps', 'subescapular', 'abdominal', 'suprailiaca', 'coxa'],
    },
    validade: { M: { min: 18, max: 61 }, F: { min: 18, max: 55 } },
    provenienciaId: { M: 'jackson-pollock-7-h', F: 'jackson-pollock-7-m' },
    densidade: (sexo, s, idade) =>
      sexo === 'M'
        ? 1.112 - 0.00043499 * s + 0.00000055 * s * s - 0.00028826 * idade
        : 1.097 - 0.00046971 * s + 0.00000056 * s * s - 0.00012828 * idade,
  },
  {
    id: 'yuhasz',
    label: 'Faulkner (Yuhasz), 4 dobras',
    resumo: 'Quatro medidas, resultado direto sem densidade',
    sitios: {
      M: ['triceps', 'subescapular', 'suprailiaca', 'abdominal'],
      F: ['triceps', 'subescapular', 'suprailiaca', 'abdominal'],
    },
    validade: { M: { min: 18, max: 61 }, F: { min: 18, max: 55 } },
    provenienciaId: { M: 'yuhasz', F: 'yuhasz' },
    densidade: null,
    gorduraDireta: (s) => s * 0.153 + 5.783,
  },
  {
    id: 'guedes',
    label: 'Guedes, 3 dobras',
    resumo: 'Brasileiro, três medidas, adulto jovem',
    sitios: {
      M: ['triceps', 'suprailiaca', 'abdominal'],
      F: ['coxa', 'suprailiaca', 'subescapular'],
    },
    validade: { M: { min: 17, max: 27 }, F: { min: 18, max: 30 } },
    provenienciaId: { M: 'guedes-1985-h', F: 'guedes-1985-m' },
    densidade: (sexo, s) =>
      sexo === 'M'
        ? 1.1714 - 0.0671 * Math.log10(s)
        : 1.1665 - 0.0706 * Math.log10(s),
  },
  {
    id: 'petroski',
    label: 'Petroski, 4 dobras',
    resumo: 'Brasileiro, quatro medidas, faixa etária ampla',
    sitios: {
      M: ['subescapular', 'triceps', 'suprailiaca', 'panturrilhaMedial'],
      F: ['axilarMedia', 'suprailiaca', 'coxa', 'panturrilhaMedial'],
    },
    validade: { M: { min: 18, max: 66 }, F: { min: 18, max: 51 } },
    provenienciaId: { M: 'petroski-1995-h', F: 'petroski-1995-m' },
    densidade: (sexo, s, idade) =>
      sexo === 'M'
        ? 1.10726863 - 0.00081201 * s + 0.00000212 * s * s - 0.00041761 * idade
        // LOGARÍTMICA — ver o aviso no topo do arquivo.
        : 1.1954713 - 0.07513507 * Math.log10(s) - 0.00041072 * idade,
  },
]

export const PROVENIENCIAS_DOBRAS: Record<string, Proveniencia> = {
  'jackson-pollock-3-h': { id: 'jackson-pollock-3-h', nome: 'Jackson & Pollock 3 dobras (homens)', autores: 'Jackson, A.S.; Pollock, M.L.', ano: 1978, populacao: 'Homens adultos', faixaEtaria: { min: 18, max: 61 }, sexo: 'M', fonteVerificadaEm: '2026-08' },
  'jackson-pollock-3-m': { id: 'jackson-pollock-3-m', nome: 'Jackson & Pollock 3 dobras (mulheres)', autores: 'Jackson, A.S.; Pollock, M.L.; Ward, A.', ano: 1980, populacao: 'Mulheres adultas', faixaEtaria: { min: 18, max: 55 }, sexo: 'F', fonteVerificadaEm: '2026-08' },
  'jackson-pollock-7-h': { id: 'jackson-pollock-7-h', nome: 'Jackson & Pollock 7 dobras (homens)', autores: 'Jackson, A.S.; Pollock, M.L.', ano: 1978, populacao: 'Homens adultos', faixaEtaria: { min: 18, max: 61 }, sexo: 'M', fonteVerificadaEm: '2026-08' },
  'jackson-pollock-7-m': { id: 'jackson-pollock-7-m', nome: 'Jackson & Pollock 7 dobras (mulheres)', autores: 'Jackson, A.S.; Pollock, M.L.; Ward, A.', ano: 1980, populacao: 'Mulheres adultas', faixaEtaria: { min: 18, max: 55 }, sexo: 'F', fonteVerificadaEm: '2026-08' },
  yuhasz: {
    id: 'yuhasz',
    nome: 'Equação de Yuhasz (difundida como "Faulkner")',
    autores: 'Yuhasz, M.S. (não publicada)',
    ano: 1968,
    populacao: 'Adultos jovens treinados',
    fonteVerificadaEm: '2026-08',
    observacao: 'Difundida no Brasil como equação de Faulkner. É a equação de Yuhasz, e NÃO foi desenvolvida com amostra de nadadores — mito desmentido por Pires Neto & Glaner (Rev Bras Cineantropom Desempenho Hum).',
  },
  'guedes-1985-h': { id: 'guedes-1985-h', nome: 'Guedes 3 dobras (homens)', autores: 'Guedes, D.P.', ano: 1985, populacao: 'Universitários brasileiros', faixaEtaria: { min: 17, max: 27 }, sexo: 'M', fonteVerificadaEm: '2026-08' },
  'guedes-1985-m': { id: 'guedes-1985-m', nome: 'Guedes 3 dobras (mulheres)', autores: 'Guedes, D.P.', ano: 1985, populacao: 'Universitárias brasileiras', faixaEtaria: { min: 18, max: 30 }, sexo: 'F', fonteVerificadaEm: '2026-08' },
  'petroski-1995-h': { id: 'petroski-1995-h', nome: 'Petroski 4 dobras (homens)', autores: 'Petroski, E.L.', ano: 1995, populacao: 'Adultos do sul do Brasil', faixaEtaria: { min: 18, max: 66 }, sexo: 'M', fonteVerificadaEm: '2026-08' },
  'petroski-1995-m': {
    id: 'petroski-1995-m',
    nome: 'Petroski 4 dobras (mulheres)',
    autores: 'Petroski, E.L.',
    ano: 1995,
    populacao: 'Mulheres do sul do Brasil',
    faixaEtaria: { min: 18, max: 51 },
    sexo: 'F',
    n: 281,
    fonteVerificadaEm: '2026-08',
    observacao: 'Várias calculadoras brasileiras publicam esta equação em forma polinomial, com Σ₄² e sem termo linear. A forma correta é logarítmica. Com Σ₄ = 66 mm e 30 anos, a forma incorreta devolve densidade negativa.',
  },
  'siri-1961': { id: 'siri-1961', nome: 'Equação de Siri', autores: 'Siri, W.E.', ano: 1961, populacao: 'Modelo de dois compartimentos', fonteVerificadaEm: '2026-08' },
  'brozek-1963': { id: 'brozek-1963', nome: 'Equação de Brozek', autores: 'Brozek, J. et al.', ano: 1963, populacao: 'Modelo de dois compartimentos', fonteVerificadaEm: '2026-08' },
}

export interface FaixaClassificacao {
  rotulo: 'gordura essencial' | 'atletas' | 'bom' | 'aceitável' | 'acima do recomendado'
  min: number
  max: number
}

/**
 * Faixas amplamente difundidas na literatura de exercício. São referência, não
 * diagnóstico: os pontos de corte variam entre fontes e as faixas saudáveis sobem
 * alguns pontos com a idade. Mantidas grosseiras de propósito — a grade fina por
 * faixa etária não foi confirmada em fonte primária.
 */
export const CLASSIFICACAO: Record<Sexo, FaixaClassificacao[]> = {
  M: [
    { rotulo: 'gordura essencial', min: 0, max: 6 },
    { rotulo: 'atletas', min: 6, max: 14 },
    { rotulo: 'bom', min: 14, max: 18 },
    { rotulo: 'aceitável', min: 18, max: 25 },
    { rotulo: 'acima do recomendado', min: 25, max: 100 },
  ],
  F: [
    { rotulo: 'gordura essencial', min: 0, max: 14 },
    { rotulo: 'atletas', min: 14, max: 21 },
    { rotulo: 'bom', min: 21, max: 25 },
    { rotulo: 'aceitável', min: 25, max: 32 },
    { rotulo: 'acima do recomendado', min: 32, max: 100 },
  ],
}

const GORDURA_ESSENCIAL_MINIMA: Record<Sexo, number> = { M: 3, F: 12 }

export function densidadeParaGordura(densidade: number, equacao: EquacaoDensidade): number {
  return equacao === 'brozek' ? 457 / densidade - 414.2 : 495 / densidade - 450
}

export function classificarGordura(sexo: Sexo, percentual: number): FaixaClassificacao | null {
  return CLASSIFICACAO[sexo].find((f) => percentual >= f.min && percentual < f.max) ?? null
}

export function sitiosDoProtocolo(protocolo: ProtocoloDobras, sexo: Sexo): SitioDobra[] {
  return PROTOCOLOS.find((p) => p.id === protocolo)!.sitios[sexo]
}

export interface EntradaDobras {
  protocolo: ProtocoloDobras
  sexo: Sexo
  idadeAnos: number
  dobrasMm: Dobras
  equacao?: EquacaoDensidade
  pesoKg?: number
}

export interface ResultadoDobras {
  protocolo: ProtocoloDobras
  sitios: SitioDobra[]
  somaMm: number
  /** null no Yuhasz: a equação entrega %G sem passar por densidade. */
  densidade: number | null
  equacao: EquacaoDensidade | null
  percentualGordura: number
  massaGordaKg: number | null
  massaMagraKg: number | null
  classificacao: FaixaClassificacao | null
  provenienciaId: string
}

export function calcularDobras(e: EntradaDobras): Calc<ResultadoDobras> {
  const def = PROTOCOLOS.find((p) => p.id === e.protocolo)
  if (!def) return erro([{ codigo: 'FORA_DO_DOMINIO', nivel: 'erro', campo: 'protocolo', mensagem: 'Protocolo desconhecido.' }])

  const avisos: Aviso[] = []
  const { idadeAnos, sexo } = e

  if (!Number.isFinite(idadeAnos) || idadeAnos < IDADE_LIMITES.min || idadeAnos > IDADE_LIMITES.max) {
    return erro([{ codigo: 'FORA_DO_DOMINIO', nivel: 'erro', campo: 'idadeAnos', mensagem: `Informe uma idade entre ${IDADE_LIMITES.min} e ${IDADE_LIMITES.max} anos.` }])
  }

  const sitios = def.sitios[sexo]
  const faltando = sitios.filter((s) => !Number.isFinite(e.dobrasMm[s] as number))
  if (faltando.length) {
    return erro(faltando.map((s) => ({
      codigo: 'CAMPO_OBRIGATORIO' as const,
      nivel: 'erro' as const,
      campo: `dobrasMm.${s}`,
      mensagem: `Informe a dobra ${SITIO_LABELS[s].toLowerCase()}.`,
    })))
  }

  for (const s of sitios) {
    const v = e.dobrasMm[s] as number
    if (v <= 0 || v > DOBRA_LIMITES.max) {
      avisos.push({
        codigo: 'DOBRA_IMPLAUSIVEL',
        nivel: 'atencao',
        campo: `dobrasMm.${s}`,
        mensagem: `${SITIO_LABELS[s]}: ${v} mm está fora do intervalo usual (${DOBRA_LIMITES.min} a ${DOBRA_LIMITES.max} mm).`,
        correcao: 'Confira a leitura do compasso e a unidade — o valor é em milímetros.',
        contexto: { valor: v, min: DOBRA_LIMITES.min, max: DOBRA_LIMITES.max },
      })
    }
  }

  const validade = def.validade[sexo]
  if (idadeAnos < validade.min || idadeAnos > validade.max) {
    avisos.push({
      codigo: 'IDADE_FORA_DA_VALIDADE',
      nivel: 'atencao',
      campo: 'idadeAnos',
      mensagem: `${def.label} foi validado de ${validade.min} a ${validade.max} anos para este sexo. Com ${idadeAnos} anos o resultado sai fora dessa faixa.`,
      correcao: 'O número continua sendo calculado, mas trate-o com reserva.',
      contexto: { idade: idadeAnos, min: validade.min, max: validade.max },
    })
  }

  const somaMm = arredondar(sitios.reduce((total, s) => total + (e.dobrasMm[s] as number), 0), 4)

  let densidade: number | null = null
  let equacao: EquacaoDensidade | null = null
  let percentualGordura: number

  if (def.gorduraDireta) {
    percentualGordura = def.gorduraDireta(somaMm)
    if (e.equacao) {
      avisos.push({
        codigo: 'FORA_DO_DOMINIO',
        nivel: 'info',
        mensagem: 'Este protocolo estima o percentual direto do somatório, sem passar por densidade corporal — Siri e Brozek não se aplicam.',
      })
    }
  } else {
    equacao = e.equacao ?? 'siri'
    densidade = def.densidade!(sexo, somaMm, idadeAnos)
    // Fora desta faixa o Siri devolve valor absurdo (em D = 1,11 já dá −4%).
    // É também a rede que transforma uma equação mal transcrita em erro visível.
    if (!Number.isFinite(densidade) || densidade < 0.99 || densidade > 1.11) {
      return erro([{
        codigo: 'DENSIDADE_IMPLAUSIVEL',
        nivel: 'erro',
        mensagem: `A densidade corporal calculada (${Number.isFinite(densidade) ? arredondar(densidade, 4) : 'inválida'}) está fora do intervalo fisiológico.`,
        correcao: 'Confira as medidas e a idade informadas.',
        contexto: { densidade: Number.isFinite(densidade) ? arredondar(densidade, 4) : 0, min: 0.99, max: 1.11 },
      }])
    }
    percentualGordura = densidadeParaGordura(densidade, equacao)
  }

  percentualGordura = arredondar(percentualGordura, 4)

  const minimo = GORDURA_ESSENCIAL_MINIMA[sexo]
  if (percentualGordura < minimo) {
    avisos.push({
      codigo: 'ABAIXO_DA_GORDURA_ESSENCIAL',
      nivel: 'atencao',
      mensagem: `${arredondar(percentualGordura, 1)}% fica abaixo da gordura essencial de referência (${minimo}% para este sexo).`,
      correcao: 'Resultado assim quase sempre indica erro de medida. Refaça a coleta antes de considerar o valor.',
      contexto: { valor: arredondar(percentualGordura, 1), minimo },
    })
  }

  const peso = e.pesoKg
  const temPeso = Number.isFinite(peso) && (peso as number) > 0
  const massaGordaKg = temPeso ? arredondar(((peso as number) * percentualGordura) / 100, 4) : null
  const massaMagraKg = temPeso ? arredondar((peso as number) - (massaGordaKg as number), 4) : null

  return sucesso(
    {
      protocolo: def.id,
      sitios,
      somaMm,
      densidade: densidade === null ? null : arredondar(densidade, 6),
      equacao,
      percentualGordura,
      massaGordaKg,
      massaMagraKg,
      classificacao: classificarGordura(sexo, percentualGordura),
      provenienciaId: def.provenienciaId[sexo],
    },
    avisos,
  )
}
