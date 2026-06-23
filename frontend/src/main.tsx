import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/installPrompt' // suprime beforeinstallprompt antes do React montar
import App from './App'
import { ErrorBoundary } from './components/ui/ErrorBoundary'

// O manifest correto já está no <head> do HTML servido pelo CloudFront:
// aluno.html → manifest-aluno.webmanifest (verde, "Meus Treinos")
// index.html  → manifest.webmanifest (escuro, "CoachPilot")
// Apenas atualiza o título da aba para a rota do aluno.
if (window.location.pathname.startsWith('/aluno')) {
  document.title = 'Meus Treinos — CoachPilot'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
