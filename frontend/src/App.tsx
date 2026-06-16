import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Amplify } from 'aws-amplify'

import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { LoginPage } from './auth/LoginPage'
import { SignUpPage } from './auth/SignUpPage'
import { AppLayout } from './components/layout/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { AlunosPage } from './pages/AlunosPage'
import { AlunoDetailPage } from './pages/AlunoDetailPage'
import { AlunoEvolucaoPage } from './pages/AlunoEvolucaoPage'
import { AvaliacoesPage } from './pages/AvaliacoesPage'
import { BibliotecaPage } from './pages/BibliotecaPage'
import { AlertasPage } from './pages/AlertasPage'
import { SettingsPage } from './pages/SettingsPage'

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
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignUpPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'alunos', element: <AlunosPage /> },
      { path: 'alunos/:alunoId', element: <AlunoDetailPage /> },
      { path: 'alunos/:alunoId/evolucao', element: <AlunoEvolucaoPage /> },
      { path: 'alunos/:alunoId/avaliacoes', element: <AvaliacoesPage /> },
      { path: 'biblioteca', element: <BibliotecaPage /> },
      { path: 'alertas', element: <AlertasPage /> },
      { path: 'config', element: <SettingsPage /> },
    ],
  },
])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  )
}
