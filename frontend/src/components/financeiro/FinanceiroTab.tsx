import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Settings, DollarSign } from 'lucide-react'
import { financeiroApi } from '../../api/financeiro'
import type { Cobranca, CobrancaStatus } from '../../types'
import { Button, Card, EmptyState, Spinner, Tabs, useToast, useConfirm } from '../ui'
import { CobrancaCard } from './CobrancaCard'
import { CobrancaConfigModal } from './CobrancaConfigModal'
import { NovaCobrancaModal } from './NovaCobrancaModal'
import { RegistrarPagamentoModal } from './RegistrarPagamentoModal'

type Filtro = 'TODAS' | CobrancaStatus

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'TODAS',    label: 'Todas' },
  { key: 'PENDENTE', label: 'Pendentes' },
  { key: 'VENCIDA',  label: 'Vencidas' },
  { key: 'PAGA',     label: 'Pagas' },
]

export function FinanceiroTab({ alunoId }: { alunoId: string }) {
  const qc = useQueryClient()
  const { show } = useToast()
  const confirm = useConfirm()
  const [filtro, setFiltro] = useState<Filtro>('TODAS')
  const [openConfig, setOpenConfig] = useState(false)
  const [openNova, setOpenNova] = useState(false)
  const [pagando, setPagando] = useState<Cobranca | null>(null)

  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ['cobranca-config', alunoId],
    queryFn: () => financeiroApi.getConfig(alunoId),
    enabled: !!alunoId,
  })

  const { data: cobranças, isLoading } = useQuery({
    queryKey: ['cobranças', alunoId, filtro],
    queryFn: () => financeiroApi.listCobrancas(alunoId, filtro !== 'TODAS' ? { status: filtro } : undefined),
    enabled: !!alunoId,
  })

  const saveConfig = useMutation({
    mutationFn: (body: Parameters<typeof financeiroApi.setConfig>[1]) =>
      financeiroApi.setConfig(alunoId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cobranca-config', alunoId] })
      qc.invalidateQueries({ queryKey: ['cobranças', alunoId] })
      show('Faturamento configurado com sucesso.', 'success')
    },
    onError: () => show('Erro ao salvar configuração.', 'error'),
  })

  const createCobranca = useMutation({
    mutationFn: (body: Parameters<typeof financeiroApi.createCobranca>[1]) =>
      financeiroApi.createCobranca(alunoId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cobranças', alunoId] })
      show('Cobrança criada.', 'success')
    },
    onError: () => show('Erro ao criar cobrança.', 'error'),
  })

  const registrarPagamento = useMutation({
    mutationFn: ({ cobrancaId, body }: { cobrancaId: string; body: Parameters<typeof financeiroApi.registrarPagamento>[2] }) =>
      financeiroApi.registrarPagamento(alunoId, cobrancaId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cobranças', alunoId] })
      show('Pagamento registrado.', 'success')
    },
    onError: () => show('Erro ao registrar pagamento.', 'error'),
  })

  const cancelarCobranca = useMutation({
    mutationFn: (cobrancaId: string) => financeiroApi.cancelarCobranca(alunoId, cobrancaId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cobranças', alunoId] })
      show('Cobrança cancelada.', 'success')
    },
    onError: () => show('Erro ao cancelar cobrança.', 'error'),
  })

  async function handleCancelar(c: Cobranca) {
    const ok = await confirm({
      title: 'Cancelar cobrança',
      message: `Cancelar a cobrança de ${c.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} com vencimento em ${c.vencimento.split('-').reverse().join('/')}?`,
      confirmLabel: 'Cancelar cobrança',
      tone: 'danger',
    })
    if (ok) cancelarCobranca.mutate(c.cobranca_id)
  }

  const items = cobranças?.items ?? []
  const configAtivo = config && (config as any).ativo

  return (
    <div className="space-y-4">
      {/* Resumo do faturamento */}
      <Card variant="elevated">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-text-secondary mb-1">Faturamento recorrente</p>
            {loadingConfig ? (
              <Spinner className="w-4 h-4" />
            ) : config && (config as any).valor ? (
              <div className="space-y-0.5">
                <p className="font-semibold text-text">
                  {((config as any).valor as number).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  <span className="text-xs font-normal text-text-muted ml-1">/ {(config as any).recorrencia === 'MENSAL' ? 'mês' : 'ano'}</span>
                </p>
                <p className="text-xs text-text-secondary">
                  {(config as any).recorrencia === 'ANUAL' && (config as any).mes_vencimento
                    ? `Vence dia ${(config as any).dia_vencimento} de ${['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][(config as any).mes_vencimento - 1]}`
                    : `Vence dia ${(config as any).dia_vencimento}`
                  } · antecedência {(config as any).dias_antecedencia} dias
                </p>
                {!configAtivo && <p className="text-xs text-warning">Faturamento desativado</p>}
              </div>
            ) : (
              <p className="text-sm text-text-muted">Não configurado</p>
            )}
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => setOpenConfig(true)}>
            <Settings size={14} /> {config && (config as any).valor ? 'Editar' : 'Configurar'}
          </Button>
        </div>
      </Card>

      {/* Ações */}
      <div className="flex justify-end">
        <Button variant="primary" size="sm" className="gap-1.5" onClick={() => setOpenNova(true)}>
          <Plus size={14} /> Nova cobrança
        </Button>
      </div>

      {/* Filtros */}
      <Tabs
        tabs={FILTROS.map((f) => ({ key: f.key, label: f.label }))}
        active={filtro}
        onChange={(k) => setFiltro(k as Filtro)}
      />

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<DollarSign size={32} />}
          title="Nenhuma cobrança"
          description={filtro === 'TODAS' ? 'Configure o faturamento recorrente ou crie uma cobrança manual.' : `Nenhuma cobrança ${filtro.toLowerCase()}.`}
        />
      ) : (
        <div className="space-y-2">
          {items.map((c) => (
            <CobrancaCard
              key={c.cobranca_id}
              cobranca={c}
              onPagar={(c) => setPagando(c)}
              onCancelar={handleCancelar}
            />
          ))}
        </div>
      )}

      {/* Modais */}
      {openConfig && (
        <CobrancaConfigModal
          current={(config as any)?.valor ? (config as any) : null}
          onConfirm={async (body) => { await saveConfig.mutateAsync(body) }}
          onClose={() => setOpenConfig(false)}
        />
      )}
      {openNova && (
        <NovaCobrancaModal
          onConfirm={async (body) => { await createCobranca.mutateAsync(body) }}
          onClose={() => setOpenNova(false)}
        />
      )}
      {pagando && (
        <RegistrarPagamentoModal
          cobranca={pagando}
          onConfirm={async (body) => {
            await registrarPagamento.mutateAsync({ cobrancaId: pagando.cobranca_id, body })
            setPagando(null)
          }}
          onClose={() => setPagando(null)}
        />
      )}
    </div>
  )
}
