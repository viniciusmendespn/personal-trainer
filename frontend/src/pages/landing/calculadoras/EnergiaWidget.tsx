import { useMemo, useState } from 'react'
import {
  estimarEnergia, FATORES_ATIVIDADE, OBJETIVOS, PROVENIENCIAS_ENERGIA,
  type EquacaoTmb, type NivelAtividade, type Objetivo,
} from '../../../calc/energia'
import type { Sexo } from '../../../calc/tipos'
import {
  CalcCartao, CalcCampo, CalcRadios, CalcSelect, CalcResultado, CalcGrade, CalcTabela,
  CalcAvisos, CalcAvancado, useCampoDecimal, num, cor,
} from './CalcUI'

export function EnergiaWidget() {
  const [sexo, setSexo] = useState<Sexo>('M')
  const [nivel, setNivel] = useState<NivelAtividade>('moderado')
  const [objetivo, setObjetivo] = useState<Objetivo>('manutencao')
  const [equacao, setEquacao] = useState<EquacaoTmb>('mifflin')

  const peso = useCampoDecimal('80', { min: 20, max: 400, rotulo: 'Peso' })
  const altura = useCampoDecimal('180', { min: 100, max: 250, rotulo: 'Altura' })
  const idade = useCampoDecimal('30', { min: 10, max: 100, rotulo: 'Idade' })
  const proteina = useCampoDecimal('1,8', { min: 0.5, max: 4, rotulo: 'Proteína' })
  const gordura = useCampoDecimal('25', { min: 5, max: 60, rotulo: 'Gordura' })

  const calculo = useMemo(() => {
    if (peso.valor === null || altura.valor === null || idade.valor === null) return null
    return estimarEnergia({
      sexo,
      pesoKg: peso.valor,
      alturaCm: altura.valor,
      idadeAnos: idade.valor,
      nivelAtividade: nivel,
      objetivo,
      equacao,
      proteinaGPorKg: proteina.valor ?? undefined,
      gordura: gordura.valor === null ? undefined : { base: 'percentualDasCalorias', valor: gordura.valor / 100 },
    })
  }, [sexo, nivel, objetivo, equacao, peso.valor, altura.valor, idade.valor, proteina.valor, gordura.valor])

  const macros = calculo?.ok ? calculo.resultado.distribuicaoDeMacros : null

  return (
    <CalcCartao
      ressalva="Estimativa educativa. A prescrição de dietas é atribuição privativa do nutricionista (Resolução CFN nº 600/2018)."
      campos={
        <>
          <CalcRadios
            nome="energia-sexo"
            legenda="Sexo"
            valor={sexo}
            onChange={setSexo}
            opcoes={[{ valor: 'M', label: 'Masculino' }, { valor: 'F', label: 'Feminino' }]}
          />
          <CalcCampo id="energia-peso" rotulo="Peso" campo={peso} sufixo="kg" />
          <CalcCampo id="energia-altura" rotulo="Altura" campo={altura} sufixo="cm" />
          <CalcCampo id="energia-idade" rotulo="Idade" campo={idade} sufixo="anos" />
          <div style={{ gridColumn: '1 / -1' }}>
            <CalcSelect
              id="energia-nivel"
              rotulo="Nível de atividade"
              valor={nivel}
              onChange={setNivel}
              // frase, nunca o multiplicador cru
              opcoes={FATORES_ATIVIDADE.map((f) => ({ valor: f.id, label: f.label }))}
              dica="Reflete o dia inteiro, não só o treino. Na dúvida, escolha o menor."
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <CalcRadios
              nome="energia-objetivo"
              legenda="Objetivo"
              valor={objetivo}
              onChange={setObjetivo}
              opcoes={OBJETIVOS.map((o) => ({ valor: o.id, label: o.label }))}
            />
          </div>
        </>
      }
      resultado={
        calculo?.ok ? (
          <>
            <CalcResultado
              rotulo="Gasto energético estimado"
              valor={num(calculo.resultado.caloriasEstimadasKcal, 0)}
              unidade="kcal/dia"
              legenda={
                <>
                  Metabolismo basal de {num(calculo.resultado.tmbKcal, 0)} kcal multiplicado pelo fator{' '}
                  {num(calculo.resultado.fatorAtividade, 3)}
                  {objetivo !== 'manutencao' && `, com ajuste de ${objetivo === 'deficit' ? 'déficit' : 'superávit'}`}.
                </>
              }
            />
            <CalcAvisos avisos={calculo.avisos} />
            {macros && (
              <CalcGrade min={150}>
                <CalcResultado rotulo="Proteína" valor={num(macros.proteina.gramas, 0)} unidade="g" destaque={false} legenda={`${num(macros.proteina.gPorKg, 1)} g/kg`} />
                <CalcResultado rotulo="Gordura" valor={num(macros.gordura.gramas, 0)} unidade="g" destaque={false} legenda={`${num(macros.gordura.percentualDasCalorias, 0)}% das calorias`} />
                <CalcResultado rotulo="Carboidrato" valor={num(macros.carboidrato.gramas, 0)} unidade="g" destaque={false} legenda="Por diferença" />
              </CalcGrade>
            )}
          </>
        ) : (
          <CalcResultado rotulo="Gasto energético estimado" valor="—" legenda="Preencha peso, altura e idade." destaque={false} />
        )
      }
      avancado={
        <CalcAvancado titulo="Detalhes: comparar equações e ajustar macros">
          <CalcSelect
            id="energia-equacao"
            rotulo="Equação da taxa metabólica basal"
            valor={equacao}
            onChange={setEquacao}
            opcoes={[
              { valor: 'mifflin', label: 'Mifflin-St Jeor (padrão)' },
              { valor: 'harrisBenedict', label: 'Harris-Benedict revisada' },
              { valor: 'katchMcArdle', label: 'Katch-McArdle (exige % de gordura)' },
            ]}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
            <CalcCampo id="energia-proteina" rotulo="Proteína" campo={proteina} sufixo="g/kg" dica="Usual: 1,6 a 2,2" />
            <CalcCampo id="energia-gordura" rotulo="Gordura" campo={gordura} sufixo="%" dica="Percentual das calorias" />
          </div>
          {calculo?.ok && (
            <CalcTabela
              cabecalho={['Equação', 'TMB estimada']}
              linhas={calculo.resultado.comparativoEquacoes.map((c) => [
                c.equacao === 'mifflin' ? 'Mifflin-St Jeor' : c.equacao === 'harrisBenedict' ? 'Harris-Benedict rev.' : 'Katch-McArdle',
                c.tmbKcal === null ? (c.indisponivelPorque ?? '—') : `${num(c.tmbKcal, 0)} kcal`,
              ])}
            />
          )}
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: cor.suave }}>
            {PROVENIENCIAS_ENERGIA['mifflin-st-jeor-1990'].nome} ({PROVENIENCIAS_ENERGIA['mifflin-st-jeor-1990'].ano})
            {' · '}{PROVENIENCIAS_ENERGIA['harris-benedict-1984'].nome} ({PROVENIENCIAS_ENERGIA['harris-benedict-1984'].autores}, {PROVENIENCIAS_ENERGIA['harris-benedict-1984'].ano})
            {' · '}{PROVENIENCIAS_ENERGIA['katch-mcardle'].nome}.
            {' '}A divergência entre elas costuma ser menor que o erro de escolher o fator de atividade errado.
          </p>
        </CalcAvancado>
      }
      cta={{
        texto: 'Acompanhe peso, medidas e evolução do aluno num só lugar — e encaminhe a parte alimentar para o nutricionista.',
        label: 'Começar grátis',
      }}
    />
  )
}
