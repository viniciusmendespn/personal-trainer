// Tipos do módulo compartilhado de artigos do blog (ver blogData.js).

export type BlogSection = {
  h2: string
  paragraphs: string[]
  list?: string[]
  table?: { headers: string[]; rows: string[][] }
  // Prompts copiáveis, numerados continuamente ao longo do artigo.
  prompts?: string[]
  // Caixa de destaque com CTA, renderizada ao fim da seção.
  callout?: { title: string; text: string; cta?: { label: string; to: string } }
}

export type BlogPost = {
  slug: string
  title: string
  description: string
  h1: string
  datePublished: string
  dateModified: string
  readingMinutes: number
  intro: string
  sections: BlogSection[]
  faqs: { q: string; a: string }[]
  related: { label: string; to: string }[]
}

export declare const BLOG_POSTS: BlogPost[]
export declare const BLOG_BASE: {
  path: string
  title: string
  description: string
  h1: string
  intro: string
}
