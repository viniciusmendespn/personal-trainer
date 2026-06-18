import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Amplify } from 'aws-amplify'

import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { ToastProvider, ConfirmProvider } from './components/ui'
import { LoginPage } from './auth/LoginPage'
import { SignUpPage } from './auth/SignUpPage'
import LandingPage from './pages/landing/LandingPage'
import { AppLayout } from './components/layout/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { AlunosPage } from './pages/AlunosPage'
import { AgendaPage } from './pages/AgendaPage'
import { TemplatesPage } from './pages/TemplatesPage'
import { AlunoDetailPage } from './pages/AlunoDetailPage'
import { AlunoEvolucaoPage } from './pages/AlunoEvolucaoPage'
import { AvaliacoesPage } from './pages/AvaliacoesPage'
import { BibliotecaPage } from './pages/BibliotecaPage'
import { PendenciasPage } from './pages/PendenciasPage'
import { SettingsPage } from './pages/SettingsPage'
import { AlunoApp } from './pages/AlunoApp'
import { FeedGlobalPage } from './pages/FeedGlobalPage'
import { RankingPage } from './pages/RankingPage'
import { PersonalProfilePage } from './pages/PersonalProfilePage'

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
    },
  },
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 60_000 },
  },
})

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/aluno', element: <AlunoApp /> },     // app do aluno (JWT do magic-link)
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignUpPage /> },
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'alunos', element: <AlunosPage /> },
      { path: 'agenda', element: <AgendaPage /> },
      { path: 'templates', element: <TemplatesPage /> },
      { path: 'alunos/:alunoId', element: <AlunoDetailPage /> },
      { path: 'alunos/:alunoId/evolucao', element: <AlunoEvolucaoPage /> },
      { path: 'alunos/:alunoId/avaliacoes', element: <AvaliacoesPage /> },
      { path: 'biblioteca', element: <BibliotecaPage /> },
      { path: 'feed', element: <FeedGlobalPage /> },
      { path: 'ranking', element: <RankingPage /> },
      { path: 'notificacoes', element: <PendenciasPage /> },
      { path: 'config', element: <SettingsPage /> },
      { path: 'perfil', element: <PersonalProfilePage /> },
    ],
  },
])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}
