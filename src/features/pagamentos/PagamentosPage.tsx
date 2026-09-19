import { useMemo, useState } from 'react'
import { BadgeDollarSign, CheckCircle2, CircleDollarSign, Landmark, Wallet } from 'lucide-react'
import { useAppData } from '@/data/useAppData'
import { api } from '@/data/api'
import { PageHeader, StatCard, EmptyState } from '@/components/ui/feedback'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableWrap, Td, Th } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { formatDate, formatMoney } from '@/lib/format'

export function PagamentosPage() {
  const { fechamentos, lancamentos, colaboradores, obras } = useAppData()
  const toast = useToast()
  const [processando, setProcessando] = useState<string | null>(null)

  const nomeColaborador = (id: string) => colaboradores.find((c) => c.id === id)?.nome ?? '-'
  const nomeObra = (id?: string | null) => obras.find((o) => o.id === id)?.nome ?? 'Sem obra'

  const kpis = useMemo(() => {
    const aPagar = lancamentos.filter((l) => l.status === 'PENDENTE' && l.tipo === 'DESPESA')
    const pago = lancamentos.filter((l) => l.status === 'PAGO' && l.tipo === 'DESPESA')
    return {
      aPagar: aPagar.reduce((s, l) => s + l.valor, 0),
      pago: pago.reduce((s, l) => s + l.valor, 0),
      pendentes: aPagar.length,
      liquidados: pago.length,
    }
  }, [lancamentos])

  async function pagarFechamento(id: string) {
    setProcessando(id)
    try {
      await api.updateFechamento(id, {
        status: 'PAGO',
        data_pagamento: new Date().toISOString(),
      })
      toast.push('Fechamento marcado como pago.', 'sucesso')
    } finally {
      setProcessando(null)
    }
  }

  async function baixarLancamento(id: string) {
    setProcessando(id)
    try {
      await api.markLancamentoPago(id)
      toast.push('Lancamento baixado.', 'sucesso')
    } finally {
      setProcessando(null)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        titulo="Pagamentos"
        descricao="Fechamentos de folha e lancamentos financeiros por obra."
        icon={BadgeDollarSign}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard titulo="A pagar" valor={formatMoney(kpis.aPagar)} detalhe={`${kpis.pendentes} lancamento(s)`} icon={CircleDollarSign} tom="warning" />
        <StatCard titulo="Pago" valor={formatMoney(kpis.pago)} detalhe={`${kpis.liquidados} lancamento(s)`} icon={CheckCircle2} tom="success" />
        <StatCard titulo="Fechamentos" valor={String(fechamentos.length)} icon={Landmark} />
        <StatCard titulo="Lancamentos" valor={String(lancamentos.length)} icon={Wallet} tom="accent" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 font-bold">Fechamentos de ponto</h3>
          {fechamentos.length === 0 ? (
            <EmptyState icon={Landmark} titulo="Nenhum fechamento" descricao="Feche a folha para gerar fechamentos." />
          ) : (
            <div className="space-y-2">
              {fechamentos.slice(0, 8).map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{nomeColaborador(f.colaborador_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      {nomeObra(f.obra_id)} - {f.periodo_inicio} a {f.periodo_fim}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-extrabold tabular-nums">{formatMoney(f.valor_liquido)}</span>
                    {f.status === 'PAGO' ? (
                      <Badge variant="success">Pago</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="success"
                        disabled={processando === f.id}
                        onClick={() => pagarFechamento(f.id)}
                      >
                        Pagar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 font-bold">Lancamentos financeiros</h3>
          {lancamentos.length === 0 ? (
            <EmptyState icon={Wallet} titulo="Nenhum lancamento" descricao="Os lancamentos surgem ao fechar a folha." />
          ) : (
            <TableWrap className="rounded-lg">
              <Table>
                <thead>
                  <tr>
                    <Th>Descricao</Th>
                    <Th>Data</Th>
                    <Th className="text-right">Valor</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.slice(0, 10).map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <Td>
                        <p className="font-semibold">{l.descricao}</p>
                        <p className="text-xs text-muted-foreground">{nomeObra(l.obra_id)} - {l.categoria}</p>
                      </Td>
                      <Td className="text-xs text-muted-foreground">{formatDate(l.data)}</Td>
                      <Td className="text-right font-bold tabular-nums">{formatMoney(l.valor)}</Td>
                      <Td className="text-right">
                        {l.status === 'PAGO' ? (
                          <Badge variant="success">Pago</Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={processando === l.id}
                            onClick={() => baixarLancamento(l.id)}
                          >
                            Baixar
                          </Button>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </div>
    </div>
  )
}
