import { ShieldCheck } from 'lucide-react'

// Rodapé de identificação das páginas públicas de formulário (/@slug e /cadastro).
//
// Existe por dois motivos que apontam para a mesma solução. O primeiro é de confiança: são as
// únicas telas do produto em que alguém que não conhece o CoachPilot digita nome, telefone e —
// no cadastro — dado de saúde, sem login e sem nenhuma marca na tela. Formulário anônimo
// pedindo dado pessoal é indistinguível de phishing, para o visitante e para o classificador do
// Safe Browsing. O segundo é de LGPD: o consentimento do titular precisa dizer quem coleta,
// para quê, e onde está a política — e é o personal que responde como controlador.
//
// Links externos de propósito (`<a>`, não `<Link>`): o componente também roda em bundles que
// não têm as rotas /privacidade e /termos no roteador.
export function RodapeFormPublico({ personalNome, tipo }: { personalNome: string; tipo: 'lead' | 'cadastro' }) {
  const finalidade =
    tipo === 'lead'
      ? `Seus dados vão apenas para ${personalNome} entrar em contato sobre o treino. Não enviamos nada para terceiros e você pode pedir a exclusão a qualquer momento.`
      : `Seus dados vão apenas para ${personalNome} montar e acompanhar o seu treino. Informações de saúde são usadas só para essa finalidade, não são compartilhadas com terceiros nem usadas para treinar modelos de IA, e você pode pedir a exclusão a qualquer momento.`

  return (
    <div className="pt-2 space-y-3 border-t border-border">
      <div className="flex items-start gap-2">
        <ShieldCheck size={15} className="text-accent-hover shrink-0 mt-0.5" />
        <p className="text-xs text-text-muted leading-relaxed">{finalidade}</p>
      </div>
      <p className="text-xs text-text-muted text-center leading-relaxed">
        Formulário hospedado no{' '}
        <a href="/" className="font-semibold text-text-secondary hover:underline">
          CoachPilot
        </a>
        , plataforma de gestão que {personalNome} usa para atender os alunos.
        <br />
        <a href="/privacidade" className="text-accent-hover hover:underline">
          Política de Privacidade
        </a>
        {' · '}
        <a href="/termos" className="text-accent-hover hover:underline">
          Termos de Uso
        </a>
      </p>
    </div>
  )
}
