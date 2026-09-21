import { useMemo, useState, type FormEvent } from 'react'
import { Camera, Check, ClipboardCheck, MapPin, Plus, RefreshCw, X } from 'lucide-react'
import { useAppData } from '@/data/useAppData'
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

interface ManualState {
  colaborador_id: string
  obra_id: string
  data: string
  hora: string
  tipo: TipoPonto
}

export function AprovacaoPage() {
  const { pontos, colaboradores, obras } = useAppData()
  const toast = useToast()
  const [filtroObra, setFiltroObra] = useState('')
  const [manual, setManual] = useState<ManualState | null>(null)
  const [horas, setHoras] = useState<Record<string, string>>({})
  const [processando, setProcessando] = useState(false)
  const [fotoAberta, setFotoAberta] = useState<string | null>(null)

  const pendentes = useMemo(
    () =>
      pontos
        .filter((p) => p.status === 'PENDENTE' && (!filtroObra || p.obra_id === filtroObra))
        .sort((a, b) => b.hora_registro.localeCompare(a.hora_registro)),
    [pontos, filtroObra],
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

  return (
    <div className="animate-fade-in">
      <PageHeader
        titulo="Aprovacoes"
        descricao="Confira e valide os pontos registrados pela equipe."
        icon={ClipboardCheck}
        acao={
          <>
            <Button variant="outline" onClick={() => setFiltroObra('')}>
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

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
        <div className="flex items-center gap-2">
          <Badge variant="warning">{pendentes.length} pendente(s)</Badge>
          <Button variant="success" onClick={aprovarTodos} disabled={processando || pendentes.length === 0}>
            <Check className="h-4 w-4" /> Aprovar todos
          </Button>
        </div>
      </div>

      {pendentes.length === 0 ? (
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
    </div>
  )
}
