import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Amplify } from 'aws-amplify'

import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { ToastProvider, ConfirmProvider } from './components/ui'
import { SplashScreen } from './components/ui/SplashScreen'
import { LoginPage } from './auth/LoginPage'
import { SignUpPage } from './auth/SignUpPage'
import { ForgotPasswordPage } from './auth/ForgotPasswordPage'
import LandingPage from './pages/landing/LandingPage'
import { PublicSeoPage } from './pages/landing/PublicSeoPage'
import { AppLayout } from './components/layout/AppLayout'
import { ErrorPage } from './pages/ErrorPage'
import { PortalErrorPage } from './pages/PortalErrorPage'

// Code-splitting: cada página do portal autenticado e o app do aluno viram chunks
// separados — o aluno (link de WhatsApp, rede móvel) não baixa o JS do portal inteiro
// (PERFORMANCE_ESCALA.md §3). Imports nomeados preservados via .then(m => ({ default: ... })).
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const AlunosPage = lazy(() => import('./pages/AlunosPage').then((m) => ({ default: m.AlunosPage })))
const AgendaPage = lazy(() => import('./pages/AgendaPage').then((m) => ({ default: m.AgendaPage })))
const TemplatesPage = lazy(() => import('./pages/TemplatesPage').then((m) => ({ default: m.TemplatesPage })))
const RotinasPage = lazy(() => import('./pages/RotinasPage').then((m) => ({ default: m.RotinasPage })))
const AlunoDetailPage = lazy(() => import('./pages/AlunoDetailPage').then((m) => ({ default: m.AlunoDetailPage })))
const AlunoEvolucaoPage = lazy(() => import('./pages/AlunoEvolucaoPage').then((m) => ({ default: m.AlunoEvolucaoPage })))
const AvaliacoesPage = lazy(() => import('./pages/AvaliacoesPage').then((m) => ({ default: m.AvaliacoesPage })))
const BibliotecaPage = lazy(() => import('./pages/BibliotecaPage').then((m) => ({ default: m.BibliotecaPage })))
const ConhecimentoPage = lazy(() => import('./pages/ConhecimentoPage').then((m) => ({ default: m.ConhecimentoPage })))
const PendenciasPage = lazy(() => import('./pages/PendenciasPage').then((m) => ({ default: m.PendenciasPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const AlunoApp = lazy(() => import('./pages/AlunoApp').then((m) => ({ default: m.AlunoApp })))
const FeedGlobalPage = lazy(() => import('./pages/FeedGlobalPage').then((m) => ({ default: m.FeedGlobalPage })))
const RankingPage = lazy(() => import('./pages/RankingPage').then((m) => ({ default: m.RankingPage })))
const PersonalProfilePage = lazy(() => import('./pages/PersonalProfilePage').then((m) => ({ default: m.PersonalProfilePage })))
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })))
const CadastroPage = lazy(() => import('./pages/CadastroPage').then((m) => ({ default: m.CadastroPage })))
const AjudaPage = lazy(() => import('./pages/AjudaPage').then((m) => ({ default: m.AjudaPage })))
const DivulgadoresPage = lazy(() => import('./pages/landing/DivulgadoresPage').then((m) => ({ default: m.DivulgadoresPage })))
const PlanoPage = lazy(() => import('./pages/PlanoPage').then((m) => ({ default: m.PlanoPage })))
const PacotesPage = lazy(() => import('./pages/PacotesPage').then((m) => ({ default: m.PacotesPage })))

function PageFallback() {
  return <SplashScreen src="/novo-logo-slogan-vertical-semfundo.png" srcLight="/novo-logo-slogan-vertical-brancosemfundo.png" rounded={false} />
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
  {
    errorElement: <ErrorPage />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/software-para-personal-trainer', element: <PublicSeoPage pageKey="software-personal-trainer" /> },
      { path: '/app-para-personal-trainer', element: <PublicSeoPage pageKey="app-personal-trainer" /> },
      { path: '/gestao-de-alunos-personal-trainer', element: <PublicSeoPage pageKey="gestao-alunos" /> },
      { path: '/app-de-treino-para-alunos', element: <PublicSeoPage pageKey="app-treino-alunos" /> },
      { path: '/avaliacao-fisica-digital', element: <PublicSeoPage pageKey="avaliacao-fisica" /> },
      { path: '/agenda-para-personal-trainer', element: <PublicSeoPage pageKey="agenda-personal" /> },
      { path: '/whatsapp-para-personal-trainer', element: <PublicSeoPage pageKey="whatsapp-personal" /> },
      { path: '/coachpilot-vs-planilhas', element: <PublicSeoPage pageKey="coachpilot-vs-planilhas" /> },
      { path: '/precos', element: <PublicSeoPage pageKey="precos" /> },
      { path: '/faq', element: <PublicSeoPage pageKey="faq" /> },
      { path: '/sobre', element: <PublicSeoPage pageKey="sobre" /> },
      { path: '/aluno', element: lazyPage(<AlunoApp />) },     // dev only — prod served by aluno.html bundle
      { path: '/cadastro', element: lazyPage(<CadastroPage />) },  // auto-cadastro via link de anamnese
          { path: '/login', element: <LoginPage /> },
          { path: '/signup', element: <SignUpPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
          { path: '/divulgadores', element: lazyPage(<DivulgadoresPage />) },
          {
            element: (
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            ),
            children: [
              {
                // Wrapper pathless: errorElement renderiza dentro do Outlet do AppLayout,
                // mantendo sidebar e topbar intactos.
                errorElement: <PortalErrorPage />,
                children: [
                  { path: 'dashboard', element: lazyPage(<DashboardPage />) },
                  { path: 'alunos', element: lazyPage(<AlunosPage />) },
                  { path: 'agenda', element: lazyPage(<AgendaPage />) },
                  { path: 'templates', element: lazyPage(<TemplatesPage />) },
                  { path: 'rotinas', element: lazyPage(<RotinasPage />) },
                  { path: 'alunos/:alunoId', element: lazyPage(<AlunoDetailPage />) },
                  { path: 'alunos/:alunoId/evolucao', element: lazyPage(<AlunoEvolucaoPage />) },
                  { path: 'alunos/:alunoId/avaliacoes', element: lazyPage(<AvaliacoesPage />) },
                  { path: 'biblioteca', element: lazyPage(<BibliotecaPage />) },
                  { path: 'conhecimento', element: lazyPage(<ConhecimentoPage />) },
                  { path: 'pacotes', element: lazyPage(<PacotesPage />) },
                  { path: 'feed', element: lazyPage(<FeedGlobalPage />) },
                  { path: 'ranking', element: lazyPage(<RankingPage />) },
                  { path: 'notificacoes', element: lazyPage(<PendenciasPage />) },
                  { path: 'plano', element: lazyPage(<PlanoPage />) },
                  { path: 'config', element: lazyPage(<SettingsPage />) },
                  { path: 'perfil', element: lazyPage(<PersonalProfilePage />) },
                  { path: 'admin', element: lazyPage(<AdminPage />) },
                  { path: 'ajuda', element: lazyPage(<AjudaPage />) },
                ],
              },
            ],
          },
      { path: '*', element: <ErrorPage /> },
    ],
  },
])

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ConfirmProvider>
            <AuthProvider>
              <RouterProvider router={router} />
            </AuthProvider>
          </ConfirmProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
