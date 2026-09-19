export type TipoPonto = 'ENTRADA' | 'SAIDA' | 'AJUSTE_MANUAL'
export type StatusPonto = 'PENDENTE' | 'VALIDADO' | 'RECUSADO'
export type OrigemPonto = 'APP' | 'MANUAL' | 'AUTO'
export type TipoContrato = 'CLT' | 'DIARISTA' | 'TERCEIRIZADO' | 'EMPREITA'

export interface PontoRegistro {
  id: string
  colaborador_id: string
  obra_id: string | null
  tipo: TipoPonto
  /** ISO 8601 completo (ex.: 2026-09-19T07:58:00.000Z) */
  hora_registro: string
  /** Fracao de dia (0..1) usada em AJUSTE_MANUAL */
  fracao_diaria?: number | null
  status: StatusPonto
  origem?: OrigemPonto
  lat_registro?: string | null
  lng_registro?: string | null
  pago_em_fechamento?: boolean
  observacao?: string | null
}

export interface Fechamento {
  id: string
  colaborador_id: string
  obra_id: string | null
  periodo_inicio: string
  periodo_fim: string
  total_diarias: number
  valor_diaria: number
  valor_bruto: number
  total_descontos: number
  total_encargos: number
  valor_liquido: number
  status: 'ABERTO' | 'FECHADO' | 'PAGO' | 'ESTORNADO'
  data_fechamento?: string | null
  data_pagamento?: string | null
}

export interface ConfiguracaoPonto {
  /** Minutos da jornada da manha */
  jornadaManhaMin: number
  /** Minutos da jornada da tarde */
  jornadaTardeMin: number
  /** Tolerancia em minutos por periodo para completar a jornada */
  toleranciaMin: number
  /** Hora de corte entre manha e tarde */
  horaCorteManha: number
  /** Estrategia de calculo */
  estrategia: 'PERIODO' | 'HORAS'
  /** Tolerancia (horas) usada na estrategia HORAS */
  toleranciaHoras: number
  /** Desconta 1h de almoco na estrategia HORAS quando passar de 6h */
  descontaAlmoco: boolean
}

export const CONFIG_PONTO_PADRAO: ConfiguracaoPonto = {
  jornadaManhaMin: 240,
  jornadaTardeMin: 240,
  toleranciaMin: 10,
  horaCorteManha: 12,
  estrategia: 'PERIODO',
  toleranciaHoras: 20 / 60,
  descontaAlmoco: true,
}

export interface ResultadoSaldo {
  totalDiarias: number
  registros: PontoRegistro[]
}
