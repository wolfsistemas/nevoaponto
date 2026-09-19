import { useEffect, useMemo, useState } from 'react'
import { BadgeDollarSign, FileText, Printer, Receipt, Wallet } from 'lucide-react'
import { api, type ApuracaoCompetencia } from '@/data/api'
import type { ResultadoFolha } from '@/core/folha'
import { PageHeader, StatCard, EmptyState } from '@/components/ui/feedback'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { Table, TableWrap, Td, Th } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { formatMoney, formatNumber, competenciaLabel } from '@/lib/format'
import { BRAND } from '@/lib/brand'

function competenciasDisponiveis(): string[] {
  const out: string[] = []
  const d = new Date()
  for (let i = 0; i < 6; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    d.setMonth(d.getMonth() - 1)
  }
  return out
}

function competenciaAtual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function FolhaPage() {
  const toast = useToast()
  const [competencia, setCompetencia] = useState(competenciaAtual())
  const [apuracao, setApuracao] = useState<ApuracaoCompetencia | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [fechando, setFechando] = useState(false)
  const [detalhe, setDetalhe] = useState<ResultadoFolha | null>(null)

  const opcoes = useMemo(competenciasDisponiveis, [])

  async function apurar() {
    setCarregando(true)
    try {
      const res = await api.apurarCompetencia(competencia)
      setApuracao(res)
    } catch {
      toast.push('Erro ao apurar folha.', 'erro')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    apurar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competencia])

  async function fechar() {
    if (!apuracao) return
    if (!confirm(`Fechar a folha de ${competenciaLabel(competencia)} e gerar os lancamentos financeiros?`)) return
    setFechando(true)
    try {
      const n = await api.fecharFolha(apuracao)
      toast.push(`Folha fechada. ${n} lancamento(s) gerado(s).`, 'sucesso')
      await apurar()
    } catch {
      toast.push('Erro ao fechar folha.', 'erro')
    } finally {
      setFechando(false)
    }
  }

  function imprimirHolerite(item: ResultadoFolha) {
    const linhas = (titulo: string, verbas: { descricao: string; referencia?: string; valor: number }[]) =>
      verbas.length === 0
        ? `<tr><td colspan="3" style="padding:6px 0;color:#888">${titulo}: nenhum</td></tr>`
        : verbas
            .map(
              (v) =>
                `<tr><td>${v.descricao}</td><td>${v.referencia ?? ''}</td><td style="text-align:right">${formatMoney(
                  v.valor,
                )}</td></tr>`,
            )
            .join('')

    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Holerite ${item.colaborador_nome}</title>
      <style>
        body{font-family:'Segoe UI',Arial,sans-serif;color:#111;padding:32px;max-width:720px;margin:0 auto}
        h1{font-size:20px;margin:0}
        .top{display:flex;justify-content:space-between;border-bottom:2px solid #eee;padding-bottom:12px;margin-bottom:20px}
        table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px}
        th{text-align:left;background:#f4f4f5;padding:6px 8px;font-size:11px;text-transform:uppercase}
        td{padding:5px 8px;border-bottom:1px solid #f0f0f0}
        h2{font-size:13px;text-transform:uppercase;color:#555;margin:18px 0 6px}
        .totais{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}
        .box{border:1px solid #e5e5e5;border-radius:10px;padding:10px 14px;min-width:150px}
        .box span{display:block;font-size:11px;color:#777;text-transform:uppercase}
        .box strong{font-size:16px}
        .assinatura{margin-top:50px;text-align:center;border-top:1px solid #000;width:60%;margin-left:auto;margin-right:auto;padding-top:8px;font-size:13px}
      </style></head><body>
      <div class="top">
        <div><h1>${BRAND.name}</h1><p style="margin:4px 0 0;color:#666;font-size:13px">Recibo de pagamento - competencia ${competenciaLabel(item.competencia)}</p></div>
        <div style="text-align:right;font-size:13px"><strong>${item.colaborador_nome}</strong><br>${item.tipo_contrato}</div>
      </div>
      <h2>Proventos</h2>
      <table><thead><tr><th>Descricao</th><th>Referencia</th><th style="text-align:right">Valor</th></tr></thead><tbody>${linhas('Proventos', item.proventos)}</tbody></table>
      <h2>Descontos</h2>
      <table><thead><tr><th>Descricao</th><th>Referencia</th><th style="text-align:right">Valor</th></tr></thead><tbody>${linhas('Descontos', item.descontos)}</tbody></table>
      <h2>Encargos (patronal)</h2>
      <table><thead><tr><th>Descricao</th><th>Referencia</th><th style="text-align:right">Valor</th></tr></thead><tbody>${linhas('Encargos', item.encargos)}</tbody></table>
      <div class="totais">
        <div class="box"><span>Proventos</span><strong>${formatMoney(item.totalProventos)}</strong></div>
        <div class="box"><span>Descontos</span><strong>${formatMoney(item.totalDescontos)}</strong></div>
        <div class="box"><span>Encargos</span><strong>${formatMoney(item.totalEncargos)}</strong></div>
        <div class="box" style="border-color:#7c5cff"><span>Liquido</span><strong>${formatMoney(item.valorLiquido)}</strong></div>
      </div>
      <div class="assinatura">${item.colaborador_nome.toUpperCase()}</div>
      </body></html>`

    const w = window.open('', '_blank', 'width=800,height=900')
    if (!w) {
      toast.push('Habilite pop-ups para imprimir o holerite.', 'erro')
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
        titulo="Folha de pagamento"
        descricao="Apuracao com proventos, descontos e encargos CLT."
        icon={Wallet}
        acao={
          <>
            <Select value={competencia} onChange={(e) => setCompetencia(e.target.value)} className="w-[190px]">
              {opcoes.map((c) => (
                <option key={c} value={c}>
                  {competenciaLabel(c)}
                </option>
              ))}
            </Select>
            <Button variant="outline" onClick={apurar} disabled={carregando}>
              {carregando ? 'Apurando...' : 'Apurar'}
            </Button>
            <Button onClick={fechar} disabled={fechando || !apuracao || apuracao.itens.length === 0}>
              <Receipt className="h-4 w-4" /> Fechar folha
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard titulo="Proventos" valor={formatMoney(apuracao?.totalProventos ?? 0)} icon={BadgeDollarSign} />
        <StatCard titulo="Descontos" valor={formatMoney(apuracao?.totalDescontos ?? 0)} icon={FileText} tom="warning" />
        <StatCard titulo="Encargos" valor={formatMoney(apuracao?.totalEncargos ?? 0)} icon={Receipt} tom="destructive" />
        <StatCard titulo="Liquido" valor={formatMoney(apuracao?.totalLiquido ?? 0)} icon={Wallet} tom="success" />
      </div>

      <div className="mt-4">
        {!apuracao || apuracao.itens.length === 0 ? (
          <EmptyState icon={Wallet} titulo="Sem dados na competencia" descricao="Selecione outra competencia ou lance pontos." />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Colaborador</Th>
                  <Th>Contrato</Th>
                  <Th className="text-right">Proventos</Th>
                  <Th className="text-right">Descontos</Th>
                  <Th className="text-right">Encargos</Th>
                  <Th className="text-right">Liquido</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {apuracao.itens.map((i) => (
                  <tr key={i.colaborador_id} className="border-t border-border">
                    <Td className="font-semibold">{i.colaborador_nome}</Td>
                    <Td>
                      <Badge variant={i.registraEncargos ? 'default' : 'secondary'}>{i.tipo_contrato}</Badge>
                    </Td>
                    <Td className="text-right tabular-nums">{formatMoney(i.totalProventos)}</Td>
                    <Td className="text-right tabular-nums text-muted-foreground">
                      {formatMoney(i.totalDescontos)}
                    </Td>
                    <Td className="text-right tabular-nums text-muted-foreground">
                      {formatMoney(i.totalEncargos)}
                    </Td>
                    <Td className="text-right font-extrabold tabular-nums">{formatMoney(i.valorLiquido)}</Td>
                    <Td className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setDetalhe(i)}>
                        <FileText className="h-3.5 w-3.5" /> Holerite
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </div>

      <Dialog
        open={Boolean(detalhe)}
        onClose={() => setDetalhe(null)}
        title={detalhe ? `Holerite - ${detalhe.colaborador_nome}` : ''}
        description={detalhe ? competenciaLabel(detalhe.competencia) : ''}
        className="sm:max-w-2xl"
        footer={
          detalhe && (
            <Button onClick={() => imprimirHolerite(detalhe)}>
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          )
        }
      >
        {detalhe && (
          <div className="space-y-4">
            <Secao titulo="Proventos" verbas={detalhe.proventos} />
            <Secao titulo="Descontos" verbas={detalhe.descontos} />
            {detalhe.encargos.length > 0 && <Secao titulo="Encargos (patronal)" verbas={detalhe.encargos} />}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Total titulo="Proventos" valor={detalhe.totalProventos} />
              <Total titulo="Descontos" valor={detalhe.totalDescontos} />
              <Total titulo="Encargos" valor={detalhe.totalEncargos} />
              <Total titulo="Liquido" valor={detalhe.valorLiquido} destaque />
            </div>
            <p className="text-xs text-muted-foreground">
              Base INSS {formatMoney(detalhe.baseINSS)} - INSS {formatMoney(detalhe.valorINSS)} - Base IRRF{' '}
              {formatMoney(detalhe.baseIRRF)} - IRRF {formatMoney(detalhe.valorIRRF)} - FGTS{' '}
              {formatMoney(detalhe.valorFGTS)}. Horas apuradas:{' '}
              {formatNumber(
                detalhe.proventos.find((p) => p.descricao.includes('Dias'))?.valor ?? 0,
                0,
              )}{' '}
              (referencia).
            </p>
          </div>
        )}
      </Dialog>
    </div>
  )
}

function Secao({
  titulo,
  verbas,
}: {
  titulo: string
  verbas: { descricao: string; referencia?: string; valor: number }[]
}) {
  return (
    <div>
      <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{titulo}</h4>
      {verbas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum lancamento.</p>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {verbas.map((v, idx) => (
            <div key={`${v.descricao}-${idx}`} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                {v.descricao}
                {v.referencia ? <span className="ml-1 text-xs text-muted-foreground">({v.referencia})</span> : null}
              </span>
              <span className="font-semibold tabular-nums">{formatMoney(v.valor)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Total({ titulo, valor, destaque }: { titulo: string; valor: number; destaque?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 ${destaque ? 'border-primary/40 bg-primary/5' : 'border-border'}`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className="mt-1 font-extrabold tabular-nums">{formatMoney(valor)}</p>
    </div>
  )
}
