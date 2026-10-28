/**
 * De onde a visita veio e que página do site foi vista — alimenta a aba **Campanhas** do
 * painel admin (`backend/app/services/campanha_service.py`).
 *
 * Link de anúncio/post: `https://coachpilot.com.br/?campanha-instagram` (ou
 * `?campanha=instagram`, ou a marcação padrão `?utm_source=instagram`). Link de divulgador
 * (`?ref=MARIA` / `?cupom=MARIA`) conta como `cupom-maria`. Sem marcação, a origem sai do
 * auto-tagging (`gclid`, `fbclid`), do referrer ou vira `direto`.
 *
 * ⚠️ `fetch` cru, e não o axios do `api/client`: telemetria que falha é telemetria que não
 * conta, nunca um erro para o visitante — e sem interceptor de auth no meio.
 *
 * ⚠️ Nada aqui roda no render: o chamador assina o router em `App.tsx`.
 */
import { allPublicPaths } from '../pages/landing/publicSeoData.js'

/**
 * ⚠️ ESPELHO de `ORIGEM_VALIDA` em `campanha_service.py` — `campanha.test.ts` lê a regex do
 * `.py` e reprova se divergirem: origem aceita aqui e recusada lá é descartada em silêncio.
 */
export const ORIGEM_VALIDA = /^[a-z0-9][a-z0-9-]{0,23}$/

/** ⚠️ ESPELHO de `CAMINHO_VALIDO` em `campanha_service.py` (o teste compara). */
export const CAMINHO_VALIDO = /^\/(?:[a-z0-9-]{1,80}(?:\/[a-z0-9-]{1,80})?)?$/

const CHAVE_ORIGEM = 'cp:campanha'
const CHAVE_PAGINAS = 'cp:paginas'

/** Reduz ao alfabeto da chave, ou `null` se não sobrar nada. */
export function normalizarOrigem(bruta: string | null | undefined): string | null {
  const origem = (bruta ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    // Corta ANTES de limpar as pontas: cortar depois deixaria um hífen no fim.
    .slice(0, 24)
    .replace(/^-+|-+$/g, '')
  return ORIGEM_VALIDA.test(origem) ? origem : null
}

/**
 * A origem declarada na query string, se houver. `utm_source` tem precedência: é o que as
 * outras ferramentas leem, e duas contagens com nomes diferentes para a mesma campanha é
 * pior que uma.
 */
export function origemDaBusca(busca: string): string | null {
  const params = new URLSearchParams(busca)
  const utm = params.get('utm_source')
  if (utm) return normalizarOrigem(utm)

  for (const chave of params.keys()) {
    const nome = chave.trim().toLowerCase()
    if (!nome.startsWith('campanha')) continue
    // `?campanha-instagram` chega como chave `campanha-instagram` com valor vazio.
    return normalizarOrigem(params.get(chave) || nome.slice('campanha'.length))
  }

  const cupom = params.get('ref') || params.get('cupom')
  if (cupom) return normalizarOrigem(`cupom-${cupom}`)
  return null
}

/** Referrers conhecidos, para não ter `l-instagram-com` e `instagram-com` separados. */
const REFERRERS: [RegExp, string][] = [
  [/(^|\.)google\.[a-z.]+$/, 'google-busca'],
  [/(^|\.)bing\.com$/, 'bing'],
  [/(^|\.)duckduckgo\.com$/, 'duckduckgo'],
  [/(^|\.)yahoo\.com$/, 'yahoo'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)facebook\.com$/, 'facebook'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'x'],
  [/(^|\.)youtube\.com$/, 'youtube'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)linkedin\.com$/, 'linkedin'],
  [/(^|\.)whatsapp\.com$/, 'whatsapp'],
  // Mesmo nome que o `utm_source=chatgpt.com` que o próprio ChatGPT acrescenta.
  [/(^|\.)(chatgpt\.com|chat\.openai\.com)$/, 'chatgpt-com'],
  [/^loja\.coachpilot\.com\.br$/, 'loja'],
  [/^divulgador\.coachpilot\.com\.br$/, 'painel-divulgador'],
  [/^app\.coachpilot\.com\.br$/, 'app-aluno'],
]

