import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import icon from './assets/coachpilot-icon.png'
import type { Aluno } from './types'

export { diaLocal, tempoRelativo } from '../utils/datetime'

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent'

export function Brand({ children }: { children?: ReactNode }) {
  return <span className="flex items-center gap-2 min-w-0">
    <img src={icon} width={24} height={24} alt="" aria-hidden="true" className="rounded-md shrink-0" />
    <span className="font-display font-semibold text-sm text-text">CoachPilot</span>
    {children}
  </span>
}

/** 'YYYY-MM-DD' ou ISO → '12/09/2026'. Data só-dia não passa por fuso (senão volta um dia). */
export function fmtDate(value?: string | null) {
  if (!value) return null
  const dia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (dia) return `${dia[3]}/${dia[2]}/${dia[1]}`
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('pt-BR')
}

export function fmtDateTime(value?: string | null) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

/** Uma etiqueta por aluno: a pendência mais grave, na mesma língua do portal. */
export function statusAluno(a: Aluno): { label: string; tone: Tone } {
  if (a.status === 'INATIVO') return { label: 'Inativo', tone: 'neutral' }
  if (a.filtros.includes('SEM_TREINO_VIGENTE')) return { label: 'Sem treino vigente', tone: 'danger' }
  if (a.filtros.includes('VENCIDOS')) return { label: 'Treino vencido', tone: 'danger' }
  if (a.filtros.includes('PROXIMOS')) return { label: 'Treino vence em breve', tone: 'warning' }
  if (a.filtros.includes('SEM_TREINAR')) return { label: 'Sem treinar', tone: 'warning' }
  if (a.pendencias[0]) return { label: a.pendencias[0].titulo, tone: 'warning' }
  return a.vigencia_informada ? { label: 'Em dia', tone: 'success' } : { label: 'Sem vigência', tone: 'neutral' }
}

const alertTone = {
  danger: { box: 'border-danger/40 bg-danger/10', icon: <XCircle size={16} className="text-danger shrink-0 mt-0.5" /> },
  warning: { box: 'border-warning/40 bg-warning/10', icon: <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" /> },
  success: { box: 'border-success/40 bg-success/10', icon: <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" /> },
  info: { box: 'border-accent/30 bg-accent/10', icon: <Info size={16} className="text-accent-hover shrink-0 mt-0.5" /> },
}

/** Aviso em linha no padrão dos cards de aviso do portal (borda e fundo no tom). */
export function Alert({ tone, children, onClose, role }: { tone: keyof typeof alertTone; children: ReactNode; onClose?: () => void; role?: string }) {
  const t = alertTone[tone]
  return <div role={role} className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm text-text ${t.box}`}>
    {t.icon}<div className="flex-1 min-w-0">{children}</div>
    {onClose && <button type="button" onClick={onClose} aria-label="Fechar mensagem" className="text-text-muted hover:text-text shrink-0"><X size={16} /></button>}
  </div>
}

export function SectionTitle({ icon, children, aside }: { icon?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return <div className="flex items-center justify-between gap-2 mb-3">
    <h3 className="font-display font-semibold text-sm text-text flex items-center gap-2 [&>svg]:text-accent-hover">{icon}{children}</h3>
    {aside}
  </div>
}
