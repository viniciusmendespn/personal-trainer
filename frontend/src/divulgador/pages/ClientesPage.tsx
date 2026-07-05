import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { divulgadorApi } from '../../api/divulgador'
import { Card } from '../../components/ui'

function dataBr(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('pt-BR')
  } catch {
    return '—'
  }
}

export function ClientesPage() {
  const { data, isLoading } = useQuery({ queryKey: ['div-clientes'], queryFn: divulgadorApi.clientes })

  if (isLoading) return <div className="py-24 text-center text-text-muted text-sm">Carregando…</div>

  const clientes = data || []
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2"><Users size={20} /> Meus indicados</h1>
      {clientes.length === 0 ? (
        <Card className="p-8 text-center text-sm text-text-secondary">
          Nenhuma conta criada com o seu cupom ainda. Compartilhe seu link — quem entrar por ele aparece aqui.
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-muted uppercase tracking-wide">
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3 text-center">Situação</th>
                  <th className="px-4 py-3 text-center">Entrou em</th>
                  <th className="px-4 py-3 text-center">1º pagamento</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3 font-medium">{c.nome}</td>
                    <td className="px-4 py-3 text-center">
                      {c.status === 'ASSINANTE' && c.ativo ? (
                        <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">Assinante ativo</span>
                      ) : c.status === 'ASSINANTE' ? (
                        <span className="rounded-md bg-slate-500/15 px-2 py-0.5 text-[11px] font-semibold text-slate-400">Assinatura vencida</span>
                      ) : (
                        <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-400">Ainda não assinou</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-text-secondary">{dataBr(c.desde)}</td>
                    <td className="px-4 py-3 text-center text-text-secondary">{dataBr(c.primeiro_pgto_em)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <p className="text-[11px] text-text-muted">
        "Assinante ativo" = plano Gestão Pro em dia (gera comissão). Contas que ainda não
        assinaram estão no período gratuito ou nos 30 dias do cupom.
      </p>
    </div>
  )
}
