import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dumbbell, TrendingUp, Trophy } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { alunoApi, type SerieInput, type SessaoAtiva } from '../api/alunoApp'
import { ALUNO_TOKEN_KEY } from '../api/alunoClient'
import { Button, Card, Spinner } from '../components/ui'

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center p-6 text-center text-slate-400">{children}</div>
}

const inputCls = 'px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-100 text-sm'

function useAlunoToken() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(ALUNO_TOKEN_KEY))
  useEffect(() => {
    const u = new URL(window.location.href)
    const t = u.searchParams.get('token')
    if (t) {
      localStorage.setItem(ALUNO_TOKEN_KEY, t)
      setToken(t)
      u.searchParams.delete('token')
      window.history.replaceState({}, '', u.pathname)
    }
  }, [])
  return token
}

export function AlunoApp() {
  const token = useAlunoToken()
  const [tab, setTab] = useState<'hoje' | 'evolucao'>('hoje')
  const me = useQuery({ queryKey: ['aluno-me'], queryFn: alunoApi.me, enabled: !!token, retry: false })

  if (!token) return <Centered>Abra o aplicativo pelo link enviado no seu WhatsApp.</Centered>
  if (me.isError) return <Centered>Seu link expirou. Peça um novo ao seu personal no WhatsApp.</Centered>

  return (
    <div className="min-h-screen max-w-md mx-auto pb-20">
      <header className="p-4">
        <h1 className="text-lg font-bold text-emerald-400">Olá, {me.data?.nome ?? 'aluno'} 👋</h1>
      </header>
      <main className="px-4">{tab === 'hoje' ? <Hoje /> : <Evolucao />}</main>
      <nav className="fixed bottom-0 inset-x-0 max-w-md mx-auto bg-slate-900 border-t border-slate-800 flex">
        {([['hoje', 'Treino', <Dumbbell size={18} />], ['evolucao', 'Evolução', <TrendingUp size={18} />]] as const).map(
          ([k, label, icon]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs ${tab === k ? 'text-emerald-400' : 'text-slate-500'}`}>
              {icon}{label}
            </button>
          ),
        )}
      </nav>
    </div>
  )
}

function Hoje() {
  const qc = useQueryClient()
  const sessao = useQuery({ queryKey: ['aluno-sessao'], queryFn: alunoApi.sessao, retry: false })
  const hoje = useQuery({ queryKey: ['aluno-hoje'], queryFn: alunoApi.hoje, retry: false })
  const start = useMutation({
    mutationFn: (id: string) => alunoApi.start(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aluno-sessao'] }),
  })

  if (sessao.isLoading) return <Spinner />
  if (sessao.data?.sessao_id) return <SessaoView s={sessao.data} />

  const agendados = hoje.data?.hoje ?? []
  const lista = agendados.length ? agendados : (hoje.data?.treinos ?? []).map((t) => ({ id: t.treino_id, nome: t.nome }))
  return (
    <div className="space-y-3">
      <h2 className="font-semibold">{agendados.length ? 'Treino de hoje' : 'Escolha um treino'}</h2>
      {!lista.length ? (
        <p className="text-slate-500 text-sm">Nenhum treino cadastrado ainda.</p>
      ) : (
        lista.map((t) => (
          <Card key={t.id} className="flex items-center justify-between">
            <span className="font-medium">{t.nome}</span>
            <Button onClick={() => start.mutate(t.id)} disabled={start.isPending}>Iniciar</Button>
          </Card>
        ))
      )}
    </div>
  )
}

function SessaoView({ s }: { s: SessaoAtiva }) {
  const qc = useQueryClient()
  const ex = s.ex_atual
  const [rows, setRows] = useState<{ carga: string; reps: string }[]>([])
  const [pr, setPr] = useState<number | null>(null)

  useEffect(() => {
    const n = ex?.series ?? 1
    setRows(Array.from({ length: n }, () => ({ carga: ex?.carga_prescrita ?? '', reps: '' })))
    setPr(null)
  }, [ex?.exercicio_id])

  const upd = (i: number, f: 'carga' | 'reps', v: string) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [f]: v } : r)))

  const registrarAvancar = useMutation({
    mutationFn: async () => {
      const series: SerieInput[] = rows
        .filter((r) => r.carga || r.reps)
        .map((r) => ({ carga: r.carga || undefined, reps: r.reps ? Number(r.reps) : undefined }))
      const r = await alunoApi.registrar(series)
      if (r.pr_novo) { setPr(r.pr_novo); await new Promise((res) => setTimeout(res, 700)) }
      await alunoApi.advance()
      return r
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aluno-sessao'] })
      qc.invalidateQueries({ queryKey: ['aluno-resumo'] })
    },
  })
  const finish = useMutation({
    mutationFn: () => alunoApi.finish(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aluno-sessao'] }),
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">{s.treino_nome} · exercício {s.ordem_atual + 1}/{s.total_ex}</p>
      <Card>
        <h3 className="font-semibold text-lg">{ex?.nome}</h3>
        <p className="text-xs text-slate-500 mb-3">
          Prescrito: {ex?.series ? `${ex.series}x` : ''}{ex?.reps_prescritas ?? ''} {ex?.carga_prescrita ? `· ${ex.carga_prescrita} kg` : ''}
        </p>
        {pr != null && (
          <p className="text-amber-300 text-sm mb-2 flex items-center gap-1"><Trophy size={14} /> Novo recorde: {pr} kg!</p>
        )}
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2 mb-2 items-center">
            <span className="text-xs text-slate-500 w-14">Série {i + 1}</span>
            <input className={`${inputCls} w-24`} placeholder="Carga" value={r.carga} onChange={(e) => upd(i, 'carga', e.target.value)} />
            <input className={`${inputCls} w-20`} placeholder="Reps" inputMode="numeric" value={r.reps} onChange={(e) => upd(i, 'reps', e.target.value)} />
          </div>
        ))}
        <button onClick={() => setRows([...rows, { carga: ex?.carga_prescrita ?? '', reps: '' }])} className="text-xs text-emerald-400">
          + série
        </button>
      </Card>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => registrarAvancar.mutate()} disabled={registrarAvancar.isPending}>
          {registrarAvancar.isPending ? 'Salvando…' : 'Registrar e avançar'}
        </Button>
        <Button variant="ghost" onClick={() => finish.mutate()}>Finalizar</Button>
      </div>
    </div>
  )
}

function Evolucao() {
  const resumo = useQuery({ queryKey: ['aluno-resumo'], queryFn: alunoApi.resumo })
  const exs = useQuery({ queryKey: ['aluno-exs'], queryFn: alunoApi.listExercicios })
  const [exId, setExId] = useState('')
  useEffect(() => { if (!exId && exs.data?.length) setExId(exs.data[0].exercicio_id) }, [exs.data, exId])
  const evo = useQuery({ queryKey: ['aluno-evo', exId], queryFn: () => alunoApi.evolucao(exId), enabled: !!exId })

  const data = (evo.data?.serie ?? [])
    .filter((p) => p.carga_max != null)
    .map((p) => ({ data: new Date(p.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), carga: p.carga_max }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card><p className="text-2xl font-bold">{resumo.data?.total_sessoes ?? 0}</p><p className="text-xs text-slate-500">Sessões</p></Card>
        <Card><p className="text-2xl font-bold">{resumo.data?.sessoes_semana ?? 0}</p><p className="text-xs text-slate-500">Esta semana</p></Card>
      </div>
      {!exs.data?.length ? (
        <p className="text-slate-500 text-sm">Sem exercícios ainda.</p>
      ) : (
        <>
          <select value={exId} onChange={(e) => setExId(e.target.value)} className={`${inputCls} w-full`}>
            {exs.data.map((ex) => <option key={ex.exercicio_id} value={ex.exercicio_id}>{ex.nome}</option>)}
          </select>
          {!data.length ? (
            <p className="text-slate-500 text-sm">Sem registros com carga ainda.</p>
          ) : (
            <Card>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-slate-400">Carga por sessão</span>
                <span className="text-xs text-amber-300 flex items-center gap-1"><Trophy size={12} /> {evo.data?.pr?.carga ?? '—'} kg</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="data" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="carga" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
