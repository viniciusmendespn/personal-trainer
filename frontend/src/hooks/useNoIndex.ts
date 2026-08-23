import { useEffect } from 'react'

// Marca a rota atual como noindex/nofollow.
//
// Necessário porque as páginas públicas de formulário (/cadastro, /@slug) são servidas pelo
// mesmo index.html das páginas de marketing, que declara `index, follow` — sem esta troca em
// runtime elas herdam a permissão de indexação. robots.txt não resolve: ele barra o
// rastreamento do Googlebot, mas não vale para o Safe Browsing nem para os demais crawlers,
// e página com formulário pedindo dado pessoal indexada é o que dispara "página enganosa".
//
// Restaura o valor anterior ao desmontar: navegação client-side da landing para /@slug e de
// volta não pode deixar a home marcada como noindex.
export function useNoIndex() {
  useEffect(() => {
    const existente = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null
    const anterior = existente?.getAttribute('content') ?? null
    const el =
      existente ??
      document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'robots' }))
    el.setAttribute('content', 'noindex, nofollow')
    return () => {
      // `existente` (e não `anterior === null`) decide quem remove: uma tag sem content na
      // página não é nossa para apagar.
      if (existente) el.setAttribute('content', anterior ?? '')
      else el.remove()
    }
  }, [])
}
