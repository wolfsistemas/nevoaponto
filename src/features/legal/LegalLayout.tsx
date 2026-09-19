import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Clock } from 'lucide-react'
import { BRAND, LEGAL, ROUTES } from '@/lib/brand'

export function LegalLayout({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to={ROUTES.home} className="flex items-center gap-2.5 font-extrabold">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Clock className="h-5 w-5" />
            </div>
            {BRAND.name}
          </Link>
          <Link
            to={ROUTES.home}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">{titulo}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Versao {LEGAL.termosVersao} - atualizado em {LEGAL.atualizadoEm}
        </p>
        <div className="mt-10 space-y-8">{children}</div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-3xl px-4 py-8 text-xs text-muted-foreground">
          <p>
            {LEGAL.razaoSocial} - CNPJ {LEGAL.cnpj} - {LEGAL.endereco}
          </p>
          <p className="mt-1">
            Encarregado de Dados (DPO): {LEGAL.dpoEmail}
          </p>
          <p className="mt-3">
            {BRAND.name} e um produto {BRAND.vendor}. Contato:{' '}
            <a href={`mailto:${BRAND.supportEmail}`} className="font-semibold text-primary hover:underline">
              {BRAND.supportEmail}
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold tracking-tight">{titulo}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  )
}

export function Lista({ itens }: { itens: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {itens.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  )
}
