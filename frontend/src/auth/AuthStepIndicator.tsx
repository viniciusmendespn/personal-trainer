import { Check } from 'lucide-react'

export function AuthStepIndicator({ labels, currentIndex }: { labels: string[]; currentIndex: number }) {
  return (
    <div className="flex items-start mb-1">
      {labels.map((label, i) => (
        <div key={label} className="flex-1 flex flex-col items-center relative">
          {i > 0 && (
            <div
              className={`absolute top-[14px] right-1/2 left-[-50%] h-0.5 transition-colors ${
                i <= currentIndex ? 'bg-accent' : 'bg-border'
              }`}
            />
          )}
          <div
            className={`z-10 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
              i < currentIndex
                ? 'bg-accent text-white'
                : i === currentIndex
                  ? 'bg-accent text-white shadow-[var(--shadow-glow-accent)] ring-2 ring-accent/30'
                  : 'bg-white/5 border border-border-strong text-text-muted'
            }`}
          >
            {i < currentIndex ? <Check size={13} strokeWidth={2.5} /> : i + 1}
          </div>
          <span className={`mt-1.5 text-[11px] text-center ${i === currentIndex ? 'text-accent-hover font-medium' : 'text-text-muted'}`}>
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}
