import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tipo = 'sucesso' | 'erro' | 'info'

interface Toast {
  id: number
  tipo: Tipo
  mensagem: string
}

interface ToastState {
  push: (mensagem: string, tipo?: Tipo) => void
}

const ToastContext = createContext<ToastState | null>(null)

const ICONS: Record<Tipo, typeof Info> = {
  sucesso: CheckCircle2,
  erro: AlertTriangle,
  info: Info,
}

const COR: Record<Tipo, string> = {
  sucesso: 'text-success',
  erro: 'text-destructive',
  info: 'text-primary',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((mensagem: string, tipo: Tipo = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, tipo, mensagem }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((t) => {
          const Icon = ICONS[t.tipo]
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xl animate-fade-in"
            >
              <Icon className={cn('h-5 w-5 shrink-0', COR[t.tipo])} />
              <span className="flex-1 text-sm font-medium">{t.mensagem}</span>
              <button
                onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastState {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider')
  return ctx
}
