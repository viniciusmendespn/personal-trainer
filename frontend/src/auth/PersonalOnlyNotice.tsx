import { Info } from 'lucide-react'

/**
 * Alunos chegavam aqui achando que precisavam de cadastro para usar o app do aluno —
 * o app não tem cadastro, o acesso é pelo link que o personal envia.
 */
export function PersonalOnlyNotice() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2.5">
      <Info size={16} className="text-accent-hover shrink-0 mt-0.5" />
      <p className="text-xs text-text-secondary">
        Esta conta é para <strong className="text-accent-hover">personal trainers</strong>. Se você é aluno, não
        precisa criar cadastro — <strong className="text-accent-hover">peça o link do app ao seu personal</strong>.
      </p>
    </div>
  )
}
