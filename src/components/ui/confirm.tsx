import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, HelpCircle, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Dialog } from './dialog'

type Tom = 'question' | 'warning' | 'danger'

export interface ConfirmOptions {
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tom?: Tom
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

const ICONES: Record<Tom, typeof AlertTriangle> = {
  question: HelpCircle,
  warning: AlertTriangle,
  danger: ShieldAlert,
}

const CORES: Record<Tom, string> = {
  question: 'bg-primary/12 text-primary',
  warning: 'bg-warning/20 text-warning',
  danger: 'bg-destructive/15 text-destructive',
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pendente, setPendente] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((valor: boolean) => void) | null>(null)

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve
        setPendente(opts)
      }),
    [],
  )

  const fechar = useCallback((resultado: boolean) => {
    resolver.current?.(resultado)
    resolver.current = null
    setPendente(null)
  }, [])

  const tom = pendente?.tom ?? 'question'
  const Icon = ICONES[tom]

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={Boolean(pendente)}
        onClose={() => fechar(false)}
        className="sm:max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => fechar(false)}>
              {pendente?.cancelLabel ?? 'Cancelar'}
            </Button>
            <Button
              variant={tom === 'danger' ? 'destructive' : 'default'}
              onClick={() => fechar(true)}
            >
              {pendente?.confirmLabel ?? 'Confirmar'}
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              CORES[tom],
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight">{pendente?.title}</h2>
            {pendente?.description && (
              <div className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                {pendente.description}
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm deve ser usado dentro de ConfirmProvider')
  return ctx
}
