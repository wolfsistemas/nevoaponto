import { useMemo } from 'react'
import { CalendarDays, Clock, Timer, TrendingDown, TrendingUp } from 'lucide-react'
import type { PontoRegistro } from '@/core/types'
import type { Colaborador, Obra } from '@/data/types'
import {
  calcularJornada,
  configDaObra,
  formatDuracao,
  minutosEsperadosDia,
  semanasDaJornada,
  valorEmReais,
  valorHoraColaborador,
} from '@/core/jornada'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { competenciaLabel, formatMoney, formatTime } from '@/lib/format'

interface Props {
  open: boolean
  onClose: () => void
  colaborador: Colaborador | null
  pontos: PontoRegistro[]
  obras: Obra[]
  competencia: string
}

const ROTULO_TIPO: Record<string, string> = {
  ENTRADA: 'Entrada',
  SAIDA: 'Saida',
  AJUSTE_MANUAL: 'Ajuste manual',
}

function formatDia(dia: string): string {
  return new Date(`${dia}T00:00:00.000Z`).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  })
}

export function JornadaDialog({ open, onClose, colaborador, pontos, obras, competencia }: Props) {
  const dados = useMemo(() => {
    if (!colaborador) return null
    const config = configDaObra(obras.find((o) => o.id === colaborador.obra_id) ?? null)
    const registros = pontos.filter(
      (p) =>
        p.colaborador_id === colaborador.id &&
        p.status === 'VALIDADO' &&
        p.hora_registro.slice(0, 7) === competencia,
    )
    const resumo = calcularJornada(registros, config)
    const valorHora = valorHoraColaborador(colaborador, config)
    return {
      config,
      resumo,
      valorHora,
      semanas: semanasDaJornada(resumo),
      esperadoDia: minutosEsperadosDia(config),
    }
  }, [colaborador, pontos, obras, competencia])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={colaborador ? `Ponto e jornada - ${colaborador.nome}` : ''}
      description={competenciaLabel(competencia)}
      className="sm:max-w-2xl"
    >
      {dados && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-semibold">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {dados.config.horasSemanais} h/semana
              </span>
              <span className="text-muted-foreground">|</span>
              <span>{dados.config.diasUteis} dias uteis</span>
              <span className="text-muted-foreground">|</span>
              <span>carga diaria {formatDuracao(dados.esperadoDia)}</span>
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Timer className="h-3.5 w-3.5" /> Tolerancia {dados.config.toleranciaMinutos} min/dia
              </span>
              <span>Banco de horas: {dados.config.bancoHoras ? 'ativo' : 'inativo'}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ResumoBox titulo="Trabalhado" valor={formatDuracao(dados.resumo.totalTrabalhadoMin)} />
            <ResumoBox
              titulo="Horas extras"
              valor={formatDuracao(dados.resumo.totalExtraMin)}
              tom="success"
              icon={TrendingUp}
            />
            <ResumoBox
              titulo="Atrasos"
              valor={formatDuracao(dados.resumo.totalAtrasoMin)}
              tom="destructive"
              icon={TrendingDown}
            />
            <ResumoBox
              titulo="Saldo"
              valor={formatDuracao(dados.resumo.saldoMin)}
              tom={dados.resumo.saldoMin >= 0 ? 'success' : 'destructive'}
            />
          </div>

          {dados.valorHora > 0 ? (
            <p className="text-xs text-muted-foreground">
              Valor da hora {formatMoney(dados.valorHora)}. O atraso apurado equivale a{' '}
              <strong>{formatMoney(valorEmReais(dados.resumo.totalAtrasoMin, dados.valorHora))}</strong>{' '}
              (desconto opcional no lancamento).
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Contrato de empreita nao tem valor hora definido; os atrasos nao sao convertidos em reais.
            </p>
          )}

          {dados.semanas.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Nenhum ponto validado nesta competencia.
            </p>
          ) : (
            <div className="space-y-2">
              {dados.semanas.map((semana) => (
                <div key={semana.inicio} className="rounded-xl border border-border">
                  <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" /> Semana de {formatDia(semana.inicio)}
                    </span>
                    <span className="inline-flex items-center gap-2 normal-case">
                      <span>trab. {formatDuracao(semana.trabalhadoMin)}</span>
                      <Badge variant={semana.saldoMin >= 0 ? 'success' : 'destructive'}>
                        {semana.saldoMin >= 0 ? '+' : ''}
                        {formatDuracao(semana.saldoMin)}
                      </Badge>
                    </span>
                  </div>
                  <div className="divide-y divide-border">
                    {semana.dias.map((dia) => (
                      <div key={dia.dia} className="px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span className="font-semibold capitalize">{formatDia(dia.dia)}</span>
                          <span className="flex items-center gap-2 text-xs">
                            {dia.incompleto && <Badge variant="warning">Incompleto</Badge>}
                            {dia.extraMinutos > 0 && (
                              <span className="font-semibold text-success">
                                +{formatDuracao(dia.extraMinutos)}
                              </span>
                            )}
                            {dia.atrasoMinutos > 0 && (
                              <span className="font-semibold text-destructive">
                                -{formatDuracao(dia.atrasoMinutos)}
                              </span>
                            )}
                            <span className="tabular-nums text-muted-foreground">
                              {formatDuracao(dia.minutosTrabalhados)}
                            </span>
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {dia.batidas.map((b) => (
                            <span
                              key={b.id}
                              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold"
                            >
                              <span
                                className={
                                  b.tipo === 'ENTRADA'
                                    ? 'text-success'
                                    : b.tipo === 'SAIDA'
                                      ? 'text-destructive'
                                      : 'text-muted-foreground'
                                }
                              >
                                {ROTULO_TIPO[b.tipo] ?? b.tipo}
                              </span>
                              <span className="tabular-nums">{formatTime(b.hora_registro)}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Dialog>
  )
}

function ResumoBox({
  titulo,
  valor,
  tom,
  icon: Icon,
}: {
  titulo: string
  valor: string
  tom?: 'success' | 'destructive'
  icon?: typeof Clock
}) {
  const cor =
    tom === 'success' ? 'text-success' : tom === 'destructive' ? 'text-destructive' : 'text-foreground'
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {titulo}
      </p>
      <p className={`mt-1 font-extrabold tabular-nums ${cor}`}>{valor}</p>
    </div>
  )
}
