import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Clock } from 'lucide-react'
import { BRAND, ROUTES } from '@/lib/brand'

export function AuthLayout({
  titulo,
  subtitulo,
  children,
  rodape,
}: {
  titulo: string
  subtitulo?: string
  children: ReactNode
  rodape?: ReactNode
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#0b0b12] p-10 text-white lg:flex">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/40 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-accent/30 blur-3xl" />
        <Link to={ROUTES.home} className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
            <Clock className="h-6 w-6 text-accent" />
          </div>
          <div>
            <p className="text-lg font-extrabold tracking-tight">{BRAND.name}</p>
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Ponto & Folha</p>
          </div>
        </Link>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Comece a fechar a folha sem planilha.
          </h1>
          <p className="mt-4 text-white/70">
            Ponto com geolocalização, aprovação do encarregado e encargos CLT calculados
            automaticamente. 14 dias grátis, sem cartão.
          </p>
        </div>

        <p className="relative text-xs text-white/40">
          Um produto {BRAND.vendor} - {BRAND.domain}
        </p>
      </div>

      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm animate-fade-in">
          <Link
            to={ROUTES.home}
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao site
          </Link>

          <div className="mb-6">
            <h2 className="text-xl font-extrabold tracking-tight">{titulo}</h2>
            {subtitulo && <p className="mt-1 text-sm text-muted-foreground">{subtitulo}</p>}
          </div>

          {children}

          {rodape && <div className="mt-6 text-sm text-muted-foreground">{rodape}</div>}
        </div>
      </div>
    </div>
  )
}
