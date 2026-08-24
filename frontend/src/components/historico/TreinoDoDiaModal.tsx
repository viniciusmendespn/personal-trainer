import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { alunoApi } from '../../api/alunoApp'
import { treinosApi, type SessaoDoDia } from '../../api/treinos'
import { Card, Modal, Spinner } from '../ui'
import { diaLocalIso, limitesDiaLocal } from '../../utils/datetime'
import { AlunoSessaoDetalheCard, SessaoDetalheCard } from './SessaoDetalheCard'

/** Argumentos que o feed entrega ao abrir o treino do dia de um post. */
export interface TreinoDoDiaArgs {
  /** `data_hora` do post — o dia é o dia LOCAL desse instante. */
  dataHora: string
  /** Vem preenchido nos posts que o aluno fez durante o treino; poupa a consulta do dia. */
  sessaoId?: string
  /** Exercício do feed, para destacá-lo dentro da sessão. */
  destaqueChave?: string
  onClose: () => void
}

function tituloDoDia(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
}

function Conteudo({
  dataHora, sessoes, carregando, erro, renderDetalhe, onClose,
}: {
  dataHora: string
  sessoes: SessaoDoDia[]
  carregando: boolean
  erro: boolean
  renderDetalhe: (sessaoId: string) => ReactNode
  onClose: () => void
}) {
  return (
    <Modal open onClose={onClose} title={tituloDoDia(dataHora)} size="lg">
      <div className="space-y-3">
        {carregando && <div className="py-6 flex justify-center"><Spinner /></div>}
        {!carregando && erro && (
          <p className="text-sm text-text-muted">Não foi possível carregar o treino desse dia.</p>
        )}
        {!carregando && !erro && sessoes.length === 0 && (
          <p className="text-sm text-text-muted">
            Nenhum treino registrado em {new Date(dataHora).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}.
          </p>
        )}
        {sessoes.map((s) => (
          <Card key={s.sessao_id} variant="flat">
            {s.treino_nome && <p className="font-medium mb-1">{s.treino_nome}</p>}
            {renderDetalhe(s.sessao_id)}
          </Card>
        ))}
      </div>
    </Modal>
  )
}

/** `sessaoId` conhecido dispensa a consulta — o post do aluno já carrega o vínculo. */
function useSessoesDoDia(
  dataHora: string,
  sessaoId: string | undefined,
  queryKey: unknown[],
  buscar: (inicio: string, fim: string) => Promise<SessaoDoDia[]>,
) {
  const { inicio, fim } = limitesDiaLocal(dataHora)
  const q = useQuery({
    queryKey,
    queryFn: () => buscar(inicio, fim),
    enabled: !sessaoId,
    staleTime: 5 * 60_000,
  })
  if (sessaoId) return { sessoes: [{ sessao_id: sessaoId, data_hora: dataHora }], carregando: false, erro: false }
  return { sessoes: q.data ?? [], carregando: q.isLoading, erro: q.isError }
}

/** Portal do personal. */
export function TreinoDoDiaModal({ alunoId, dataHora, sessaoId, destaqueChave, onClose }: TreinoDoDiaArgs & { alunoId: string }) {
  const { sessoes, carregando, erro } = useSessoesDoDia(
    dataHora, sessaoId,
    ['sessoes-dia', alunoId, diaLocalIso(dataHora)],
    (inicio, fim) => treinosApi.sessoesNoIntervalo(alunoId, inicio, fim),
  )
  return (
    <Conteudo
      dataHora={dataHora} sessoes={sessoes} carregando={carregando} erro={erro} onClose={onClose}
      renderDetalhe={(id) => <SessaoDetalheCard alunoId={alunoId} sessaoId={id} destaqueChave={destaqueChave} />}
    />
  )
}

/** App do aluno. */
export function AlunoTreinoDoDiaModal({ dataHora, sessaoId, destaqueChave, onClose }: TreinoDoDiaArgs) {
  const { sessoes, carregando, erro } = useSessoesDoDia(
    dataHora, sessaoId,
    ['aluno-sessoes-dia', diaLocalIso(dataHora)],
    (inicio, fim) => alunoApi.sessoesNoIntervalo(inicio, fim),
  )
  return (
    <Conteudo
      dataHora={dataHora} sessoes={sessoes} carregando={carregando} erro={erro} onClose={onClose}
      renderDetalhe={(id) => <AlunoSessaoDetalheCard sessaoId={id} destaqueChave={destaqueChave} />}
    />
  )
}
