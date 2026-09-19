import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Building2,
  Calculator,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock,
  HardHat,
  MapPin,
  Menu,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { BRAND, ROUTES } from '@/lib/brand'
import { cn } from '@/lib/utils'

const NAV = [
  { id: 'recursos', label: 'Recursos' },
  { id: 'como-funciona', label: 'Como funciona' },
  { id: 'planos', label: 'Planos' },
  { id: 'faq', label: 'Dúvidas' },
]

const RECURSOS: { icon: LucideIcon; titulo: string; texto: string }[] = [
  {
    icon: MapPin,
    titulo: 'Ponto com geolocalização',
    texto: 'O colaborador registra a entrada e a saída pelo celular, validado pelo raio da obra.',
  },
  {
    icon: ClipboardCheck,
    titulo: 'Aprovação do encarregado',
    texto: 'Fluxo pendente, validado e recusado. Nada entra na folha sem conferência.',
  },
  {
    icon: Calculator,
    titulo: 'Folha com encargos CLT',
    texto: 'INSS, IRRF, FGTS, provisões de 13º e férias calculados com tabelas por competência.',
  },
  {
    icon: HardHat,
    titulo: 'Produção e empreita',
    texto: 'Medição por metro para terceirizados e empreiteiros, com valor fechado por serviço.',
  },
  {
    icon: Wallet,
    titulo: 'Pagamentos e recibos',
    texto: 'Fechamento por período, lançamentos financeiros e comprovantes prontos para assinar.',
  },
  {
    icon: BarChart3,
    titulo: 'Relatórios e indicadores',
    texto: 'Custo por obra, presença, produtividade e histórico completo em poucos cliques.',
  },
]

const PASSOS = [
  { titulo: 'Cadastre a obra e a equipe', texto: 'Importe colaboradores, defina diárias, salários e o raio de tolerância.' },
  { titulo: 'A equipe bate o ponto', texto: 'No celular, com GPS e regra de tolerância por período. Funciona offline.' },
  { titulo: 'O encarregado aprova', texto: 'Confere as marcações do dia e libera para o fechamento da folha.' },
  { titulo: 'Folha e pagamento prontos', texto: 'Gere a competência com encargos e envie os valores para pagamento.' },
]

interface Plano {
  nome: string
  preco: string
  periodo: string
  anual: string
  resumo: string
  destaque?: boolean
  itens: string[]
  cta: string
}

const PLANOS: Plano[] = [
  {
    nome: 'Essencial',
    preco: '149',
    periodo: '/mês',
    anual: 'ou R$ 1.490/ano (2 meses grátis)',
    resumo: 'Para quem está começando a organizar o ponto.',
    cta: 'Começar agora',
    itens: [
      'Até 10 colaboradores',
      '1 obra ativa',
      'Ponto com geolocalização',
      'Aprovação do encarregado',
      'Relatórios essenciais',
      'Suporte por e-mail',
    ],
  },
  {
    nome: 'Profissional',
    preco: '349',
    periodo: '/mês',
    anual: 'ou R$ 3.490/ano (2 meses grátis)',
    resumo: 'Para construtoras com várias frentes de trabalho.',
    destaque: true,
    cta: 'Testar 14 dias grátis',
    itens: [
      'Até 50 colaboradores',
      'Obras ilimitadas',
      'Folha completa com encargos CLT',
      'Produção e empreita (metros)',
      'Pagamentos e recibos',
      'Relatórios avançados e exportação',
      'Suporte prioritário no WhatsApp',
    ],
  },
  {
    nome: 'Corporativo',
    preco: '799',
    periodo: '/mês',
    anual: 'ou R$ 7.990/ano (2 meses grátis)',
    resumo: 'Para operações grandes e múltiplas empresas.',
    cta: 'Falar com especialista',
    itens: [
      'Colaboradores ilimitados',
      'Multiempresa e multivínculo',
      'Tabelas legais personalizadas',
      'Perfis e permissões por obra',
      'Exportação para contabilidade',
      'API e integrações',
      'Gerente de conta dedicado',
    ],
  },
]

const FAQ = [
  {
    q: 'O PontoFlow substitui o relógio de ponto?',
    a: 'Sim. O registro é feito pelo celular do colaborador, com validação de geolocalização pelo raio da obra e aprovação do encarregado. Também é possível lançar ajustes manuais com justificativa.',
  },
  {
    q: 'A folha calcula os encargos corretamente?',
    a: 'O motor de folha aplica INSS, IRRF, FGTS e provisões de 13º e férias, com tabelas legais versionadas por competência. Os valores ficam transparentes e podem ser conferidos linha a linha.',
  },
  {
    q: 'Dá para controlar terceirizados e empreita?',
    a: 'Sim. Além do ponto por diária, o sistema calcula produção por metro e fechamentos de empreita com valor por serviço.',
  },
  {
    q: 'Meus dados ficam seguros?',
    a: 'Os dados ficam em banco na nuvem com isolamento por perfil: cada encarregado acessa apenas a própria obra e o funcionário vê somente os próprios registros.',
  },
  {
    q: 'Preciso instalar algo?',
    a: 'Não. O PontoFlow roda no navegador e pode ser instalado como app (PWA) na tela inicial do celular, sem passar por loja de aplicativos.',
  },
]

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Clock className="h-5 w-5" />
      </span>
      <span className="text-lg font-extrabold tracking-tight">{BRAND.name}</span>
    </span>
  )
}

