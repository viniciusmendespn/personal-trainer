import { useMemo } from 'react'
import { estimar1Rm, tabelaDeCargas, FORMULAS_RM, RM_LIMITES } from '../../../calc/rm'
import {
  CalcCartao, CalcCampo, CalcResultado, CalcTabela, CalcAvisos, CalcAvancado,
  useCampoDecimal, num, cor,
} from './CalcUI'

// Estado inicial preenchido: quem chega da busca vê resultado sem digitar nada.
// Estes são os mesmos números do exemplo resolvido no conteúdo da página.
const EXEMPLO = { carga: '100', reps: '8' }

export function OneRepMaxWidget() {
  const carga = useCampoDecimal(EXEMPLO.carga, { min: RM_LIMITES.carga.min, max: RM_LIMITES.carga.max, rotulo: 'Peso levantado' })
  const reps = useCampoDecimal(EXEMPLO.reps, { min: RM_LIMITES.reps.min, max: RM_LIMITES.reps.max, rotulo: 'Repetições' })

  const calculo = useMemo(() => {
    if (carga.valor === null || reps.valor === null) return null
    return estimar1Rm({ cargaKg: carga.valor, reps: Math.round(reps.valor) })
  }, [carga.valor, reps.valor])

  const tabela = useMemo(() => {
    if (!calculo?.ok) return null
    return tabelaDeCargas({ umRmKg: calculo.resultado.medianaKg })
  }, [calculo])

  const repsInformadas = reps.valor === null ? null : Math.round(reps.valor)

  return (
    <CalcCartao
      campos={
        <>
          <CalcCampo id="rm-carga" rotulo="Peso levantado" campo={carga} sufixo="kg" dica="A carga da série" />
          <CalcCampo id="rm-reps" rotulo="Repetições feitas" campo={reps} dica="Até a falha ou perto dela" />
        </>
      }
      resultado={
        calculo?.ok ? (
          <>
            <CalcResultado
              rotulo="Seu 1RM estimado"
              valor={num(calculo.resultado.medianaKg, 1)}
              unidade="kg"
              legenda={
                <>
                  Mediana de sete fórmulas, que vão de {num(calculo.resultado.faixa.minKg, 1)} kg a{' '}
                  {num(calculo.resultado.faixa.maxKg, 1)} kg.{' '}
                  {calculo.resultado.confianca === 'alta'
                    ? `Nesta faixa de repetições o erro típico fica em torno de ${calculo.resultado.erroTipicoPct}%.`
                    : 'Com este número de repetições a estimativa é pouco confiável.'}
                </>
              }
            />
            <CalcAvisos avisos={calculo.avisos} />
            {tabela?.ok && (
              <div style={{ display: 'grid', gap: 10 }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: cor.texto, marginBottom: 2 }}>
                    Que carga usar em cada intensidade
                  </p>
                  <p style={{ fontSize: 13.5, color: cor.suave, lineHeight: 1.5 }}>
                    Porcentagens da tabela da NSCA, já convertidas e arredondadas para baixo em múltiplos de 2,5 kg.
                  </p>
                </div>
                <CalcTabela
                  cabecalho={['Repetições', '% do 1RM', 'Carga', 'Na barra']}
                  linhas={tabela.resultado.linhas.map((l) => [
                    l.reps,
                    `${num(l.percentual, 0)}%`,
                    `${num(l.cargaKg, 1)} kg`,
                    `${num(l.cargaArredondadaKg, 1)} kg`,
                  ])}
                  destacar={tabela.resultado.linhas.findIndex((l) => l.reps === repsInformadas)}
                />
              </div>
            )}
          </>
        ) : (
          <CalcResultado rotulo="Seu 1RM estimado" valor="—" legenda="Preencha o peso e as repetições." destaque={false} />
        )
      }
      avancado={
        calculo?.ok && (
          <CalcAvancado titulo="Como chegamos nesse número (as sete fórmulas)">
            <p style={{ fontSize: 14, lineHeight: 1.7, color: cor.corpo }}>
              Cada equação foi ajustada a uma amostra diferente, então elas discordam — e mostrar a
              divergência é mais honesto que escolher uma e apresentá-la como verdade. Para acompanhar
              a evolução de um aluno, o que importa é usar sempre a mesma.
            </p>
            <CalcTabela
              cabecalho={['Fórmula', 'Equação', '1RM estimado']}
              linhas={calculo.resultado.estimativas.map((e) => [
                e.label,
                FORMULAS_RM.find((f) => f.id === e.formula)!.equacao,
                `${num(e.umRmKg, 1)} kg`,
              ])}
            />
            <p style={{ fontSize: 13.5, lineHeight: 1.65, color: cor.suave }}>
              Tabela de porcentagens adaptada de Landers, J. — NSCA Journal 6(6):60-61, 1984.
              A tabela original não traz 11 repetições, e este valor não foi inventado aqui.
            </p>
          </CalcAvancado>
        )
      }
      cta={{
        texto: 'Prescreveu 4×8 a 80%? No CoachPilot o 1RM fica salvo no exercício e a carga em quilos sai sozinha na hora de montar o treino.',
        label: 'Começar grátis',
      }}
    />
  )
}
