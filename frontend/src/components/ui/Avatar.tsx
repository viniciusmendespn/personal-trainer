import { useState } from 'react'

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const sizeStyles = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
}

export function Avatar({
  name,
  imageUrl,
  size = 'md',
  className = '',
}: {
  name: string
  imageUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const [imgError, setImgError] = useState(false)
  const showImage = imageUrl && !imgError

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-accent/15 text-accent-hover font-display font-semibold shrink-0 overflow-hidden ${sizeStyles[size]} ${className}`}
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        initials(name)
      )}
    </div>
  )
}
