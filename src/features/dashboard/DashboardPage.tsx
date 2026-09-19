import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  CalendarCheck,
  ClipboardList,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAppData } from '@/data/useAppData'
import { useAuth } from '@/features/auth/AuthContext'
import { api, type ApuracaoCompetencia } from '@/data/api'
import { PageHeader, StatCard, EmptyState } from '@/components/ui/feedback'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { formatMoney, formatTime, todayISO } from '@/lib/format'
import { ROUTES } from '@/lib/brand'
import { cn } from '@/lib/utils'

function competenciaAtual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function diaChave(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

export function DashboardPage() {
  const { user } = useAuth()
  const { colaboradores, pontos, carregando } = useAppData()
  const [apuracao, setApuracao] = useState<ApuracaoCompetencia | null>(null)

  const competencia = competenciaAtual()

  useEffect(() => {
    api.apurarCompetencia(competencia).then(setApuracao).catch(() => setApuracao(null))
  }, [competencia])

  const hoje = todayISO()

  const metricas = useMemo(() => {
    const ativos = colaboradores.filter((c) => c.ativo)
    const presentesHoje = new Set(
      pontos
        .filter((p) => p.tipo === 'ENTRADA' && diaChave(p.hora_registro) === hoje)
        .map((p) => p.colaborador_id),
    )
    const pendentes = pontos.filter((p) => p.status === 'PENDENTE')
    return {
      ativos: ativos.length,
      total: colaboradores.length,
      presentes: presentesHoje.size,
      pendentes: pendentes.length,
    }
  }, [colaboradores, pontos, hoje])

  const serie = useMemo(() => {
    const dias: { dia: string; label: string; presentes: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = todayISO(d)
      const presentes = new Set(
        pontos
          .filter((p) => p.tipo === 'ENTRADA' && diaChave(p.hora_registro) === key)
          .map((p) => p.colaborador_id),
      ).size
      dias.push({
        dia: key,
        label: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
        presentes,
      })
    }
    return dias
  }, [pontos])

  const pendentesRecentes = useMemo(
    () =>
      pontos
        .filter((p) => p.status === 'PENDENTE')
        .sort((a, b) => b.hora_registro.localeCompare(a.hora_registro))
        .slice(0, 6),
    [pontos],
  )

  function nomeColaborador(id: string): string {
    return colaboradores.find((c) => c.id === id)?.nome ?? 'Desconhecido'
  }

  const primeiroNome = user?.nome.split(' ')[0] ?? ''

  return (
    <div className="animate-fade-in">
      <PageHeader
        titulo={`Ola, ${primeiroNome}`}
        descricao="Resumo de presenca, aprovacoes e folha do mes."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          titulo="Colaboradores ativos"
          valor={String(metricas.ativos)}
          detalhe={`${metricas.total} cadastrados`}
          icon={Users}
        />
        <StatCard
          titulo="Presentes hoje"
          valor={String(metricas.presentes)}
          detalhe={`de ${metricas.ativos} ativos`}
          icon={UserCheck}
          tom="success"
        />
        <StatCard
          titulo="Pontos pendentes"
          valor={String(metricas.pendentes)}
          detalhe="aguardando aprovacao"
          icon={ClipboardList}
          tom="warning"
        />
        <StatCard
          titulo="Folha estimada"
          valor={formatMoney(apuracao?.totalLiquido ?? 0)}
          detalhe={`liquido em ${competencia}`}
          icon={Wallet}
          tom="accent"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Presencas nos ultimos 7 dias</CardTitle>
              <p className="text-sm text-muted-foreground">Colaboradores distintos com entrada</p>
            </div>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="h-64">
            {carregando ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Carregando...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serie} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--card))',
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="presentes"
                    name="Presentes"
                    fill="hsl(var(--primary))"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={44}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Pendentes recentes</CardTitle>
            <CalendarCheck className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            {pendentesRecentes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum ponto pendente.
              </p>
            ) : (
              pendentesRecentes.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{nomeColaborador(p.colaborador_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.tipo} - {formatTime(p.hora_registro)}
                    </p>
                  </div>
                  <Badge variant={p.tipo === 'ENTRADA' ? 'success' : 'secondary'}>
                    {p.tipo === 'ENTRADA' ? 'Entrada' : p.tipo === 'SAIDA' ? 'Saida' : 'Ajuste'}
                  </Badge>
                </div>
              ))
            )}
            {(user?.role === 'admin' || user?.role === 'encarregado') && (
              <Link
                to={ROUTES.aprovacao}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-2 w-full')}
              >
                Ir para aprovacoes <ArrowUpRight className="h-4 w-4" />
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {user?.role === 'funcionario' && (
        <div className="mt-4">
          <EmptyState
            icon={CalendarCheck}
            titulo="Pronto para registrar seu ponto?"
            descricao="Use a tela de ponto para registrar entrada e saida com validacao de localizacao."
            acao={
              <Link to={ROUTES.ponto} className={buttonVariants()}>
                Bater ponto agora
              </Link>
            }
          />
        </div>
      )}
    </div>
  )
}
