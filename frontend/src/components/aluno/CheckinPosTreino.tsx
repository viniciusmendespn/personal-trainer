import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Camera, Loader2, Trophy, Dumbbell, Clock, PartyPopper } from 'lucide-react'
import { Modal, Button, useToast } from '../ui'
import { enviarCheckin, type SessaoFinalizada } from '../../api/alunoApp'
import { MediaValidationError } from '../../utils/media'

function formatDuracao(s?: number): string | null {
  if (!s) return null
  const m = Math.floor(s / 60)
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}min`
  if (m > 0) return `${m}min`
  return `${s}s`
}

function formatVolume(v?: number): string | null {
  if (!v || v <= 0) return null
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace('.', ',')} t`
  return `${Math.round(v)} kg`
}

/** Tela de comemoração ao finalizar o treino: mostra os destaques do dia e convida o aluno a
 * registrar uma foto de check-in (tirada na hora pela câmera) — combustível pro engajamento. */
export function CheckinPosTreino({ sessao, onClose }: { sessao: SessaoFinalizada; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)

  const duracao = formatDuracao(sessao.duracao_segundos)
  const volume = formatVolume(sessao.volume_total)
  const prs = sessao.novos_prs ?? []

  async function handleFile(file: File) {
    setUploading(true)
    try {
      await enviarCheckin(sessao.sessao_id, file)
      qc.invalidateQueries({ queryKey: ['aluno-sessoes'] })
      qc.invalidateQueries({ queryKey: ['aluno-historico-mes'] })
      setDone(true)
      toast.show('Check-in registrado! 📸', 'success')
      setTimeout(onClose, 900)
    } catch (err) {
      const msg = err instanceof MediaValidationError ? err.message : 'Não consegui enviar a foto. Tenta de novo.'
      toast.show(msg, 'error')
    } finally {
      setUploading(false)
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) handleFile(file)
  }

  return (
    <Modal open onClose={onClose} title="">
      <div className="space-y-5 text-center">
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-energy/15 text-energy">
            <PartyPopper size={28} />
          </div>
          <h2 className="font-display text-lg font-semibold">Treino concluído! 💪</h2>
          <p className="text-sm text-text-muted">{sessao.treino_nome}</p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {duracao && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-surface-elevated border border-border px-2.5 py-1.5 text-sm">
              <Clock size={14} className="text-info" /> {duracao}
            </span>
          )}
          {volume && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-surface-elevated border border-border px-2.5 py-1.5 text-sm">
              <Dumbbell size={14} className="text-accent" /> {volume}
            </span>
          )}
          {prs.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-warning/10 border border-warning/30 text-warning px-2.5 py-1.5 text-sm font-medium">
              <Trophy size={14} /> {prs.length} novo{prs.length > 1 ? 's' : ''} PR{prs.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {prs.length > 0 && (
          <ul className="text-left text-xs text-text-secondary space-y-0.5 max-w-xs mx-auto">
            {prs.slice(0, 4).map((pr, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <Trophy size={11} className="text-warning shrink-0" />
                <span className="truncate">{pr.exercicio_nome}</span>
                <span className="ml-auto font-medium text-text">{pr.carga}{pr.tipo === 'PESO_CORPORAL' ? ' reps' : pr.tipo === 'CARDIO' ? '' : ' kg'}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="pt-1 space-y-2">
          <p className="text-sm text-text-secondary">Registre seu check-in de hoje pra acompanhar sua evolução e mostrar no seu histórico.</p>
          <Button
            variant="energy"
            className="w-full"
            disabled={uploading || done}
            onClick={() => inputRef.current?.click()}
          >
            <span className="flex items-center justify-center gap-1.5">
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
              {uploading ? 'Enviando…' : done ? 'Enviado!' : 'Tirar foto do check-in'}
            </span>
          </Button>
          <button
            className="w-full text-sm text-text-muted hover:text-text transition-colors py-1"
            onClick={onClose}
            disabled={uploading}
          >
            Agora não
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onChange}
          disabled={uploading}
        />
      </div>
    </Modal>
  )
}
