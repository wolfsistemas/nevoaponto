import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from '@/data/api'
import type { Profile, UserRole } from '@/data/types'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

interface AuthState {
  user: Profile | null
  loading: boolean
  signIn: (login: string, senha: string) => Promise<{ ok: boolean; erro?: string }>
  signOut: () => Promise<void>
  signUp: (input: {
    empresa: string
    nome: string
    email: string
    senha: string
    telefone?: string
    cnpj?: string
    aceitou_termos: boolean
    website?: string
  }) => Promise<{ ok: boolean; erro?: string }>
  recuperarSenha: (email: string) => Promise<{ ok: boolean; erro?: string }>
  redefinirSenha: (nova: string) => Promise<{ ok: boolean; erro?: string }>
  alterarSenha: (atual: string, nova: string) => Promise<{ ok: boolean; erro?: string }>
  pode: (...roles: UserRole[]) => boolean
}

const AuthContext = createContext<AuthState | null>(null)
const STORAGE_KEY = 'pontoflow.user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ativo = true
    async function restaurar() {
      try {
        if (isSupabaseConfigured) {
          const { data } = await getSupabase().auth.getSession()
          if (data.session?.user) {
            const profiles = await api.listProfiles()
            const perfil = profiles.find((p) => p.id === data.session?.user.id) ?? null
            if (ativo) setUser(perfil)
          }
        } else {
          const raw = localStorage.getItem(STORAGE_KEY)
          if (raw && ativo) setUser(JSON.parse(raw) as Profile)
        }
      } catch {
        // sessao invalida: ignora
      } finally {
        if (ativo) setLoading(false)
      }
    }
    restaurar()
    return () => {
      ativo = false
    }
  }, [])

  const signIn = useCallback<AuthState['signIn']>(async (login, senha) => {
    const usuario = login.trim().toLowerCase()
    if (!usuario) return { ok: false, erro: 'Informe o usuario.' }
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await getSupabase().auth.signInWithPassword({
          email: usuario.includes('@') ? usuario : `${usuario}@pontoflow.app`,
          password: senha,
        })
        if (error || !data.user) return { ok: false, erro: 'Credenciais invalidas.' }
        const profiles = await api.listProfiles()
        const perfil = profiles.find((p) => p.id === data.user!.id) ?? null
        if (!perfil) return { ok: false, erro: 'Usuario sem perfil ativo.' }
        setUser(perfil)
        return { ok: true }
      }

      const profiles = await api.listProfiles()
      const perfil = profiles.find((p) => p.login.toLowerCase() === usuario && p.ativo)
      if (!perfil) return { ok: false, erro: 'Credenciais invalidas.' }
      if (!senha) return { ok: false, erro: 'Informe a senha.' }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(perfil))
      setUser(perfil)
      return { ok: true }
    } catch {
      return { ok: false, erro: 'Nao foi possivel entrar. Tente novamente.' }
    }
  }, [])

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) {
      try {
        await getSupabase().auth.signOut()
      } catch {
        // ignora
      }
    }
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }, [])

  const pode = useCallback<AuthState['pode']>(
    (...roles) => (user ? roles.includes(user.role) : false),
    [user],
  )

  const emailDe = useCallback((login: string) => {
    const valor = login.trim().toLowerCase()
    return valor.includes('@') ? valor : `${valor}@pontoflow.app`
  }, [])

  const signUp = useCallback<AuthState['signUp']>(
    async (input) => {
      if (!isSupabaseConfigured) {
        return { ok: false, erro: 'Cadastro disponivel apenas com o Supabase configurado.' }
      }
      try {
        await api.criarConta(input)
        const res = await signIn(input.email, input.senha)
        return res.ok ? { ok: true } : { ok: true }
      } catch (erro) {
        return {
          ok: false,
          erro: erro instanceof Error ? erro.message : 'Nao foi possivel criar a conta.',
        }
      }
    },
    [signIn],
  )

  const recuperarSenha = useCallback<AuthState['recuperarSenha']>(async (email) => {
    if (!isSupabaseConfigured) {
      return { ok: false, erro: 'Disponivel apenas com o Supabase configurado.' }
    }
    const destino = `${window.location.origin}${import.meta.env.BASE_URL}#/redefinir-senha`
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: destino,
    })
    if (error) return { ok: false, erro: error.message }
    return { ok: true }
  }, [])

  const redefinirSenha = useCallback<AuthState['redefinirSenha']>(async (nova) => {
    if (!isSupabaseConfigured) {
      return { ok: false, erro: 'Disponivel apenas com o Supabase configurado.' }
    }
    if (nova.length < 8) return { ok: false, erro: 'A senha deve ter ao menos 8 caracteres.' }
    const { error } = await getSupabase().auth.updateUser({ password: nova })
    if (error) return { ok: false, erro: error.message }
    return { ok: true }
  }, [])

  const alterarSenha = useCallback<AuthState['alterarSenha']>(
    async (atual, nova) => {
      if (!user) return { ok: false, erro: 'Sessao expirada. Entre novamente.' }
      if (!isSupabaseConfigured) {
        return { ok: false, erro: 'Disponivel apenas com o Supabase configurado.' }
      }
      if (nova.length < 8) return { ok: false, erro: 'A senha deve ter ao menos 8 caracteres.' }
      const email = user.email ?? emailDe(user.login)
      const reauth = await getSupabase().auth.signInWithPassword({ email, password: atual })
      if (reauth.error) return { ok: false, erro: 'Senha atual incorreta.' }
      const { error } = await getSupabase().auth.updateUser({ password: nova })
      if (error) return { ok: false, erro: error.message }
      return { ok: true }
    },
    [user, emailDe],
  )

  const value = useMemo(
    () => ({
      user,
      loading,
      signIn,
      signOut,
      signUp,
      recuperarSenha,
      redefinirSenha,
      alterarSenha,
      pode,
    }),
    [user, loading, signIn, signOut, signUp, recuperarSenha, redefinirSenha, alterarSenha, pode],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
