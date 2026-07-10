import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/installPrompt' // suprime beforeinstallprompt antes do React montar
import App from './App'
import { ErrorBoundary } from './components/ui/ErrorBoundary'

// O manifest correto já está no <head> do HTML servido pelo CloudFront:
// aluno.html → aluno.webmanifest (verde, "Treinos — CoachPilot")
// index.html  → manifest.webmanifest (escuro, "CoachPilot — Portal")
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
