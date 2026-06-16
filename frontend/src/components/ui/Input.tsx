import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

const fieldBase =
  'w-full px-3 py-2 rounded-lg bg-surface border border-border text-text placeholder-text-muted transition-colors focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-50'

function FieldLabel({ label, required }: { label?: string; required?: boolean }) {
  if (!label) return null
  return (
    <span className="block text-xs font-medium text-text-secondary mb-1">
      {label}
      {required && <span className="text-danger ml-0.5">*</span>}
    </span>
  )
}

export function Input({
  label,
  required,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="block">
      <FieldLabel label={label} required={required} />
      <input required={required} className={`${fieldBase} ${className}`} {...props} />
    </label>
  )
}

export function Textarea({
  label,
  required,
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block">
      <FieldLabel label={label} required={required} />
      <textarea required={required} className={`${fieldBase} min-h-24 resize-y ${className}`} {...props} />
    </label>
  )
}

export function Select({
  label,
  required,
  children,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block">
      <FieldLabel label={label} required={required} />
      <select required={required} className={`${fieldBase} ${className}`} {...props}>
        {children}
      </select>
    </label>
  )
}
