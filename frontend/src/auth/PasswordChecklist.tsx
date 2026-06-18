import { Check, X } from 'lucide-react'
import { PASSWORD_RULES } from './cognitoErrors'

export function PasswordChecklist({ password, show }: { password: string; show: boolean }) {
  if (!show) return null
  return (
    <ul className="mt-1.5 space-y-1">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(password)
        return (
          <li key={r.key} className={`flex items-center gap-1.5 text-xs transition-colors ${ok ? 'text-energy' : 'text-text-muted'}`}>
            {ok ? <Check size={12} strokeWidth={2.5} /> : <X size={12} strokeWidth={2.5} />}
            {r.label}
          </li>
        )
      })}
    </ul>
  )
}
