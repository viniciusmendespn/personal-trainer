import { useMemo, useState } from 'react'
import { calcularVolume, GRUPO_LABELS, PROVENIENCIA_VOLUME, type GrupoMuscular } from '../../../calc/volume'
import {
  CalcCartao, CalcCampo, CalcSelect, CalcResultado, CalcTabela,
  CalcAvisos, CalcAvancado, num, cor,
} from './CalcUI'

interface Linha {
  id: number
  grupo: GrupoMuscular
  diretas: string
  indiretas: string
  frequencia: string
}

const GRUPOS = Object.keys(GRUPO_LABELS) as GrupoMuscular[]

export function VolumeWidget() {
  // Um grupo por vez na tela principal — não os doze de uma vez.
  const [linhas, setLinhas] = useState<Linha[]>([
    { id: 1, grupo: 'peito', diretas: '4', indiretas: '0', frequencia: '2' },
  ])
  // A contagem fracionária é rigor científico, mas nuance para quem só quer um número.
  const [contarIndiretas, setContarIndiretas] = useState(false)

  const calculo = useMemo(() => {
    const grupos = linhas
      .map((l) => ({
        grupo: l.grupo,
        seriesDiretasPorSessao: Number(l.diretas.replace(',', '.')) || 0,
        seriesIndiretasPorSessao: contarIndiretas ? Number(l.indiretas.replace(',', '.')) || 0 : 0,
        frequenciaSemanal: Number(l.frequencia.replace(',', '.')) || 0,
      }))
      .filter((g) => g.frequenciaSemanal > 0)
    if (!grupos.length) return null
    return calcularVolume({ grupos })
  }, [linhas, contarIndiretas])

  const principal = calculo?.ok ? calculo.resultado.grupos[0] : null

  function atualizar(id: number, campo: keyof Omit<Linha, 'id'>, valor: string) {
    setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)))
  }

  return (
    <CalcCartao
      campos={
        <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 16 }}>
          {linhas.map((l, i) => (
            <div key={l.id} style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))`, gap: 12, alignItems: 'start', paddingTop: i > 0 ? 14 : 0, borderTop: i > 0 ? `1px solid ${cor.borda}` : undefined }}>
              <CalcSelect
                id={`vol-grupo-${l.id}`}
                rotulo="Grupo muscular"
                valor={l.grupo}
                onChange={(v) => atualizar(l.id, 'grupo', v)}
                opcoes={GRUPOS.map((g) => ({ valor: g, label: GRUPO_LABELS[g] }))}
              />
              <CampoSimples id={`vol-diretas-${l.id}`} rotulo="Séries por treino" valor={l.diretas} onChange={(v) => atualizar(l.id, 'diretas', v)} />
              <CampoSimples id={`vol-freq-${l.id}`} rotulo="Treinos por semana" valor={l.frequencia} onChange={(v) => atualizar(l.id, 'frequencia', v)} />
              {contarIndiretas && (
                <CampoSimples id={`vol-ind-${l.id}`} rotulo="Séries indiretas por treino" valor={l.indiretas} onChange={(v) => atualizar(l.id, 'indiretas', v)} dica="Ex.: remada para bíceps" />
              )}
              {linhas.length > 1 && (
                <button
                  type="button"
                  className="cp-calc-campo"
                  onClick={() => setLinhas((ls) => ls.filter((x) => x.id !== l.id))}
                  style={{ alignSelf: 'end', minHeight: 44, padding: '10px 14px', borderRadius: 10, border: `1px solid ${cor.borda}`, background: cor.fundo, color: cor.suave, fontSize: 14, cursor: 'pointer' }}
                >
                  Remover
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="cp-calc-campo"
            onClick={() => setLinhas((ls) => [...ls, { id: Math.max(...ls.map((x) => x.id)) + 1, grupo: 'costas', diretas: '4', indiretas: '0', frequencia: '2' }])}
            style={{ justifySelf: 'start', minHeight: 44, padding: '10px 16px', borderRadius: 10, border: `1px solid ${cor.teal}`, background: cor.tealFundo, color: cor.tealEscuro, fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}
          >
            + Adicionar outro grupo
          </button>
        </div>
      }
      resultado={
        principal && calculo?.ok ? (
          <>
            <CalcResultado
              rotulo={`${principal.label}: volume semanal`}
              valor={num(principal.seriesEfetivasSemana, principal.seriesEfetivasSemana % 1 === 0 ? 0 : 1)}
              unidade="séries/semana"
              legenda={
                <>
                  {principal.rotulo}.{' '}
                  {principal.seriesAteFaixaAlvo > 0
                    ? `Faltam ${num(principal.seriesAteFaixaAlvo, principal.seriesAteFaixaAlvo % 1 === 0 ? 0 : 1)} séries para chegar à faixa alvo de 10 por semana.`
                    : 'Já está na faixa onde os melhores resultados aparecem na meta-análise.'}
                </>
              }
            />
            <CalcAvisos avisos={calculo.avisos} />
            {calculo.resultado.grupos.length > 1 && (
              <CalcTabela
                cabecalho={['Grupo', 'Séries/semana', 'Leitura']}
                linhas={calculo.resultado.grupos.map((g) => [
                  g.label,
                  num(g.seriesEfetivasSemana, g.seriesEfetivasSemana % 1 === 0 ? 0 : 1),
                  g.rotulo,
                ])}
              />
            )}
          </>
        ) : (
          <>
            <CalcResultado rotulo="Volume semanal" valor="—" legenda="Informe séries por treino e treinos por semana." destaque={false} />
            {/* sem isto o erro fica invisivel e a pessoa so ve um traco */}
            {calculo && !calculo.ok && <CalcAvisos avisos={calculo.avisos} />}
          </>
        )
      }
      avancado={
        <CalcAvancado titulo="Detalhes: séries indiretas e a base do cálculo">
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 15, color: cor.texto, cursor: 'pointer', minHeight: 44 }}>
            <input
              type="checkbox"
              checked={contarIndiretas}
              onChange={(e) => setContarIndiretas(e.target.checked)}
              style={{ accentColor: cor.teal, width: 18, height: 18 }}
            />
            Contar séries indiretas como meia série
          </label>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: cor.corpo }}>
            Uma série de remada recruta bíceps como músculo auxiliar. A meta-regressão publicada na
            Sports Medicine em 2025, com 67 estudos e 2.058 participantes, mostrou que contar essa
            série como meia é o que melhor explica os ganhos observados — melhor do que contar como
            série inteira ou ignorar.
          </p>
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: cor.suave }}>
            {PROVENIENCIA_VOLUME.autores} ({PROVENIENCIA_VOLUME.ano}) — {PROVENIENCIA_VOLUME.publicacao}.
            {' '}{PROVENIENCIA_VOLUME.observacao}
          </p>
        </CalcAvancado>
      }
      cta={{
        texto: 'No CoachPilot o volume sai do próprio programa prescrito, e o histórico de sessões mostra o que o aluno realmente executou.',
        label: 'Começar grátis',
      }}
    />
  )
}

/** Campo inteiro simples: aqui não há decimal nem faixa a validar por parse. */
function CampoSimples({ id, rotulo, valor, onChange, dica }: { id: string; rotulo: string; valor: string; onChange: (v: string) => void; dica?: string }) {
  const campo = { bruto: valor, valor: Number(valor) || 0, erro: null, set: onChange, aoSair: () => {} }
  return <CalcCampo id={id} rotulo={rotulo} campo={campo} dica={dica} />
}
