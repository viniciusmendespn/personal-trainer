export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className={`w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin ${className}`}
    />
  )
}
