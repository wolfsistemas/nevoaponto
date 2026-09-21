import type { PontoRegistro } from './types'
import { diffMinutesUTC } from './ponto'

/**
 * Configuracao de jornada de um local. A jornada semanal e distribuida nos dias
 * uteis para chegar na carga diaria de referencia; a tolerancia diaria em minutos
 * e o quanto pode faltar/sobrar em um dia antes de contar como atraso/extra.
 */
export interface JornadaConfig {
  horasSemanais: number
  diasUteis: number
  toleranciaMinutos: number
  bancoHoras: boolean
}

export const JORNADA_PADRAO: JornadaConfig = {
  horasSemanais: 44,
  diasUteis: 5,
  toleranciaMinutos: 10,
  bancoHoras: false,
}

export interface JornadaDia {
  /** YYYY-MM-DD (relogio de parede) */
  dia: string
  batidas: PontoRegistro[]
  minutosTrabalhados: number
  minutosEsperados: number
  /** trabalhados - esperados */
  saldoMinutos: number
  extraMinutos: number
  atrasoMinutos: number
  /** Existe entrada sem saida correspondente no dia. */
  incompleto: boolean
}

export interface JornadaDiaResumo {
  dia: string
  trabalhadoMin: number
  extraMin: number
  atrasoMin: number
  incompleto: boolean
}

export interface ResumoJornada {
  config: JornadaConfig
  dias: JornadaDia[]
  totalTrabalhadoMin: number
  totalExtraMin: number
  totalAtrasoMin: number
  /** extra - atraso (positivo = credito, negativo = debito) */
  saldoMin: number
  /** Saldo gravavel como banco de horas quando habilitado no local. */
  bancoMin: number
}

/** Normaliza a configuracao de jornada a partir do cadastro do local. */
export function configDaObra(
  obra?: {
    horas_semanais?: number | null
    dias_uteis?: number | null
    tolerancia_minutos?: number | null
    banco_horas?: boolean | null
  } | null,
): JornadaConfig {
  return {
    horasSemanais: Number(obra?.horas_semanais ?? JORNADA_PADRAO.horasSemanais) || JORNADA_PADRAO.horasSemanais,
    diasUteis: Number(obra?.dias_uteis ?? JORNADA_PADRAO.diasUteis) || JORNADA_PADRAO.diasUteis,
    toleranciaMinutos: Math.max(0, Number(obra?.tolerancia_minutos ?? JORNADA_PADRAO.toleranciaMinutos) || 0),
    bancoHoras: Boolean(obra?.banco_horas),
  }
}

/** Minutos esperados por dia (jornada semanal dividida pelos dias uteis). */
export function minutosEsperadosDia(config: JornadaConfig): number {
  const dias = Math.max(1, config.diasUteis)
  return (config.horasSemanais * 60) / dias
}

/** Dia (UTC-as-walltime) de um registro, no formato YYYY-MM-DD. */
function diaDoRegistro(horaRegistro: string): string {
  return new Date(horaRegistro).toISOString().slice(0, 10)
}

/** Segunda-feira da semana (UTC) de uma data YYYY-MM-DD. */
export function segundaDaSemana(dia: string): string {
  const d = new Date(`${dia}T00:00:00.000Z`)
  const delta = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - delta)
  return d.toISOString().slice(0, 10)
}

export function agruparPorDia(registros: PontoRegistro[]): Map<string, PontoRegistro[]> {
  const mapa = new Map<string, PontoRegistro[]>()
  for (const r of registros) {
    const dia = diaDoRegistro(r.hora_registro)
    const lista = mapa.get(dia) ?? []
    lista.push(r)
    mapa.set(dia, lista)
  }
  for (const lista of mapa.values()) {
    lista.sort((a, b) => a.hora_registro.localeCompare(b.hora_registro))
  }
  return mapa
}

/** Soma os minutos trabalhados de um dia pareando ENTRADA/SAIDA. */
function minutosDoDia(
  registros: PontoRegistro[],
  minutosAjuste: number,
): { minutos: number; incompleto: boolean } {
  let total = minutosAjuste
  let aberto: string | null = null
  let incompleto = false

  for (const r of registros) {
    if (r.tipo === 'ENTRADA') {
      if (aberto) incompleto = true
      aberto = r.hora_registro
    } else if (r.tipo === 'SAIDA') {
      if (aberto) {
        const minutos = diffMinutesUTC(aberto, r.hora_registro)
        if (minutos > 0 && minutos < 24 * 60) total += minutos
        aberto = null
      } else {
        incompleto = true
      }
    }
  }
  if (aberto) incompleto = true

  return { minutos: Math.max(0, total), incompleto }
}

export function calcularDia(dia: string, registros: PontoRegistro[], config: JornadaConfig): JornadaDia {
  const esperado = minutosEsperadosDia(config)
  const ajuste = registros
    .filter((r) => r.tipo === 'AJUSTE_MANUAL')
    .reduce((s, r) => s + Number(r.fracao_diaria ?? 0) * esperado, 0)

  const { minutos, incompleto } = minutosDoDia(registros, ajuste)
  const saldo = minutos - esperado

  let extra = 0
  let atraso = 0
  if (Math.abs(saldo) > config.toleranciaMinutos) {
    if (saldo > 0) extra = saldo
    else atraso = -saldo
  }

  return {
    dia,
    batidas: registros,
    minutosTrabalhados: minutos,
    minutosEsperados: esperado,
    saldoMinutos: saldo,
    extraMinutos: extra,
    atrasoMinutos: atraso,
    incompleto,
  }
}

