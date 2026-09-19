import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from './AuthContext'
import { AuthLayout } from './AuthLayout'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { ROUTES } from '@/lib/brand'

export function RecuperarSenhaPage() {
  const { recuperarSenha } = useAuth()
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [carregando, setCarregando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    const res = await recuperarSenha(email)
    setCarregando(false)
    if (res.ok) setEnviado(true)
    else setErro(res.erro ?? 'Nao foi possivel enviar o e-mail.')
  }

  return (
    <AuthLayout
      titulo="Recuperar senha"
      subtitulo="Informe seu e-mail e enviaremos um link para redefinir a senha."
      rodape={
        <>
          Lembrou a senha?{' '}
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

      {enviado ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
            Link enviado
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Se existir uma conta para <strong>{email}</strong>, o link de redefinicao chegara em
            instantes. Verifique tambem a caixa de spam.
          </p>
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <Field label="E-mail">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com.br"
                autoComplete="email"
                className="pl-9"
                required
              />
            </div>
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={carregando}>
            {carregando ? 'Enviando...' : 'Enviar link'}
            {!carregando && <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