export function LandingPage() {
  const { user } = useAuth()
  const [menuAberto, setMenuAberto] = useState(false)
  const [faqAberta, setFaqAberta] = useState<number | null>(0)

  if (user) return <Navigate to={ROUTES.dashboard} replace />

  const irPara = (id: string) => {
    setMenuAberto(false)
    scrollTo(id)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <button onClick={() => scrollTo('topo')} aria-label="Início">
            <Logo />
          </button>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => irPara(n.id)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {n.label}
              </button>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Link to={ROUTES.login}>
              <Button variant="ghost">Entrar</Button>
            </Link>
            <Link to={ROUTES.login}>
              <Button>
                Teste grátis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <button
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted md:hidden"
            onClick={() => setMenuAberto((v) => !v)}
            aria-label="Menu"
          >
            {menuAberto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuAberto && (
          <div className="border-t border-border/60 bg-background px-4 py-3 md:hidden">
            <div className="grid gap-1">
              {NAV.map((n) => (
                <button
                  key={n.id}
                  onClick={() => irPara(n.id)}
                  className="rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-muted-foreground hover:bg-muted"
                >
                  {n.label}
                </button>
              ))}
            </div>
            <Link to={ROUTES.login} className="mt-2 block">
              <Button className="w-full">
                Teste grátis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </header>

      <main id="topo">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />

          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-bold text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Ponto, folha e pagamento para a construção civil
              </span>

              <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
                Controle a obra inteira sem planilha e sem papel.
              </h1>

              <p className="mt-5 max-w-xl text-lg text-muted-foreground">
                O {BRAND.name} registra o ponto com GPS, aprova com o encarregado e fecha a folha
                com todos os encargos CLT. Tudo em um painel só, do celular ao escritório.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to={ROUTES.login}>
                  <Button size="lg">
                    Começar agora
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to={ROUTES.login}>
                  <Button size="lg" variant="outline">
                    Ver demonstração
                  </Button>
                </Link>
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                14 dias grátis, sem cartão de crédito. Cancele quando quiser.
              </p>

              <div className="mt-10 grid max-w-lg grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { valor: '480', label: 'min = 1 diária' },
                  { valor: '80 m', label: 'raio da obra' },
                  { valor: 'CLT', label: 'encargos completos' },
                  { valor: '100%', label: 'mobile' },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-xl font-extrabold tracking-tight">{s.valor}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Mock do painel */}
            <div className="relative">
              <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Resumo do dia
                    </p>
                    <p className="text-lg font-extrabold">Obra Residencial Aurora</p>
                  </div>
                  <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-bold text-success">
                    No prazo
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    { label: 'Presentes', valor: '42' },
                    { label: 'Diárias', valor: '39,5' },
                    { label: 'Pendentes', valor: '3' },
                  ].map((c) => (
                    <div key={c.label} className="rounded-2xl border border-border bg-muted/50 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        {c.label}
                      </p>
                      <p className="mt-1 text-xl font-extrabold">{c.valor}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 space-y-3">
                  {[
                    { nome: 'Marcos A.', cargo: 'Servente', pct: 100 },
                    { nome: 'Juliana R.', cargo: 'Pedreira', pct: 88 },
                    { nome: 'Equipe Elétrica', cargo: 'Terceirizado', pct: 64 },
                  ].map((p) => (
                    <div key={p.nome}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold">{p.nome}</span>
                        <span className="text-muted-foreground">{p.cargo}</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${p.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center gap-2 rounded-2xl border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-success" />
                  Marcações validadas por GPS e aprovadas pelo encarregado.
                </div>
              </div>

              <div className="absolute -bottom-5 -left-4 hidden items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-soft sm:flex">
                <Smartphone className="h-5 w-5 text-accent" />
                <div>
                  <p className="text-xs font-bold">Bate o ponto no celular</p>
                  <p className="text-[11px] text-muted-foreground">Funciona offline e sincroniza</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Recursos */}
        <section id="recursos" className="scroll-mt-20 border-t border-border/60 bg-muted/30 py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-wide text-primary">Recursos</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Tudo que a obra precisa, em um só sistema.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Do registro no canteiro ao pagamento no escritório, sem retrabalho e sem
                planilhas paralelas.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {RECURSOS.map((r) => (
                <div
                  key={r.titulo}
                  className="rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-soft"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <r.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-extrabold">{r.titulo}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{r.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Como funciona */}
        <section id="como-funciona" className="scroll-mt-20 py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-wide text-primary">Como funciona</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
                No ar em quatro passos.
              </h2>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {PASSOS.map((p, i) => (
                <div key={p.titulo} className="relative rounded-2xl border border-border bg-card p-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-extrabold">{p.titulo}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{p.texto}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl border border-border bg-muted/40 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Building2 className="h-5 w-5 text-primary" /> Multiobras
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Smartphone className="h-5 w-5 text-primary" /> PWA instalável
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-5 w-5 text-primary" /> Acesso por perfil
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Wallet className="h-5 w-5 text-primary" /> Envios em lote
              </div>
            </div>
          </div>
        </section>

        {/* Planos */}
        <section id="planos" className="scroll-mt-20 border-t border-border/60 bg-muted/30 py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-bold uppercase tracking-wide text-primary">Planos</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Um plano para cada tamanho de obra.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Assinatura mensal, sem taxa de implantação. Os valores abaixo são sugestões de
                lançamento e podem ser ajustados conforme o volume da operação.
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {PLANOS.map((plano) => (
                <div
                  key={plano.nome}
                  className={cn(
                    'relative flex flex-col rounded-3xl border bg-card p-6',
                    plano.destaque
                      ? 'border-primary shadow-soft lg:-mt-4 lg:mb-4'
                      : 'border-border',
                  )}
                >
                  {plano.destaque && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
                      Mais escolhido
                    </span>
                  )}

                  <h3 className="text-lg font-extrabold">{plano.nome}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{plano.resumo}</p>

                  <div className="mt-5 flex items-end gap-1">
                    <span className="text-sm font-bold text-muted-foreground">R$</span>
                    <span className="text-4xl font-extrabold tracking-tight">{plano.preco}</span>
                    <span className="pb-1 text-sm font-semibold text-muted-foreground">
                      {plano.periodo}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{plano.anual}</p>

                  <Link to={ROUTES.login} className="mt-6">
                    <Button className="w-full" variant={plano.destaque ? 'default' : 'outline'}>
                      {plano.cta}
                    </Button>
                  </Link>

                  <ul className="mt-6 space-y-3">
                    {plano.itens.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-3xl border border-border bg-card p-6 sm:flex-row">
              <div>
                <h3 className="font-extrabold">Precisa de algo sob medida?</h3>
                <p className="text-sm text-muted-foreground">
                  Franquias, consórcios e operações com regras próprias de folha. A gente monta o
                  plano com você.
                </p>
              </div>
              <Link to={ROUTES.login}>
                <Button variant="secondary">
                  Falar com especialista
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 py-16 lg:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-primary">Dúvidas</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Perguntas frequentes.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Não encontrou o que procurava? Fale com a gente que respondemos rapidinho.
              </p>
            </div>

            <div className="space-y-3">
              {FAQ.map((item, i) => {
                const aberta = faqAberta === i
                return (
                  <div key={item.q} className="rounded-2xl border border-border bg-card">
                    <button
                      onClick={() => setFaqAberta(aberta ? null : i)}
                      className="flex w-full items-center justify-between gap-4 p-4 text-left"
                      aria-expanded={aberta}
                    >
                      <span className="font-semibold">{item.q}</span>
                      <ChevronDown
                        className={cn(
                          'h-5 w-5 shrink-0 text-muted-foreground transition-transform',
                          aberta && 'rotate-180',
                        )}
                      />
                    </button>
                    {aberta && (
                      <p className="px-4 pb-4 text-sm text-muted-foreground">{item.a}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="px-4 pb-16 sm:px-6 lg:pb-24">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[#0b0b12] px-6 py-14 text-center text-white sm:px-12">
            <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-primary/40 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-accent/30 blur-3xl" />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
                Comece hoje a fechar a folha sem dor de cabeça.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-white/70">
                14 dias grátis, sem compromisso. Configure a primeira obra em minutos.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link to={ROUTES.login}>
                  <Button size="lg" className="bg-white text-[#0b0b12] hover:brightness-95">
                    Criar minha conta
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to={ROUTES.login}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/30 bg-transparent text-white hover:bg-white/10"
                  >
                    Ver demonstração
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <Logo />
              <p className="mt-4 max-w-sm text-sm text-muted-foreground">{BRAND.tagline}</p>
              <p className="mt-4 text-sm text-muted-foreground">
                Fale com a gente: {BRAND.supportEmail}
              </p>
            </div>

            <div>
              <p className="text-sm font-bold">Produto</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {NAV.map((n) => (
                  <li key={n.id}>
                    <button onClick={() => irPara(n.id)} className="hover:text-foreground">
                      {n.label}
                    </button>
                  </li>
                ))}
                <li>
                  <Link to={ROUTES.login} className="hover:text-foreground">
                    Entrar
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-sm font-bold">Empresa</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>{BRAND.company}</li>
                <li>
                  <a
                    href={BRAND.vendorUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground"
                  >
                    wolfsaas.com.br
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row">
            <p>
              © {new Date().getFullYear()} {BRAND.company}. Todos os direitos reservados.
            </p>
            <p>
              Um produto{' '}
              <a
                href={BRAND.vendorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-foreground hover:text-primary"
              >
                {BRAND.vendor}
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
