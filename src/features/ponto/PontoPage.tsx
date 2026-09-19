import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarClock, Camera, CheckCircle2, Clock, MapPin, Navigation, ScanFace, ShieldAlert, UserCircle } from 'lucide-react'
import { useAppData } from '@/data/useAppData'
import { useAuth } from '@/features/auth/AuthContext'
import { api } from '@/data/api'
import type { TipoPonto } from '@/core/types'
import { dentroDoPerimetro, distanciaMetros, existeEntradaNoPeriodo } from '@/core/ponto'
import { PageHeader, EmptyState } from '@/components/ui/feedback'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { CameraCaptureDialog, type CapturaPonto } from './CameraCaptureDialog'
import { formatDate, formatTime, todayISO, wallClockISO } from '@/lib/format'
import { cn } from '@/lib/utils'

type GpsEstado = 'aguardando' | 'ok' | 'erro'

export function PontoPage() {
  const { user } = useAuth()
  const { colaboradores, obras, pontos } = useAppData()
  const toast = useToast()

  const podeEscolher = user?.role === 'admin' || user?.role === 'encarregado'
  const [searchParams] = useSearchParams()
  const [colaboradorId, setColaboradorId] = useState<string>('')
  const [obraId, setObraId] = useState<string>('')
  const [agora, setAgora] = useState(new Date())
  const [gps, setGps] = useState<{ estado: GpsEstado; lat?: number; lng?: number; msg?: string }>({
    estado: 'aguardando',
  })
  const [registrando, setRegistrando] = useState(false)
  const [capturaAberta, setCapturaAberta] = useState(false)

  // Obra vinda do QR Code fixado na entrada da obra (?obra=<id>).
  useEffect(() => {
    const alvo = searchParams.get('obra')
    if (alvo && obras.some((o) => o.id === alvo)) setObraId(alvo)
  }, [searchParams, obras])

  // Colaborador padrao
  useEffect(() => {
    if (colaboradorId) return
    if (user?.colaborador_id) setColaboradorId(user.colaborador_id)
    else if (colaboradores[0]) setColaboradorId(colaboradores[0].id)
  }, [user, colaboradores, colaboradorId])

  const colaborador = colaboradores.find((c) => c.id === colaboradorId)

  useEffect(() => {
    if (colaborador?.obra_id && !obraId) setObraId(colaborador.obra_id)
  }, [colaborador, obraId])

  const obra = obras.find((o) => o.id === obraId)

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    capturarGps()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId])

  function capturarGps() {
    if (!navigator.geolocation) {
      setGps({ estado: 'erro', msg: 'Geolocalizacao nao suportada neste dispositivo.' })
      return
    }
    setGps({ estado: 'aguardando' })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ estado: 'ok', lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => setGps({ estado: 'erro', msg: 'Permita o acesso a localizacao para registrar o ponto.' }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  const distancia = useMemo(() => {
    if (gps.estado !== 'ok' || obra?.lat == null || obra?.lng == null || gps.lat == null || gps.lng == null) return null
    return distanciaMetros(gps.lat, gps.lng, obra.lat, obra.lng)
  }, [gps, obra])

  const dentro = useMemo(() => {
    if (obra?.lat == null || obra?.lng == null || gps.lat == null || gps.lng == null) return false
    return dentroDoPerimetro(
      gps.lat,
      gps.lng,
      obra.lat,
      obra.lng,
      obra.raio_tolerancia ?? 80,
    )
  }, [gps, obra])

  const registrosHoje = useMemo(() => {
    const hoje = todayISO()
    return pontos
      .filter(
        (p) =>
          p.colaborador_id === colaboradorId &&
          new Date(p.hora_registro).toISOString().slice(0, 10) === hoje,
      )
      .sort((a, b) => a.hora_registro.localeCompare(b.hora_registro))
  }, [pontos, colaboradorId])

  const proximoTipo: TipoPonto = useMemo(() => {
    const ultimo = registrosHoje[registrosHoje.length - 1]
    if (!ultimo) return 'ENTRADA'
    if (ultimo.tipo === 'ENTRADA') return 'SAIDA'
    return 'ENTRADA'
  }, [registrosHoje])

  const podeRegistrar = Boolean(colaborador) && (dentro || (podeEscolher && gps.estado === 'ok'))

  async function registrar(captura?: CapturaPonto) {
    if (!colaborador || !obra) {
      toast.push('Selecione o colaborador e a obra.', 'erro')
      return
    }
    if (!podeRegistrar) {
      toast.push('Fora do perimetro da obra.', 'erro')
      return
    }
    if (!captura && (obra.exigir_foto || obra.exigir_face)) {
      setCapturaAberta(true)
      return
    }

    const hoje = todayISO()
    if (proximoTipo === 'ENTRADA' && existeEntradaNoPeriodo(registrosHoje, hoje, formatTime(agora))) {
      toast.push('Ja existe entrada registrada neste periodo.', 'erro')
      return
    }

    setRegistrando(true)
    try {
      await api.createPonto({
        colaborador_id: colaborador.id,
        obra_id: obra.id,
        tipo: proximoTipo,
        hora_registro: wallClockISO(),
        status: 'PENDENTE',
        origem: 'APP',
        lat_registro: gps.lat != null ? String(gps.lat) : null,
        lng_registro: gps.lng != null ? String(gps.lng) : null,
        foto: captura?.foto ?? null,
        face_detectada: captura?.face ?? null,
        dispositivo: navigator.userAgent.slice(0, 150),
        pago_em_fechamento: false,
      })
      toast.push(
        `${proximoTipo === 'ENTRADA' ? 'Entrada' : 'Saida'} registrada. Aguardando aprovacao.`,
        'sucesso',
      )
    } catch {
      toast.push('Erro ao registrar ponto.', 'erro')
    } finally {
      setRegistrando(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        titulo="Bater ponto"
        descricao="Registro com validacao de localizacao e aprovacao do encarregado."
        icon={CalendarClock}
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card className="overflow-hidden">
          <div className="bg-[#0b0b12] p-6 text-center text-white">
            <p className="text-sm font-semibold text-white/60">
              {agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>
            <p className="mt-1 font-mono text-5xl font-extrabold tracking-tight tabular-nums">
              {agora.toLocaleTimeString('pt-BR')}
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
              <span className="relative flex h-2 w-2">
                <span
                  className={cn(
                    'absolute inline-flex h-full w-full rounded-full opacity-75',
                    dentro ? 'animate-pulse-ring bg-success' : 'bg-warning',
                  )}
                />
                <span className={cn('relative inline-flex h-2 w-2 rounded-full', dentro ? 'bg-success' : 'bg-warning')} />
              </span>
              {dentro ? 'Dentro do perimetro' : 'Fora do perimetro'}
            </div>
          </div>

          <div className="space-y-4 p-5">
            {podeEscolher && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Colaborador">
                  <Select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)}>
                    {colaboradores.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                        {c.matricula ? ` (#${c.matricula})` : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Obra">
                  <Select value={obraId} onChange={(e) => setObraId(e.target.value)}>
                    <option value="">Selecione</option>
                    {obras.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nome}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}

            <div className="rounded-xl border border-border p-3">
              <div className="flex items-center gap-2 text-sm">
                {gps.estado === 'ok' ? (
                  <Navigation className="h-4 w-4 text-success" />
                ) : gps.estado === 'erro' ? (
                  <ShieldAlert className="h-4 w-4 text-destructive" />
                ) : (
                  <MapPin className="h-4 w-4 animate-pulse text-warning" />
                )}
                <span className="font-semibold">
                  {gps.estado === 'ok'
                    ? `Localizacao capturada${distancia != null ? ` - ${Math.round(distancia)} m da obra` : ''}`
                    : gps.estado === 'erro'
                      ? gps.msg
                      : 'Obtendo localizacao...'}
                </span>
              </div>
              {(gps.estado === 'erro' || gps.estado === 'aguardando') && (
                <Button variant="outline" size="sm" className="mt-2" onClick={capturarGps}>
                  Tentar novamente
                </Button>
              )}
            </div>

            <Button
              size="lg"
              className="w-full"
              disabled={!podeRegistrar || registrando}
              onClick={() => registrar()}
              variant={proximoTipo === 'ENTRADA' ? 'success' : 'default'}
            >
              <Clock className="h-5 w-5" />
              {registrando
                ? 'Registrando...'
                : `Registrar ${proximoTipo === 'ENTRADA' ? 'entrada' : 'saida'}`}
            </Button>
            {obra && (obra.exigir_foto || obra.exigir_face) && (
              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                {obra.exigir_face ? (
                  <ScanFace className="h-3.5 w-3.5" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
                Esta obra exige {obra.exigir_face ? 'foto com verificacao facial' : 'foto'} no registro.
              </p>
            )}
            {!dentro && gps.estado === 'ok' && !podeEscolher && (
              <p className="text-center text-xs text-muted-foreground">
                Aproxime-se da obra para liberar o registro.
              </p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold">Registros de hoje</h3>
            {colaborador && (
              <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                <UserCircle className="h-4 w-4" /> {colaborador.nome}
              </span>
            )}
          </div>

          {registrosHoje.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              titulo="Nenhum registro hoje"
              descricao="Os registros aparecem aqui conforme sao lancados."
            />
          ) : (
            <ol className="relative space-y-3 border-l border-border pl-5">
              {registrosHoje.map((p) => (
                <li key={p.id} className="relative">
                  <span
                    className={cn(
                      'absolute -left-[26px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background',
                      p.tipo === 'ENTRADA' ? 'bg-success' : 'bg-primary',
                    )}
                  />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold">{formatTime(p.hora_registro)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(p.hora_registro)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={p.tipo === 'ENTRADA' ? 'success' : 'default'}>
                        {p.tipo === 'ENTRADA' ? 'Entrada' : p.tipo === 'SAIDA' ? 'Saida' : 'Ajuste'}
                      </Badge>
                      <Badge variant={p.status === 'VALIDADO' ? 'success' : p.status === 'RECUSADO' ? 'destructive' : 'warning'}>
                        {p.status}
                      </Badge>
                      {p.foto && (
                        <Badge variant="secondary">
                          <Camera className="h-3 w-3" />
                          Foto
                        </Badge>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
            Os registros entram como <strong>pendentes</strong> e viram validos apos a aprovacao do
            encarregado.
          </div>
        </Card>
      </div>

      <CameraCaptureDialog
        open={capturaAberta}
        onClose={() => setCapturaAberta(false)}
        exigirFace={!!obra?.exigir_face}
        onConfirmar={(captura) => {
          void registrar(captura)
        }}
      />
    </div>
  )
}
