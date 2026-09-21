import { describe, expect, it } from 'vitest'
import type { PontoRegistro } from './types'
import {
  calcularJornada,
  configDaObra,
  formatDuracao,
  minutosEsperadosDia,
  segundaDaSemana,
  valorEmReais,
  valorHoraColaborador,
  semanasDaJornada,
  type JornadaConfig,
} from './jornada'

const CONFIG: JornadaConfig = { horasSemanais: 44, diasUteis: 5, toleranciaMinutos: 10, bancoHoras: false }

function ponto(tipo: 'ENTRADA' | 'SAIDA' | 'AJUSTE_MANUAL', hora: string, fracao?: number): PontoRegistro {
  return {
    id: `${tipo}-${hora}`,
    colaborador_id: 'c1',
    obra_id: 'o1',
    tipo,
    hora_registro: hora,
    status: 'VALIDADO',
    fracao_diaria: fracao ?? null,
  }
}

describe('configDaObra', () => {
  it('usa os padroes quando o local nao define jornada', () => {
    expect(configDaObra(null)).toEqual({ horasSemanais: 44, diasUteis: 5, toleranciaMinutos: 10, bancoHoras: false })
  })

  it('respeita os valores do local', () => {
    expect(configDaObra({ horas_semanais: 40, dias_uteis: 6, tolerancia_minutos: 5, banco_horas: true })).toEqual({
      horasSemanais: 40,
      diasUteis: 6,
      toleranciaMinutos: 5,
      bancoHoras: true,
    })
  })
})

describe('minutosEsperadosDia', () => {
  it('divide a jornada semanal pelos dias uteis', () => {
    expect(minutosEsperadosDia(CONFIG)).toBe(528)
  })
})

describe('formatDuracao', () => {
  it('formata horas e minutos', () => {
    expect(formatDuracao(510)).toBe('8h30')
    expect(formatDuracao(45)).toBe('45min')
    expect(formatDuracao(-90)).toBe('-1h30')
  })
})

describe('segundaDaSemana', () => {
  it('retorna a segunda-feira da semana', () => {
    expect(segundaDaSemana('2026-09-17')).toBe('2026-09-14')
    expect(segundaDaSemana('2026-09-14')).toBe('2026-09-14')
  })
})

describe('calcularJornada', () => {
  it('soma o intervalo entrada/saida do dia', () => {
    const resumo = calcularJornada(
      [ponto('ENTRADA', '2026-09-14T08:00:00.000Z'), ponto('SAIDA', '2026-09-14T17:00:00.000Z')],
      CONFIG,
    )
    expect(resumo.dias).toHaveLength(1)
    expect(resumo.totalTrabalhadoMin).toBe(540)
    expect(resumo.totalExtraMin).toBe(12)
    expect(resumo.totalAtrasoMin).toBe(0)
  })

  it('ignora pequenas diferencas dentro da tolerancia', () => {
    const resumo = calcularJornada(
      [ponto('ENTRADA', '2026-09-14T08:00:00.000Z'), ponto('SAIDA', '2026-09-14T16:40:00.000Z')],
      CONFIG,
    )
    expect(resumo.dias[0].saldoMinutos).toBe(-8)
    expect(resumo.totalAtrasoMin).toBe(0)
  })

  it('conta atraso quando falta mais que a tolerancia', () => {
    const resumo = calcularJornada(
      [ponto('ENTRADA', '2026-09-14T08:00:00.000Z'), ponto('SAIDA', '2026-09-14T16:00:00.000Z')],
      CONFIG,
    )
    expect(resumo.totalAtrasoMin).toBe(48)
    expect(resumo.saldoMin).toBe(-48)
  })

  it('marca dia incompleto quando ha entrada sem saida', () => {
    const resumo = calcularJornada([ponto('ENTRADA', '2026-09-14T08:00:00.000Z')], CONFIG)
    expect(resumo.dias[0].incompleto).toBe(true)
    expect(resumo.dias[0].minutosTrabalhados).toBe(0)
  })

  it('nao considera dias sem batidas (sem falta automatica)', () => {
    const resumo = calcularJornada(
      [ponto('ENTRADA', '2026-09-14T08:00:00.000Z'), ponto('SAIDA', '2026-09-14T17:00:00.000Z')],
      CONFIG,
    )
    expect(resumo.dias).toHaveLength(1)
  })

  it('considera ajuste manual pela fracao do dia', () => {
    const resumo = calcularJornada([ponto('AJUSTE_MANUAL', '2026-09-14T12:00:00.000Z', 0.5)], CONFIG)
    expect(resumo.totalTrabalhadoMin).toBe(264)
    expect(resumo.totalAtrasoMin).toBe(264)
  })
})

describe('semanasDaJornada', () => {
  it('agrupa os dias por semana somando os totais', () => {
    const resumo = calcularJornada(
      [
        ponto('ENTRADA', '2026-09-14T08:00:00.000Z'),
        ponto('SAIDA', '2026-09-14T17:00:00.000Z'),
        ponto('ENTRADA', '2026-09-15T08:00:00.000Z'),
        ponto('SAIDA', '2026-09-15T17:00:00.000Z'),
      ],
      CONFIG,
    )
    const semanas = semanasDaJornada(resumo)
    expect(semanas).toHaveLength(1)
    expect(semanas[0].inicio).toBe('2026-09-14')
    expect(semanas[0].extraMin).toBe(24)
  })
})

describe('valorHoraColaborador', () => {
  it('calcula o valor hora do CLT pela jornada mensal', () => {
    expect(valorHoraColaborador({ tipo_contrato: 'CLT', salario_base: 2200 }, CONFIG)).toBe(10)
  })

  it('calcula o valor hora do diarista pela jornada diaria', () => {
    const valor = valorHoraColaborador({ tipo_contrato: 'DIARISTA', valor_diaria: 176 }, CONFIG)
    expect(valor).toBeCloseTo(20, 5)
  })

  it('nao define valor hora para empreita', () => {
    expect(valorHoraColaborador({ tipo_contrato: 'EMPREITA', valor_diaria: 200 }, CONFIG)).toBe(0)
  })
})

describe('valorEmReais', () => {
  it('converte minutos em reais', () => {
    expect(valorEmReais(90, 10)).toBe(15)
  })
})
