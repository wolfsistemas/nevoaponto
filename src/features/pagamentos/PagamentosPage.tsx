import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import {
  BadgeDollarSign,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  Landmark,
  QrCode,
  Wallet,
} from 'lucide-react'
import { useAppData } from '@/data/useAppData'
import { api } from '@/data/api'
import type { Colaborador, Empresa, LancamentoFinanceiro } from '@/data/types'
import { PageHeader, StatCard, EmptyState } from '@/components/ui/feedback'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { Table, TableWrap, Td, Th } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { competenciaLabel, formatCpf, formatDate, formatMoney } from '@/lib/format'
import { montarPixCopiaECola } from '@/lib/pix'

function competenciaDoLancamento(l: LancamentoFinanceiro): string {
  if (l.competencia) return l.competencia
  const m = /folha:(\d{4}-\d{2})/.exec(l.referencia ?? '')
  return m?.[1] ?? ''
}

function labelCompetencia(competencia: string): string {
  return competencia ? competenciaLabel(competencia) : 'Sem competencia'
}

export function PagamentosPage() {
  const { lancamentos, colaboradores, obras, fechamentos } = useAppData()
  const toast = useToast()
  const [processando, setProcessando] = useState<string | null>(null)
  const [pagando, setPagando] = useState<LancamentoFinanceiro | null>(null)
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [qrcode, setQrcode] = useState('')

  useEffect(() => {
    if (api.modo === 'local') return
    api
      .minhaEmpresa()
      .then(setEmpresa)
      .catch(() => undefined)
  }, [])

  const nomeObra = (id?: string | null) => obras.find((o) => o.id === id)?.nome ?? 'Sem local'

  function colaboradorDoLancamento(l: LancamentoFinanceiro): Colaborador | undefined {
    if (l.colaborador_id) return colaboradores.find((c) => c.id === l.colaborador_id)
    const nome = l.descricao.includes(' - ') ? l.descricao.split(' - ').slice(1).join(' - ').trim() : ''
    return nome ? colaboradores.find((c) => c.nome === nome) : undefined
  }

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

  const aPagar = useMemo(
    () =>
      lancamentos
        .filter((l) => l.status === 'PENDENTE' && l.tipo === 'DESPESA')
        .sort((a, b) => b.data.localeCompare(a.data)),
    [lancamentos],
  )
  const pagos = useMemo(
    () =>
      lancamentos
        .filter((l) => l.status === 'PAGO' && l.tipo === 'DESPESA')
        .sort((a, b) => b.data.localeCompare(a.data))
        .slice(0, 12),
    [lancamentos],
  )

  const colaboradorPagando = pagando ? colaboradorDoLancamento(pagando) : undefined

  const pixPayload = useMemo(() => {
    if (!pagando || !colaboradorPagando?.chave_pix) return ''
    try {
      return montarPixCopiaECola({
        chave: colaboradorPagando.chave_pix,
        nome: colaboradorPagando.nome,
        cidade: empresa?.cidade || 'CIDADE',
        valor: pagando.valor,
        txid: `FOLHA${competenciaDoLancamento(pagando).replace('-', '')}`,
      })
    } catch {
      return ''
    }
  }, [pagando, colaboradorPagando, empresa])

  useEffect(() => {
    if (!pixPayload) {
      setQrcode('')
      return
    }
    QRCode.toDataURL(pixPayload, {
      width: 360,
      margin: 1,
      color: { dark: '#0b0b12', light: '#ffffff' },
    })
      .then(setQrcode)
      .catch(() => setQrcode(''))
  }, [pixPayload])

  async function copiarPix() {
    if (!pixPayload) return
    try {
      await navigator.clipboard.writeText(pixPayload)
      toast.push('PIX copia e cola copiado.', 'sucesso')
    } catch {
      toast.push('Nao foi possivel copiar.', 'erro')
    }
  }

  async function confirmarPagamento() {
    if (!pagando) return
    setProcessando(pagando.id)
    try {
      await api.markLancamentoPago(pagando.id)

      // Baixa em cadeia o fechamento correspondente (mesmo colaborador/competencia).
      const colaboradorId = pagando.colaborador_id ?? colaboradorPagando?.id
      const competencia = competenciaDoLancamento(pagando)
      const fechamento = fechamentos.find(
        (f) =>
          f.colaborador_id === colaboradorId &&
          f.status !== 'ESTORNADO' &&
          (!competencia || f.periodo_inicio.startsWith(`${competencia}-`)),
      )
      if (fechamento) {
        await api.updateFechamento(fechamento.id, {
          status: 'PAGO',
          data_pagamento: new Date().toISOString(),
        })
      }

      toast.push('Pagamento registrado.', 'sucesso')
      setPagando(null)
    } catch {
      toast.push('Erro ao registrar o pagamento.', 'erro')
    } finally {
      setProcessando(null)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        titulo="Pagamentos"
        descricao="Contas a pagar geradas pela folha. Pague pelo PIX do colaborador."
        icon={BadgeDollarSign}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard titulo="A pagar" valor={formatMoney(kpis.aPagar)} detalhe={`${kpis.pendentes} conta(s)`} icon={CircleDollarSign} tom="warning" />
        <StatCard titulo="Pago" valor={formatMoney(kpis.pago)} detalhe={`${kpis.liquidados} pagamento(s)`} icon={CheckCircle2} tom="success" />
        <StatCard titulo="Fechamentos" valor={String(fechamentos.length)} icon={Landmark} />
        <StatCard titulo="Lancamentos" valor={String(lancamentos.length)} icon={Wallet} tom="accent" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 font-bold">Contas a pagar</h3>
          {aPagar.length === 0 ? (
            <EmptyState
              icon={CircleDollarSign}
              titulo="Nada a pagar"
              descricao="Feche a folha na aba Folha para gerar as contas a pagar."
            />
          ) : (
            <div className="space-y-2">
              {aPagar.map((l) => {
                const c = colaboradorDoLancamento(l)
                return (
                  <div key={l.id} className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{c?.nome ?? l.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        {competenciaDoLancamento(l)
                          ? `${competenciaLabel(competenciaDoLancamento(l))} - `
                          : ''}
                        {nomeObra(l.obra_id)}
                        {c?.chave_pix ? ' - PIX cadastrado' : ' - sem PIX'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-extrabold tabular-nums">{formatMoney(l.valor)}</span>
                      <Button
                        size="sm"
                        variant="success"
                        disabled={processando === l.id}
                        onClick={() => setPagando(l)}
                      >
                        Pagar
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 font-bold">Pagamentos realizados</h3>
          {pagos.length === 0 ? (
            <EmptyState icon={Wallet} titulo="Nenhum pagamento" descricao="Os pagamentos aparecem aqui apos a baixa." />
          ) : (
            <TableWrap className="rounded-lg">
              <Table>
                <thead>
                  <tr>
                    <Th>Colaborador</Th>
                    <Th>Competencia</Th>
                    <Th className="text-right">Valor</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((l) => {
                    const c = colaboradorDoLancamento(l)
                    return (
                      <tr key={l.id} className="border-t border-border">
                        <Td>
                          <p className="font-semibold">{c?.nome ?? l.descricao}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(l.data)}</p>
                        </Td>
                        <Td className="text-xs text-muted-foreground">
                          {competenciaDoLancamento(l)
                            ? competenciaLabel(competenciaDoLancamento(l))
                            : '-'}
                        </Td>
                        <Td className="text-right font-bold tabular-nums">{formatMoney(l.valor)}</Td>
                        <Td className="text-right">
                          <Badge variant="success">Pago</Badge>
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </div>

      <Dialog
        open={Boolean(pagando)}
        onClose={() => setPagando(null)}
        title={colaboradorPagando ? `Pagar - ${colaboradorPagando.nome}` : 'Pagar'}
        description={
          pagando
            ? `${labelCompetencia(competenciaDoLancamento(pagando))} - ${formatMoney(pagando.valor)}`
            : ''
        }
        className="sm:max-w-xl"
        footer={
          pagando && (
            <>
              <Button variant="outline" onClick={() => setPagando(null)}>
                Cancelar
              </Button>
              <Button
                variant="success"
                onClick={confirmarPagamento}
                disabled={processando === pagando.id}
              >
                {processando === pagando.id ? 'Registrando...' : 'Confirmar pagamento'}
              </Button>
            </>
          )
        }
      >
        {pagando && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border p-3 text-sm">
              <Info rotulo="Colaborador" valor={colaboradorPagando?.nome ?? '-'} />
              <Info rotulo="CPF" valor={formatCpf(colaboradorPagando?.cpf) || '-'} />
              <Info rotulo="Contrato" valor={colaboradorPagando?.tipo_contrato ?? '-'} />
              <Info rotulo="Local" valor={nomeObra(pagando.obra_id)} />
              <Info rotulo="Chave PIX" valor={colaboradorPagando?.chave_pix ?? 'Nao cadastrada'} />
              <Info rotulo="Valor" valor={formatMoney(pagando.valor)} destaque />
            </div>

            {pixPayload ? (
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-2xl border border-border bg-white p-3">
                  {qrcode ? (
                    <img src={qrcode} alt="QR Code do PIX" className="h-52 w-52" />
                  ) : (
                    <div className="flex h-52 w-52 items-center justify-center text-muted-foreground">
                      <QrCode className="h-10 w-10" />
                    </div>
                  )}
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  Escaneie o QR Code no app do banco ou use o PIX copia e cola.
                </p>
                <div className="flex w-full items-center gap-2">
                  <p className="min-w-0 flex-1 truncate rounded-lg bg-muted p-2 font-mono text-[11px] text-muted-foreground">
                    {pixPayload}
                  </p>
                  <Button variant="outline" onClick={copiarPix} title="Copiar PIX copia e cola">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
                Este colaborador nao possui chave PIX cadastrada. Pague pelo meio combinado e
                confirme para baixar a conta.
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  )
}

function Info({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className={destaque ? 'font-extrabold text-primary' : 'font-semibold'}>{valor}</p>
    </div>
  )
}
