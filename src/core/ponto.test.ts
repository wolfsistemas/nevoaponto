import { describe, expect, it } from 'vitest'
import {
  calcularFracaoDiaHoras,
  calcularFracaoDiaPeriodo,
  calcularSaldoPendente,
  calcularTotalDiarias,
  distanciaMetros,
  existeEntradaNoPeriodo,
  proximaMatricula,
  roundHalfDown,
} from './ponto'
import { CONFIG_PONTO_PADRAO, type PontoRegistro } from './types'

function reg(
  tipo: PontoRegistro['tipo'],
  hora: string,
  extra: Partial<PontoRegistro> = {},
): PontoRegistro {
  return {
    id: `${tipo}-${hora}`,
    colaborador_id: 'c1',
    obra_id: 'o1',
    tipo,
    hora_registro: `2026-09-19T${hora}Z`,
    status: 'VALIDADO',
    pago_em_fechamento: false,
    ...extra,
  }
}

describe('roundHalfDown', () => {
  it('mantem inteiros e limites', () => {
    expect(roundHalfDown(0)).toBe(0)
    expect(roundHalfDown(1)).toBe(1)
    expect(roundHalfDown(1.5)).toBe(1)
  })

  it('arredonda .5 para baixo', () => {
    expect(roundHalfDown(0.455)).toBe(0.45)
    expect(roundHalfDown(0.456)).toBe(0.46)
  })
})

describe('calcularFracaoDiaPeriodo (motor legado)', () => {
  it('dia completo (4 batidas) = 1 diaria', () => {
    const dia = [reg('ENTRADA', '07:00:00'), reg('SAIDA', '11:00:00'), reg('ENTRADA', '13:00:00'), reg('SAIDA', '17:00:00')]
    expect(calcularFracaoDiaPeriodo(dia)).toBe(1)
  })

  it('apenas manha = 0.5 diaria', () => {
    const dia = [reg('ENTRADA', '07:00:00'), reg('SAIDA', '11:00:00')]
    expect(calcularFracaoDiaPeriodo(dia)).toBe(0.5)
  })

  it('aplica tolerancia de 10 min por periodo', () => {
    const dia = [reg('ENTRADA', '07:00:00'), reg('SAIDA', '10:50:00')]
    expect(calcularFracaoDiaPeriodo(dia)).toBe(0.5)
  })

  it('nao completa quando falta mais que a tolerancia', () => {
    const dia = [reg('ENTRADA', '07:00:00'), reg('SAIDA', '10:49:00')]
    expect(calcularFracaoDiaPeriodo(dia)).toBe(0.48)
  })

  it('aceita ajuste manual isolado', () => {
    const dia = [reg('AJUSTE_MANUAL', '12:00:00', { fracao_diaria: 0.5 })]
    expect(calcularFracaoDiaPeriodo(dia)).toBe(0.5)
  })

  it('soma ajuste a base e limita a 1', () => {
    const dia = [
      reg('ENTRADA', '07:00:00'),
      reg('SAIDA', '11:00:00'),
      reg('AJUSTE_MANUAL', '12:00:00', { fracao_diaria: 0.75 }),
    ]
    expect(calcularFracaoDiaPeriodo(dia)).toBe(1)
  })
})

describe('calcularFracaoDiaHoras (estrategia alternativa)', () => {
  it('desconta 1h de almoco acima de 6h', () => {
    const dia = [reg('ENTRADA', '07:00:00'), reg('SAIDA', '16:00:00')]
    // 9h - 1h = 8h -> 1 diaria
    expect(calcularFracaoDiaHoras(dia)).toBe(1)
  })
})

describe('agregacoes', () => {
  it('soma diarias por dia', () => {
    const registros = [
      reg('ENTRADA', '07:00:00'),
      reg('SAIDA', '11:00:00'),
      reg('ENTRADA', '13:00:00'),
      reg('SAIDA', '17:00:00'),
      reg('AJUSTE_MANUAL', '20:00:00', { fracao_diaria: 0.5 }),
    ]
    registros[registros.length - 1].hora_registro = '2026-09-20T12:00:00Z'
    expect(calcularTotalDiarias(registros)).toBe(1.5)
  })

  it('saldo pendente ignora pagos e nao validados', () => {
    const registros: PontoRegistro[] = [
      reg('ENTRADA', '07:00:00'),
      reg('SAIDA', '11:00:00'),
      { ...reg('ENTRADA', '13:00:00', { id: 'x' }), status: 'PENDENTE' },
      { ...reg('ENTRADA', '14:00:00', { id: 'y' }), pago_em_fechamento: true },
    ]
    expect(calcularSaldoPendente(registros).totalDiarias).toBe(0.5)
  })
})

describe('geofencing', () => {
  it('zero para o mesmo ponto', () => {
    expect(distanciaMetros(-17.8, -51.7, -17.8, -51.7)).toBe(0)
  })

  it('aproxima distancia conhecida', () => {
    // ~111 km por grau de latitude
    expect(distanciaMetros(0, 0, 1, 0)).toBeGreaterThan(110000)
    expect(distanciaMetros(0, 0, 1, 0)).toBeLessThan(112000)
  })
})

describe('regras auxiliares', () => {
  it('proxima matricula', () => {
    expect(proximaMatricula([])).toBe(133)
    expect(proximaMatricula([100, '250', null])).toBe(251)
  })

  it('detecta entrada no periodo', () => {
    const registros = [reg('ENTRADA', '08:00:00')]
    expect(existeEntradaNoPeriodo(registros, '2026-09-19', '09:00')).toBe(true)
    expect(existeEntradaNoPeriodo(registros, '2026-09-19', '14:00')).toBe(false)
    expect(existeEntradaNoPeriodo(registros, '2026-09-20', '09:00')).toBe(false)
  })

  it('usa configuracao padrao', () => {
    expect(CONFIG_PONTO_PADRAO.jornadaManhaMin + CONFIG_PONTO_PADRAO.jornadaTardeMin).toBe(480)
  })
})
