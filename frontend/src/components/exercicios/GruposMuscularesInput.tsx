import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { normalizeText } from '../../utils/normalizeText'

const fieldBase =
  'w-full px-3 py-2 rounded-lg bg-surface border border-border text-text placeholder-text-muted transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30'

/**
 * Grupos musculares de um exercício, como chips.
 *
 * Um exercício atinge mais de um grupo (supino = peito + tríceps), e enquanto o campo era uma
 * string só o gráfico de volume contava "Peito, Tríceps" como um grupo próprio, separado de
 * "Peito". As sugestões trazem o vocabulário canônico + o que o personal já usa, mas o campo
 * aceita Enter com texto novo: quem trabalha com "Adutores" ou "Oblíquos" não pode ficar de fora.
 */
export function GruposMuscularesInput({ value, onChange, suggestions, label = 'Grupos musculares' }: {
  value: string[]
  onChange: (grupos: string[]) => void
  /** Vocabulário + grupos já usados — ver `sugestoesDeGrupo` em `utils/grupos.ts`. */
  suggestions: string[]
  label?: string
}) {
  const [texto, setTexto] = useState('')
  const [aberto, setAberto] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const jaEscolhido = (s: string) => value.some((g) => normalizeText(g) === normalizeText(s))
  const filtradas = suggestions.filter(
    (s) => !jaEscolhido(s) && normalizeText(s).includes(normalizeText(texto)),
  )

  function adicionar(bruto: string) {
    const nome = bruto.trim()
    setTexto('')
    if (!nome || jaEscolhido(nome)) return
    onChange([...value, nome])
  }

  function remover(alvo: string) {
    onChange(value.filter((g) => g !== alvo))
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      // Enter aqui não pode submeter o formulário em volta — é "adicionar chip".
      e.preventDefault()
      adicionar(texto)
      return
    }
    if (e.key === 'Backspace' && !texto && value.length) {
      remover(value[value.length - 1])
    }
  }

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  return (
    <div ref={containerRef} className="relative block">
      <span className="block text-xs font-medium text-text-secondary mb-1">{label}</span>
      <div className={`${fieldBase} flex flex-wrap items-center gap-1.5`}>
        {value.map((g) => (
          <span
            key={g}
            className="inline-flex items-center gap-1 rounded-md bg-accent/15 border border-accent/30 pl-2 pr-1 py-0.5 text-xs text-accent"
          >
            {g}
            <button
              type="button"
              onClick={() => remover(g)}
              aria-label={`Remover ${g}`}
              className="text-accent/70 hover:text-accent transition-colors"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          value={texto}
          onChange={(e) => { setTexto(e.target.value); setAberto(true) }}
          onFocus={() => setAberto(true)}
          onKeyDown={onKeyDown}
          onBlur={() => adicionar(texto)}
          placeholder={value.length ? '' : 'Peito, Tríceps…'}
          autoComplete="off"
          className="flex-1 min-w-24 bg-transparent text-text placeholder-text-muted focus:outline-none"
        />
      </div>
      {aberto && filtradas.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-lg bg-surface-elevated border border-border shadow-lg">
          {filtradas.map((s) => (
            <li
              key={s}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => adicionar(s)}
              className="px-3 py-2 text-sm text-text cursor-pointer hover:bg-surface-hover"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
