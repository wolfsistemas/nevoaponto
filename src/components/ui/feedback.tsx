import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from './card'

export function PageHeader({
  titulo,
  descricao,
  acao,
  icon: Icon,
}: {
  titulo: string
  descricao?: string
  acao?: ReactNode
  icon?: LucideIcon
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{titulo}</h1>
          {descricao && <p className="text-sm text-muted-foreground">{descricao}</p>}
        </div>
      </div>
      {acao && (
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-0.5 sm:justify-end">
          {acao}
        </div>
      )}
    </div>
  )
}

export function StatCard({
  titulo,
  valor,
  detalhe,
  icon: Icon,
  tom = 'primary',
}: {
  titulo: string
  valor: string
  detalhe?: string
  icon: LucideIcon
  tom?: 'primary' | 'success' | 'warning' | 'destructive' | 'accent'
}) {
  const tons: Record<string, string> = {
    primary: 'bg-primary/12 text-primary',
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/20 text-warning',
    destructive: 'bg-destructive/15 text-destructive',
    accent: 'bg-accent/15 text-accent',
  }
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {titulo}
          </p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight">{valor}</p>
          {detalhe && <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>}
        </div>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', tons[tom])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  )
}

export function EmptyState({
  icon: Icon,
  titulo,
  descricao,
  acao,
}: {
  icon: LucideIcon
  titulo: string
  descricao?: string
  acao?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="font-bold">{titulo}</h3>
      {descricao && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  )
}
