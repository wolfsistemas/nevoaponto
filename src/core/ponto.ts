import type {
  ConfiguracaoPonto,
  PontoRegistro,
  ResultadoSaldo,
} from './types'
import { CONFIG_PONTO_PADRAO } from './types'

export function diffMinutesUTC(startIso: string, endIso: string): number {
  return (new Date(endIso).getTime() - new Date(startIso).getTime()) / (1000 * 60)
}

/**
 * Arredondamento "half-down" em centesimos, portado do sistema original.
 * 0,005 desce para 0,00 (comportamento da folha legada).
 */
export function roundHalfDown(v: number): number {
  if (v <= 0) return 0
  if (v >= 1) return 1
  const cents = v * 100
  const dec = cents - Math.floor(cents)
  if (Math.abs(dec - 0.5) < 0.0001) return Math.floor(cents) / 100
  return Math.round(cents) / 100
}

function calcularMinutosPeriodo(
  start: string | null,
  end: string | null,
  jornada: number,
  tolerancia: number,
): number {
  if (!start || !end) return 0
  let mins = diffMinutesUTC(start, end)
  const falta = jornada - mins
  if (falta > 0 && falta <= tolerancia) mins = jornada
  return Math.min(jornada, Math.max(0, mins))
}

/**
 * Fracao de uma diaria para os registros de UM unico dia (0..1).
 *
 * Portado fielmente de `calcularFracaoDiaPeriodo` (rvnegocios/js/shared.js):
 * - separa manha (< horaCorte) e tarde (>= horaCorte)
 * - jornada de 4h por periodo (240 min), 8h totais (480 min)
 * - tolerancia de 10 min por periodo completa o periodo
 * - AJUSTE_MANUAL soma fracao e o total e limitado a 1
 */
export function calcularFracaoDiaPeriodo(
  registrosDoDia: PontoRegistro[],
  config: ConfiguracaoPonto = CONFIG_PONTO_PADRAO,
): number {
  const entradas = registrosDoDia.filter((r) => r.tipo === 'ENTRADA').map((r) => r.hora_registro)
  const saidas = registrosDoDia.filter((r) => r.tipo === 'SAIDA').map((r) => r.hora_registro)
  const ajustes = registrosDoDia
    .filter((r) => r.tipo === 'AJUSTE_MANUAL')
    .reduce((sum, a) => sum + Number.parseFloat(String(a.fracao_diaria ?? 0)), 0)

  if (entradas.length === 0 && saidas.length === 0) return Math.min(ajustes, 1)

  const todosPontos = [
    ...entradas.map((e) => ({ tipo: 'E' as const, hora: e })),
    ...saidas.map((s) => ({ tipo: 'S' as const, hora: s })),
  ].sort((a, b) => new Date(a.hora).getTime() - new Date(b.hora).getTime())

  let startManha: string | null = null
  let endManha: string | null = null
  let startTarde: string | null = null
  let endTarde: string | null = null

  for (const p of todosPontos) {
    const hour = new Date(p.hora).getUTCHours()
    if (hour < config.horaCorteManha) {
      if (p.tipo === 'E' && !startManha) startManha = p.hora
      if (p.tipo === 'S') endManha = p.hora
    } else {
      if (p.tipo === 'E' && !startTarde) startTarde = p.hora
      if (p.tipo === 'S') endTarde = p.hora
    }
  }

  const minutosManha = calcularMinutosPeriodo(
    startManha,
    endManha,
    config.jornadaManhaMin,
    config.toleranciaMin,
  )
  const minutosTarde = calcularMinutosPeriodo(
    startTarde,
    endTarde,
    config.jornadaTardeMin,
    config.toleranciaMin,
  )

  const jornadaTotal = config.jornadaManhaMin + config.jornadaTardeMin
  let baseFracao = (minutosManha + minutosTarde) / jornadaTotal
  baseFracao = Math.min(1, Math.max(0, baseFracao))

  let fracao = baseFracao + ajustes
  if (fracao > 1) fracao = 1

  return roundHalfDown(fracao)
}

/**
 * Estrategia alternativa baseada em horas, portada de `calcularDiariasPorHora`.
 * 4 batidas = manha + tarde; senao calcula total e desconta 1h de almoco.
 */
export function calcularFracaoDiaHoras(
  registrosDoDia: PontoRegistro[],
  config: ConfiguracaoPonto = CONFIG_PONTO_PADRAO,
): number {
  const pontos = registrosDoDia
    .filter((r) => r.tipo === 'ENTRADA' || r.tipo === 'SAIDA')
    .map((r) => ({ tipo: r.tipo, hora: new Date(r.hora_registro).getTime() }))
    .sort((a, b) => a.hora - b.hora)

  const entradas = pontos.filter((p) => p.tipo === 'ENTRADA')
  const saidas = pontos.filter((p) => p.tipo === 'SAIDA')
  if (entradas.length === 0 || saidas.length === 0) return 0

  const jornadaHoras = (config.jornadaManhaMin + config.jornadaTardeMin) / 60
  let totalHoras = 0

  if (pontos.length >= 4) {
    const msManha = pontos[1].hora - pontos[0].hora
    const msTarde = pontos[3].hora - pontos[2].hora
    if (msManha > 0) totalHoras += msManha / 3_600_000
    if (msTarde > 0) totalHoras += msTarde / 3_600_000
  } else {
    let horasBrutas = (saidas[saidas.length - 1].hora - entradas[0].hora) / 3_600_000
    if (config.descontaAlmoco && horasBrutas >= 6) horasBrutas -= 1
    totalHoras = horasBrutas
  }

  if (
    totalHoras >= jornadaHoras - config.toleranciaHoras &&
    totalHoras < jornadaHoras
  ) {
    totalHoras = jornadaHoras
  }

  let fracao = totalHoras / jornadaHoras
  if (fracao > 1) fracao = 1
  else if (fracao < 0) fracao = 0
  else fracao = Number.parseFloat(fracao.toFixed(2))
  return fracao
}

