// Shared with the public HTML prerender so social previews use the same covers.
export function blogPresentation(slug) {
  if (/melhor|alternativas|vs-|mfit/.test(slug))
    return {
      category: 'Ferramentas',
      image: '/images/coachpilot-editorial-v2.webp',
      alt: 'Ambiente de trabalho do personal trainer com planejamento e tecnologia',
    }
  if (/conseguir|gestao|planilha|ilimitados|gratis/.test(slug))
    return {
      category: 'Gestão e carreira',
      image: '/images/coachpilot-coaching-v2.webp',
      alt: 'Personal trainer acompanhando o planejamento de uma aluna',
    }
  if (/montar|atualizar|prompts/.test(slug))
    return {
      category: 'Treinos na prática',
      image: '/images/coachpilot-training-v2.webp',
      alt: 'Treinamento de força com acompanhamento de um profissional',
    }
  return {
    category: 'Inteligência artificial',
    image: '/images/coachpilot-editorial-v2.webp',
    alt: 'Tecnologia e planejamento na rotina do personal trainer',
  }
}

export const BLOG_CATEGORIES = [
  'Todos',
  'Inteligência artificial',
  'Gestão e carreira',
  'Treinos na prática',
  'Ferramentas',
]
