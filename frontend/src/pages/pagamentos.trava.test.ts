import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

/**
 * Trava do fluxo de conexão do Mercado Pago.
 *
 * O personal conecta por OAuth, com um clique. O caminho antigo — criar aplicação no
 * painel de desenvolvedores e colar um Access Token — foi removido de propósito, e com
 * ele o único lugar do frontend que já manipulou uma credencial do Mercado Pago.
 *
 * Estes testes existem para que uma refatoração futura não o ressuscite sem querer:
 * um campo de token na tela voltaria a expor a credencial ao navegador, e um endpoint
 * de gravação direta contornaria a validação da conta que só o OAuth faz.
 */
const ler = (p: string) => readFileSync(resolve(__dirname, p), 'utf-8')

describe('tela de Pagamentos — sem Access Token colado', () => {
  const tela = ler('./SettingsPage.tsx')

  it('não menciona o prefixo de token de produção do MP', () => {
    expect(tela).not.toContain('APP_USR')
  })

  it('não manda o personal ao painel de desenvolvedores', () => {
    expect(tela).not.toContain('developers/panel')
  })

  it('não tem campo de senha na aba de pagamentos', () => {
    const aba = tela.slice(tela.indexOf('function PagamentosTab'))
    expect(aba).not.toContain('type="password"')
  })

  it('abre a autorização navegando o documento, não por fetch', () => {
    expect(tela).toContain('window.location.assign')
  })
})

describe('client de financeiro — sem gravação de credencial', () => {
  const client = ler('../api/financeiro.ts')

  it('não expõe função que envia access_token', () => {
    expect(client).not.toContain('setMpConfig')
    expect(client).not.toContain('access_token')
  })

  it('tem o endpoint de iniciar o OAuth', () => {
    expect(client).toContain('/v1/config/mercadopago/oauth/iniciar')
  })
})
