import { useState, type FormEvent } from 'react'
import { ArrowRight, KeyRound, Lock, ShieldCheck, User } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { BRAND } from '@/lib/brand'

export function AdminLogin() {
  const { signIn } = useAuth()
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    const res = await signIn(login, senha)
    setCarregando(false)
    if (!res.ok) setErro(res.erro ?? 'Nao foi possivel entrar.')
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#0b0b12] p-10 text-white lg:flex">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/40 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
            <ShieldCheck className="h-6 w-6 text-accent" />
          </div>
          <div>
            <p className="text-lg font-extrabold tracking-tight">{BRAND.name}</p>
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Admin</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Painel administrativo da plataforma.
          </h1>
          <p className="mt-4 text-white/70">
            Empresas, usuarios, planos, assinaturas e auditoria. Acesso exclusivo do Super Admin.
          </p>
        </div>

        <p className="relative text-xs text-white/40">
          {BRAND.company} - {BRAND.domain}
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-fade-in">
          <a
            href={import.meta.env.BASE_URL}
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowRight className="h-4 w-4 rotate-180" />
            Voltar ao site
          </a>

          <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground lg:hidden">
            <ShieldCheck className="h-6 w-6" />
          </div>

          <h2 className="text-xl font-extrabold tracking-tight">Acesso administrativo</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Entre com o usuario Super Admin para continuar.
          </p>

          {erro && (
            <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm font-semibold text-destructive">
              {erro}
            </div>
          )}

          <form onSubmit={entrar} className="space-y-4">
            <Field label="Usuario">
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="superadmin"
                  autoComplete="username"
                  className="pl-9"
                  autoFocus
                />
              </div>
            </Field>
            <Field label="Senha">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="........"
                  autoComplete="current-password"
                  className="pl-9"
                />
              </div>
            </Field>
            <Button type="submit" className="w-full" size="lg" disabled={carregando}>
              {carregando ? 'Entrando...' : 'Entrar'}
              {!carregando && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <KeyRound className="h-3.5 w-3.5" />
            Ambiente restrito. Acessos sao registrados na auditoria.
          </p>
        </div>
      </div>
    </div>
  )
}
