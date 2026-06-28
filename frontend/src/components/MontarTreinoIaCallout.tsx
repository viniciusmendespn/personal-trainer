import { Link } from 'react-router-dom'
import { Bot, Download, Sparkles } from 'lucide-react'
import { Button } from './ui'

/**
 * Callout de destaque que incentiva o personal a montar o treino com IA
 * ("Ensine o ChatGPT a usar o CoachPilot por você"). Reaproveitado no
 * empty-state de treinos do aluno. O CTA leva à página de Pacotes, onde
 * fica o fluxo de geração com IA, e "Baixar prompt" entrega o prompt-cpkg.md.
 */
export function MontarTreinoIaCallout({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-xl border border-accent/30 bg-gradient-to-br from-accent/15 to-accent/5 p-6">
      <div className="flex items-center gap-2 text-accent-hover">
        <Sparkles size={18} className="shrink-0" />
        <h3 className="font-display font-semibold text-base text-text">
          Ensine o ChatGPT a usar o CoachPilot por você
        </h3>
      </div>
      <p className="text-sm text-text-secondary mt-2 max-w-xl">
        Que tal deixar a IA montar o treino inteiro? Você descreve o objetivo, ela gera,
        e o CoachPilot cadastra tudo — sem perder tempo lançando exercício por exercício.
      </p>
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <Link to="/pacotes">
          <Button>
            <span className="flex items-center gap-2"><Bot size={16} /> Montar treino com IA</span>
          </Button>
        </Link>
        <a href="/prompt-cpkg.md" download="prompt-cpkg.md">
          <Button variant="outline">
            <span className="flex items-center gap-2"><Download size={15} /> Baixar prompt</span>
          </Button>
        </a>
      </div>
      {!compact && (
        <p className="text-xs text-text-muted mt-3">
          ou adicione manualmente no botão <span className="text-text-secondary">Adicionar treino</span> acima.
        </p>
      )}
    </div>
  )
}
