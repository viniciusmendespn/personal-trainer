// Primitivos das calculadoras públicas.
//
// A landing usa estilo inline com paleta teal e não tem modo escuro — os componentes
// de components/ui/* são Tailwind/dark e ficariam ilegíveis sobre fundo claro.
//
// Regras que estes primitivos existem para garantir:
//   1. resultado na tela antes de digitar (o estado inicial vem preenchido)
//   2. nenhuma escolha técnica obrigatória (tudo tem default)
//   3. rótulo em português de gente; jargão só no conteúdo abaixo
//   4. um número grande, o resto atrás de <details>
//   5. toda saída com uma frase dizendo o que significa
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { parseDecimalPtBr } from '../../../calc/numero'
import type { Aviso } from '../../../calc/tipos'

export const cor = {
  texto: '#0f172a',
  corpo: '#475569',
  suave: '#64748b',
  borda: '#e2e8f0',
  fundo: '#fff',
  fundoSuave: '#f8fafc',
  teal: '#14b8a6',
  tealEscuro: '#0f766e',
  tealFundo: '#f0fdfa',
  aviso: '#b45309',
  avisoFundo: '#fffbeb',
  erro: '#b91c1c',
  erroFundo: '#fef2f2',
} as const

const fonteTitulo = "'Sora', sans-serif"

// ── Campo numérico ───────────────────────────────────────────────────────────

export interface CampoDecimal {
  bruto: string
  valor: number | null
  erro: string | null
  set: (v: string) => void
  aoSair: () => void
}

/**
 * Campo numérico com parse pt-BR. O erro só aparece depois do primeiro blur —
 * senão pisca vermelho enquanto a pessoa digita o "8" de "80".
 */
export function useCampoDecimal(
  inicial: string,
  opcoes: { min?: number; max?: number; rotulo: string },
): CampoDecimal {
  const [bruto, setBruto] = useState(inicial)
  const [tocado, setTocado] = useState(false)

  const { valor, erro } = useMemo(() => {
    const r = parseDecimalPtBr(bruto, opcoes.rotulo)
    if (r.valor === null) return { valor: null, erro: 'Informe um número.' }
    if (opcoes.min !== undefined && r.valor < opcoes.min) {
      return { valor: null, erro: `Precisa ser ${opcoes.min} ou mais.` }
    }
    if (opcoes.max !== undefined && r.valor > opcoes.max) {
      return { valor: null, erro: `Precisa ser ${opcoes.max} ou menos.` }
    }
    return { valor: r.valor, erro: null }
  }, [bruto, opcoes.min, opcoes.max, opcoes.rotulo])

  return { bruto, valor, erro: tocado ? erro : null, set: setBruto, aoSair: () => setTocado(true) }
}

export function CalcCampo({
  id,
  rotulo,
  campo,
  sufixo,
  dica,
}: {
  id: string
  rotulo: string
  campo: CampoDecimal
  sufixo?: string
  dica?: string
}) {
  const idDica = `${id}-dica`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={id} style={{ fontSize: 14, fontWeight: 650, color: cor.texto }}>
        {rotulo}
      </label>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          id={id}
          className="cp-calc-campo"
          // type="text" de propósito: type="number" rejeita vírgula em pt-BR e o
          // scroll do mouse sobre o campo altera o valor sem a pessoa perceber.
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          value={campo.bruto}
          onChange={(e) => campo.set(e.target.value)}
          onBlur={campo.aoSair}
          aria-invalid={!!campo.erro}
          aria-describedby={dica || campo.erro ? idDica : undefined}
          style={{
            width: '100%',
            minHeight: 44,
            // 16px é o mínimo: abaixo disso o iOS dá zoom ao focar e o layout salta
            fontSize: 16,
            padding: sufixo ? '10px 52px 10px 12px' : '10px 12px',
            border: `1px solid ${campo.erro ? cor.erro : cor.borda}`,
            borderRadius: 10,
            color: cor.texto,
            background: cor.fundo,
            boxSizing: 'border-box',
          }}
        />
        {sufixo && (
          <span aria-hidden style={{ position: 'absolute', right: 12, fontSize: 14, color: cor.suave, pointerEvents: 'none' }}>
            {sufixo}
          </span>
        )}
      </div>
      {(dica || campo.erro) && (
        <span id={idDica} style={{ fontSize: 12.5, lineHeight: 1.45, color: campo.erro ? cor.erro : cor.suave }}>
          {campo.erro ?? dica}
        </span>
      )}
    </div>
  )
}

