/**
 * Geracao do BR Code (PIX Copia e Cola) e do QR Code correspondente.
 *
 * O payload segue o padrao EMV QR Code do Banco Central. Nao depende de
 * nenhuma API externa: e apenas texto + CRC16, entao tambem funciona offline.
 */

export interface PixParams {
  /** Chave PIX do recebedor (CPF/CNPJ, e-mail, telefone ou chave aleatoria). */
  chave: string
  /** Nome do recebedor (maximo 25 caracteres apos normalizacao). */
  nome: string
  /** Cidade do recebedor (maximo 15 caracteres apos normalizacao). */
  cidade: string
  /** Valor a receber. Omitido/zero gera um QR sem valor fixo. */
  valor?: number
  /** Identificador da cobranca (txid). Padrao: "***". */
  txid?: string
}

/** Remove acentos e caracteres nao suportados, limitando o tamanho. */
export function normalizarCampoPix(valor: string, max: number): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 .-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, max)
}

/** Normaliza o txid: apenas letras e numeros. */
export function normalizarTxid(txid: string): string {
  const limpo = txid.replace(/[^A-Za-z0-9]/g, '')
  return limpo.slice(0, 25) || '***'
}

function campo(id: string, valor: string): string {
  const tamanho = String(valor.length).padStart(2, '0')
  return `${id}${tamanho}${valor}`
}

/** CRC16/CCITT-FALSE (poly 0x1021, init 0xFFFF), usado no fim do BR Code. */
export function crc16ccitt(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/**
 * Monta o PIX Copia e Cola. O valor e incluido apenas quando informado,
 * permitindo tanto cobrancas de valor fixo quanto abertas.
 */
export function montarPixCopiaECola(params: PixParams): string {
  const chave = params.chave.trim()
  if (!chave) throw new Error('Informe a chave PIX.')

  const merchant = campo('00', 'br.gov.bcb.pix') + campo('01', chave)

  const partes = [
    campo('00', '01'),
    campo('26', merchant),
    campo('52', '0000'),
    campo('53', '986'),
  ]

  if (params.valor != null && params.valor > 0) {
    partes.push(campo('54', params.valor.toFixed(2)))
  }

  partes.push(campo('58', 'BR'))
  partes.push(campo('59', normalizarCampoPix(params.nome, 25) || 'RECEBEDOR'))
  partes.push(campo('60', normalizarCampoPix(params.cidade, 15) || 'CIDADE'))
  partes.push(campo('62', campo('05', normalizarTxid(params.txid ?? '***'))))

  const semCrc = `${partes.join('')}6304`
  return `${semCrc}${crc16ccitt(semCrc)}`
}

/** Valida se um BR Code possui o CRC16 correto. */
export function validarPix(payload: string): boolean {
  if (!payload || payload.length < 8) return false
  const semCrc = payload.slice(0, -4)
  return crc16ccitt(semCrc) === payload.slice(-4).toUpperCase()
}
