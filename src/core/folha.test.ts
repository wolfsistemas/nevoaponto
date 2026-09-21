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

  it('usa o salario base sem descontos automaticos', () => {
    const r = calcularFolha({ colaborador: clt, competencia: '2025-09' })
    expect(r.totalProventos).toBe(3000)
    expect(r.totalDescontos).toBe(0)
    expect(r.valorLiquido).toBe(3000)
    expect(r.totalEncargos).toBe(0)
    expect(r.valorINSS).toBe(0)
    expect(r.valorIRRF).toBe(0)
    expect(r.valorFGTS).toBe(0)
    expect(r.registraEncargos).toBe(false)
  })

  it('aplica o desconto informado pelo contador', () => {
    const r = calcularFolha({
      colaborador: clt,
      competencia: '2025-09',
      descontosInformados: 289.96,
    })
    expect(r.totalProventos).toBe(3000)
    expect(r.totalDescontos).toBeCloseTo(289.96, 2)
    expect(r.valorLiquido).toBeCloseTo(2710.04, 2)
    expect(r.descontos.some((d) => d.descricao === 'Descontos')).toBe(true)
  })

  it('soma proventos avulsos', () => {
    const r = calcularFolha({
      colaborador: clt,
      competencia: '2025-09',
      outrosProventos: 500,
    })
    expect(r.totalProventos).toBe(3500)
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

  it('empreita usa o valor lancado do contrato', () => {
    const r = calcularFolha({
      colaborador: { id: 'e1', nome: 'Pedro', tipo_contrato: 'EMPREITA', valor_empreita: 10000 },
      competencia: '2025-09',
      valorEmpreita: 3500,
      empreitaReferencia: '35% de 10.000,00',
    })
    expect(r.totalProventos).toBe(3500)
    expect(r.registraEncargos).toBe(false)
    expect(r.proventos[0].referencia).toBe('35% de 10.000,00')
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
