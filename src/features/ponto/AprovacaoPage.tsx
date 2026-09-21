import { useMemo, useState, type FormEvent } from 'react'
import { Camera, Check, ClipboardCheck, History, ListChecks, MapPin, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { useAppData } from '@/data/useAppData'
import { useAuth } from '@/features/auth/AuthContext'
import { api } from '@/data/api'
import type { PontoRegistro, TipoPonto } from '@/core/types'
import { PageHeader, EmptyState } from '@/components/ui/feedback'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { formatDate, formatTime, todayISO } from '@/lib/format'
import { cn } from '@/lib/utils'

interface ManualState {
  colaborador_id: string
  obra_id: string
  data: string
  hora: string
  tipo: TipoPonto
}

export function AprovacaoPage() {
  const { pontos, colaboradores, obras } = useAppData()
  const { user } = useAuth()
  const toast = useToast()
  const podeExcluir = user?.role === 'admin'
  const [aba, setAba] = useState<'pendentes' | 'historico'>('pendentes')
  const [filtroObra, setFiltroObra] = useState('')
  const [filtroColaborador, setFiltroColaborador] = useState('')
  const [manual, setManual] = useState<ManualState | null>(null)
  const [horas, setHoras] = useState<Record<string, string>>({})
  const [processando, setProcessando] = useState(false)
  const [fotoAberta, setFotoAberta] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState<PontoRegistro | null>(null)

  const pendentes = useMemo(
    () =>
      pontos
        .filter((p) => p.status === 'PENDENTE' && (!filtroObra || p.obra_id === filtroObra))
        .sort((a, b) => b.hora_registro.localeCompare(a.hora_registro)),
    [pontos, filtroObra],
  )

  const historico = useMemo(
    () =>
      pontos
        .filter(
          (p) =>
            (!filtroObra || p.obra_id === filtroObra) &&
            (!filtroColaborador || p.colaborador_id === filtroColaborador),
        )
        .sort((a, b) => b.hora_registro.localeCompare(a.hora_registro))
        .slice(0, 200),
    [pontos, filtroObra, filtroColaborador],
  )

  function colaborador(id: string) {
    return colaboradores.find((c) => c.id === id)
  }
  function nomeObra(id?: string | null) {
    return obras.find((o) => o.id === id)?.nome ?? '-'
  }

  async function aprovar(p: PontoRegistro) {
    setProcessando(true)
    try {
      const horaEdit = horas[p.id]
      const patch: Partial<PontoRegistro> = { status: 'VALIDADO' }
      if (horaEdit && horaEdit !== formatTime(p.hora_registro)) {
        const data = new Date(p.hora_registro).toISOString().slice(0, 10)
        patch.hora_registro = `${data}T${horaEdit}:00.000Z`
      }
      await api.updatePonto(p.id, patch)
      toast.push('Ponto aprovado.', 'sucesso')
    } finally {
      setProcessando(false)
    }
  }

  async function recusar(p: PontoRegistro) {
    setProcessando(true)
    try {
      await api.updatePonto(p.id, { status: 'RECUSADO' })
      toast.push('Ponto recusado.', 'info')
    } finally {
      setProcessando(false)
    }
  }

  async function aprovarTodos() {
    if (pendentes.length === 0) return
    setProcessando(true)
    try {
      await api.setStatusPontos(
        pendentes.map((p) => p.id),
        'VALIDADO',
      )
      toast.push(`${pendentes.length} ponto(s) aprovado(s).`, 'sucesso')
    } finally {
      setProcessando(false)
    }
  }

  async function salvarManual(e: FormEvent) {
    e.preventDefault()
    if (!manual) return
    setProcessando(true)
    try {
      await api.createPonto({
        colaborador_id: manual.colaborador_id,
        obra_id: manual.obra_id || null,
        tipo: manual.tipo,
        hora_registro: `${manual.data}T${manual.hora}:00.000Z`,
        status: 'VALIDADO',
        origem: 'MANUAL',
        pago_em_fechamento: false,
        observacao: 'Lancamento manual',
      })
      toast.push('Ponto lancado manualmente.', 'sucesso')
      setManual(null)
    } finally {
      setProcessando(false)
    }
  }

  async function excluirPonto() {
    if (!excluindo) return
    setProcessando(true)
    try {
      await api.removePonto(excluindo.id)
      toast.push('Registro de ponto excluido.', 'sucesso')
      setExcluindo(null)
    } catch {
      toast.push('Erro ao excluir o registro.', 'erro')
    } finally {
      setProcessando(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        titulo="Aprovacoes"
        descricao="Confira e valide os pontos registrados pela equipe."
        icon={ClipboardCheck}
        acao={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setFiltroObra('')
                setFiltroColaborador('')
              }}
            >
              <RefreshCw className="h-4 w-4" /> Limpar filtro
            </Button>
            <Button
              onClick={() =>
                setManual({
                  colaborador_id: colaboradores[0]?.id ?? '',
                  obra_id: obras[0]?.id ?? '',
                  data: todayISO(),
                  hora: new Date().toTimeString().slice(0, 5),
                  tipo: 'ENTRADA',
                })
              }
            >
              <Plus className="h-4 w-4" /> Lancamento manual
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="mr-auto inline-flex rounded-xl border border-border p-1">
          <button
            type="button"
            onClick={() => setAba('pendentes')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
              aba === 'pendentes' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            <ListChecks className="h-4 w-4" /> Pendentes
            {pendentes.length > 0 && <Badge variant="warning">{pendentes.length}</Badge>}
          </button>
          <button
            type="button"
            onClick={() => setAba('historico')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
              aba === 'historico' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            <History className="h-4 w-4" /> Historico
          </button>
        </div>

        <Select
          value={filtroObra}
          onChange={(e) => setFiltroObra(e.target.value)}
          className="sm:max-w-xs"
        >
          <option value="">Todos os locais</option>
          {obras.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </Select>

        {aba === 'pendentes' ? (
          <div className="flex items-center gap-2">
            <Badge variant="warning">{pendentes.length} pendente(s)</Badge>
            <Button variant="success" onClick={aprovarTodos} disabled={processando || pendentes.length === 0}>
              <Check className="h-4 w-4" /> Aprovar todos
            </Button>
          </div>
        ) : (
          <Select
            value={filtroColaborador}
            onChange={(e) => setFiltroColaborador(e.target.value)}
            className="sm:max-w-xs"
          >
            <option value="">Todos os colaboradores</option>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        )}
      </div>

      {aba === 'pendentes' ? (
        pendentes.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            titulo="Tudo em ordem"
            descricao="Nenhum ponto pendente de aprovacao neste filtro."
          />
        ) : (
          <div className="space-y-2">
            {pendentes.map((p) => {
              const c = colaborador(p.colaborador_id)
              return (
                <Card key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/12 text-sm font-extrabold text-primary">
                      {(c?.nome ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold">
                        {c?.nome ?? 'Desconhecido'}
                        {c?.matricula ? ` (#${c.matricula})` : ''}
                      </p>
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{nomeObra(p.obra_id)}</span>
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" />
                          {p.lat_registro ? 'GPS' : 'sem GPS'}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {p.foto && (
                      <button
                        type="button"
                        onClick={() => setFotoAberta(p.foto ?? null)}
                        className="h-10 w-10 overflow-hidden rounded-lg border border-border"
                        title="Ver comprovante"
                      >
                        <img src={p.foto} alt="Comprovante do ponto" className="h-full w-full object-cover" />
                      </button>
                    )}
                    {p.face_detectada === true && <Badge variant="success">Face ok</Badge>}
                    {p.face_detectada === false && <Badge variant="destructive">Sem face</Badge>}
                    <Badge variant={p.tipo === 'ENTRADA' ? 'success' : 'default'}>
                      {p.tipo === 'ENTRADA' ? 'Entrada' : p.tipo === 'SAIDA' ? 'Saida' : 'Ajuste'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(p.hora_registro)}</span>
                    <Input
                      type="time"
                      className="h-9 w-[110px]"
                      value={horas[p.id] ?? formatTime(p.hora_registro)}
                      onChange={(e) => setHoras((h) => ({ ...h, [p.id]: e.target.value }))}
                    />
                    <Button size="sm" variant="success" disabled={processando} onClick={() => aprovar(p)}>
                      <Check className="h-3.5 w-3.5" /> Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={processando}
                      onClick={() => recusar(p)}
                    >
                      <X className="h-3.5 w-3.5" /> Recusar
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )
      ) : historico.length === 0 ? (
        <EmptyState
          icon={History}
          titulo="Nenhum registro"
          descricao="Ajuste os filtros para ver o historico de pontos lancados."
        />
      ) : (
        <div className="space-y-2">
          {historico.map((p) => {
            const c = colaborador(p.colaborador_id)
            return (
              <Card key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/12 text-sm font-extrabold text-primary">
                    {(c?.nome ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold">
                      {c?.nome ?? 'Desconhecido'}
                      {c?.matricula ? ` (#${c.matricula})` : ''}
                    </p>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{nomeObra(p.obra_id)}</span>
                      <span>{formatDate(p.hora_registro)} as {formatTime(p.hora_registro)}</span>
                      {p.origem === 'MANUAL' && <Badge variant="secondary">Manual</Badge>}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={p.tipo === 'ENTRADA' ? 'success' : 'default'}>
                    {p.tipo === 'ENTRADA' ? 'Entrada' : p.tipo === 'SAIDA' ? 'Saida' : 'Ajuste'}
                  </Badge>
                  <Badge
                    variant={
                      p.status === 'VALIDADO' ? 'success' : p.status === 'RECUSADO' ? 'destructive' : 'warning'
                    }
                  >
                    {p.status}
                  </Badge>
                  {p.pago_em_fechamento && <Badge variant="secondary">Em folha</Badge>}
                  {podeExcluir && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={processando}
                      onClick={() => setExcluindo(p)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog
        open={Boolean(manual)}
        onClose={() => setManual(null)}
        title="Lancamento manual de ponto"
        description="Use para ajustar esquecimentos de batida. Entra ja validado."
      >
        {manual && (
          <form onSubmit={salvarManual} className="space-y-3">
            <Field label="Colaborador">
              <Select
                value={manual.colaborador_id}
                onChange={(e) => setManual({ ...manual, colaborador_id: e.target.value })}
              >
                {colaboradores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Local">
                <Select value={manual.obra_id} onChange={(e) => setManual({ ...manual, obra_id: e.target.value })}>
                  <option value="">Sem local</option>
                  {obras.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tipo">
                <Select
                  value={manual.tipo}
                  onChange={(e) => setManual({ ...manual, tipo: e.target.value as TipoPonto })}
                >
                  <option value="ENTRADA">Entrada</option>
                  <option value="SAIDA">Saida</option>
                  <option value="AJUSTE_MANUAL">Ajuste manual (fracao)</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data">
                <Input
                  type="date"
                  value={manual.data}
                  onChange={(e) => setManual({ ...manual, data: e.target.value })}
                />
              </Field>
              <Field label="Hora">
                <Input
                  type="time"
                  value={manual.hora}
                  onChange={(e) => setManual({ ...manual, hora: e.target.value })}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <Button type="button" variant="outline" onClick={() => setManual(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={processando}>
                {processando ? 'Salvando...' : 'Lancar ponto'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog
        open={!!fotoAberta}
        onClose={() => setFotoAberta(null)}
        title="Comprovante do registro"
        description="Foto capturada no momento da batida."
      >
        {fotoAberta && (
          <img
            src={fotoAberta}
            alt="Comprovante do ponto"
            className="mx-auto max-h-[70vh] w-auto rounded-xl border border-border"
          />
        )}
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Camera className="h-3.5 w-3.5" /> Imagem armazenada junto ao registro de ponto.
        </p>
      </Dialog>

      <Dialog
        open={Boolean(excluindo)}
        onClose={() => setExcluindo(null)}
        title="Excluir registro de ponto"
        description="Revise antes de confirmar."
        footer={
          excluindo && (
            <>
              <Button variant="outline" onClick={() => setExcluindo(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={excluirPonto} disabled={processando}>
                {processando ? 'Excluindo...' : 'Excluir definitivamente'}
              </Button>
            </>
          )
        }
      >
        {excluindo && (
          <div className="space-y-3">
            <div className="rounded-xl border border-border p-3 text-sm">
              <p className="font-bold">{colaborador(excluindo.colaborador_id)?.nome ?? 'Colaborador'}</p>
              <p className="text-muted-foreground">
                {nomeObra(excluindo.obra_id)} - {formatDate(excluindo.hora_registro)} as{' '}
                {formatTime(excluindo.hora_registro)}
              </p>
            </div>
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <strong>Esta acao nao podera ser desfeita.</strong> O registro sera apagado
              permanentemente do sistema.
            </div>
            {excluindo.pago_em_fechamento && (
              <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
                Este ponto ja foi incluido em uma folha fechada. Exclui-lo pode alterar valores ja
                apurados. Considere estornar a folha antes.
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  )
}
