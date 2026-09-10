import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Tabs({
  tabs,
  active,
  onChange,
  className = '',
}: {
  tabs: { key: string; label: string; badge?: number }[]
  active: string
  onChange: (key: string) => void
  className?: string
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  // Booleans (não objeto) para que o setState com valor igual não cause re-render.
  const sync = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setCanLeft(el.scrollLeft > 1)
    setCanRight(el.scrollLeft < max - 1)
  }, [])

  // Sem deps: reavalia a cada render (rótulos/badges podem mudar a largura do conteúdo,
  // e ResizeObserver não dispara para mudança de scrollWidth).
  useEffect(sync)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return

    const ro = new ResizeObserver(sync)
    ro.observe(el)
    el.addEventListener('scroll', sync, { passive: true })

    // Roda vertical do mouse/trackpad move as abas na horizontal — no desktop não há
    // swipe e a scrollbar está oculta. Só intercepta se ainda há para onde rolar,
    // senão deixa o scroll passar para a página.
    function onWheel(e: WheelEvent) {
      const node = scrollerRef.current
      if (!node) return
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      const max = node.scrollWidth - node.clientWidth
      const next = Math.min(max, Math.max(0, node.scrollLeft + e.deltaY))
      if (next === node.scrollLeft) return
      node.scrollLeft = next
      e.preventDefault()
    }
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', sync)
      el.removeEventListener('wheel', onWheel)
    }
  }, [sync])

  // Mantém a aba ativa visível (ex.: aba vinda da query string).
  useEffect(() => {
    scrollerRef.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [active])

  function nudge(dir: -1 | 1) {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(120, el.clientWidth * 0.6), behavior: 'smooth' })
  }

  const arrowClass =
    'shrink-0 self-stretch px-0.5 text-text-secondary hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded-t-md'

  return (
    <div className={`flex items-center border-b border-border ${className}`}>
      {canLeft && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={() => nudge(-1)}
          className={arrowClass}
        >
          <ChevronLeft size={16} />
        </button>
      )}

      <div
        ref={scrollerRef}
        role="tablist"
        className="flex gap-1 flex-1 min-w-0 overflow-x-auto"
        style={{ scrollbarWidth: 'none' } as React.CSSProperties}
      >
        {tabs.map((tab) => {
          const isActive = tab.key === active
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.key)}
              className={`relative shrink-0 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded-t-md ${
                isActive ? 'text-text' : 'text-text-secondary hover:text-text'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                {tab.label}
                {!!tab.badge && (
                  <span className="text-[10px] bg-accent text-white rounded-full px-1.5 min-w-4 text-center leading-4">
                    {tab.badge}
                  </span>
                )}
              </span>
              {isActive && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-accent rounded-full" />}
            </button>
          )
        })}
      </div>

      {canRight && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={() => nudge(1)}
          className={arrowClass}
        >
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  )
}
