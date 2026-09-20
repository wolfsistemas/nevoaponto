const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatMoney(value: number | null | undefined): string {
  return BRL.format(Number(value ?? 0))
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value ?? 0))
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  return `${formatNumber((value ?? 0) * 100, digits)}%`
}

const DATE = new Intl.DateTimeFormat('pt-BR')

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '-'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return DATE.format(d)
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '-'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return `${DATE.format(d)} ${formatTime(d)}`
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return '--:--'
  if (typeof value === 'string') {
    const iso = value.includes('T') ? value.split('T')[1] : value.split(' ')[1]
    if (iso) return iso.substring(0, 5)
  }
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '--:--'
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function formatCpf(value: string | null | undefined): string {
  if (!value) return ''
  const nums = value.replace(/\D/g, '')
  if (nums.length !== 11) return value
  return nums.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

export function formatCnpj(value: string | null | undefined): string {
  if (!value) return ''
  const nums = value.replace(/\D/g, '')
  if (nums.length !== 14) return value
  return nums.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

export function dayKey(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** ISO local no formato YYYY-MM-DD (evita deslocamento de fuso do toISOString). */
export function todayISO(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Instante ISO cujos campos UTC representam o relogio local ("relogio de
 * parede"). O sistema armazena o ponto como relogio de parede nos campos UTC
 * (mesma convencao do seed e do historico legado), entao gravar com
 * `toISOString()` puro deslocaria o horario exibido em relacao ao relogio do
 * usuario em fusos como America/Sao_Paulo (UTC-3).
 */
export function wallClockISO(date = new Date()): string {
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString()
}

export function competenciaLabel(competencia: string): string {
  const [ano, mes] = competencia.split('-')
  const nomes = [
    'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ]
  const idx = Number(mes) - 1
  return `${nomes[idx] ?? mes}/${ano}`
}
