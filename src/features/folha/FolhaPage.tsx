import { useEffect, useMemo, useState } from 'react'
import {
  BadgeDollarSign,
  Clock,
  FileText,
  Lock,
  Pencil,
  Printer,
  Receipt,
  RotateCcw,
  Wallet,
} from 'lucide-react'
import { api, type ApuracaoCompetencia } from '@/data/api'
import type { ResultadoFolha } from '@/core/folha'
import { formatDuracao } from '@/core/jornada'
import type { TipoContrato } from '@/core/types'
import { useAuth } from '@/features/auth/AuthContext'
import { useAppData } from '@/data/useAppData'
import { PageHeader, StatCard, EmptyState } from '@/components/ui/feedback'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { Table, TableWrap, Td, Th } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { formatMoney, formatCnpj, competenciaLabel } from '@/lib/format'
import type { Colaborador, Empresa, FolhaItem } from '@/data/types'
import { JornadaDialog } from './JornadaDialog'

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

interface LancamentoState {
  colaboradorId: string
  nome: string
  tipo: TipoContrato
  valorContrato: number
  percentual: string
  valorEmpreita: string
  outrosProventos: string
  adiantamentos: string
  descontos: string
  descontarAtrasos: boolean
}

export function FolhaPage() {
  const toast = useToast()
  const { user } = useAuth()
  const { colaboradores, pontos, fechamentos, obras } = useAppData()
  const somenteEu = user?.role === 'funcionario'
  const podeEstornar = user?.role === 'admin'
  const [competencia, setCompetencia] = useState(competenciaAtual())
  const [apuracao, setApuracao] = useState<ApuracaoCompetencia | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [fechando, setFechando] = useState(false)
  const [estornando, setEstornando] = useState(false)
  const [detalhe, setDetalhe] = useState<ResultadoFolha | null>(null)
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [lancamento, setLancamento] = useState<LancamentoState | null>(null)
  const [salvandoLancamento, setSalvandoLancamento] = useState(false)
  const [jornadaColaborador, setJornadaColaborador] = useState<Colaborador | null>(null)
  const [manuais, setManuais] = useState<Map<string, LancamentoState>>(new Map())
  const [itensSalvos, setItensSalvos] = useState<FolhaItem[]>([])

  useEffect(() => {
    if (api.modo === 'local') return
    api
      .minhaEmpresa()
      .then(setEmpresa)
      .catch(() => undefined)
  }, [])

  // Meses disponiveis: os ultimos 6 meses mais qualquer mes com ponto lancado.
  const opcoes = useMemo(() => {
    const set = new Set<string>(competenciasDisponiveis())
    set.add(competenciaAtual())
    for (const p of pontos) {
      const d = new Date(p.hora_registro)
      set.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
    }
    return Array.from(set).sort().reverse()
  }, [pontos])

  // O funcionario ve apenas o proprio holerite; gestores veem a equipe.
  const itens = useMemo(() => {
    const base = apuracao?.itens ?? []
    if (!somenteEu) return base
    if (!user?.colaborador_id) return []
    return base.filter((i) => i.colaborador_id === user.colaborador_id)
  }, [apuracao, somenteEu, user?.colaborador_id])

  const totais = useMemo(
    () =>
      itens.reduce(
        (acc, i) => ({
          proventos: acc.proventos + i.totalProventos,
          descontos: acc.descontos + i.totalDescontos,
          liquido: acc.liquido + i.valorLiquido,
        }),
        { proventos: 0, descontos: 0, liquido: 0 },
      ),
    [itens],
  )

  // Competencia fechada: itens congelados ou fechamentos gerados (nao estornados).
  const fechada = useMemo(() => {
    if (itensSalvos.some((f) => f.status !== 'ABERTO')) return true
    return fechamentos.some(
      (f) => f.periodo_inicio.startsWith(`${competencia}-`) && f.status !== 'ESTORNADO',
    )
  }, [itensSalvos, fechamentos, competencia])

  const jornadaLancamento = lancamento
    ? itens.find((i) => i.colaborador_id === lancamento.colaboradorId)?.jornada
    : undefined

  async function apurar() {
    setCarregando(true)
    try {
      const [res, lancados] = await Promise.all([
        api.apurarCompetencia(competencia),
        api.listFolhaItens(competencia),
      ])
      setApuracao(res)
      setItensSalvos(lancados)
      const mapa = new Map<string, LancamentoState>()
      for (const f of lancados) {
        const manual = (f.detalhe as { manual?: Record<string, number | boolean> } | null)?.manual
        const colab = colaboradores.find((c) => c.id === f.colaborador_id)
        if (!colab) continue
        mapa.set(f.colaborador_id, {
          colaboradorId: colab.id,
          nome: colab.nome,
          tipo: colab.tipo_contrato,
          valorContrato: Number(colab.valor_empreita ?? 0),
          percentual: manual?.empreitaPercentual != null ? String(manual.empreitaPercentual) : '',
          valorEmpreita: manual?.valorEmpreita != null ? String(manual.valorEmpreita) : '',
          outrosProventos: manual?.outrosProventos ? String(manual.outrosProventos) : '',
          adiantamentos: manual?.adiantamentos ? String(manual.adiantamentos) : '',
          descontos: manual?.descontosInformados ? String(manual.descontosInformados) : '',
          descontarAtrasos: Boolean(manual?.descontarAtrasos),
        })
      }
      setManuais(mapa)
    } catch {
      toast.push('Erro ao apurar folha.', 'erro')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    apurar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competencia, colaboradores])

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

  async function estornar() {
    const msg =
      `Estornar a folha de ${competenciaLabel(competencia)}?\n\n` +
      'Isso remove os lancamentos financeiros gerados, marca os fechamentos como ' +
      'estornados, reabre a competencia para edicao e libera os pontos.\n\n' +
      'Esta acao nao pode ser desfeita.'
    if (!confirm(msg)) return
    setEstornando(true)
    try {
      const r = await api.estornarFolha(competencia)
      toast.push(
        `Folha estornada. ${r.lancamentos} lancamento(s) removido(s) e ${r.fechamentos} fechamento(s) estornado(s).`,
        'sucesso',
      )
      await apurar()
    } catch {
      toast.push('Erro ao estornar a folha.', 'erro')
    } finally {
      setEstornando(false)
    }
  }

  function abrirLancamento(item: ResultadoFolha) {
    const c = colaboradores.find((x) => x.id === item.colaborador_id)
    if (!c) return
    const salvo = manuais.get(c.id)
    setLancamento(
      salvo ?? {
        colaboradorId: c.id,
        nome: c.nome,
        tipo: c.tipo_contrato,
        valorContrato: Number(c.valor_empreita ?? 0),
        percentual: '',
        valorEmpreita: '',
        outrosProventos: '',
        adiantamentos: '',
        descontos: '',
        descontarAtrasos: false,
      },
    )
  }

  function abrirJornada(item: ResultadoFolha) {
    const c = colaboradores.find((x) => x.id === item.colaborador_id)
    if (c) setJornadaColaborador(c)
  }

  function mudarPercentual(valor: string) {
    setLancamento((l) => {
      if (!l) return l
      const pct = Number(valor)
      const reais =
        l.valorContrato > 0 && valor !== '' ? String(arredondar((l.valorContrato * pct) / 100)) : ''
      return { ...l, percentual: valor, valorEmpreita: reais }
    })
  }

  function mudarValorEmpreita(valor: string) {
    setLancamento((l) => {
      if (!l) return l
      const reais = Number(valor)
      const pct =
        l.valorContrato > 0 && valor !== '' ? String(arredondar((reais / l.valorContrato) * 100)) : ''
      return { ...l, valorEmpreita: valor, percentual: pct }
    })
  }

  async function salvarLancamento() {
    if (!lancamento) return
    setSalvandoLancamento(true)
    try {
      await api.salvarFolhaItem({
        competencia,
        colaborador_id: lancamento.colaboradorId,
        valorEmpreita: lancamento.valorEmpreita ? Number(lancamento.valorEmpreita) : undefined,
        empreitaPercentual: lancamento.percentual ? Number(lancamento.percentual) : undefined,
        outrosProventos: lancamento.outrosProventos ? Number(lancamento.outrosProventos) : undefined,
        adiantamentos: lancamento.adiantamentos ? Number(lancamento.adiantamentos) : undefined,
        descontosInformados: lancamento.descontos ? Number(lancamento.descontos) : undefined,
        descontarAtrasos: lancamento.descontarAtrasos,
      })
      toast.push('Folha lancada e salva.', 'sucesso')
      setLancamento(null)
      await apurar()
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Erro ao salvar lancamento.', 'erro')
    } finally {
      setSalvandoLancamento(false)
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

    const nomeEmpresa = empresa?.nome || 'Recibo de pagamento'
    const cnpjEmpresa = empresa?.cnpj ? `CNPJ ${formatCnpj(empresa.cnpj)}` : ''
    const contato = empresa?.email_contato || empresa?.telefone || ''
    const logoHtml = empresa?.logo_url
      ? `<img src="${empresa.logo_url}" alt="Logo" />`
      : `<div class="logo-fallback">${(nomeEmpresa.slice(0, 1) || 'P').toUpperCase()}</div>`

    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Holerite ${item.colaborador_nome}</title>
      <style>
        *{box-sizing:border-box}
        body{font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;background:#fff;padding:36px;max-width:760px;margin:0 auto;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .cabecalho{display:flex;align-items:center;gap:16px;padding-bottom:18px;border-bottom:3px solid #7c5cff}
        .cabecalho img{max-height:64px;max-width:200px;object-fit:contain}
        .logo-fallback{width:56px;height:56px;border-radius:14px;background:#7c5cff;color:#fff;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800}
        .empresa h1{font-size:20px;margin:0}
        .empresa p{margin:3px 0 0;color:#64748b;font-size:12px}
        .recibo{margin-left:auto;text-align:right}
        .recibo .tag{display:inline-block;background:#f1edff;color:#6d28d9;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
        .recibo h2{margin:8px 0 0;font-size:15px}
        .funcionario{display:flex;justify-content:space-between;gap:12px;margin:22px 0;padding:14px 16px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc}
        .funcionario .campo span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;font-weight:700}
        .funcionario .campo strong{font-size:14px}
        h3{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#6d28d9;margin:20px 0 8px}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th{text-align:left;background:#f1f5f9;padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#475569}
        td{padding:7px 10px;border-bottom:1px solid #eef2f7}
        .totais{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}
        .box{flex:1;min-width:130px;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px}
        .box span{display:block;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;font-weight:700}
        .box strong{display:block;margin-top:4px;font-size:16px}
        .box.destaque{border-color:#7c5cff;background:#faf8ff}
        .box.destaque strong{color:#6d28d9}
        .rodape{margin-top:56px;text-align:center}
        .assinatura{border-top:1px solid #0f172a;width:60%;margin:0 auto;padding-top:8px;font-size:12px}
        .gerado{margin-top:26px;font-size:10px;color:#94a3b8;text-align:center}
        @media print{body{padding:20px}}
      </style></head><body>
      <div class="cabecalho">
        <div>${logoHtml}</div>
        <div class="empresa"><h1>${nomeEmpresa}</h1><p>${[cnpjEmpresa, contato].filter(Boolean).join(' &bull; ')}</p></div>
        <div class="recibo"><span class="tag">Recibo de pagamento</span><h2>${competenciaLabel(item.competencia)}</h2></div>
      </div>
      <div class="funcionario">
        <div class="campo"><span>Colaborador</span><strong>${item.colaborador_nome}</strong></div>
        <div class="campo"><span>Contrato</span><strong>${item.tipo_contrato}</strong></div>
        <div class="campo"><span>Competencia</span><strong>${competenciaLabel(item.competencia)}</strong></div>
      </div>
      <h3>Proventos</h3>
      <table><thead><tr><th>Descricao</th><th>Referencia</th><th style="text-align:right">Valor</th></tr></thead><tbody>${linhas('Proventos', item.proventos)}</tbody></table>
      <h3>Descontos</h3>
      <table><thead><tr><th>Descricao</th><th>Referencia</th><th style="text-align:right">Valor</th></tr></thead><tbody>${linhas('Descontos', item.descontos)}</tbody></table>
      <div class="totais">
        <div class="box"><span>Proventos</span><strong>${formatMoney(item.totalProventos)}</strong></div>
        <div class="box"><span>Descontos</span><strong>${formatMoney(item.totalDescontos)}</strong></div>
        <div class="box destaque"><span>Liquido a receber</span><strong>${formatMoney(item.valorLiquido)}</strong></div>
      </div>
      <div class="rodape"><div class="assinatura">${item.colaborador_nome.toUpperCase()}</div></div>
      <p class="gerado">Documento gerado em ${new Date().toLocaleString('pt-BR')}.</p>
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
        titulo={somenteEu ? 'Minha folha' : 'Folha de pagamento'}
        descricao={
          somenteEu
            ? 'Seus proventos, descontos e valor liquido por competencia.'
            : 'Lance os descontos informados pelo contador e gere os holerites.'
        }
        icon={Wallet}
        acao={
          <>
            {fechada ? (
              <Badge variant="success" className="shrink-0 gap-1 whitespace-nowrap">
                <Lock className="h-3 w-3" /> Fechada
              </Badge>
            ) : (
              <Badge variant="secondary" className="shrink-0 whitespace-nowrap">
                Aberta
              </Badge>
            )}
            <Select
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className="w-[190px] shrink-0"
            >
              {opcoes.map((c) => (
                <option key={c} value={c}>
                  {competenciaLabel(c)}
                </option>
              ))}
            </Select>
            <Button
              variant="outline"
              onClick={apurar}
              disabled={carregando}
              className="shrink-0 whitespace-nowrap"
            >
              {carregando ? 'Apurando...' : 'Apurar'}
            </Button>
            {!somenteEu && (
              <Button
                onClick={fechar}
                disabled={fechando || fechada || !apuracao || itens.length === 0}
                className="shrink-0 whitespace-nowrap"
              >
                <Receipt className="h-4 w-4" /> Fechar folha
              </Button>
            )}
            {podeEstornar && fechada && (
              <Button
                variant="destructive"
                onClick={estornar}
                disabled={estornando}
                className="shrink-0 whitespace-nowrap"
              >
                <RotateCcw className="h-4 w-4" /> {estornando ? 'Estornando...' : 'Estornar'}
              </Button>
            )}
          </>
        }
      />

      {fechada && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-3 text-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <p>
            <strong>Competencia fechada.</strong> Os lancamentos e descontos ficam bloqueados para
            edicao. A impressao do holerite continua liberada. Para alterar, use{' '}
            <strong>Estornar</strong> (o que reabre a competencia e remove os lancamentos
            financeiros gerados).
          </p>
        </div>
      )}

      <div className={somenteEu ? 'grid gap-4 sm:grid-cols-3' : 'grid gap-4 sm:grid-cols-3'}>
        <StatCard titulo="Proventos" valor={formatMoney(totais.proventos)} icon={BadgeDollarSign} />
        <StatCard titulo="Descontos" valor={formatMoney(totais.descontos)} icon={FileText} tom="warning" />
        <StatCard titulo="Liquido" valor={formatMoney(totais.liquido)} icon={Wallet} tom="success" />
      </div>

      <div className="mt-4">
        {itens.length === 0 ? (
          <EmptyState
            icon={Wallet}
            titulo={somenteEu ? 'Sem folha nesta competencia' : 'Sem dados na competencia'}
            descricao={
              somenteEu
                ? 'Selecione outra competencia ou fale com o gestor.'
                : 'Selecione outra competencia ou lance pontos.'
            }
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Colaborador</Th>
                  <Th>Contrato</Th>
                  <Th className="text-right">Proventos</Th>
                  <Th className="text-right">Descontos</Th>
                  <Th className="text-right">Liquido</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {itens.map((i) => (
                  <tr key={i.colaborador_id} className="border-t border-border">
                    <Td className="font-semibold">{i.colaborador_nome}</Td>
                    <Td>
                      <Badge variant="secondary">{i.tipo_contrato}</Badge>
                    </Td>
                    <Td className="text-right tabular-nums">{formatMoney(i.totalProventos)}</Td>
                    <Td className="text-right tabular-nums text-muted-foreground">
                      {formatMoney(i.totalDescontos)}
                    </Td>
                    <Td className="text-right font-extrabold tabular-nums">{formatMoney(i.valorLiquido)}</Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {!somenteEu && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abrirLancamento(i)}
                            disabled={fechada}
                            title={fechada ? 'Competencia fechada. Estorne para editar.' : undefined}
                          >
                            {fechada ? (
                              <Lock className="h-3.5 w-3.5" />
                            ) : (
                              <Pencil className="h-3.5 w-3.5" />
                            )}{' '}
                            Lancar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => abrirJornada(i)}
                          title="Ver todas as batidas e o calculo de horas"
                        >
                          <Clock className="h-3.5 w-3.5" /> Ponto
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDetalhe(i)}>
                          <FileText className="h-3.5 w-3.5" /> Holerite
                        </Button>
                      </div>
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
            {empresa?.logo_url && (
              <div className="flex items-center gap-3 border-b border-border pb-3">
                <img src={empresa.logo_url} alt="Logo" className="h-10 max-w-[160px] object-contain" />
                <p className="text-sm font-bold">{empresa.nome}</p>
              </div>
            )}
            <Secao titulo="Proventos" verbas={detalhe.proventos} />
            <Secao titulo="Descontos" verbas={detalhe.descontos} />
            <div className="grid grid-cols-3 gap-2">
              <Total titulo="Proventos" valor={detalhe.totalProventos} />
              <Total titulo="Descontos" valor={detalhe.totalDescontos} />
              <Total titulo="Liquido" valor={detalhe.valorLiquido} destaque />
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={Boolean(lancamento)}
        onClose={() => setLancamento(null)}
        title={lancamento ? `Lancar folha - ${lancamento.nome}` : ''}
        description={competenciaLabel(competencia)}
      >
        {lancamento && (
          <div className="space-y-3">
            {lancamento.tipo === 'EMPREITA' && (
              <>
                <div className="rounded-xl bg-muted/60 p-3 text-sm">
                  Valor combinado:{' '}
                  <strong>{formatMoney(lancamento.valorContrato)}</strong>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Percentual do contrato (%)">
                    <Input
                      type="number"
                      step="0.01"
                      value={lancamento.percentual}
                      onChange={(e) => mudarPercentual(e.target.value)}
                      placeholder="35"
                    />
                  </Field>
                  <Field label="Valor a receber (R$)">
                    <Input
                      type="number"
                      step="0.01"
                      value={lancamento.valorEmpreita}
                      onChange={(e) => mudarValorEmpreita(e.target.value)}
                      placeholder="3500"
                    />
                  </Field>
                </div>
                <p className="text-xs text-muted-foreground">
                  Informe o percentual ou o valor em reais. O sistema converte automaticamente.
                </p>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Outros proventos (R$)">
                <Input
                  type="number"
                  step="0.01"
                  value={lancamento.outrosProventos}
                  onChange={(e) => setLancamento({ ...lancamento, outrosProventos: e.target.value })}
                />
              </Field>
              <Field label="Adiantamentos (R$)">
                <Input
                  type="number"
                  step="0.01"
                  value={lancamento.adiantamentos}
                  onChange={(e) => setLancamento({ ...lancamento, adiantamentos: e.target.value })}
                />
              </Field>
            </div>

            <Field label="Descontos informados pelo contador (R$)">
              <Input
                type="number"
                step="0.01"
                value={lancamento.descontos}
                onChange={(e) => setLancamento({ ...lancamento, descontos: e.target.value })}
              />
            </Field>

            {jornadaLancamento && jornadaLancamento.atrasoMin > 0 && (
              <div className="rounded-xl border border-warning/40 bg-warning/10 p-3">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={lancamento.descontarAtrasos}
                    onChange={(e) =>
                      setLancamento({ ...lancamento, descontarAtrasos: e.target.checked })
                    }
                    className="h-4 w-4 accent-[hsl(var(--primary))]"
                  />
                  Lancar descontos de pontos se houver?
                </label>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Atraso apurado no ponto: <strong>{formatDuracao(jornadaLancamento.atrasoMin)}</strong>
                  {jornadaLancamento.valorHora > 0 && (
                    <>
                      {' '}
                      = <strong>{formatMoney(jornadaLancamento.valorAtraso)}</strong> (valor da hora{' '}
                      {formatMoney(jornadaLancamento.valorHora)})
                    </>
                  )}
                  . Se marcado, o valor entra como desconto no holerite.
                </p>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              O sistema nao calcula INSS, IRRF ou FGTS. Informe apenas o valor descontado. O holerite
              e os dados ficam registrados na competencia.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setLancamento(null)}>
                Cancelar
              </Button>
              <Button onClick={salvarLancamento} disabled={salvandoLancamento}>
                {salvandoLancamento ? 'Salvando...' : 'Salvar lancamento'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <JornadaDialog
        open={Boolean(jornadaColaborador)}
        onClose={() => setJornadaColaborador(null)}
        colaborador={jornadaColaborador}
        pontos={pontos}
        obras={obras}
        competencia={competencia}
      />
    </div>
  )
}

function arredondar(v: number): number {
  return Math.round(v * 100) / 100
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
