import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Amplify } from 'aws-amplify'

import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { ToastProvider, ConfirmProvider, Spinner } from './components/ui'
import { LoginPage } from './auth/LoginPage'
import { SignUpPage } from './auth/SignUpPage'
import { ForgotPasswordPage } from './auth/ForgotPasswordPage'
import LandingPage from './pages/landing/LandingPage'
import { AppLayout } from './components/layout/AppLayout'

// Code-splitting: cada página do portal autenticado e o app do aluno viram chunks
// separados — o aluno (link de WhatsApp, rede móvel) não baixa o JS do portal inteiro
// (PERFORMANCE_ESCALA.md §3). Imports nomeados preservados via .then(m => ({ default: ... })).
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const AlunosPage = lazy(() => import('./pages/AlunosPage').then((m) => ({ default: m.AlunosPage })))
const AgendaPage = lazy(() => import('./pages/AgendaPage').then((m) => ({ default: m.AgendaPage })))
const TemplatesPage = lazy(() => import('./pages/TemplatesPage').then((m) => ({ default: m.TemplatesPage })))
const AlunoDetailPage = lazy(() => import('./pages/AlunoDetailPage').then((m) => ({ default: m.AlunoDetailPage })))
const AlunoEvolucaoPage = lazy(() => import('./pages/AlunoEvolucaoPage').then((m) => ({ default: m.AlunoEvolucaoPage })))
const AvaliacoesPage = lazy(() => import('./pages/AvaliacoesPage').then((m) => ({ default: m.AvaliacoesPage })))
const BibliotecaPage = lazy(() => import('./pages/BibliotecaPage').then((m) => ({ default: m.BibliotecaPage })))
const PendenciasPage = lazy(() => import('./pages/PendenciasPage').then((m) => ({ default: m.PendenciasPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const AlunoApp = lazy(() => import('./pages/AlunoApp').then((m) => ({ default: m.AlunoApp })))
const FeedGlobalPage = lazy(() => import('./pages/FeedGlobalPage').then((m) => ({ default: m.FeedGlobalPage })))
const RankingPage = lazy(() => import('./pages/RankingPage').then((m) => ({ default: m.RankingPage })))
const PersonalProfilePage = lazy(() => import('./pages/PersonalProfilePage').then((m) => ({ default: m.PersonalProfilePage })))

function PageFallback() {
  return (
    <div className="flex justify-center items-center min-h-[50vh]">
      <Spinner />
    </div>
  )
}

function lazyPage(element: ReactNode) {
  return <Suspense fallback={<PageFallback />}>{element}</Suspense>
}

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
  { path: '/aluno', element: lazyPage(<AlunoApp />) },     // app do aluno (JWT do magic-link)
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignUpPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: 'dashboard', element: lazyPage(<DashboardPage />) },
      { path: 'alunos', element: lazyPage(<AlunosPage />) },
      { path: 'agenda', element: lazyPage(<AgendaPage />) },
      { path: 'templates', element: lazyPage(<TemplatesPage />) },
      { path: 'alunos/:alunoId', element: lazyPage(<AlunoDetailPage />) },
      { path: 'alunos/:alunoId/evolucao', element: lazyPage(<AlunoEvolucaoPage />) },
      { path: 'alunos/:alunoId/avaliacoes', element: lazyPage(<AvaliacoesPage />) },
      { path: 'biblioteca', element: lazyPage(<BibliotecaPage />) },
      { path: 'feed', element: lazyPage(<FeedGlobalPage />) },
      { path: 'ranking', element: lazyPage(<RankingPage />) },
      { path: 'notificacoes', element: lazyPage(<PendenciasPage />) },
      { path: 'config', element: lazyPage(<SettingsPage />) },
      { path: 'perfil', element: lazyPage(<PersonalProfilePage />) },
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
