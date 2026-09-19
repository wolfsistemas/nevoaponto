import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthContext'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { ToastProvider } from '@/components/ui/toast'
import { ThemeProvider } from '@/lib/theme'
import { LoginPage } from '@/features/auth/LoginPage'
import { LandingPage } from '@/features/landing/LandingPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { ColaboradoresPage } from '@/features/colaboradores/ColaboradoresPage'
import { ObrasPage } from '@/features/obras/ObrasPage'
import { PontoPage } from '@/features/ponto/PontoPage'
import { AprovacaoPage } from '@/features/ponto/AprovacaoPage'
import { FolhaPage } from '@/features/folha/FolhaPage'
import { PagamentosPage } from '@/features/pagamentos/PagamentosPage'
import { RelatoriosPage } from '@/features/relatorios/RelatoriosPage'
import { ROUTES } from '@/lib/brand'

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <HashRouter>
            <Routes>
              <Route path={ROUTES.home} element={<LandingPage />} />
              <Route path={ROUTES.login} element={<LoginPage />} />
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path={ROUTES.dashboard} element={<DashboardPage />} />
                <Route path={ROUTES.colaboradores} element={<ColaboradoresPage />} />
                <Route path={ROUTES.obras} element={<ObrasPage />} />
                <Route path={ROUTES.ponto} element={<PontoPage />} />
                <Route path={ROUTES.aprovacao} element={<AprovacaoPage />} />
                <Route path={ROUTES.folha} element={<FolhaPage />} />
                <Route path={ROUTES.pagamentos} element={<PagamentosPage />} />
                <Route path={ROUTES.relatorios} element={<RelatoriosPage />} />
              </Route>
              <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
            </Routes>
          </HashRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
