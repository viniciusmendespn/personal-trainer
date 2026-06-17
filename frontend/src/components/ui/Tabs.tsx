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
  return (
    <div role="tablist" className={`flex flex-wrap gap-1 border-b border-border ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.key === active
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={`relative px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded-t-md ${
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
  )
}
