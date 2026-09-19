import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Clock, Lock, ShieldCheck, User, Wallet } from 'lucide-react'
import { useAuth } from './AuthContext'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { BRAND, ROUTES } from '@/lib/brand'
import { api } from '@/data/api'

const DEMO = [
  { login: 'admin', senha: 'demo', label: 'Administrador', desc: 'Acesso total' },
  { login: 'encarregado', senha: 'demo', label: 'Encarregado', desc: 'Aprova o ponto' },
  { login: 'funcionario', senha: 'demo', label: 'Funcionario', desc: 'Bate o ponto' },
]

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  // O Super Admin tem um portal exclusivo (admin.html) fora do app comum.
  useEffect(() => {
    if (login.trim().toLowerCase() === 'superadmin') {
      window.location.assign(`${import.meta.env.BASE_URL}admin.html`)
    }
  }, [login])

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    const res = await signIn(login, senha)
    setCarregando(false)
    if (res.ok) navigate(ROUTES.dashboard, { replace: true })
    else setErro(res.erro ?? 'Nao foi possivel entrar.')
  }

  async function acessoDemo(usuario: string) {
    setCarregando(true)
    const res = await signIn(usuario, 'demo')
    setCarregando(false)
    if (res.ok) navigate(ROUTES.dashboard, { replace: true })
    else setErro(res.erro ?? 'Nao foi possivel entrar.')
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Painel de marca */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#0b0b12] p-10 text-white lg:flex">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/40 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
            <Clock className="h-6 w-6 text-accent" />
          </div>
          <div>
            <p className="text-lg font-extrabold tracking-tight">{BRAND.name}</p>
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Ponto & Folha</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Ponto, folha e pagamento em um so lugar.
          </h1>
          <p className="mt-4 text-white/70">
            Registro por geolocalizacao, aprovacao do encarregado, folha completa com encargos CLT e
            recibos prontos para assinar.
          </p>
          <div className="mt-8 grid gap-3">
            {[
              { icon: ShieldCheck, txt: 'Regras de ponto e tolerancias configuraveis' },
              { icon: Wallet, txt: 'Folha com INSS, IRRF, FGTS, 13o e ferias' },
              { icon: Clock, txt: 'Fechamento, recibo e extrato em segundos' },
            ].map((f) => (
              <div key={f.txt} className="flex items-center gap-3 rounded-xl bg-white/5 p-3 backdrop-blur">
                <f.icon className="h-5 w-5 text-accent" />
                <span className="text-sm text-white/80">{f.txt}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/40">
          {BRAND.company} - {BRAND.domain}
        </p>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm animate-fade-in">
          <Link
            to={ROUTES.home}
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao site
          </Link>

          <div className="mb-8 lg:hidden">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Clock className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-extrabold">{BRAND.name}</h1>
            <p className="text-sm text-muted-foreground">{BRAND.tagline}</p>
          </div>

          <h2 className="text-xl font-extrabold tracking-tight">Bem-vindo de volta</h2>
          <p className="mb-6 text-sm text-muted-foreground">Entre com seu usuario para continuar.</p>

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
                  placeholder="admin"
                  autoComplete="username"
                  className="pl-9"
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

          <div className="mt-4 flex items-center justify-between text-sm">
            <Link
              to={ROUTES.recuperarSenha}
              className="font-semibold text-muted-foreground transition-colors hover:text-primary"
            >
              Esqueci a senha
            </Link>
            <Link to={ROUTES.signup} className="font-semibold text-primary hover:underline">
              Criar conta
            </Link>
          </div>

          {api.modo === 'local' && (
            <div className="mt-8">
              <div className="mb-3 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Acesso rapido (demo)
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="grid gap-2">
                {DEMO.map((d) => (
                  <button
                    key={d.login}
                    onClick={() => acessoDemo(d.login)}
                    disabled={carregando}
                    className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5 text-left transition-colors hover:border-primary/50 hover:bg-muted disabled:opacity-60"
                  >
                    <span>
                      <span className="block text-sm font-bold">{d.label}</span>
                      <span className="block text-xs text-muted-foreground">{d.desc}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
