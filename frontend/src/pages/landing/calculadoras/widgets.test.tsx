// Smoke test dos widgets: renderiza cada um em servidor e confere que o estado
// inicial JÁ PRODUZ RESULTADO — a primeira regra de usabilidade das calculadoras
// ("resultado antes de digitar"). De quebra, pega qualquer crash de runtime que
// viraria página branca em produção.
//
// renderToStaticMarkup em vez de jsdom: os widgets não tocam window/document, então
// não vale instalar um DOM inteiro só para isto.
import { describe, it, expect } from 'vitest'
import { createElement, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { OneRepMaxWidget } from './OneRepMaxWidget'
import { DobrasWidget } from './DobrasWidget'
import { PrecificacaoWidget } from './PrecificacaoWidget'
import { VolumeWidget } from './VolumeWidget'
import { EnergiaWidget } from './EnergiaWidget'

function render(Widget: ComponentType) {
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Widget)))
}

const WIDGETS: { nome: string; comp: ComponentType; esperado: RegExp }[] = [
  { nome: '1RM', comp: OneRepMaxWidget, esperado: /125,1/ },
  { nome: 'dobras', comp: DobrasWidget, esperado: /14,5/ },
  { nome: 'precificação', comp: PrecificacaoWidget, esperado: /R\$/ },
  { nome: 'volume', comp: VolumeWidget, esperado: /8\s*<\/p>|>8</ },
  { nome: 'energia', comp: EnergiaWidget, esperado: /2\.759|2759/ },
]

describe('widgets renderizam sem quebrar', () => {
  for (const { nome, comp } of WIDGETS) {
    it(`${nome} renderiza`, () => {
      const html = render(comp)
      expect(html.length).toBeGreaterThan(500)
    })
  }
})

describe('regra 1: resultado na tela antes de digitar', () => {
  for (const { nome, comp, esperado } of WIDGETS) {
    it(`${nome} já mostra resultado no estado inicial`, () => {
      const html = render(comp)
      // nenhum widget pode abrir com o placeholder de "preencha os campos"
      expect(html, `${nome} abriu sem resultado`).not.toMatch(/>—</)
      expect(html, `${nome} não trouxe o valor esperado`).toMatch(esperado)
    })
  }
})

describe('regra 4: um número grande, o resto colapsado', () => {
  for (const { nome, comp } of WIDGETS) {
    it(`${nome} tem bloco avançado em <details>`, () => {
      const html = render(comp)
      expect(html, nome).toContain('<details')
      // o conteúdo do details fica no DOM mesmo fechado — continua indexável
      expect(html, nome).toContain('<summary')
    })
  }
})

describe('acessibilidade dos campos', () => {
  for (const { nome, comp } of WIDGETS) {
    it(`${nome}: todo input tem label associado`, () => {
      const html = render(comp)
      const ids = [...html.matchAll(/<(?:input|select)[^>]*\bid="([^"]+)"/g)].map((m) => m[1])
      expect(ids.length, `${nome} não tem campo nenhum`).toBeGreaterThan(0)
      for (const id of ids) {
        expect(html, `${nome}: input ${id} sem <label for>`).toContain(`for="${id}"`)
      }
    })

    it(`${nome}: nenhum input numérico usa type="number"`, () => {
      // type="number" rejeita vírgula em pt-BR e o scroll do mouse altera o valor
      expect(render(comp), nome).not.toContain('type="number"')
    })

    it(`${nome}: resultado é anunciado por leitor de tela`, () => {
      const html = render(comp)
      expect(html, nome).toContain('aria-live="polite"')
      expect(html, nome).not.toContain('aria-live="assertive"')
    })

    it(`${nome}: toda tabela rola dentro do próprio container`, () => {
      const html = render(comp)
      const tabelas = (html.match(/<table/g) ?? []).length
      const wrappers = (html.match(/overflow-x:auto/g) ?? []).length
      expect(wrappers, `${nome}: ${tabelas} tabelas para ${wrappers} wrappers`).toBeGreaterThanOrEqual(tabelas)
    })
  }
})

describe('ressalvas obrigatórias', () => {
  it('todo widget avisa que nada é enviado para servidor', () => {
    for (const { nome, comp } of WIDGETS) {
      expect(render(comp), nome).toContain('Nada é enviado para servidor')
    }
  })

  it('a de TMB cita a resolução do CFN antes de qualquer número', () => {
    const html = render(EnergiaWidget)
    expect(html).toContain('600/2018')
    expect(html).toContain('nutricionista')
  })

  it('as de treino citam a responsabilidade do CREF', () => {
    for (const comp of [OneRepMaxWidget, DobrasWidget, VolumeWidget]) {
      expect(render(comp)).toContain('CREF')
    }
  })
})

describe('regra 3: rótulo sem jargão na tela principal', () => {
  it('precificação não usa "ocupação" nem "alíquota" como rótulo', () => {
    const html = render(PrecificacaoWidget)
    expect(html).not.toMatch(/>Taxa de ocupação</)
    expect(html).not.toMatch(/>Alíquota</)
    expect(html).toContain('quantas você atende hoje')
  })

  it('energia mostra o nível de atividade por frase, não pelo multiplicador', () => {
    const html = render(EnergiaWidget)
    expect(html).toContain('treina 3 a 5 vezes por semana')
    // o multiplicador cru (1.55) não aparece em rótulo de opção
    expect(html).not.toMatch(/<option[^>]*>[^<]*1,55/)
  })

  it('dobras descreve onde medir em cada campo', () => {
    const html = render(DobrasWidget)
    expect(html).toContain('ponto médio entre a prega inguinal')
  })
})
