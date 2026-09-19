import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/features/auth/AuthContext'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { ToastProvider } from '@/components/ui/toast'
import { ThemeProvider } from '@/lib/theme'
import { LoginPage } from '@/features/auth/LoginPage'
import { SignupPage } from '@/features/auth/SignupPage'
import { RecuperarSenhaPage } from '@/features/auth/RecuperarSenhaPage'
import { RedefinirSenhaPage } from '@/features/auth/RedefinirSenhaPage'
import { LandingPage } from '@/features/landing/LandingPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { ColaboradoresPage } from '@/features/colaboradores/ColaboradoresPage'
import { ObrasPage } from '@/features/obras/ObrasPage'
import { PontoPage } from '@/features/ponto/PontoPage'
import { AprovacaoPage } from '@/features/ponto/AprovacaoPage'
import { FolhaPage } from '@/features/folha/FolhaPage'
import { PagamentosPage } from '@/features/pagamentos/PagamentosPage'
import { RelatoriosPage } from '@/features/relatorios/RelatoriosPage'
import { AssinaturaPage } from '@/features/billing/AssinaturaPage'
import { SuperAdminPage } from '@/features/superadmin/SuperAdminPage'
import { TermosPage } from '@/features/legal/TermosPage'
import { PrivacidadePage } from '@/features/legal/PrivacidadePage'
import { ROUTES } from '@/lib/brand'

function RotaPainel() {
  const { user } = useAuth()
  if (user?.role === 'superadmin') return <Navigate to={ROUTES.superadmin} replace />
  return <DashboardPage />
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <HashRouter>
            <Routes>
              <Route path={ROUTES.home} element={<LandingPage />} />
              <Route path={ROUTES.login} element={<LoginPage />} />
              <Route path={ROUTES.signup} element={<SignupPage />} />
              <Route path={ROUTES.recuperarSenha} element={<RecuperarSenhaPage />} />
              <Route path={ROUTES.redefinirSenha} element={<RedefinirSenhaPage />} />
              <Route path={ROUTES.termos} element={<TermosPage />} />
              <Route path={ROUTES.privacidade} element={<PrivacidadePage />} />
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path={ROUTES.dashboard} element={<RotaPainel />} />
                <Route path={ROUTES.colaboradores} element={<ColaboradoresPage />} />
                <Route path={ROUTES.obras} element={<ObrasPage />} />
                <Route path={ROUTES.ponto} element={<PontoPage />} />
                <Route path={ROUTES.aprovacao} element={<AprovacaoPage />} />
                <Route path={ROUTES.folha} element={<FolhaPage />} />
                <Route path={ROUTES.pagamentos} element={<PagamentosPage />} />
                <Route path={ROUTES.relatorios} element={<RelatoriosPage />} />
                <Route path={ROUTES.assinatura} element={<AssinaturaPage />} />
                <Route
                  path={ROUTES.superadmin}
                  element={
                    <ProtectedRoute roles={['superadmin']}>
                      <SuperAdminPage />
                    </ProtectedRoute>
                  }
                />
              </Route>
              <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
            </Routes>
          </HashRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
