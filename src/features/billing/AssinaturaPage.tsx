import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, CreditCard, ExternalLink, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { api } from '@/data/api'
import type { Assinatura, Empresa, Pagamento, Plano, StatusAssinatura } from '@/data/types'
import { PageHeader, StatCard, EmptyState } from '@/components/ui/feedback'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableWrap, Td, Th } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { formatDate, formatMoney } from '@/lib/format'
import { isSupabaseConfigured } from '@/lib/supabase'

const STATUS_LABEL: Record<StatusAssinatura, string> = {
  pendente: 'Aguardando pagamento',
  autorizada: 'Ativa',
  pausada: 'Pausada',
  cancelada: 'Cancelada',
  expirada: 'Expirada',
}

function diasRestantes(trialAte?: string | null): number | null {
  if (!trialAte) return null
  const fim = new Date(`${trialAte}T23:59:59`)
  if (Number.isNaN(fim.getTime())) return null
  const diff = fim.getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

export function AssinaturaPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [planos, setPlanos] = useState<Plano[]>([])
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null)
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState<string | null>(null)

  async function carregar() {
    setCarregando(true)
    try {
      const [ps, es, as, pgs] = await Promise.all([
        api.listPlanos(),
        api.listEmpresas(),
        api.listAssinaturas(),
        api.listPagamentos(),
      ])
      setPlanos([...ps].sort((a, b) => a.ordem - b.ordem))
      const propria = user?.empresa_id ? es.find((e) => e.id === user.empresa_id) : es[0]
      setEmpresa(propria ?? null)
      setAssinatura(as[0] ?? null)
      setPagamentos(pgs)
    } catch {
      toast.push('Erro ao carregar dados de assinatura.', 'erro')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.empresa_id])

  const planoAtual = useMemo(
    () => planos.find((p) => p.id === (assinatura?.plano_id ?? empresa?.plano)),
    [planos, assinatura, empresa],
  )

  const trial = diasRestantes(empresa?.trial_ate)

  async function assinar(plano: Plano) {
    if (plano.valor_mensal <= 0) {
      toast.push('Este plano e gratuito: nenhuma cobranca necessaria.', 'info')
      return
    }
    setProcessando(plano.id)
    try {
      const { init_point } = await api.criarAssinatura(plano.id)
      if (init_point) {
        window.location.href = init_point
      } else {
        toast.push('Mercado Pago nao retornou o link de pagamento.', 'erro')
      }
    } catch (erro) {
      toast.push(erro instanceof Error ? erro.message : 'Erro ao criar a assinatura.', 'erro')
    } finally {
      setProcessando(null)
    }
  }

  async function cancelar() {
    if (!confirm('Cancelar a assinatura? O acesso permanece ate o fim do periodo ja pago.')) return
    setProcessando('cancelar')
    try {
      await api.cancelarAssinatura()
      toast.push('Assinatura cancelada.', 'info')
      await carregar()
    } catch (erro) {
      toast.push(erro instanceof Error ? erro.message : 'Erro ao cancelar a assinatura.', 'erro')
    } finally {
      setProcessando(null)
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="animate-fade-in">
        <PageHeader titulo="Assinatura" descricao="Planos e cobranca via Mercado Pago." icon={CreditCard} />
        <EmptyState
          icon={CreditCard}
          titulo="Disponivel com o Supabase configurado"
          descricao="Ative o Supabase e o Mercado Pago para gerenciar a assinatura da empresa."
        />
      </div>
    )
  }

  const ativa = assinatura?.status === 'autorizada'

  return (
    <div className="animate-fade-in">
      <PageHeader
        titulo="Assinatura"
        descricao="Escolha o plano e gerencie a cobranca recorrente pelo Mercado Pago."
        icon={CreditCard}
        acao={
          ativa ? (
            <Button variant="outline" onClick={cancelar} disabled={processando === 'cancelar'}>
              {processando === 'cancelar' ? 'Cancelando...' : 'Cancelar assinatura'}
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          titulo="Plano atual"
          valor={planoAtual?.nome ?? empresa?.plano ?? '-'}
          detalhe={empresa?.status ?? 'sem empresa'}
          icon={BadgeCheck}
          tom="accent"
        />
        <StatCard
          titulo="Valor mensal"
          valor={formatMoney(empresa?.valor_mensal ?? planoAtual?.valor_mensal ?? 0)}
          icon={CreditCard}
        />
        <StatCard
          titulo="Assinatura"
          valor={assinatura ? STATUS_LABEL[assinatura.status] : 'Sem assinatura'}
          detalhe={
            assinatura?.proxima_cobranca
              ? `proxima em ${formatDate(assinatura.proxima_cobranca)}`
              : undefined
          }
          icon={ShieldCheck}
          tom={ativa ? 'success' : 'warning'}
        />
        <StatCard
          titulo="Teste gratis"
          valor={trial != null ? `${trial} dia(s)` : '-'}
          detalhe={empresa?.trial_ate ? `ate ${formatDate(empresa.trial_ate)}` : 'sem trial ativo'}
          icon={BadgeCheck}
        />
      </div>

      <h3 className="mb-3 mt-6 font-bold">Planos disponiveis</h3>
      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando planos...</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {planos.map((plano) => {
            const atual = plano.id === (assinatura?.plano_id ?? empresa?.plano)
            return (
              <Card
                key={plano.id}
                className={`flex flex-col p-5 ${plano.destaque ? 'border-primary/50 shadow-glow' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold">{plano.nome}</p>
                  {atual && <Badge variant="success">Atual</Badge>}
                  {!atual && plano.destaque && <Badge variant="default">Recomendado</Badge>}
                </div>
                <p className="mt-2 text-2xl font-extrabold">
                  {plano.valor_mensal > 0 ? formatMoney(plano.valor_mensal) : 'Gratis'}
                  {plano.valor_mensal > 0 && (
                    <span className="text-xs font-semibold text-muted-foreground">/mes</span>
                  )}
                </p>
                <ul className="mt-3 flex-1 space-y-1.5 text-xs text-muted-foreground">
                  {plano.recursos.map((recurso) => (
                    <li key={recurso} className="flex items-start gap-1.5">
                      <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                      {recurso}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-4 w-full"
                  variant={plano.destaque ? 'default' : 'outline'}
                  disabled={processando != null || plano.valor_mensal <= 0 || (atual && ativa)}
                  onClick={() => assinar(plano)}
                >
                  {processando === plano.id
                    ? 'Abrindo checkout...'
                    : atual && ativa
                      ? 'Plano ativo'
                      : 'Assinar'}
                  {!atual && <ExternalLink className="h-3.5 w-3.5" />}
                </Button>
              </Card>
            )
          })}
        </div>
      )}

      <Card className="mt-6 p-5">
        <h3 className="mb-3 font-bold">Historico de pagamentos</h3>
        {pagamentos.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            titulo="Nenhum pagamento"
            descricao="Os pagamentos aparecem aqui apos a confirmacao do Mercado Pago."
          />
        ) : (
          <TableWrap className="rounded-lg">
            <Table>
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Plano</Th>
                  <Th>Metodo</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Valor</Th>
                </tr>
              </thead>
              <tbody>
                {pagamentos.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <Td className="text-xs text-muted-foreground">{formatDate(p.pago_em ?? p.created_at)}</Td>
                    <Td>{p.plano_id ?? '-'}</Td>
                    <Td className="text-xs text-muted-foreground">{p.metodo ?? '-'}</Td>
                    <Td>
                      <Badge variant={p.status === 'approved' ? 'success' : p.status === 'pending' ? 'warning' : 'secondary'}>
                        {p.status}
                      </Badge>
                    </Td>
                    <Td className="text-right font-bold tabular-nums">{formatMoney(p.valor)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Pagamentos processados com seguranca pelo Mercado Pago. Em caso de duvidas, fale com o suporte.
      </p>
    </div>
  )
}
