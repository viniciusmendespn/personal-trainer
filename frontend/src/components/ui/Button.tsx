import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'energy' | 'ghost' | 'outline' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variantStyles: Record<Variant, string> = {
  primary: 'bg-accent hover:bg-accent-hover active:bg-accent-active text-white shadow-[var(--shadow-glow-accent)]',
  energy: 'bg-energy hover:bg-energy-hover text-[#0c1404] font-semibold shadow-[var(--shadow-glow-energy)]',
  ghost: 'bg-white/5 hover:bg-white/10 text-text',
  outline: 'bg-transparent border border-border-strong hover:border-accent text-text-secondary hover:text-text',
  danger: 'bg-danger/90 hover:bg-danger text-white',
}

const sizeStyles: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2',
}

type BaseProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  children?: ReactNode
}

type IconOnlyProps = BaseProps & { iconOnly: true; 'aria-label': string }
type NormalProps = BaseProps & { iconOnly?: false }

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  iconOnly = false,
  className = '',
  ...props
}: IconOnlyProps | NormalProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none ${variantStyles[variant]} ${
        iconOnly ? 'p-2' : sizeStyles[size]
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
