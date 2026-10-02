import { App } from '@modelcontextprotocol/ext-apps'
import type { Selecao, ToolResult } from './types'

export class ToolError extends Error {
  constructor(message: string, public detail?: { code?: string; mensagem?: string }) { super(message) }
}
export function assertResult(result: ToolResult): ToolResult {
  if (result.isError) {
    const message = result.content?.map(c => c.text ?? '').join('\n') || 'A operação foi recusada.'
    let detail = result._meta?.erro as ToolError['detail']
    const start = message.indexOf('{')
    if (start >= 0) { try { detail = JSON.parse(message.slice(start)) } catch { /* mensagem textual */ } }
    throw new ToolError(message, detail)
  }
  return result
}
/** O que o host oferece nesta conversa; a UI decide fallback a partir disso, nunca presume. */
export interface Capacidades { fullscreen: boolean; contexto: boolean; mensagem: boolean }
/** Portal do personal: destino de "Abrir no CoachPilot" e fallback quando não há tela cheia. */
export const PORTAL = 'https://coachpilot.com.br'
export interface Host {
  capabilities?(): Capacidades
  /** Abre uma página do portal em nova aba; `false` se o host recusar. */
  openPortal?(path: string): Promise<boolean>
  /** Destino do botão do host "abrir no app" — separado da origem de isolamento (`_meta.ui.domain`). */
  setOpenInApp?(path: string): void
  preferences?(): { ordem?: string }
  savePreferences?(preferences: { ordem: string }): void
  /** `onInput` recebe os argumentos da tool que abriu o card, antes do resultado chegar. */
  connect(onResult: (r: ToolResult) => void, onEnvironment: (theme?: string, mode?: string) => void,
    onInput?: (args: Record<string, unknown>) => void): Promise<void>
  call(name: string, args: Record<string, unknown>): Promise<ToolResult>
  /** `false` quando o host não recebe contexto: a UI não pode presumir que a seleção chegou. */
  context(selection: Selecao): Promise<boolean>
  ask(text: string): Promise<void>
  /** `false` quando não há tela cheia: quem chama mantém o card limitado. */
  expand(): Promise<boolean>
  dispose(): void
}

// Toda dependência do host fica neste adaptador; componentes não leem window.openai.
export class McpHost implements Host {
  private app = new App({ name: 'CoachPilot', version: '1.0.0' }, {}, { autoResize: true })
  preferences() {
    const bridge = (window as unknown as { openai?: { widgetState?: { preferences?: { ordem?: string } } } }).openai
    return bridge?.widgetState?.preferences || {}
  }
  savePreferences(preferences: { ordem: string }) {
    const bridge = (window as unknown as { openai?: { widgetState?: Record<string, unknown>; setWidgetState?: (state: Record<string, unknown>) => void } }).openai
    bridge?.setWidgetState?.({ ...bridge.widgetState, preferences })
  }
  async connect(onResult: (r: ToolResult) => void, onEnvironment: (theme?: string, mode?: string) => void,
    onInput?: (args: Record<string, unknown>) => void) {
    this.app.ontoolresult = result => onResult(result as ToolResult)
    this.app.ontoolinput = params => onInput?.(params.arguments ?? {})
    // A notificação traz só o que mudou (ex.: só displayMode): campo ausente mantém o valor atual.
    this.app.onhostcontextchanged = ctx => onEnvironment(ctx.theme, ctx.displayMode)
    if (window.parent === window) throw new Error('Abra o CoachPilot pela conexão autenticada no ChatGPT.')
    await this.app.connect(undefined, { timeout: 15000 })
    const ctx = this.app.getHostContext()
    onEnvironment(ctx?.theme ?? 'light', ctx?.displayMode ?? 'inline')
  }
  async call(name: string, args: Record<string, unknown>) {
    return assertResult(await this.app.callServerTool({ name, arguments: args }, { timeout: 30000 }) as ToolResult)
  }
  capabilities(): Capacidades {
    const caps = this.app.getHostCapabilities()
    return { fullscreen: this.fullscreenDisponivel(), contexto: !!caps?.updateModelContext, mensagem: !!caps?.message }
  }
  async openPortal(path: string) {
    if (!this.app.getHostCapabilities()?.openLinks) return false
    const r = await this.app.openLink({ url: PORTAL + path })
    return !r.isError
  }
  setOpenInApp(path: string) {
    const openai = (window as unknown as { openai?: { setOpenInAppUrl?: (args: { href: string }) => unknown } }).openai
    try { openai?.setOpenInAppUrl?.({ href: PORTAL + path }) } catch { /* extensão opcional */ }
  }
  private openai() {
    return (window as unknown as { openai?: { requestDisplayMode?: (args: { mode: string }) => Promise<unknown> } }).openai
  }
  private fullscreenDisponivel() {
    return !!this.app.getHostContext()?.availableDisplayModes?.includes('fullscreen') || !!this.openai()?.requestDisplayMode
  }
  async context(selection: Selecao) {
    if (!this.app.getHostCapabilities()?.updateModelContext) return false
    await this.app.updateModelContext({ structuredContent: { coachpilot: selection } })
    return true
  }
  async ask(text: string) {
    const result = await this.app.sendMessage({ role: 'user', content: [{ type: 'text', text }] })
    if (result.isError) throw new Error('O host não aceitou o pedido. Envie-o na conversa.')
  }
  async expand() {
    if (this.app.getHostContext()?.availableDisplayModes?.includes('fullscreen')) {
      const r = await this.app.requestDisplayMode({ mode: 'fullscreen' })
      return r.mode === 'fullscreen'
    }
    // Extensão opcional, isolada da apresentação.
    const openai = this.openai()
    if (!openai?.requestDisplayMode) return false
    await openai.requestDisplayMode({ mode: 'fullscreen' })
    return true
  }
  dispose() { void this.app.close() }
}
