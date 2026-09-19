import { useEffect } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { AuthProvider, useAuth } from '@/features/auth/AuthContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { SuperAdminPage } from '@/features/superadmin/SuperAdminPage'
import { ToastProvider } from '@/components/ui/toast'
import { ThemeProvider } from '@/lib/theme'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/brand'
import { AdminLogin } from './AdminLogin'

function Carregando() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  )
}

function AcessoNegado() {
  const { user, signOut } = useAuth()

  // Um usuario comum que caiu aqui nao permanece logado neste portal.
  useEffect(() => {
    void signOut()
  }, [signOut])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/12 text-destructive">
          <ShieldAlert className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-xl font-extrabold tracking-tight">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {user?.nome ? `${user.nome}, este` : 'Este'} ambiente e exclusivo do Super Admin da
          plataforma.
        </p>
        <a href={import.meta.env.BASE_URL} className="mt-6 block">
          <Button variant="outline" className="w-full">
            Voltar ao site
          </Button>
        </a>
      </div>
    </div>
  )
}

function PortalAdmin() {
  const { user, loading } = useAuth()

  if (loading) return <Carregando />
  if (!user) return <AdminLogin />
  if (user.role !== 'superadmin') return <AcessoNegado />

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path={ROUTES.superadmin} element={<SuperAdminPage />} />
          <Route path="*" element={<SuperAdminPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export function AdminApp() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <PortalAdmin />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
