import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Download, PieChart, Printer } from 'lucide-react'
import { useAppData } from '@/data/useAppData'
import { api, type ApuracaoCompetencia } from '@/data/api'
import type { Empresa } from '@/data/types'
import { calcularTotalDiarias } from '@/core/ponto'
import { PageHeader, StatCard, EmptyState } from '@/components/ui/feedback'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { Table, TableWrap, Td, Th } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { formatMoney, formatNumber, formatCnpj, competenciaLabel, todayISO } from '@/lib/format'
import { BRAND } from '@/lib/brand'
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
  const toast = useToast()
  const [competencia, setCompetencia] = useState(competencias()[0])
  const [apuracao, setApuracao] = useState<ApuracaoCompetencia | null>(null)
  const [empresa, setEmpresa] = useState<Empresa | null>(null)

  useEffect(() => {
    api.apurarCompetencia(competencia).then(setApuracao).catch(() => setApuracao(null))
  }, [competencia])

  useEffect(() => {
    if (api.modo === 'local') return
    api
      .minhaEmpresa()
      .then(setEmpresa)
      .catch(() => undefined)
  }, [])

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

  function imprimirRelatorio() {
    const nomeEmpresa = empresa?.nome || BRAND.name
    const cnpjEmpresa = empresa?.cnpj ? `CNPJ ${formatCnpj(empresa.cnpj)}` : ''
    const logoHtml = empresa?.logo_url
      ? `<img src="${empresa.logo_url}" alt="Logo" />`
      : `<div class="logo-fallback">${(nomeEmpresa.slice(0, 1) || 'P').toUpperCase()}</div>`
    const totalDiarias = linhas.reduce((s, l) => s + l.diarias, 0)

    const corpo = linhas
      .map(
        (l) => `<tr>
          <td>${l.nome}</td>
          <td>${l.tipo}</td>
          <td class="num">${l.presencas}</td>
          <td class="num">${l.faltas}</td>
          <td class="num">${formatNumber(l.diarias)}</td>
          <td class="num strong">${formatMoney(l.liquido)}</td>
          <td class="num">${formatMoney(l.encargos)}</td>
        </tr>`,
      )
      .join('')

    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatorio ${competenciaLabel(competencia)}</title>
      <style>
        *{box-sizing:border-box}
        body{font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;background:#fff;padding:36px;max-width:920px;margin:0 auto;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .cabecalho{display:flex;align-items:center;gap:16px;padding-bottom:18px;border-bottom:3px solid #7c5cff}
        .cabecalho img{max-height:60px;max-width:200px;object-fit:contain}
        .logo-fallback{width:52px;height:52px;border-radius:14px;background:#7c5cff;color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800}
        .empresa h1{font-size:19px;margin:0}
        .empresa p{margin:3px 0 0;color:#64748b;font-size:12px}
        .titulo{margin-left:auto;text-align:right}
        .titulo .tag{display:inline-block;background:#f1edff;color:#6d28d9;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
        .titulo h2{margin:8px 0 0;font-size:16px}
        .resumo{display:flex;gap:10px;flex-wrap:wrap;margin:22px 0}
        .box{flex:1;min-width:150px;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;background:#f8fafc}
        .box span{display:block;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;font-weight:700}
        .box strong{display:block;margin-top:4px;font-size:17px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th{text-align:left;background:#f1f5f9;padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#475569}
        td{padding:7px 10px;border-bottom:1px solid #eef2f7}
        td.num{text-align:right;font-variant-numeric:tabular-nums}
        td.strong{font-weight:700;color:#6d28d9}
        tfoot td{font-weight:800;border-top:2px solid #e2e8f0;border-bottom:none}
        .gerado{margin-top:26px;font-size:10px;color:#94a3b8;text-align:center}
        @media print{body{padding:20px}}
      </style></head><body>
      <div class="cabecalho">
        <div>${logoHtml}</div>
        <div class="empresa"><h1>${nomeEmpresa}</h1><p>${cnpjEmpresa}</p></div>
        <div class="titulo"><span class="tag">Relatorio de ponto</span><h2>${competenciaLabel(competencia)}</h2></div>
      </div>
      <div class="resumo">
        <div class="box"><span>Custo total estimado</span><strong>${formatMoney(total)}</strong></div>
        <div class="box"><span>Colaboradores</span><strong>${linhas.length}</strong></div>
        <div class="box"><span>Diarias apuradas</span><strong>${formatNumber(totalDiarias)}</strong></div>
      </div>
      <table>
        <thead><tr><th>Colaborador</th><th>Contrato</th><th class="num">Presencas</th><th class="num">Faltas</th><th class="num">Diarias</th><th class="num">Liquido</th><th class="num">Encargos</th></tr></thead>
        <tbody>${corpo}</tbody>
        <tfoot><tr><td colspan="5">Total</td><td class="num">${formatMoney(total)}</td><td></td></tr></tfoot>
      </table>
      <p class="gerado">Documento gerado por ${BRAND.name} em ${new Date().toLocaleString('pt-BR')}.</p>
      </body></html>`

    const w = window.open('', '_blank', 'width=1000,height=900')
    if (!w) {
      toast.push('Habilite pop-ups para imprimir o relatorio.', 'erro')
      return
    }
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 400)
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
            <Button variant="outline" onClick={imprimirRelatorio} disabled={linhas.length === 0}>
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
          <CardTitle>Custo por local</CardTitle>
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
