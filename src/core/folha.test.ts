import { describe, expect, it } from 'vitest'
import { calcularFolha, calcularINSS, calcularIRRF } from './folha'
import { TABELA_2025 } from './tabelas'

describe('calcularINSS', () => {
  it('aplica faixas progressivas', () => {
    // 1518*.075 + (2000-1518)*.09 = 113.85 + 43.38
    expect(calcularINSS(2000, TABELA_2025)).toBeCloseTo(157.23, 2)
  })

  it('zero para base nula', () => {
    expect(calcularINSS(0, TABELA_2025)).toBe(0)
  })

  it('respeita o teto', () => {
    const noTeto = calcularINSS(TABELA_2025.tetoINSS, TABELA_2025)
    const acima = calcularINSS(20000, TABELA_2025)
    expect(acima).toBeCloseTo(noTeto, 2)
  })
})

describe('calcularIRRF', () => {
  it('isenta bases baixas', () => {
    expect(calcularIRRF(2000, 0, TABELA_2025)).toBe(0)
  })

  it('considera dependentes', () => {
    const semDep = calcularIRRF(3000, 0, TABELA_2025)
    const comDep = calcularIRRF(3000, 2, TABELA_2025)
    expect(comDep).toBeLessThan(semDep)
  })
})

describe('calcularFolha CLT', () => {
  const clt = {
    id: 'c1',
    nome: 'Joao',
    tipo_contrato: 'CLT' as const,
    salario_base: 3000,
  }

  it('calcula proventos, descontos e encargos', () => {
    const r = calcularFolha({ colaborador: clt, competencia: '2025-09' })
    expect(r.totalProventos).toBe(3000)
    expect(r.valorINSS).toBeCloseTo(253.41, 2)
    expect(r.valorIRRF).toBeCloseTo(36.55, 2)
    expect(r.valorFGTS).toBeCloseTo(240, 2)
    expect(r.valorLiquido).toBeCloseTo(2710.04, 2)
    expect(r.totalEncargos).toBeCloseTo(1423.33, 2)
    expect(r.custoTotal).toBeCloseTo(4423.33, 2)
    expect(r.registraEncargos).toBe(true)
  })

  it('soma horas extras e adicional noturno', () => {
    const r = calcularFolha({
      colaborador: clt,
      competencia: '2025-09',
      horasExtras50: 10,
      horasNoturnas: 5,
    })
    // base hora = 3000/220
    expect(r.totalProventos).toBeGreaterThan(3000)
    expect(r.valorFGTS).toBeCloseTo(r.totalProventos * 0.08, 2)
  })

  it('desconta vale-transporte a 6%', () => {
    const r = calcularFolha({
      colaborador: { ...clt, recebe_vale_transporte: true },
      competencia: '2025-09',
    })
    expect(r.descontos.some((d) => d.descricao.includes('Vale-transporte'))).toBe(true)
    expect(r.totalDescontos).toBeCloseTo(r.valorINSS + r.valorIRRF + 180, 2)
  })
})

describe('calcularFolha nao-CLT', () => {
  it('diarista paga por diaria sem encargos', () => {
    const r = calcularFolha({
      colaborador: { id: 'd1', nome: 'Maria', tipo_contrato: 'DIARISTA', valor_diaria: 150 },
      competencia: '2025-09',
      totalDiarias: 20,
    })
    expect(r.totalProventos).toBe(3000)
    expect(r.totalEncargos).toBe(0)
    expect(r.valorLiquido).toBe(3000)
  })

  it('terceirizado paga por metro sem encargos', () => {
    const r = calcularFolha({
      colaborador: { id: 't1', nome: 'Pedro', tipo_contrato: 'TERCEIRIZADO', valor_metro: 12 },
      competencia: '2025-09',
      totalMetros: 350,
    })
    expect(r.totalProventos).toBe(4200)
    expect(r.registraEncargos).toBe(false)
  })

  it('aplica adiantamentos', () => {
    const r = calcularFolha({
      colaborador: { id: 'd1', nome: 'Maria', tipo_contrato: 'DIARISTA', valor_diaria: 150 },
      competencia: '2025-09',
      totalDiarias: 20,
      adiantamentos: 500,
    })
    expect(r.valorLiquido).toBe(2500)
  })
})
