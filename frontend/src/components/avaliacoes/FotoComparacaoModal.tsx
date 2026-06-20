import { useState, useMemo } from 'react'
import { ArrowLeftRight, ChevronLeft } from 'lucide-react'
import { Modal } from '../ui'
import type { Avaliacao } from '../../types'

type Step = 'selA' | 'fotoA' | 'selB' | 'fotoB' | 'comparar'

function fmtData(a: Avaliacao) {
  return new Date(a.data ?? a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function FotoComparacaoModal({
  open,
  onClose,
  avaliacoes,
}: {
  open: boolean
  onClose: () => void
  avaliacoes: Avaliacao[]
}) {
  const avComFoto = useMemo(
    () => [...avaliacoes]
      .filter((a) => a.fotos_urls && a.fotos_urls.length > 0)
      .sort((a, b) => (a.data ?? a.created_at).localeCompare(b.data ?? b.created_at)),
    [avaliacoes]
  )

  const [step, setStep] = useState<Step>('selA')
  const [avA, setAvA] = useState<Avaliacao | null>(null)
  const [fotoA, setFotoA] = useState<string | null>(null)
  const [avB, setAvB] = useState<Avaliacao | null>(null)
  const [fotoB, setFotoB] = useState<string | null>(null)

  function reset() {
    setStep('selA')
    setAvA(null)
    setFotoA(null)
    setAvB(null)
    setFotoB(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function trocar() {
    const tmpAv = avA
    const tmpFoto = fotoA
    setAvA(avB)
    setFotoA(fotoB)
    setAvB(tmpAv)
    setFotoB(tmpFoto)
  }

  if (!open) return null

  return (
    <Modal open={open} onClose={handleClose} title="Comparar fotos" size="xl">
      {avComFoto.length < 2 ? (
        <p className="text-text-secondary text-sm">São necessárias pelo menos 2 avaliações com fotos para comparar.</p>
      ) : step === 'selA' ? (
        <SelecaoAvaliacao
          titulo="Selecione a avaliação mais antiga (Antes)"
          avaliacoes={avComFoto}
          excluir={avB?.avaliacao_id}
          onSelect={(av) => { setAvA(av); setStep('fotoA') }}
        />
      ) : step === 'fotoA' && avA ? (
        <SelecaoFoto
          avaliacao={avA}
          onBack={() => setStep('selA')}
          onSelect={(url) => { setFotoA(url); setStep('selB') }}
        />
      ) : step === 'selB' ? (
        <SelecaoAvaliacao
          titulo="Selecione a avaliação mais recente (Depois)"
          avaliacoes={avComFoto}
          excluir={avA?.avaliacao_id}
          onSelect={(av) => { setAvB(av); setStep('fotoB') }}
          onBack={() => setStep('fotoA')}
        />
      ) : step === 'fotoB' && avB ? (
        <SelecaoFoto
          avaliacao={avB}
          onBack={() => setStep('selB')}
          onSelect={(url) => { setFotoB(url); setStep('comparar') }}
        />
      ) : step === 'comparar' && avA && avB && fotoA && fotoB ? (
        <ComparacaoView
          avA={avA} fotoA={fotoA}
          avB={avB} fotoB={fotoB}
          onTrocar={trocar}
          onReiniciar={reset}
        />
      ) : null}
    </Modal>
  )
}

function SelecaoAvaliacao({
  titulo,
  avaliacoes,
  excluir,
  onSelect,
  onBack,
}: {
  titulo: string
  avaliacoes: Avaliacao[]
  excluir?: string
  onSelect: (av: Avaliacao) => void
  onBack?: () => void
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary font-medium">{titulo}</p>
      <div className="grid gap-2">
        {avaliacoes.map((av) => {
          const disabled = av.avaliacao_id === excluir
          const thumb = av.fotos_urls?.[0]
          return (
            <button
              key={av.avaliacao_id}
              disabled={disabled}
              onClick={() => !disabled && onSelect(av)}
              className={`flex items-center gap-3 p-3 rounded-xl border text-left transition
                ${disabled
                  ? 'opacity-40 cursor-not-allowed border-border bg-surface'
                  : 'border-border hover:border-primary hover:bg-primary/5 cursor-pointer bg-surface'}`}
            >
              {thumb
                ? <img src={thumb} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                : <div className="w-12 h-12 rounded-lg bg-surface-elevated flex-shrink-0" />}
              <div>
                <p className="font-medium text-sm">{fmtData(av)}</p>
                {av.peso && <p className="text-xs text-text-secondary">{av.peso} kg{av.percentual_gordura ? ` · ${av.percentual_gordura}% gordura` : ''}</p>}
                <p className="text-xs text-text-secondary">{av.fotos_urls?.length ?? 0} foto(s)</p>
              </div>
            </button>
          )
        })}
      </div>
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-text-secondary hover:text-text mt-2">
          <ChevronLeft size={16} /> Voltar
        </button>
      )}
    </div>
  )
}

function SelecaoFoto({
  avaliacao,
  onBack,
  onSelect,
}: {
  avaliacao: Avaliacao
  onBack: () => void
  onSelect: (url: string) => void
}) {
  const fotos = avaliacao.fotos_urls ?? []
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary font-medium">
        Selecione uma foto — {fmtData(avaliacao)}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {fotos.map((url, i) => (
          <button
            key={i}
            onClick={() => onSelect(url)}
            className="aspect-square rounded-xl overflow-hidden border border-border hover:border-primary hover:ring-2 hover:ring-primary/30 transition"
          >
            <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-text-secondary hover:text-text">
        <ChevronLeft size={16} /> Voltar
      </button>
    </div>
  )
}

function ComparacaoView({
  avA, fotoA, avB, fotoB, onTrocar, onReiniciar,
}: {
  avA: Avaliacao; fotoA: string
  avB: Avaliacao; fotoB: string
  onTrocar: () => void
  onReiniciar: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <FotoCard label="Antes" avaliacao={avA} fotoUrl={fotoA} />
        <FotoCard label="Depois" avaliacao={avB} fotoUrl={fotoB} />
      </div>
      <div className="flex items-center justify-center gap-3 pt-1">
        <button
          onClick={onTrocar}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text px-3 py-1.5 rounded-lg border border-border hover:border-border-strong transition"
        >
          <ArrowLeftRight size={14} /> Inverter
        </button>
        <button
          onClick={onReiniciar}
          className="text-sm text-text-secondary hover:text-text px-3 py-1.5 rounded-lg border border-border hover:border-border-strong transition"
        >
          Nova comparação
        </button>
      </div>
    </div>
  )
}

function FotoCard({ label, avaliacao, fotoUrl }: { label: string; avaliacao: Avaliacao; fotoUrl: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</span>
        <span className="text-xs text-text-secondary">{fmtData(avaliacao)}</span>
      </div>
      <div className="rounded-xl overflow-hidden border border-border aspect-[3/4]">
        <img src={fotoUrl} alt={label} className="w-full h-full object-cover" />
      </div>
      {avaliacao.peso && (
        <p className="text-xs text-center text-text-secondary">
          {avaliacao.peso} kg{avaliacao.percentual_gordura ? ` · ${avaliacao.percentual_gordura}%` : ''}
        </p>
      )}
    </div>
  )
}
