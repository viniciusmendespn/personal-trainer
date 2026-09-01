import { Link } from 'react-router-dom'
import { Sparkles, ExternalLink, Plug, ListChecks, Upload } from 'lucide-react'
import { useMcpConexoes } from '../hooks/useMcpConexoes'
import { CHATGPT_APP_URL } from '../lib/links'
import { Button } from './ui'

const CHATGPT_URL = 'https://chatgpt.com/'

/**
 * Callout do empty-state de treinos do aluno. A ordem aqui é intencional:
 * o **destaque é o app/plugin** (caminho mais curto — o personal pede na conversa e o
 * treino cai na conta do aluno), e o fluxo de templates/rotinas/import fica como
 * segunda opção, para quem quer reaproveitar treino pronto.
 * O personal continua sendo quem prescreve — a IA só escreve e cadastra.
 *
 * Quem já tem conexão autorizada não vê o passo de instalar (mesma fonte do
 * `ConectarIaBanner`, queryKey compartilhada — não gera chamada extra).
 */
export function MontarTreinoIaCallout({
  compact = false,
  onAplicarRotina,
  alunoNome,
}: {
  compact?: boolean
  onAplicarRotina?: () => void
  alunoNome?: string
}) {
  // Exemplo de programa inteiro (não de um treino só): é o que o app faz de uma vez,
  // e é o que economiza mais tempo na primeira montagem.
  // "de {Nome}" evita chutar gênero pela terminação do nome.
  const primeiroNome = alunoNome?.trim().split(/\s+/)[0]
  const exemplo = `Monte o programa de ${primeiroNome || 'Marina'}: ABCDE, 5x por semana, `
    + 'hipertrofia com ênfase em inferiores, respeitando a anamnese.'

  const { data: conexoes } = useMcpConexoes()
  const conectado = !!conexoes && conexoes.items.length > 0

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-accent/30 bg-gradient-to-br from-accent/15 to-accent/5 p-6">
        <div className="flex items-center gap-2 text-accent-hover">
          <Sparkles size={18} className="shrink-0" />
          <h3 className="font-display font-semibold text-base text-text">
            Peça o treino direto no ChatGPT
          </h3>
          <span className="text-[11px] font-medium uppercase tracking-wide rounded-full bg-accent/20 px-2 py-0.5">
            mais rápido
          </span>
        </div>
        <p className="text-sm text-text-secondary mt-2 max-w-xl">
          Você é o profissional e sabe o que prescrever. {conectado ? 'Seu ChatGPT já está conectado' : 'Com o app instalado'}, você
          descreve o programa na conversa — a semana inteira de uma vez — e ele já entra na conta do
          aluno. A IA só escreve e cadastra, sem baixar prompt nem colar arquivo.
        </p>

        <ol className="mt-4 space-y-2">
          {[
            conectado ? (
              <>Abra o ChatGPT — o app do CoachPilot já está conectado à sua conta.</>
            ) : (
              <>Instale o app no ChatGPT e autorize com a sua conta CoachPilot.</>
            ),
            <>
              Diga o que quer prescrever — ex.:{' '}
              <span className="text-text-secondary italic">“{exemplo}”</span>
            </>,
            <>Confira o que ele montou e mande cadastrar. O programa inteiro aparece aqui na hora.</>,
          ].map((txt, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <span className="flex items-center justify-center shrink-0 w-5 h-5 rounded-full bg-accent/20 text-accent-hover text-[11px] font-semibold">
                {i + 1}
              </span>
              <span className="text-text-secondary">{txt}</span>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <a href={conectado ? CHATGPT_URL : CHATGPT_APP_URL} target="_blank" rel="noopener noreferrer">
            <Button>
              <span className="flex items-center gap-2">
                <ExternalLink size={16} /> {conectado ? 'Abrir o ChatGPT' : 'Instalar o app no ChatGPT'}
              </span>
            </Button>
          </a>
          <Link to="/config?tab=conexoes">
            <Button variant="ghost">
              <span className="flex items-center gap-2">
                <Plug size={16} /> {conectado ? 'Gerenciar conexões' : 'Conectar Claude ou Gemini'}
              </span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface-secondary/40 p-5">
        <h4 className="font-display font-semibold text-sm text-text">
          Crie templates e rotinas reutilizáveis
        </h4>
        <p className="text-sm text-text-secondary mt-1 max-w-xl">
          Monte o treino uma vez e aplique em qualquer aluno com 1 clique. Dá também para gerar o
          treino com IA em outra conversa e importar tudo de uma vez.
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {onAplicarRotina ? (
            <Button variant="outline" size="sm" onClick={onAplicarRotina}>
              <span className="flex items-center gap-2"><ListChecks size={16} /> Aplicar rotina pronta</span>
            </Button>
          ) : (
            <Link to="/rotinas">
              <Button variant="outline" size="sm">
                <span className="flex items-center gap-2"><ListChecks size={16} /> Aplicar rotina pronta</span>
              </Button>
            </Link>
          )}
          <Link to="/pacotes">
            <Button variant="ghost" size="sm">
              <span className="flex items-center gap-2"><Upload size={16} /> Importar treino de IA</span>
            </Button>
          </Link>
        </div>
      </div>

      {!compact && (
        <p className="text-xs text-text-muted">
          ou adicione manualmente no botão <span className="text-text-secondary">Adicionar treino</span> acima.
        </p>
      )}
    </div>
  )
}