export function calcularFracaoDia(
  registrosDoDia: PontoRegistro[],
  config: ConfiguracaoPonto = CONFIG_PONTO_PADRAO,
): number {
  return config.estrategia === 'HORAS'
    ? calcularFracaoDiaHoras(registrosDoDia, config)
    : calcularFracaoDiaPeriodo(registrosDoDia, config)
}

/** Agrupa registros por dia (UTC), no formato YYYY-MM-DD. */
export function agruparPorDia(registros: PontoRegistro[]): Map<string, PontoRegistro[]> {
  const porDia = new Map<string, PontoRegistro[]>()
  for (const r of registros) {
    const key = new Date(r.hora_registro).toISOString().split('T')[0]
    const lista = porDia.get(key) ?? []
    lista.push(r)
    porDia.set(key, lista)
  }
  return porDia
}

/** Soma as fracoes de diaria de um conjunto de registros. */
export function calcularTotalDiarias(
  registros: PontoRegistro[],
  config: ConfiguracaoPonto = CONFIG_PONTO_PADRAO,
): number {
  let total = 0
  for (const registrosDoDia of agruparPorDia(registros).values()) {
    total += calcularFracaoDia(registrosDoDia, config)
  }
  return total
}

export interface FiltroSaldo {
  dataInicio?: string
  dataFim?: string
  competencia?: string
}

/** Filtra registros validados e ainda nao pagos. */
export function filtrarPendentes(
  registros: PontoRegistro[],
  filtro: FiltroSaldo = {},
): PontoRegistro[] {
  let out = registros.filter((p) => p.status === 'VALIDADO' && !p.pago_em_fechamento)

  if (filtro.dataInicio) out = out.filter((p) => p.hora_registro >= `${filtro.dataInicio}T00:00:00`)
  if (filtro.dataFim) out = out.filter((p) => p.hora_registro <= `${filtro.dataFim}T23:59:59`)
  if (filtro.competencia) {
    out = out.filter((p) => {
      const d = new Date(p.hora_registro)
      const comp = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
      return comp === filtro.competencia
    })
  }
  return out
}

export function calcularSaldoPendente(
  registros: PontoRegistro[],
  filtro: FiltroSaldo = {},
  config: ConfiguracaoPonto = CONFIG_PONTO_PADRAO,
): ResultadoSaldo {
  const registrosFiltrados = filtrarPendentes(registros, filtro)
  return {
    totalDiarias: calcularTotalDiarias(registrosFiltrados, config),
    registros: registrosFiltrados,
  }
}

/** Distancia em metros entre duas coordenadas (Haversine). */
export function distanciaMetros(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371e3
  const f1 = (lat1 * Math.PI) / 180
  const f2 = (lat2 * Math.PI) / 180
  const df = ((lat2 - lat1) * Math.PI) / 180
  const dl = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function dentroDoPerimetro(
  userLat: number,
  userLng: number,
  obraLat: number,
  obraLng: number,
  raio: number,
): boolean {
  return distanciaMetros(userLat, userLng, obraLat, obraLng) <= raio
}

export type Periodo = 'MANHA' | 'TARDE'

export function periodoDaHora(hora: number): Periodo {
  return hora >= 4 && hora < 12 ? 'MANHA' : 'TARDE'
}

/** Verifica se ha ENTRADA/AJUSTE no mesmo periodo (manha/tarde) do dia. */
export function existeEntradaNoPeriodo(
  registros: PontoRegistro[],
  dataISO: string,
  hora: string,
): boolean {
  const h = Number.parseInt(hora.split(':')[0] ?? '0', 10)
  const [ini, fim] = h >= 4 && h < 12 ? ['04:00:00', '11:59:59'] : ['12:00:00', '19:00:00']
  return registros.some(
    (r) =>
      (r.tipo === 'ENTRADA' || r.tipo === 'AJUSTE_MANUAL') &&
      r.hora_registro >= `${dataISO} ${ini}` &&
      r.hora_registro <= `${dataISO} ${fim}`,
  )
}

/** Proximo numero de matricula (max + 1), iniciando em 133. */
export function proximaMatricula(matriculas: Array<string | number | null | undefined>): number {
  let max = 0
  for (const m of matriculas) {
    const n = Number.parseInt(String(m ?? ''), 10)
    if (!Number.isNaN(n) && n > max) max = n
  }
  return max > 0 ? max + 1 : 133
}

/** Formata fracao de diaria para exibicao (2 casas). */
export function formatDiarias(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
