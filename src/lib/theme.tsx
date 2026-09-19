import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Tema = 'light' | 'dark'

interface ThemeState {
  tema: Tema
  alternar: () => void
  definir: (t: Tema) => void
}

const ThemeContext = createContext<ThemeState | null>(null)
const KEY = 'pontoflow.tema'

function temaInicial(): Tema {
  const salvo = localStorage.getItem(KEY)
  if (salvo === 'light' || salvo === 'dark') return salvo
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(() => temaInicial())

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', tema === 'dark')
    root.style.colorScheme = tema
    localStorage.setItem(KEY, tema)
  }, [tema])

  return (
    <ThemeContext.Provider
      value={{
        tema,
        alternar: () => setTema((t) => (t === 'dark' ? 'light' : 'dark')),
        definir: setTema,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme deve ser usado dentro de ThemeProvider')
  return ctx
}
