import { describe, expect, it } from 'vitest'
import { crc16ccitt, montarPixCopiaECola, normalizarCampoPix, validarPix } from './pix'

describe('crc16ccitt', () => {
  it('confere com o vetor de teste padrao (123456789 -> 29B1)', () => {
    expect(crc16ccitt('123456789')).toBe('29B1')
  })
})

describe('montarPixCopiaECola', () => {
  const base = {
    chave: '12345678900',
    nome: 'Empresa Exemplo LTDA',
    cidade: 'Sao Paulo',
    valor: 1234.5,
  }

  it('gera um payload valido e com CRC correto', () => {
    const payload = montarPixCopiaECola(base)
    expect(validarPix(payload)).toBe(true)
    expect(payload.startsWith('000201')).toBe(true)
    expect(payload).toContain('br.gov.bcb.pix')
    expect(payload).toContain('5303986')
    expect(payload).toContain('5802BR')
    expect(payload.endsWith(crc16ccitt(payload.slice(0, -4)))).toBe(true)
  })

  it('inclui o valor quando informado e omite quando ausente', () => {
    expect(montarPixCopiaECola(base)).toContain('54071234.50')
    expect(montarPixCopiaECola({ ...base, valor: undefined })).not.toContain('5407')
  })

  it('normaliza nome e cidade removendo acentos', () => {
    const payload = montarPixCopiaECola({ ...base, nome: 'João da Silva', cidade: 'São Paulo' })
    expect(payload).toContain('JOAO DA SILVA')
    expect(payload).toContain('SAO PAULO')
    expect(validarPix(payload)).toBe(true)
  })

  it('falha sem chave', () => {
    expect(() => montarPixCopiaECola({ ...base, chave: '  ' })).toThrow()
  })
})

describe('normalizarCampoPix', () => {
  it('limita o tamanho maximo', () => {
    expect(normalizarCampoPix('a'.repeat(80), 25)).toHaveLength(25)
  })
})