// ── Seleções ─────────────────────────────────────────────────────────────────

export function CalcSelect<T extends string>({
  id,
  rotulo,
  valor,
  onChange,
  opcoes,
  dica,
}: {
  id: string
  rotulo: string
  valor: T
  onChange: (v: T) => void
  opcoes: { valor: T; label: string }[]
  dica?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={id} style={{ fontSize: 14, fontWeight: 650, color: cor.texto }}>{rotulo}</label>
      <select
        id={id}
        className="cp-calc-campo"
        value={valor}
        onChange={(e) => onChange(e.target.value as T)}
        style={{ minHeight: 44, fontSize: 16, padding: '10px 12px', border: `1px solid ${cor.borda}`, borderRadius: 10, color: cor.texto, background: cor.fundo, boxSizing: 'border-box' }}
      >
        {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
      </select>
      {dica && <span style={{ fontSize: 12.5, lineHeight: 1.45, color: cor.suave }}>{dica}</span>}
    </div>
  )
}

/** fieldset + radios nativos: navegação por setas e leitura correta em leitor de tela. */
export function CalcRadios<T extends string>({
  legenda,
  valor,
  onChange,
  opcoes,
  nome,
}: {
  legenda: string
  valor: T
  onChange: (v: T) => void
  opcoes: { valor: T; label: string }[]
  nome: string
}) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <legend style={{ fontSize: 14, fontWeight: 650, color: cor.texto, padding: 0, marginBottom: 2 }}>{legenda}</legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {opcoes.map((o) => {
          const ativo = o.valor === valor
          return (
            <label
              key={o.valor}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44,
                padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 15,
                border: `1px solid ${ativo ? cor.teal : cor.borda}`,
                background: ativo ? cor.tealFundo : cor.fundo,
                color: ativo ? cor.tealEscuro : cor.corpo,
                fontWeight: ativo ? 700 : 500,
              }}
            >
              <input
                type="radio"
                name={nome}
                value={o.valor}
                checked={ativo}
                onChange={() => onChange(o.valor)}
                style={{ accentColor: cor.teal, width: 16, height: 16 }}
              />
              {o.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

// ── Resultado ────────────────────────────────────────────────────────────────

/** aria-live polite (nunca assertive: interromperia a leitura a cada tecla). */
export function CalcResultado({
  valor,
  unidade,
  rotulo,
  legenda,
  destaque = true,
}: {
  valor: string
  unidade?: string
  rotulo: string
  legenda?: ReactNode
  destaque?: boolean
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        background: destaque ? cor.tealFundo : cor.fundoSuave,
        border: `1px solid ${destaque ? 'rgba(20,184,166,0.25)' : cor.borda}`,
        borderRadius: 14,
        padding: destaque ? '20px 22px' : '16px 18px',
      }}
    >
      <p style={{ fontSize: 13, fontWeight: 700, color: cor.suave, textTransform: 'uppercase', letterSpacing: 0.2, marginBottom: 6 }}>
        {rotulo}
      </p>
      <p style={{ fontFamily: fonteTitulo, fontSize: destaque ? 'clamp(30px, 6vw, 40px)' : 24, fontWeight: 800, color: cor.texto, lineHeight: 1.1 }}>
        {valor}
        {unidade && <span style={{ fontSize: destaque ? 20 : 15, fontWeight: 700, color: cor.suave, marginLeft: 6 }}>{unidade}</span>}
      </p>
      {legenda && <p style={{ fontSize: 14, lineHeight: 1.6, color: cor.corpo, marginTop: 8 }}>{legenda}</p>}
    </div>
  )
}

export function CalcGrade({ children, min = 200 }: { children: ReactNode; min?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 14 }}>
      {children}
    </div>
  )
}

