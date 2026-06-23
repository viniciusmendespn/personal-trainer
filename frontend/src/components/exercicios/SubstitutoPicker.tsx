import { useState } from 'react'
import { Plus, Repeat, X as XIcon } from 'lucide-react'
import { Button, Input, Tabs, Textarea } from '../ui'
import type { ExercicioSubstituto } from '../../types'

interface ExercicioOpcao {
  nome: string
  grupo?: string
  video_url?: string
}

interface Props {
  biblioteca: ExercicioOpcao[]
  exercicioAtual: string
  jaAdicionados: string[] // nomes (lowercase) já presentes na lista efetiva
  onAdd: (item: ExercicioSubstituto) => void
}

export function SubstitutoPicker({ biblioteca, exercicioAtual, jaAdicionados, onAdd }: Props) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'biblioteca' | 'custom'>('biblioteca')
  const [search, setSearch] = useState('')
  const [cNome, setCNome] = useState('')
  const [cVideo, setCVideo] = useState('')
  const [cObs, setCObs] = useState('')

  const atualLower = exercicioAtual.trim().toLowerCase()
  const excluidos = new Set([atualLower, ...jaAdicionados])

  function filtra(lista: ExercicioOpcao[]) {
    return lista.filter(
      (o) =>
        !excluidos.has(o.nome.trim().toLowerCase()) &&
        (search.trim() === '' || o.nome.toLowerCase().includes(search.trim().toLowerCase())),
    )
  }

  function escolher(o: ExercicioOpcao) {
    onAdd({ nome: o.nome, video_url: o.video_url || undefined })
    fechar()
  }

  function adicionarCustom() {
    if (!cNome.trim()) return
    onAdd({ nome: cNome.trim(), video_url: cVideo.trim() || undefined, observacao: cObs.trim() || undefined })
    fechar()
  }

  function fechar() {
    setOpen(false)
    setSearch('')
    setCNome('')
    setCVideo('')
    setCObs('')
    setTab('biblioteca')
  }

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <span className="flex items-center gap-1"><Plus size={14} /> Adicionar substituto</span>
      </Button>
    )
  }

  const tabs = [
    { key: 'biblioteca', label: 'Da biblioteca' },
    { key: 'custom', label: 'Personalizado' },
  ]

  return (
    <div className="border border-border rounded-xl p-2 space-y-2">
      <div className="flex items-center justify-between">
        <Tabs tabs={tabs} active={tab} onChange={(k) => setTab(k as typeof tab)} />
        <Button type="button" variant="ghost" size="sm" iconOnly aria-label="Fechar" onClick={fechar}>
          <XIcon size={14} />
        </Button>
      </div>

      {tab !== 'custom' && (
        <>
          <Input
            placeholder="Buscar exercício…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs"
            autoFocus
          />
          <div className="max-h-40 overflow-y-auto space-y-1">
            {filtra(biblioteca).map((o) => (
              <button
                key={o.nome}
                type="button"
                onClick={() => escolher(o)}
                className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-surface-elevated transition-colors flex items-center gap-2"
              >
                <Repeat size={10} className="shrink-0 text-accent" />
                {o.nome}
              </button>
            ))}
            {filtra(biblioteca).length === 0 && (
              <p className="text-xs text-text-muted px-2 py-1.5">Nenhum exercício encontrado.</p>
            )}
          </div>
        </>
      )}

      {tab === 'custom' && (
        <div className="space-y-2">
          <Input placeholder="Nome do exercício substituto" value={cNome} onChange={(e) => setCNome(e.target.value)} autoFocus />
          <Input placeholder="Vídeo (URL, opcional)" value={cVideo} onChange={(e) => setCVideo(e.target.value)} />
          <Textarea placeholder="Observação (opcional)" rows={2} value={cObs} onChange={(e) => setCObs(e.target.value)} />
          <Button type="button" size="sm" onClick={adicionarCustom} disabled={!cNome.trim()}>
            Adicionar
          </Button>
        </div>
      )}
    </div>
  )
}