/**
 * A origem de uma visita SEM marcação. `null` para navegação interna (referrer do próprio
 * site): é recarga ou saída do portal, não uma visita nova.
 */
export function origemImplicita(busca: string, referrer: string, hostAtual: string): string | null {
  const params = new URLSearchParams(busca)
  // Auto-tagging do Google Ads (gclid; gbraid/wbraid no iOS) e do Meta (fbclid).
  if (params.has('gclid') || params.has('gbraid') || params.has('wbraid')) return 'google-ads'
  if (params.has('fbclid')) return 'meta'

  if (!referrer) return 'direto'
  let host: string
  try {
    host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return 'direto'
  }
  if (host === hostAtual.toLowerCase().replace(/^www\./, '') || host === 'coachpilot.com.br') return null
  for (const [padrao, origem] of REFERRERS) {
    if (padrao.test(host)) return origem
  }
  return normalizarOrigem(host)
}

const PUBLICAS = new Set<string>([...allPublicPaths(), '/blog', '/midia-kit', '/signup'])

/**
 * O caminho, se for página do site (landing, SEO, calculadoras, blog, cadastro); `null`
 * para portal, app e `/@slug` (captação do personal — tráfego de prospect dele, não nosso).
 */
export function paginaInstitucional(pathname: string): string | null {
  let caminho = pathname.trim().toLowerCase()
  if (caminho.length > 1) caminho = caminho.replace(/\/+$/, '')
  if (!CAMINHO_VALIDO.test(caminho)) return null
  if (PUBLICAS.has(caminho) || caminho.startsWith('/blog/')) return caminho
  return null
}

/** Robôs que executam JS (Googlebot renderiza) não contam como visita. */
function ehRobo(): boolean {
  try {
    return navigator.webdriver === true ||
      /bot|crawl|spider|slurp|preview|headless|lighthouse/i.test(navigator.userAgent)
  } catch {
    return false
  }
}

/** Marca `valor` como já visto nesta aba; `true` se já tinha sido. */
function jaVistoNaAba(chave: string, valor: string, lista: boolean): boolean {
  try {
    if (!lista) {
      if (sessionStorage.getItem(chave) === valor) return true
      sessionStorage.setItem(chave, valor)
      return false
    }
    const vistos: string[] = JSON.parse(sessionStorage.getItem(chave) || '[]')
    if (vistos.includes(valor)) return true
    sessionStorage.setItem(chave, JSON.stringify([...vistos, valor].slice(-100)))
    return false
  } catch {
    // Armazenamento bloqueado: conta como visita nova. Contar duas vezes é melhor que
    // perder o clique.
    return false
  }
}

let origemAvaliada = false

/**
 * Registra uma página vista — e, na PRIMEIRA chamada da carga do documento, de onde a
 * visita veio. Silenciosa: nada a contar, nenhuma requisição; falha de rede, nenhum erro.
 *
 *  - link marcado conta em qualquer página;
 *  - sem marcação, só conta quando a ENTRADA é página do site (quem abre o portal direto
 *    já é cliente, não aquisição).
 *
 * Origem: uma vez por aba. Página: uma vez por caminho por aba (F5 não infla).
 */
export function registrarVisita(local: { pathname: string; search: string; referrer: string; host: string }): void {
  if (ehRobo()) return
  const pagina = paginaInstitucional(local.pathname)

  let origem: string | null = null
  if (!origemAvaliada) {
    origemAvaliada = true
    origem = origemDaBusca(local.search) ??
      (pagina ? origemImplicita(local.search, local.referrer, local.host) : null)
    if (origem && jaVistoNaAba(CHAVE_ORIGEM, origem, false)) origem = null
  }
  const paginaNova = pagina && !jaVistoNaAba(CHAVE_PAGINAS, pagina, true) ? pagina : null
  if (!origem && !paginaNova) return

  // `keepalive`: quem clica no anúncio e sai da página em seguida ainda conta.
  void fetch(`${import.meta.env.VITE_API_URL ?? ''}/v1/public/telemetry/visita`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origem: origem ?? '', pagina: paginaNova ?? '' }),
    keepalive: true,
  }).catch(() => {})
}
