import { useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Clock, KeyRound, LogOut, Menu, Moon, Sun, X } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { ChangePasswordDialog } from '@/features/auth/ChangePasswordDialog'
import { useTheme } from '@/lib/theme'
import { BRAND } from '@/lib/brand'
import { api } from '@/data/api'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { itensDoPerfil } from './nav'

const ROLE_LABEL: Record<string, string> = {
  superadmin: 'Super Admin',
  admin: 'Administrador',
  encarregado: 'Encarregado',
  funcionario: 'Funcionario',
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow">
        <Clock className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-extrabold tracking-tight">{BRAND.name}</p>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Ponto & Folha
        </p>
      </div>
    </div>
  )
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()
  if (!user) return null
  return (
    <nav className="flex flex-col gap-1">
      {itensDoPerfil(user.role).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
              isActive
                ? 'bg-primary/12 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )
          }
        >
          <item.icon className="h-[18px] w-[18px]" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function AppLayout({ children }: { children?: ReactNode }) {
  const { user, signOut } = useAuth()
  const { tema, alternar } = useTheme()
  const [menuAberto, setMenuAberto] = useState(false)
  const [senhaAberta, setSenhaAberta] = useState(false)
  const itens = user ? itensDoPerfil(user.role) : []
  const mobileItems = itens.filter((i) => i.mobile).slice(0, 4)

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar desktop */}
      <aside className="no-print hidden w-64 shrink-0 flex-col border-r border-border bg-card/60 p-4 lg:flex">
        <div className="px-2 py-1">
          <Logo />
        </div>
        <div className="mt-6 flex-1">
          <NavLinks />
        </div>
        {api.modo === 'local' && (
          <div className="mb-2 rounded-xl bg-warning/15 p-3 text-[11px] font-semibold text-warning-foreground dark:text-warning">
            Modo demonstracao: dados locais. Configure o Supabase no .env para usar o banco.
          </div>
        )}
        <div className="rounded-xl border border-border p-3">
          <p className="truncate text-sm font-bold">{user?.nome}</p>
          <p className="text-xs text-muted-foreground">{ROLE_LABEL[user?.role ?? '']}</p>
          <button
            onClick={() => setSenhaAberta(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
          >
            <KeyRound className="h-4 w-4" /> Alterar senha
          </button>
          <button
            onClick={signOut}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:text-destructive"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Drawer mobile */}
      {menuAberto && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setMenuAberto(false)} />
          <div className="absolute left-0 top-0 h-full w-72 border-r border-border bg-card p-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <Logo />
              <button onClick={() => setMenuAberto(false)} className="rounded-full p-1.5 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-6">
              <NavLinks onNavigate={() => setMenuAberto(false)} />
            </div>
            <button
              onClick={() => {
                setMenuAberto(false)
                setSenhaAberta(true)
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm font-bold text-muted-foreground hover:text-foreground"
            >
              <KeyRound className="h-4 w-4" /> Alterar senha
            </button>
            <button
              onClick={signOut}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm font-bold text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-xl">
          <button onClick={() => setMenuAberto(true)} className="rounded-lg p-2 hover:bg-muted lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 lg:hidden">
            <Logo />
          </div>
          <div className="hidden flex-1 items-center gap-2 lg:flex">
            <Badge variant={api.modo === 'supabase' ? 'success' : 'secondary'}>
              {api.modo === 'supabase' ? 'Supabase' : 'Demo local'}
            </Badge>
          </div>
          <button
            onClick={() => setSenhaAberta(true)}
            className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Alterar senha"
          >
            <KeyRound className="h-5 w-5" />
          </button>
          <button
            onClick={alternar}
            className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Alternar tema"
          >
            {tema === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <div className="hidden items-center gap-2 sm:flex">
            <div className="text-right leading-tight">
              <p className="text-sm font-bold">{user?.nome}</p>
              <p className="text-[11px] text-muted-foreground">{ROLE_LABEL[user?.role ?? '']}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/12 text-sm font-extrabold text-primary">
              {user?.nome?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pb-24 pt-5 lg:px-8 lg:pb-10">
          <div className="mx-auto w-full max-w-6xl">{children ?? <Outlet />}</div>
        </main>

        {/* Bottom nav mobile */}
        <nav className="no-print fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border bg-background/90 px-2 py-1.5 backdrop-blur-xl lg:hidden">
          {mobileItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-bold transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <ChangePasswordDialog open={senhaAberta} onClose={() => setSenhaAberta(false)} />
    </div>
  )
}
