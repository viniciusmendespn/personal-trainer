import { createPortal } from 'react-dom'
import { X, Timer, Play, Pause, RotateCcw } from 'lucide-react'
import { useCronometro, fmtCrono } from './cronometroContext'

/**
 * Pílula flutuante do cronômetro (estado minimizado). Renderizada pelo provider sobre todas as
 * telas/abas — continua contando enquanto o aluno registra carga ou navega. Toque no corpo para
 * expandir; botão ▸/❚❚ para iniciar/pausar; ✕ para encerrar. Pausado ou concluído aparece o ↺,
 * que volta ao tempo cheio (e silencia o alarme) sem precisar fechar nem abrir em tela cheia —
 * daí o play repetir o intervalo em um toque.
 */
export function CronometroPill() {
  const { displayMs, running, done, modo, label, expandir, fechar, iniciar, pausar, resetar } = useCronometro()

  const alerta = displayMs <= 5000 && modo === 'regressivo' && running
  const timeColor = done ? 'text-energy' : alerta ? 'text-warning' : 'text-text'

  return createPortal(
    <div
      className="fixed inset-x-0 z-[55] flex justify-center px-4 pointer-events-none"
      style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom) + 0.5rem)' }}
    >
      <div
        className={`pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-surface-elevated/95 backdrop-blur-xl pl-3 pr-2 py-1.5 shadow-lg max-w-full ${
          done ? 'animate-pulse ring-2 ring-energy' : ''
        }`}
      >
        <button
          type="button"
          onClick={expandir}
          className="flex items-center gap-2 min-w-0"
          aria-label="Expandir cronômetro"
        >
          <Timer size={16} className={done ? 'text-energy' : 'text-energy shrink-0'} />
          <span className={`font-display tabular-nums text-lg leading-none shrink-0 ${timeColor}`}>
            {fmtCrono(displayMs)}
          </span>
          {label && <span className="text-xs text-text-muted truncate max-w-[9rem]">{label}</span>}
        </button>
        {!running && (
          <button
            type="button"
            onClick={resetar}
            aria-label="Resetar cronômetro"
            className={`p-1.5 rounded-full hover:bg-white/10 ${
              done ? 'text-energy' : 'text-text-secondary hover:text-text'
            }`}
          >
            <RotateCcw size={18} />
          </button>
        )}
        {!done && (
          <button
            type="button"
            onClick={running ? pausar : iniciar}
            aria-label={running ? 'Pausar' : 'Iniciar'}
            className="p-1.5 rounded-full text-text-secondary hover:bg-white/10 hover:text-text"
          >
            {running ? <Pause size={18} /> : <Play size={18} className="translate-x-0.5" />}
          </button>
        )}
        <button
          type="button"
          onClick={fechar}
          aria-label="Fechar cronômetro"
          className="p-1.5 rounded-full text-text-secondary hover:bg-white/10 hover:text-text"
        >
          <X size={18} />
        </button>
      </div>
    </div>,
    document.body
  )
}
