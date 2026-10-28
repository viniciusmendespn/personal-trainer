import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CAMINHO_VALIDO,
  ORIGEM_VALIDA,
  normalizarOrigem,
  origemDaBusca,
  origemImplicita,
  paginaInstitucional,
} from './campanha'

const PY = readFileSync(join(__dirname, '../../../backend/app/services/campanha_service.py'), 'utf8')

function regexDoPy(nome: string): string {
  const m = PY.match(new RegExp(`${nome} = re\\.compile\\(r"([^"]+)"\\)`))
  if (!m) throw new Error(`${nome} não encontrado em campanha_service.py`)
  return m[1]
}

describe('espelho com o backend', () => {
  it('ORIGEM_VALIDA é a mesma regex', () => {
    expect(ORIGEM_VALIDA.source).toBe(regexDoPy('ORIGEM_VALIDA'))
  })
  it('CAMINHO_VALIDO é a mesma regex', () => {
    expect(CAMINHO_VALIDO.source.replace(/\\\//g, '/')).toBe(regexDoPy('CAMINHO_VALIDO'))
  })
})

describe('origem', () => {
  it('normaliza para o alfabeto da chave', () => {
    expect(normalizarOrigem(' Instagram.Stories ')).toBe('instagram-stories')
    expect(normalizarOrigem('a'.repeat(23) + '-xyz')).toBe('a'.repeat(23))
    expect(normalizarOrigem('###')).toBeNull()
  })

  it('lê as formas marcadas, utm primeiro', () => {
    expect(origemDaBusca('?campanha-instagram')).toBe('instagram')
    expect(origemDaBusca('?campanha=tiktok')).toBe('tiktok')
    expect(origemDaBusca('?utm_source=google&campanha-x')).toBe('google')
    expect(origemDaBusca('?ref=MARIA')).toBe('cupom-maria')
    expect(origemDaBusca('?cupom=Joao10')).toBe('cupom-joao10')
    expect(origemDaBusca('?next=/dashboard')).toBeNull()
  })

  it('deduz sem marcação', () => {
    const host = 'coachpilot.com.br'
    expect(origemImplicita('?gclid=1', '', host)).toBe('google-ads')
    expect(origemImplicita('?fbclid=1', '', host)).toBe('meta')
    expect(origemImplicita('', '', host)).toBe('direto')
    expect(origemImplicita('', 'https://www.google.com.br/', host)).toBe('google-busca')
    expect(origemImplicita('', 'https://l.instagram.com/x', host)).toBe('instagram')
    expect(origemImplicita('', 'https://loja.coachpilot.com.br/p/1', host)).toBe('loja')
    expect(origemImplicita('', 'https://coachpilot.com.br/blog', host)).toBeNull()
    expect(origemImplicita('', 'https://exemplo.com.br/', host)).toBe('exemplo-com-br')
  })
})

describe('página', () => {
  it('só conta página do site', () => {
    expect(paginaInstitucional('/')).toBe('/')
    expect(paginaInstitucional('/precos/')).toBe('/precos')
    expect(paginaInstitucional('/calculadoras/1rm')).toBe('/calculadoras/1rm')
    expect(paginaInstitucional('/blog/qualquer-artigo')).toBe('/blog/qualquer-artigo')
    expect(paginaInstitucional('/signup')).toBe('/signup')
    expect(paginaInstitucional('/dashboard')).toBeNull()
    expect(paginaInstitucional('/@demo')).toBeNull()
    expect(paginaInstitucional('/alunos/abc')).toBeNull()
  })
})
