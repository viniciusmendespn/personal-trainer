import { useMemo, useState } from 'react'
import { precificar, PRESETS_IMPOSTO, REFERENCIAS_MERCADO } from '../../../calc/precificacao'
import { formatBRL } from '../../../utils/currency'
import {
  CalcCartao, CalcCampo, CalcRadios, CalcResultado, CalcGrade, CalcTabela,
  CalcAvisos, CalcAvancado, useCampoDecimal, num, cor,
} from './CalcUI'

type PresetId = (typeof PRESETS_IMPOSTO)[number]['id']

export function PrecificacaoWidget() {
  const [presetId, setPresetId] = useState<PresetId>('mei')

  // Cenário completo já preenchido: a calculadora abre mostrando resultado.
  const custo = useCampoDecimal('800', { min: 0, max: 100000, rotulo: 'Custo fixo' })
  const horas = useCampoDecimal('20', { min: 1, max: 80, rotulo: 'Horas disponíveis' })
  const atendidas = useCampoDecimal('12', { min: 1, max: 80, rotulo: 'Horas atendidas' })
  const renda = useCampoDecimal('5000', { min: 0, max: 200000, rotulo: 'Renda desejada' })

  const preset = PRESETS_IMPOSTO.find((p) => p.id === presetId)!

  const calculo = useMemo(() => {
    if (custo.valor === null || horas.valor === null || atendidas.valor === null || renda.valor === null) return null
    // "ocupação" nunca aparece na tela: ela sai de horas disponíveis x horas atendidas.
    const ocupacao = Math.min(atendidas.valor / horas.valor, 1)
    return precificar({
      custoFixoMensal: custo.valor,
      horasDisponiveisSemana: horas.valor,
      taxaOcupacao: ocupacao,
      aliquotaImposto: preset.aliquota,
      tributoFixoMensal: preset.valorFixoMensal,
      tetoFaturamentoAnual: preset.tetoFaturamentoAnual,
      rendaLiquidaDesejada: renda.valor,
    })
  }, [custo.valor, horas.valor, atendidas.valor, renda.valor, preset])

  const duasPorSemana = calculo?.ok ? calculo.resultado.mensalidades.find((m) => m.vezesPorSemana === 2) : null
  const alunosDuas = calculo?.ok ? calculo.resultado.alunosParaMeta.find((a) => a.vezesPorSemana === 2) : null

  return (
    <CalcCartao
      ressalva="Estimativa de negócio. Valores fiscais verificados em agosto de 2026 — confirme com o seu contador."
      campos={
        <>
          <CalcCampo id="pre-custo" rotulo="Quanto você gasta por mês para trabalhar?" campo={custo} sufixo="R$" dica="Transporte, academia, material, celular, sistema" />
          <CalcCampo id="pre-renda" rotulo="Quanto quer receber limpo por mês?" campo={renda} sufixo="R$" />
          <CalcCampo id="pre-horas" rotulo="Horas por semana disponíveis" campo={horas} sufixo="h" dica="O que cabe na sua agenda" />
          <CalcCampo id="pre-atendidas" rotulo="Dessas, quantas você atende hoje?" campo={atendidas} sufixo="h" dica="O meio do dia costuma ficar vazio" />
          <div style={{ gridColumn: '1 / -1' }}>
            <CalcRadios
              nome="pre-imposto"
              legenda="Imposto"
              valor={presetId}
              onChange={setPresetId}
              opcoes={PRESETS_IMPOSTO.map((p) => ({ valor: p.id, label: p.rotulo }))}
            />
          </div>
        </>
      }
      resultado={
        calculo?.ok ? (
          <>
            <CalcResultado
              rotulo="Preço por sessão"
              valor={formatBRL(calculo.resultado.precoMetaSessaoComercial)}
              legenda={
                <>
                  Conta exata: {formatBRL(calculo.resultado.precoMetaSessao)}, arredondado para cima.
                  Abaixo de {formatBRL(calculo.resultado.precoMinimoSessao)} você trabalha no prejuízo.
                </>
              }
            />
            <CalcGrade min={200}>
              {duasPorSemana && (
                <CalcResultado
                  rotulo="Mensalidade 2× por semana"
                  valor={formatBRL(duasPorSemana.valorMensal)}
                  destaque={false}
                  legenda={`${num(duasPorSemana.sessoesMes, 1)} sessões por mês`}
                />
              )}
              {alunosDuas && (
                <CalcResultado
                  rotulo="Alunos para essa meta"
                  valor={String(alunosDuas.alunos)}
                  destaque={false}
                  legenda={`Atendendo 2× por semana, o que dá ${num(alunosDuas.sessoesExigidas, 0)} sessões por mês`}
                />
              )}
            </CalcGrade>
            <CalcAvisos avisos={calculo.avisos} />
          </>
        ) : (
          <CalcResultado rotulo="Preço por sessão" valor="—" legenda="Preencha os quatro campos acima." destaque={false} />
        )
      }
      avancado={
        <CalcAvancado titulo="Detalhes: mensalidades, capacidade e referências de mercado">
          {calculo?.ok && (
            <>
              <CalcTabela
                cabecalho={['Frequência', 'Sessões/mês', 'Mensalidade', 'Alunos para a meta']}
                linhas={calculo.resultado.mensalidades.map((m) => {
                  const a = calculo.resultado.alunosParaMeta.find((x) => x.vezesPorSemana === m.vezesPorSemana)!
                  return [`${m.vezesPorSemana}× por semana`, num(m.sessoesMes, 1), formatBRL(m.valorMensal), String(a.alunos)]
                })}
              />
              <p style={{ fontSize: 14, lineHeight: 1.7, color: cor.corpo }}>
                Sua capacidade real é de {num(calculo.resultado.capacidade.sessoesMesRealista, 0)} sessões por mês
                ({num(calculo.resultado.capacidade.horasMes, 0)} horas, considerando 4,33 semanas — a média real
                do mês; usar 4 faz perder quase uma sessão por aluno).
                {' '}Para cobrir os custos você precisa faturar {formatBRL(calculo.resultado.faturamentoBrutoBreakEven)} por mês;
                para bater a meta, {formatBRL(calculo.resultado.faturamentoBrutoMeta)}.
              </p>
            </>
          )}
          <CalcTabela
            cabecalho={['Referência de mercado', 'Faixa', 'Verificado em']}
            linhas={REFERENCIAS_MERCADO.map((r) => [
              `${r.rotulo} (${r.unidade})`,
              `${formatBRL(r.min)} a ${formatBRL(r.max)}`,
              r.verificadoEm,
            ])}
          />
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: cor.suave }}>
            Estes números são contexto e não entram na conta em momento nenhum.
            {preset.observacao && ` ${preset.rotulo}: ${preset.observacao}`}
          </p>
        </CalcAvancado>
      }
      cta={{
        texto: 'Definir o preço é a parte fácil. O CoachPilot controla quem pagou, quem atrasou e cobra por Pix direto na sua conta, sem taxa da plataforma.',
        label: 'Começar grátis',
      }}
    />
  )
}
