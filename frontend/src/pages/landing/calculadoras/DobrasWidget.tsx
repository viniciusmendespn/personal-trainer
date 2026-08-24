import { useMemo, useState } from 'react'
import {
  calcularDobras, sitiosDoProtocolo, PROTOCOLOS, SITIO_LABELS, SITIO_COMO_MEDIR,
  PROVENIENCIAS_DOBRAS, DOBRA_LIMITES,
  type ProtocoloDobras, type EquacaoDensidade, type SitioDobra,
} from '../../../calc/dobras'
import type { Sexo } from '../../../calc/tipos'
import {
  CalcCartao, CalcCampo, CalcRadios, CalcSelect, CalcResultado, CalcGrade,
  CalcAvisos, CalcAvancado, useCampoDecimal, num, cor,
} from './CalcUI'

// Um campo por sítio anatômico possível: os hooks precisam de ordem estável entre
// renders, então todos existem sempre e só os do protocolo escolhido aparecem.
const EXEMPLO: Record<SitioDobra, string> = {
  peitoral: '12', axilarMedia: '12', triceps: '10', subescapular: '14',
  abdominal: '20', suprailiaca: '15', coxa: '16', panturrilhaMedial: '12',
}

export function DobrasWidget() {
  const [sexo, setSexo] = useState<Sexo>('M')
  // Default Pollock 3: o mais rápido. Trocar é opcional, nunca pedágio de entrada.
  const [protocolo, setProtocolo] = useState<ProtocoloDobras>('jp3')
  const [equacao, setEquacao] = useState<EquacaoDensidade>('siri')

  const idade = useCampoDecimal('30', { min: 10, max: 90, rotulo: 'Idade' })
  const peso = useCampoDecimal('80', { min: 20, max: 400, rotulo: 'Peso' })

  const campos = {
    peitoral: useCampoDecimal(EXEMPLO.peitoral, { min: 1, max: DOBRA_LIMITES.max, rotulo: 'Peitoral' }),
    axilarMedia: useCampoDecimal(EXEMPLO.axilarMedia, { min: 1, max: DOBRA_LIMITES.max, rotulo: 'Axilar média' }),
    triceps: useCampoDecimal(EXEMPLO.triceps, { min: 1, max: DOBRA_LIMITES.max, rotulo: 'Tríceps' }),
    subescapular: useCampoDecimal(EXEMPLO.subescapular, { min: 1, max: DOBRA_LIMITES.max, rotulo: 'Subescapular' }),
    abdominal: useCampoDecimal(EXEMPLO.abdominal, { min: 1, max: DOBRA_LIMITES.max, rotulo: 'Abdominal' }),
    suprailiaca: useCampoDecimal(EXEMPLO.suprailiaca, { min: 1, max: DOBRA_LIMITES.max, rotulo: 'Suprailíaca' }),
    coxa: useCampoDecimal(EXEMPLO.coxa, { min: 1, max: DOBRA_LIMITES.max, rotulo: 'Coxa' }),
    panturrilhaMedial: useCampoDecimal(EXEMPLO.panturrilhaMedial, { min: 1, max: DOBRA_LIMITES.max, rotulo: 'Panturrilha medial' }),
  } satisfies Record<SitioDobra, ReturnType<typeof useCampoDecimal>>

  const sitios = sitiosDoProtocolo(protocolo, sexo)

  const calculo = useMemo(() => {
    if (idade.valor === null) return null
    const dobrasMm: Partial<Record<SitioDobra, number>> = {}
    for (const s of sitios) {
      if (campos[s].valor === null) return null
      dobrasMm[s] = campos[s].valor as number
    }
    return calcularDobras({
      protocolo, sexo, idadeAnos: idade.valor, dobrasMm, equacao,
      pesoKg: peso.valor ?? undefined,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocolo, sexo, equacao, idade.valor, peso.valor, sitios.map((s) => campos[s].valor).join(',')])

  const def = PROTOCOLOS.find((p) => p.id === protocolo)!
  const prov = PROVENIENCIAS_DOBRAS[def.provenienciaId[sexo]]

  return (
    <CalcCartao
      campos={
        <>
          <CalcRadios
            nome="dobras-sexo"
            legenda="Sexo"
            valor={sexo}
            onChange={setSexo}
            opcoes={[{ valor: 'M', label: 'Masculino' }, { valor: 'F', label: 'Feminino' }]}
          />
          <CalcCampo id="dobras-idade" rotulo="Idade" campo={idade} sufixo="anos" />
          <CalcCampo id="dobras-peso" rotulo="Peso (opcional)" campo={peso} sufixo="kg" dica="Habilita massa gorda e magra" />
          <div style={{ gridColumn: '1 / -1' }}>
            <CalcSelect
              id="dobras-protocolo"
              rotulo="Protocolo"
              valor={protocolo}
              onChange={setProtocolo}
              // descrito pelo custo, não só pelo nome
              opcoes={PROTOCOLOS.map((p) => ({ valor: p.id, label: `${p.label} — ${p.resumo}` }))}
              dica={`Validado de ${def.validade[sexo].min} a ${def.validade[sexo].max} anos para este sexo.`}
            />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
            {sitios.map((s) => (
              <CalcCampo
                key={s}
                id={`dobras-${s}`}
                rotulo={SITIO_LABELS[s]}
                campo={campos[s]}
                sufixo="mm"
                // onde e como medir fica visível, não escondido em tooltip
                dica={SITIO_COMO_MEDIR[s]}
              />
            ))}
          </div>
        </>
      }
      resultado={
        calculo?.ok ? (
          <>
            <CalcResultado
              rotulo="Percentual de gordura"
              valor={num(calculo.resultado.percentualGordura, 1)}
              unidade="%"
              legenda={
                calculo.resultado.classificacao
                  ? `Faixa "${calculo.resultado.classificacao.rotulo}" para ${sexo === 'M' ? 'homens' : 'mulheres'}. Somatório de ${num(calculo.resultado.somaMm, 0)} mm em ${sitios.length} dobras.`
                  : `Somatório de ${num(calculo.resultado.somaMm, 0)} mm em ${sitios.length} dobras.`
              }
            />
            <CalcAvisos avisos={calculo.avisos} />
            {calculo.resultado.massaGordaKg !== null && (
              <CalcGrade min={170}>
                <CalcResultado rotulo="Massa gorda" valor={num(calculo.resultado.massaGordaKg, 1)} unidade="kg" destaque={false} />
                <CalcResultado rotulo="Massa magra" valor={num(calculo.resultado.massaMagraKg as number, 1)} unidade="kg" destaque={false} />
              </CalcGrade>
            )}
          </>
        ) : (
          <>
            <CalcResultado rotulo="Percentual de gordura" valor="—" legenda="Preencha a idade e todas as dobras do protocolo." destaque={false} />
            {/* sem isto o erro fica invisivel e a pessoa so ve um traco */}
            {calculo && !calculo.ok && <CalcAvisos avisos={calculo.avisos} />}
          </>
        )
      }
      avancado={
        <CalcAvancado titulo="Detalhes: equação, conversão e origem">
          <CalcSelect
            id="dobras-equacao"
            rotulo="Conversão de densidade em gordura"
            valor={equacao}
            onChange={setEquacao}
            opcoes={[
              { valor: 'siri', label: 'Siri (padrão da literatura)' },
              { valor: 'brozek', label: 'Brozek' },
            ]}
            dica="Na faixa usual a diferença é de décimos de ponto. O que não vale é alternar entre elas ao acompanhar o mesmo aluno."
          />
          {calculo?.ok && calculo.resultado.densidade !== null && (
            <p style={{ fontSize: 14, lineHeight: 1.7, color: cor.corpo }}>
              Densidade corporal calculada: <strong>{num(calculo.resultado.densidade, 5)}</strong> g/cm³.
            </p>
          )}
          {calculo?.ok && calculo.resultado.densidade === null && (
            <p style={{ fontSize: 14, lineHeight: 1.7, color: cor.corpo }}>
              Este protocolo estima o percentual direto do somatório, sem passar por densidade
              corporal — por isso Siri e Brozek não mudam o resultado.
            </p>
          )}
          <p style={{ fontSize: 14, lineHeight: 1.7, color: cor.corpo }}>
            <strong>{prov.nome}</strong> — {prov.autores}, {prov.ano}. População: {prov.populacao}
            {prov.faixaEtaria && `, de ${prov.faixaEtaria.min} a ${prov.faixaEtaria.max} anos`}
            {prov.n && `, n = ${prov.n}`}.
          </p>
          {prov.observacao && (
            <p style={{ fontSize: 13.5, lineHeight: 1.65, color: cor.suave }}>{prov.observacao}</p>
          )}
        </CalcAvancado>
      }
      cta={{
        texto: 'Registre esse resultado no histórico do aluno e compare com as próximas avaliações, com fotos e medidas lado a lado.',
        label: 'Começar grátis',
      }}
    />
  )
}
