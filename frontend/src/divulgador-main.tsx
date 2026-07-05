import './index.css'
import './loja/loja.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Amplify } from 'aws-amplify'
import { ToastProvider } from './components/ui/Toast'
import { ConfirmProvider } from './components/ui/Confirm'
import { DivulgadorApp } from './divulgador/DivulgadorApp'

// Mesmo User Pool do portal (padrão da loja) — divulgador loga com a conta CoachPilot
// comum; o backend só libera o painel se a conta estiver registrada como divulgador.
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
    },
  },
})

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 60_000 } },
})

// Identidade de marca dark fixa, como a loja.
document.documentElement.setAttribute('data-theme', 'dark')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <ConfirmProvider>
          <DivulgadorApp />
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>
)
