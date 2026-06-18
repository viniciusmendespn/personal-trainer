import { useState } from 'react'
import { Info, X } from 'lucide-react'

const REGRAS = [
  { atividade: 'Registrar uma série', pts: 1, obs: 'Por série salva' },
  { atividade: 'Concluir uma sessão de treino', pts: 8, obs: '' },
  { atividade: 'Sessão 100% concluída (bônus)', pts: 7, obs: 'Somado à sessão: total 15' },
  { atividade: 'Bater recorde pessoal (PR)', pts: 10, obs: 'Novo peso máximo registrado' },
  { atividade: 'Publicar no feed', pts: 3, obs: '' },
  { atividade: 'Comentar no feed', pts: 2, obs: '' },
  { atividade: 'Curtir uma publicação', pts: 1, obs: '' },
]

export function RankingRulesInfo() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-1 text-text-muted hover:text-text transition-colors"
        aria-label="Como ganhar pontos"
      >
        <Info size={16} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-sm mx-4 bg-surface-elevated border border-border rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-text">Como ganhar pontos</h3>
              <button onClick={() => setOpen(false)} className="p-1 text-text-muted hover:text-text">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2">
              {REGRAS.map((r) => (
                <div key={r.atividade} className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary leading-tight">{r.atividade}</p>
                    {r.obs && <p className="text-xs text-text-muted">{r.obs}</p>}
                  </div>
                  <span className="shrink-0 text-sm font-bold text-energy">+{r.pts}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-text-muted text-center">
              Pontos acumulam e nunca expiram
            </p>
          </div>
        </div>
      )}
    </>
  )
}