export function CalcTabela({
  cabecalho,
  linhas,
  destacar,
}: {
  cabecalho: string[]
  linhas: (string | number)[][]
  /** Índice da linha em destaque (ex.: a das repetições informadas). */
  destacar?: number
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14.5 }}>
        <thead>
          <tr>
            {cabecalho.map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '9px 12px', background: cor.tealFundo, border: `1px solid ${cor.borda}`, color: cor.texto, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, i) => (
            <tr key={i} style={destacar === i ? { background: 'rgba(20,184,166,0.12)', fontWeight: 700 } : undefined}>
              {linha.map((c, j) => (
                <td key={j} style={{ padding: '9px 12px', border: `1px solid ${cor.borda}`, color: destacar === i ? cor.texto : cor.corpo }}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CalcAvisos({ avisos }: { avisos: Aviso[] }) {
  const visiveis = avisos.filter((a) => a.nivel !== 'info' || a.codigo === 'ESTIMATIVA_EDUCATIVA_NAO_PRESCRICAO')
  if (!visiveis.length) return null
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {visiveis.map((a, i) => {
        const grave = a.nivel === 'erro'
        return (
          <div
            key={`${a.codigo}-${i}`}
            style={{
              background: grave ? cor.erroFundo : cor.avisoFundo,
              border: `1px solid ${grave ? 'rgba(185,28,28,0.25)' : 'rgba(180,83,9,0.25)'}`,
              borderRadius: 10,
              padding: '12px 14px',
              fontSize: 14,
              lineHeight: 1.6,
              color: grave ? cor.erro : cor.aviso,
            }}
          >
            <span style={{ fontWeight: 650 }}>{a.mensagem}</span>
            {a.correcao && <span style={{ display: 'block', marginTop: 4, color: cor.corpo }}>{a.correcao}</span>}
          </div>
        )
      })}
    </div>
  )
}

/** <details> — o conteúdo fica no DOM, então continua indexável mesmo fechado. */
export function CalcAvancado({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <details style={{ border: `1px solid ${cor.borda}`, borderRadius: 12, background: cor.fundoSuave }}>
      <summary style={{ cursor: 'pointer', padding: '13px 16px', fontSize: 14.5, fontWeight: 650, color: cor.tealEscuro, minHeight: 44, display: 'flex', alignItems: 'center' }}>
        {titulo}
      </summary>
      <div style={{ padding: '4px 16px 16px', display: 'grid', gap: 14 }}>{children}</div>
    </details>
  )
}

// ── Cartão ───────────────────────────────────────────────────────────────────

export function CalcCartao({
  campos,
  resultado,
  avancado,
  ressalva,
  cta,
}: {
  campos: ReactNode
  resultado: ReactNode
  avancado?: ReactNode
  ressalva?: ReactNode
  cta?: { texto: string; label: string }
}) {
  return (
    // preventDefault: sem isso, Enter num campo recarrega a página
    <form onSubmit={(e) => e.preventDefault()} style={{ display: 'grid', gap: 20 }}>
      <div style={{ background: cor.fundo, border: `1px solid ${cor.borda}`, borderRadius: 16, padding: '22px 24px', display: 'grid', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
          {campos}
        </div>
        {resultado}
        {avancado}
        <p style={{ fontSize: 12.5, lineHeight: 1.6, color: cor.suave, borderTop: `1px solid ${cor.borda}`, paddingTop: 14 }}>
          {ressalva ?? 'Estimativa. Não substitui avaliação presencial nem a prescrição do profissional responsável (CREF).'}
          {' '}Nada é enviado para servidor — o cálculo roda no seu navegador.
        </p>
      </div>
      {cta && (
        <div style={{ background: 'linear-gradient(160deg, #0f172a 0%, #060a14 100%)', borderRadius: 14, padding: '20px 22px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: 15, lineHeight: 1.6, maxWidth: 460 }}>{cta.texto}</p>
          <Link to="/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #14b8a6, #10b981)', color: '#fff', textDecoration: 'none', fontWeight: 800, padding: '12px 20px', borderRadius: 10, whiteSpace: 'nowrap' }}>
            {cta.label} <ArrowRight size={17} />
          </Link>
        </div>
      )}
    </form>
  )
}

export function num(v: number, casas = 1): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}
