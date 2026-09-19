import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, Mail, Lock, Phone, User } from 'lucide-react'
import { useAuth } from './AuthContext'
import { AuthLayout } from './AuthLayout'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { ROUTES } from '@/lib/brand'

export function SignupPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    empresa: '',
    nome: '',
    email: '',
    telefone: '',
    senha: '',
    confirmar: '',
    website: '',
  })
  const [aceitou, setAceitou] = useState(false)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function criar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (form.senha.length < 8) {
      setErro('A senha deve ter ao menos 8 caracteres.')
      return
    }
    if (form.senha !== form.confirmar) {
      setErro('As senhas nao conferem.')
      return
    }
    if (!aceitou) {
      setErro('Aceite os Termos de Uso e a Politica de Privacidade para continuar.')
      return
    }
    setCarregando(true)
    const res = await signUp({
      empresa: form.empresa.trim(),
      nome: form.nome.trim(),
      email: form.email.trim().toLowerCase(),
      telefone: form.telefone.trim() || undefined,
      senha: form.senha,
      aceitou_termos: true,
      website: form.website,
    })
    setCarregando(false)
    if (res.ok) navigate(ROUTES.dashboard, { replace: true })
    else setErro(res.erro ?? 'Nao foi possivel criar a conta.')
  }

  return (
    <AuthLayout
      titulo="Criar conta"
      subtitulo="Cadastre sua empresa e comece a usar em minutos."
      rodape={
        <>
          Ja tem conta?{' '}
          <Link to={ROUTES.login} className="font-semibold text-primary hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      {erro && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm font-semibold text-destructive">
          {erro}
        </div>
      )}

      <form onSubmit={criar} className="space-y-3">
        <Field label="Empresa">
          <div className="relative">
            <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={form.empresa}
              onChange={(e) => setForm({ ...form, empresa: e.target.value })}
              placeholder="Construtora Exemplo"
              className="pl-9"
              required
            />
          </div>
        </Field>

        <Field label="Seu nome">
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="pl-9"
              required
            />
          </div>
        </Field>

        <Field label="E-mail">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="voce@empresa.com.br"
              autoComplete="email"
              className="pl-9"
              required
            />
          </div>
        </Field>

        <Field label="Telefone (opcional)">
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              placeholder="(11) 99999-0000"
              className="pl-9"
            />
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Senha">
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                value={form.senha}
                onChange={(e) => setForm({ ...form, senha: e.target.value })}
                placeholder="Min. 8"
                autoComplete="new-password"
                className="pl-9"
                required
              />
            </div>
          </Field>
          <Field label="Confirmar">
            <Input
              type="password"
              value={form.confirmar}
              onChange={(e) => setForm({ ...form, confirmar: e.target.value })}
              autoComplete="new-password"
              required
            />
          </Field>
        </div>

        {/* honeypot anti-bot */}
        <input
          type="text"
          value={form.website}
          onChange={(e) => setForm({ ...form, website: e.target.value })}
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
        />

        <label className="flex items-start gap-2.5 pt-1 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={aceitou}
            onChange={(e) => setAceitou(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
          />
          <span>
            Li e aceito os{' '}
            <Link to={ROUTES.termos} className="font-semibold text-primary hover:underline">
              Termos de Uso
            </Link>{' '}
            e a{' '}
            <Link to={ROUTES.privacidade} className="font-semibold text-primary hover:underline">
              Politica de Privacidade
            </Link>
            , incluindo o tratamento dos dados conforme a LGPD.
          </span>
        </label>

        <Button type="submit" size="lg" className="w-full" disabled={carregando}>
          {carregando ? 'Criando conta...' : 'Criar conta gratis'}
          {!carregando && <ArrowRight className="h-4 w-4" />}
        </Button>
      </form>
    </AuthLayout>
  )
}
