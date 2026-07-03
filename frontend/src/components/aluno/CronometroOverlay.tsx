import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Play, Pause, RotateCcw, ChevronDown, PictureInPicture2 } from 'lucide-react'
import { DurationInput } from '../ui/DurationInput'
import { useCronometro, fmtCrono } from './cronometroContext'

/**
 * Cronômetro em tela cheia do app do aluno (apresentacional — o relógio vive no
 * CronometroProvider, então continua contando ao minimizar/navegar). Dois modos: regressivo
 * (intervalo de descanso, padrão) e progressivo (conta pra cima). Botões de minimizar (mantém
 * rodando na pílula) e Picture-in-Picture (onde houver suporte) no topo.
 */
export function CronometroOverlay() {
  const {
    modo,
    running,
    done,
    displayMs,
    label,
    runTotalMs,
    minimizar,
    fechar,
    iniciar,
    pausar,
    resetar,
    dismiss,
    addSeconds,
    trocarModo,
    setDisplaySeconds,
    pipSupported,
    pipActive,
    togglePiP,
  } = useCronometro()

  const [flashOn, setFlashOn] = useState(false)

  // Flash sólido enquanto "concluído".
  useEffect(() => {
    if (!done) {
      setFlashOn(false)
      return
    }
    const id = setInterval(() => setFlashOn((f) => !f), 450)
    return () => clearInterval(id)
  }, [done])

  const tabCls = (m: typeof modo) =>
    `px-4 py-1.5 text-sm transition-colors ${
      modo === m ? 'bg-accent/15 text-accent-hover font-medium' : 'text-text-muted hover:text-text'
    }`

  const alerta = displayMs <= 5000 && modo === 'regressivo' && running
  const idle = !running && !done

  const isLight = document.documentElement.dataset.theme === 'light'
  const bgClass = done
    ? (flashOn ? (isLight ? 'bg-border-strong' : 'bg-surface-elevated') : 'bg-bg')
    : 'bg-bg'

  const RING_C = 2 * Math.PI * 45
  let progress: number
  if (modo === 'regressivo') {
    progress = done ? 0 : running ? (runTotalMs > 0 ? displayMs / runTotalMs : 0) : 1
  } else {
    progress = ((displayMs / 1000) % 60) / 60
  }
  progress = Math.max(0, Math.min(1, progress))
  const ringColor = alerta ? 'stroke-warning' : modo === 'regressivo' ? 'stroke-energy' : 'stroke-accent'

  const androidStandalone =
    /Android/i.test(navigator.userAgent) && window.matchMedia('(display-mode: standalone)').matches

  return createPortal(
    <div
      className={`fixed inset-0 z-[60] flex flex-col transition-colors duration-100 ${bgClass}`}
      style={{
        paddingTop: androidStandalone ? 'max(env(safe-area-inset-top), 24px)' : 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
      onClick={done ? dismiss : undefined}
    >
      <div className="flex items-center justify-between p-4">
        {done ? (
          <div />
        ) : (
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            <button type="button" onClick={() => trocarModo('regressivo')} className={tabCls('regressivo')}>
              Intervalo
            </button>
            <button type="button" onClick={() => trocarModo('progressivo')} className={tabCls('progressivo')}>
              Cronômetro
            </button>
          </div>
        )}
        <div className="flex items-center gap-1">
          {pipSupported && !done && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                togglePiP()
              }}
              aria-label="Janela flutuante (Picture-in-Picture)"
              className={`p-2 rounded-lg hover:bg-white/10 hover:text-text ${pipActive ? 'text-energy' : 'text-text-secondary'}`}
            >
              <PictureInPicture2 size={24} />
            </button>
          )}
          {!done && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                minimizar()
              }}
              aria-label="Minimizar cronômetro"
              className="p-2 rounded-lg text-text-secondary hover:bg-white/10 hover:text-text"
            >
              <ChevronDown size={26} />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              fechar()
            }}
            aria-label="Fechar cronômetro"
            className="p-2 rounded-lg text-text-secondary hover:bg-white/10 hover:text-text"
          >
            <X size={26} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 min-h-0">
        {label && (
          <p className="text-lg sm:text-2xl mb-3 text-center max-w-full truncate text-text-secondary">{label}</p>
        )}

        <div className="relative flex items-center justify-center w-[82vw] h-[82vw] max-w-[26rem] max-h-[26rem]">
          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="45" fill="none" strokeWidth="2.5" className="stroke-white/10" />
            {!done && (
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                strokeWidth="2.5"
                strokeLinecap="round"
                className={`transition-[stroke-dashoffset] duration-200 ease-linear ${ringColor}`}
                style={{ strokeDasharray: RING_C, strokeDashoffset: RING_C * (1 - progress) }}
              />
            )}
          </svg>

          <div
            className="relative flex flex-col items-center justify-center"
            onClick={done ? undefined : (e) => e.stopPropagation()}
          >
            {done ? (
              <span className="font-display tabular-nums leading-none text-[15vw] sm:text-[7rem] text-text">00:00</span>
            ) : running ? (
              <span
                className={`font-display tabular-nums leading-none text-[15vw] sm:text-[7rem] transition-colors ${
                  alerta ? 'text-warning' : 'text-text'
                }`}
              >
                {fmtCrono(displayMs)}
              </span>
            ) : modo === 'regressivo' ? (
              <DurationInput
                value={Math.round(displayMs / 1000)}
                onChange={(s) => setDisplaySeconds(s ?? 0)}
                placeholder="0:00"
                ariaLabel="Tempo do cronômetro"
                inputClassName="w-[70vw] max-w-[20rem] bg-transparent text-center font-display tabular-nums leading-none text-[15vw] sm:text-[7rem] text-text caret-energy focus:outline-none"
              />
            ) : (
              <span className="font-display tabular-nums leading-none text-[15vw] sm:text-[7rem] text-text">00:00</span>
            )}
          </div>
        </div>

        {done && <p className="mt-6 text-energy font-display text-3xl sm:text-5xl font-bold">Intervalo concluído!</p>}
        {idle && modo === 'regressivo' && (
          <p className="mt-4 text-text-muted text-sm">Toque no tempo para digitar (m:ss) ou use os botões</p>
        )}
      </div>

      {idle && modo === 'regressivo' && (
        <div className="flex items-center justify-center gap-2 px-4 pb-2">
          {[10, 30, 60].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addSeconds(s)}
              className="px-4 py-2 rounded-full border border-border text-text-secondary hover:border-accent hover:text-text text-sm"
            >
              +{s < 60 ? `${s}s` : '1min'}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-center gap-4 p-6 pb-10">
        {done ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              dismiss()
            }}
            className="px-12 py-4 rounded-full bg-energy text-[#0c1404] font-display text-xl font-bold shadow-[var(--shadow-glow-energy)]"
          >
            Parar
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={resetar}
              aria-label="Resetar"
              className="p-4 rounded-full bg-white/5 text-text-secondary hover:bg-white/10 hover:text-text"
            >
              <RotateCcw size={28} />
            </button>
            <button
              type="button"
              onClick={running ? pausar : iniciar}
              aria-label={running ? 'Pausar' : 'Iniciar'}
              className="p-6 rounded-full bg-energy text-[#0c1404] shadow-[var(--shadow-glow-energy)] hover:bg-energy-hover transition-colors"
            >
              {running ? <Pause size={40} /> : <Play size={40} className="translate-x-0.5" />}
            </button>
            {/* espaçador para manter o botão de play centralizado */}
            <div className="w-[60px]" aria-hidden="true" />
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
