import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ErrorBoundary } from './components/ui/ErrorBoundary'

// Injeta o manifesto correto antes de montar o React para que o browser
// exiba o nome/ícone certo no prompt de instalação do PWA.
;(function injectManifest() {
  const isAluno = window.location.pathname.startsWith('/aluno')
  if (!isAluno) return
  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'manifest'
    document.head.appendChild(link)
  }
  link.href = '/manifest-aluno.webmanifest'
})()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
