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

  const value = useMemo(
    () => ({ user, loading, signIn, signOut, pode }),
    [user, loading, signIn, signOut, pode],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
