import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, ExternalLink, X } from 'lucide-react'
import { useMcpConexoes } from '../hooks/useMcpConexoes'
import { CHATGPT_APP_URL } from '../lib/links'
import { Button } from './ui'

const DISMISS_KEY = 'cp_aviso_conexao_ia_oculto'

/**
 * Aviso para quem ainda não conectou nenhuma IA. Some sozinho quando existe
 * conexão autorizada, e o "Agora não" é lembrado no localStorage (só neste
 * navegador — é conveniência, não estado de conta).
 *
 * Quem chama (AlunosPage) só monta o banner depois do primeiro aluno cadastrado:
 * o MCP não cadastra aluno, então na carteira vazia o convite só atrapalharia.
 */
export function ConectarIaBanner() {
  const { data, isLoading } = useMcpConexoes()
  const [oculto, setOculto] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
  })

  // Não pisca durante o carregamento e desaparece assim que existe conexão.
  if (isLoading || oculto || !data || data.items.length > 0) return null

  function dispensar() {
    setOculto(true)
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* modo privado: só não lembra */ }
  }

  return (
    <div className="relative mb-5 rounded-xl border border-accent/30 bg-gradient-to-br from-accent/15 to-accent/5 p-4 pr-10">
      <button
        onClick={dispensar}
        aria-label="Dispensar aviso"
        className="absolute top-2.5 right-2.5 p-1 rounded-lg text-text-muted hover:text-text hover:bg-white/10 transition-colors"
      >
        <X size={15} />
      </button>

      <div className="flex items-start gap-3">
        <Sparkles size={18} className="text-accent-hover shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-display font-semibold text-text text-sm">
            Pergunte sobre seus alunos direto no ChatGPT
          </p>
          <p className="text-sm text-text-secondary mt-1 max-w-2xl">
            Conecte a IA que você já usa e consulte a carteira conversando: <em>“quem não treina
            há mais de 10 dias?”</em>, <em>“resumo da Júlia antes da sessão”</em>. Com a escrita
            liberada, ela também monta e aplica treino. Grátis nos dois planos.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <a href={CHATGPT_APP_URL} target="_blank" rel="noopener noreferrer">
              <Button size="sm">
                <span className="flex items-center gap-2">
                  <ExternalLink size={14} /> Instalar no ChatGPT
                </span>
              </Button>
            </a>
            <Link
              to="/config?tab=conexoes"
              className="text-xs text-text-secondary hover:text-text underline"
            >
              Configurações → Conexões (Claude, Gemini e permissões)
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
