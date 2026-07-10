// Tipos do módulo compartilhado de dados SEO (ver publicSeoData.js).

export type PageKey =
  | 'software-personal-trainer'
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

export type SeoPage = {
  path: string
  title: string
  description: string
  h1: string
  intro: string
  bullets: string[]
  sections: { title: string; body: string }[]
  faqs: { q: string; a: string }[]
  related: PageKey[]
}

export declare const BASE_URL: string
export declare const PAGES: Record<PageKey, SeoPage>
export declare const EXTRA_PUBLIC_PATHS: string[]
export declare function allPublicPaths(): string[]
