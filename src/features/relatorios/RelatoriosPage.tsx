import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Download, PieChart, Printer } from 'lucide-react'
import { useAppData } from '@/data/useAppData'
import { api, type ApuracaoCompetencia } from '@/data/api'
import { calcularTotalDiarias } from '@/core/ponto'
import { PageHeader, StatCard, EmptyState } from '@/components/ui/feedback'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { Table, TableWrap, Td, Th } from '@/components/ui/table'
import { formatMoney, formatNumber, competenciaLabel, todayISO } from '@/lib/format'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const CORES = ['#7c5cff', '#22d3ee', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6']

function competencias(): string[] {
  const out: string[] = []
  const d = new Date()
  for (let i = 0; i < 6; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    d.setMonth(d.getMonth() - 1)
  }
  return out
}

function diasUteis(competencia: string): number {
  const [ano, mes] = competencia.split('-').map(Number)
  const hoje = todayISO()
  const ultimo = new Date(ano, mes, 0).getDate()
  let total = 0
  for (let dia = 1; dia <= ultimo; dia++) {
    const d = new Date(ano, mes - 1, dia)
    if (d.getDay() === 0) continue
    if (`${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}` > hoje) continue
    total++
  }
  return total
}

export function RelatoriosPage() {
  const { colaboradores, pontos, obras } = useAppData()
  const [competencia, setCompetencia] = useState(competencias()[0])
  const [apuracao, setApuracao] = useState<ApuracaoCompetencia | null>(null)

  useEffect(() => {
    api.apurarCompetencia(competencia).then(setApuracao).catch(() => setApuracao(null))
  }, [competencia])

  const linhas = useMemo(() => {
    const uteis = diasUteis(competencia)
    return colaboradores
      .filter((c) => c.ativo)
      .map((c) => {
        const pontosColab = pontos.filter(
          (p) =>
            p.colaborador_id === c.id &&
            p.status === 'VALIDADO' &&
            new Date(p.hora_registro).toISOString().slice(0, 7) === competencia,
        )
        const presencas = new Set(
          pontosColab
            .filter((p) => p.tipo === 'ENTRADA')
            .map((p) => new Date(p.hora_registro).toISOString().slice(0, 10)),
        ).size
        const diarias = calcularTotalDiarias(pontosColab)
        const item = apuracao?.itens.find((i) => i.colaborador_id === c.id)
        return {
          id: c.id,
          nome: c.nome,
          tipo: c.tipo_contrato,
          presencas,
          faltas: Math.max(0, uteis - presencas),
          diarias,
          liquido: item?.valorLiquido ?? 0,
          encargos: item?.totalEncargos ?? 0,
        }
      })
      .sort((a, b) => b.liquido - a.liquido)
  }, [colaboradores, pontos, competencia, apuracao])

  const porObra = useMemo(() => {
    return obras.map((o) => {
      const custo = linhas
        .filter((l) => colaboradores.find((c) => c.id === l.id)?.obra_id === o.id)
        .reduce((s, l) => s + l.liquido + l.encargos, 0)
      return { nome: o.nome.split(' ')[0], custo: Math.round(custo) }
    })
  }, [obras, linhas, colaboradores])

  const total = linhas.reduce((s, l) => s + l.liquido + l.encargos, 0)

  function exportarCsv() {
    const cabecalho = ['Colaborador', 'Contrato', 'Presencas', 'Faltas', 'Diarias', 'Liquido', 'Encargos']
    const corpo = linhas.map((l) =>
      [l.nome, l.tipo, l.presencas, l.faltas, l.diarias.toFixed(2), l.liquido.toFixed(2), l.encargos.toFixed(2)].join(';'),
    )
    const csv = [cabecalho.join(';'), ...corpo].join('\n')
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-ponto-${competencia}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        titulo="Relatorios"
        descricao="Presenca, faltas e custo de mao de obra por competencia."
        icon={PieChart}
        acao={
          <>
            <Select value={competencia} onChange={(e) => setCompetencia(e.target.value)} className="w-[190px]">
              {competencias().map((c) => (
                <option key={c} value={c}>
                  {competenciaLabel(c)}
                </option>
              ))}
            </Select>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
            <Button onClick={exportarCsv} disabled={linhas.length === 0}>
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard titulo="Custo total estimado" valor={formatMoney(total)} detalhe="liquido + encargos" icon={BarChart3} tom="accent" />
        <StatCard titulo="Colaboradores" valor={String(linhas.length)} detalhe="ativos na competencia" icon={PieChart} />
        <StatCard
          titulo="Diarias apuradas"
          valor={formatNumber(
            linhas.reduce((s, l) => s + l.diarias, 0),
          )}
          detalhe="soma da equipe"
          icon={BarChart3}
          tom="success"
        />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Custo por obra</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={porObra} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="nome" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))' }}
                formatter={(v: number) => formatMoney(v)}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--card))',
                  fontSize: 12,
                }}
              />
              <Bar dataKey="custo" name="Custo" radius={[6, 6, 0, 0]} maxBarSize={64}>
                {porObra.map((_, i) => (
                  <Cell key={i} fill={CORES[i % CORES.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="mt-4">
        {linhas.length === 0 ? (
          <EmptyState icon={PieChart} titulo="Sem dados" descricao="Nenhum colaborador ativo para o periodo." />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Colaborador</Th>
                  <Th>Contrato</Th>
                  <Th className="text-right">Presencas</Th>
                  <Th className="text-right">Faltas</Th>
                  <Th className="text-right">Diarias</Th>
                  <Th className="text-right">Liquido</Th>
                  <Th className="text-right">Encargos</Th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <Td className="font-semibold">{l.nome}</Td>
                    <Td className="text-xs text-muted-foreground">{l.tipo}</Td>
                    <Td className="text-right tabular-nums">{l.presencas}</Td>
                    <Td className="text-right tabular-nums text-destructive">{l.faltas}</Td>
                    <Td className="text-right tabular-nums">{formatNumber(l.diarias)}</Td>
                    <Td className="text-right font-bold tabular-nums">{formatMoney(l.liquido)}</Td>
                    <Td className="text-right tabular-nums text-muted-foreground">{formatMoney(l.encargos)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </div>
    </div>
  )
}
