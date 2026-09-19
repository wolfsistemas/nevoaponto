import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, Lock } from 'lucide-react'
import { useAuth } from './AuthContext'
import { AuthLayout } from './AuthLayout'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { ROUTES } from '@/lib/brand'

export function RedefinirSenhaPage() {
  const { user, loading, redefinirSenha } = useAuth()
  const navigate = useNavigate()
  const [nova, setNova] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState(false)
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    document.title = 'Redefinir senha'
  }, [])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (nova.length < 8) {
      setErro('A senha deve ter ao menos 8 caracteres.')
      return
    }
    if (nova !== confirmar) {
      setErro('As senhas nao conferem.')
      return
    }
    setCarregando(true)
    const res = await redefinirSenha(nova)
    setCarregando(false)
    if (res.ok) setOk(true)
    else setErro(res.erro ?? 'Nao foi possivel redefinir a senha.')
  }

  if (loading) {
    return (
      <AuthLayout titulo="Redefinir senha">
        <p className="text-sm text-muted-foreground">Validando o link...</p>
      </AuthLayout>
    )
  }

  if (!user) {
    return (
      <AuthLayout
        titulo="Link invalido ou expirado"
        subtitulo="O link de redefinicao pode ter expirado ou ja ter sido usado."
        rodape={
          <Link to={ROUTES.login} className="font-semibold text-primary hover:underline">
            Voltar para o login
          </Link>
        }
      >
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <p>
            Solicite um novo link em{' '}
            <Link to={ROUTES.recuperarSenha} className="font-semibold text-primary hover:underline">
              Recuperar senha
            </Link>
            .
          </p>
        </div>
      </AuthLayout>
    )
  }

  if (ok) {
    return (
      <AuthLayout titulo="Senha atualizada">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
            Tudo certo
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua senha foi alterada com sucesso. Use-a no proximo acesso.
          </p>
          <Button className="mt-4 w-full" onClick={() => navigate(ROUTES.dashboard, { replace: true })}>
            Ir para o painel
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      titulo="Definir nova senha"
      subtitulo={`Conta: ${user.email ?? user.login}`}
    >
      {erro && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm font-semibold text-destructive">
          {erro}
        </div>
      )}
      <form onSubmit={salvar} className="space-y-4">
        <Field label="Nova senha">
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="password"
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              placeholder="Min. 8 caracteres"
              autoComplete="new-password"
              className="pl-9"
              required
            />
          </div>
        </Field>
        <Field label="Confirmar nova senha">
          <Input
            type="password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            autoComplete="new-password"
            required
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={carregando}>
          {carregando ? 'Salvando...' : 'Salvar nova senha'}
          {!carregando && <ArrowRight className="h-4 w-4" />}
        </Button>
      </form>
    </AuthLayout>
  )
}
