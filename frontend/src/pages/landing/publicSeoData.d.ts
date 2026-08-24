// Tipos do módulo compartilhado de dados SEO (ver publicSeoData.js).

export type PageKey =
  | 'software-personal-trainer'
  | 'ia-personal-trainer'
  | 'chatgpt-personal-trainer'
  | 'app-personal-trainer'
  | 'gestao-alunos'
  | 'app-treino-alunos'
  | 'avaliacao-fisica'
  | 'agenda-personal'
  | 'whatsapp-personal'
  | 'coachpilot-vs-planilhas'
  | 'precos'
  | 'faq'
  | 'sobre'
  | 'termos'
  | 'privacidade'

/** Widget interativo da página (calculadoras). O valor NÃO é derivável do path:
 *  os slugs carregam keyword (/calculadoras/quanto-cobrar), então a ligação
 *  widget↔página é explícita e validada no assert do prerender. */
export type WidgetKind =
  | '1rm'
  | 'dobras'
  | 'precificacao'
  | 'volume'
  | 'energia'

export type SeoTable = { headers: string[]; rows: string[][] }

export type SeoSection = {
  title: string
  /** Parágrafo único — formato das páginas legadas. Exclusivo com `paragraphs`. */
  body?: string
  /** Múltiplos parágrafos. Tem precedência sobre `body` quando ambos existem. */
  paragraphs?: string[]
  list?: string[]
  table?: SeoTable
}
// body/paragraphs/list/table aceitam links inline [texto](/rota) — mesmo parser
// do blog (renderInline em prose.tsx, inline() no prerender).

export type SeoPage = {
  path: string
  title: string
  description: string
  h1: string
  intro: string
  bullets: string[]
  sections: SeoSection[]
  faqs: { q: string; a: string }[]
  related: PageKey[]

  // ── extensões (2026-08, calculadoras) — todas opcionais ──
  /** Rótulo curto para pílulas de `related`, cards de `index` e breadcrumb.
   *  Default: h1.replace('CoachPilot vs ', 'Vs '). */
  label?: string
  /** Sobrescreve o eyebrow do hero ("CoachPilot para personal trainers"). */
  eyebrow?: string
  /** Página-mãe: entra no BreadcrumbList (nível 2) e no link "Voltar". */
  parent?: PageKey
  /** Páginas-filhas listadas como cards (página hub). Exclusivo com `widget`. */
  index?: PageKey[]
  /** Widget React interativo. Exclusivo com `index`. */
  widget?: WidgetKind
  /** H2 da seção do widget/hub — fonte única para o React E o prerender. */
  widgetTitle?: string
  /** Parágrafo de apoio abaixo do H2 do widget. */
  widgetNote?: string
  /** applicationCategory do nó WebApplication no JSON-LD. Default 'HealthApplication'. */
  appCategory?: string
}

export declare const BASE_URL: string
export declare const WIDGET_KINDS: readonly WidgetKind[]
export declare const PAGES: Record<PageKey, SeoPage>
export declare const EXTRA_PUBLIC_PATHS: string[]
export declare function allPublicPaths(): string[]