/**
 * Calcula a jornada de um colaborador no periodo. Dias sem nenhuma batida nao
 * entram no calculo (faltas sao tratadas em outro fluxo), evitando descontos
 * indevidos por dias nao trabalhados.
 */
export function calcularJornada(
  registros: PontoRegistro[],
  config: JornadaConfig = JORNADA_PADRAO,
): ResumoJornada {
  const porDia = agruparPorDia(registros)
  const dias = Array.from(porDia.entries())
    .map(([dia, batidas]) => calcularDia(dia, batidas, config))
    .sort((a, b) => a.dia.localeCompare(b.dia))

  const totalTrabalhadoMin = dias.reduce((s, d) => s + d.minutosTrabalhados, 0)
  const totalExtraMin = dias.reduce((s, d) => s + d.extraMinutos, 0)
  const totalAtrasoMin = dias.reduce((s, d) => s + d.atrasoMinutos, 0)
  const saldoMin = totalExtraMin - totalAtrasoMin

  return {
    config,
    dias,
    totalTrabalhadoMin,
    totalExtraMin,
    totalAtrasoMin,
    saldoMin,
    bancoMin: saldoMin,
  }
}

/** Agrupa os dias em semanas (segunda a domingo) somando os totais. */
export function semanasDaJornada(resumo: ResumoJornada): Array<{
  inicio: string
  dias: JornadaDia[]
  trabalhadoMin: number
  extraMin: number
  atrasoMin: number
  saldoMin: number
}> {
  const mapa = new Map<string, JornadaDia[]>()
  for (const dia of resumo.dias) {
    const semana = segundaDaSemana(dia.dia)
    const lista = mapa.get(semana) ?? []
    lista.push(dia)
    mapa.set(semana, lista)
  }
  return Array.from(mapa.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([inicio, dias]) => {
      const trabalhadoMin = dias.reduce((s, d) => s + d.minutosTrabalhados, 0)
      const extraMin = dias.reduce((s, d) => s + d.extraMinutos, 0)
      const atrasoMin = dias.reduce((s, d) => s + d.atrasoMinutos, 0)
      return { inicio, dias, trabalhadoMin, extraMin, atrasoMin, saldoMin: extraMin - atrasoMin }
    })
}

/** Formata minutos como "8h30" (ou "45min"). */
export function formatDuracao(minutos: number): string {
  const total = Math.round(minutos)
  const sinal = total < 0 ? '-' : ''
  const abs = Math.abs(total)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  if (h === 0) return `${sinal}${m}min`
  return `${sinal}${h}h${String(m).padStart(2, '0')}`
}

export interface ColaboradorRemuneracao {
  tipo_contrato: string
  salario_base?: number | null
  valor_diaria?: number | null
}

/**
 * Valor da hora usado para converter atrasos em reais.
 * - CLT: salario mensal / (horas semanais x 5)  [44h/semana => 220h/mes]
 * - Diarista: valor da diaria / jornada diaria
 * - Empreita: sem valor hora (nao desconta por atraso)
 */
export function valorHoraColaborador(
  colaborador: ColaboradorRemuneracao | null | undefined,
  config: JornadaConfig,
): number {
  if (!colaborador) return 0
  const jornadaDiaria = minutosEsperadosDia(config) / 60
  if (colaborador.tipo_contrato === 'CLT') {
    const mensal = Number(colaborador.salario_base ?? 0)
    const horasMes = config.horasSemanais * 5
    return mensal > 0 && horasMes > 0 ? mensal / horasMes : 0
  }
  if (colaborador.tipo_contrato === 'DIARISTA') {
    const diaria = Number(colaborador.valor_diaria ?? 0)
    return diaria > 0 && jornadaDiaria > 0 ? diaria / jornadaDiaria : 0
  }
  return 0
}

/** Converte um total de minutos em reais a partir do valor da hora. */
export function valorEmReais(minutos: number, valorHora: number): number {
  return Math.round((minutos / 60) * valorHora * 100) / 100
}

/** Snapshot compacto da jornada, gravado no detalhe da folha (jsonb). */
export interface JornadaSnapshot {
  trabalhadoMin: number
  extraMin: number
  atrasoMin: number
  saldoMin: number
  bancoMin: number
  valorHora: number
  valorAtraso: number
  horasSemanais: number
  diasUteis: number
  toleranciaMinutos: number
  bancoHoras: boolean
}

export function snapshotJornada(
  resumo: ResumoJornada,
  valorHora: number,
): JornadaSnapshot {
  return {
    trabalhadoMin: Math.round(resumo.totalTrabalhadoMin),
    extraMin: Math.round(resumo.totalExtraMin),
    atrasoMin: Math.round(resumo.totalAtrasoMin),
    saldoMin: Math.round(resumo.saldoMin),
    bancoMin: Math.round(resumo.bancoMin),
    valorHora,
    valorAtraso: valorEmReais(resumo.totalAtrasoMin, valorHora),
    horasSemanais: resumo.config.horasSemanais,
    diasUteis: resumo.config.diasUteis,
    toleranciaMinutos: resumo.config.toleranciaMinutos,
    bancoHoras: resumo.config.bancoHoras,
  }
}
