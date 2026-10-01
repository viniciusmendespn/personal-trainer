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
export interface Host {
  preferences?(): { ordem?: string }
  savePreferences?(preferences: { ordem: string }): void
  connect(onResult: (r: ToolResult) => void, onEnvironment: (theme: string, mode: string) => void): Promise<void>
  call(name: string, args: Record<string, unknown>): Promise<ToolResult>
  context(selection: Selecao): Promise<void>
  ask(text: string): Promise<void>
  expand(): Promise<void>
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
  async connect(onResult: (r: ToolResult) => void, onEnvironment: (theme: string, mode: string) => void) {
    this.app.ontoolresult = result => onResult(result as ToolResult)
    this.app.onhostcontextchanged = ctx => onEnvironment(ctx.theme ?? 'light', ctx.displayMode ?? 'inline')
    if (window.parent === window) throw new Error('Abra o CoachPilot pela conexão autenticada no ChatGPT.')
    await this.app.connect(undefined, { timeout: 15000 })
    const ctx = this.app.getHostContext()
    onEnvironment(ctx?.theme ?? 'light', ctx?.displayMode ?? 'inline')
  }
  async call(name: string, args: Record<string, unknown>) {
    return assertResult(await this.app.callServerTool({ name, arguments: args }, { timeout: 30000 }) as ToolResult)
  }
  async context(selection: Selecao) {
    if (this.app.getHostCapabilities()?.updateModelContext) {
      await this.app.updateModelContext({ structuredContent: { coachpilot: selection } })
    }
  }
  async ask(text: string) {
    const result = await this.app.sendMessage({ role: 'user', content: [{ type: 'text', text }] })
    if (result.isError) throw new Error('O host não aceitou o pedido. Envie-o na conversa.')
  }
  async expand() {
    const modes = this.app.getHostContext()?.availableDisplayModes
    if (modes?.includes('fullscreen')) { await this.app.requestDisplayMode({ mode: 'fullscreen' }); return }
    // Extensão opcional, isolada da apresentação.
    const openai = (window as unknown as { openai?: { requestDisplayMode?: (args: { mode: string }) => Promise<unknown> } }).openai
    if (openai?.requestDisplayMode) await openai.requestDisplayMode({ mode: 'fullscreen' })
  }
  dispose() { void this.app.close() }
}
