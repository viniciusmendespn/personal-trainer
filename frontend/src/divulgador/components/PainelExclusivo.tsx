import { Rocket } from 'lucide-react'

export function PainelExclusivo() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <Rocket size={40} className="mx-auto text-accent mb-4" />
      <h1 className="text-xl font-bold mb-2">Painel exclusivo do programa</h1>
      <p className="text-sm text-text-secondary mb-6">
        Este painel é exclusivo para divulgadores do programa CoachPilot — comissão recorrente
        sobre cada assinatura Gestão Pro indicada. A entrada é feita pela nossa equipe.
      </p>
      <a
        href="https://wa.me/5513991830305?text=Oi%2C%20quero%20entrar%20no%20programa%20de%20divulgadores%20do%20CoachPilot"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
      >
        Tenho interesse, quero entrar em contato
      </a>
      <p className="text-xs text-text-muted mt-4">
        <a href="https://coachpilot.com.br/divulgadores" className="hover:underline">Conheça as regras do programa</a>
      </p>
    </div>
  )
}
