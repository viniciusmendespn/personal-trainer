// Tipos do módulo compartilhado do Mídia Kit (ver mediaKitData.js).

/** Link com evento de analytics opcional. `href` interno começa com "/". */
export type MediaKitLink = {
  label: string
  href: string
  /** Nome do evento GA4 disparado no clique (ver MediaKitPage.tsx). */
  event?: string
}

export type MediaKitCard = { titulo: string; desc: string }

export type MediaKitFormato = {
  titulo: string
  desc: string
  itens: string[]
  /** Formato principal — recebe destaque visual. */
  destaque?: boolean
  cta?: MediaKitLink & { label: string }
}

export type MediaKitImagem = {
  src: string
  alt: string
  legenda: string
  /** Ocupa a linha inteira da grade. */
  largo?: boolean
  /** Print de celular — renderizado estreito e centralizado. */
  retrato?: boolean
}

export type MediaKit = {
  path: string
  title: string
  description: string
  hero: {
    eyebrow: string
    h1: string
    subheadline: string
    ctaPrimario: MediaKitLink
    ctaSecundario: MediaKitLink
  }
  resumo: { titulo: string; paragrafo: string; cards: MediaKitCard[] }
  publico: { titulo: string; intro: string; itens: string[]; nota: string }
  diferenciais: MediaKitCard[]
  metricas: { valor: string; label: string }[]
  metricasNota: string
  parceria: { titulo: string; paragrafo: string; beneficios: string[] }
  formatos: MediaKitFormato[]
  formatosNota: string
  sinergia: { titulo: string; paragrafo: string; colunas: MediaKitCard[] }
  provaVisual: { titulo: string; intro: string; imagens: MediaKitImagem[] }
  links: (MediaKitLink & { valor: string })[]
  contato: {
    titulo: string
    paragrafo: string
    whatsapp: MediaKitLink
    instagram: MediaKitLink
    site: MediaKitLink
  }
  faqs: { q: string; a: string }[]
}

export declare const MEDIA_KIT_PATH: string
export declare const MEDIA_KIT: MediaKit
