export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/5 ${className}`} />
}

export function SkeletonLine({ width = 'w-full', className = '' }: { width?: string; className?: string }) {
  return <Skeleton className={`h-3.5 ${width} ${className}`} />
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-surface p-4 space-y-3 ${className}`}>
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <SkeletonLine width="w-1/2" />
          <SkeletonLine width="w-1/3" />
        </div>
      </div>
      <SkeletonLine />
      <SkeletonLine width="w-2/3" />
    </div>
  )
}
