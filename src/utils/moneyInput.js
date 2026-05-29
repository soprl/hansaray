/** "350.000" → 350000, "3.500,50" → 3500.5 */
export function parseMoneyInput(value) {
  if (value === '' || value === null || value === undefined) return 0

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  const raw = String(value).trim().replace(/\s/g, '')
  if (!raw) return 0

  const lastComma = raw.lastIndexOf(',')
  if (lastComma !== -1) {
    const whole = raw.slice(0, lastComma).replace(/\./g, '').replace(/\D/g, '')
    const fraction = raw.slice(lastComma + 1).replace(/\D/g, '').slice(0, 2)
    const combined = fraction ? `${whole}.${fraction}` : whole
    const parsed = parseFloat(combined)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const digitsOnly = raw.replace(/\./g, '').replace(/\D/g, '')
  if (!digitsOnly) return 0
  const parsed = parseInt(digitsOnly, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

/** 350000 → "350.000" */
export function formatMoneyInputDisplay(value) {
  if (value === '' || value === null || value === undefined) return ''

  const amount = typeof value === 'number' ? value : parseMoneyInput(value)
  if (!Number.isFinite(amount) || amount === 0) {
    return value === 0 || value === '0' ? '0' : ''
  }

  const rounded = Math.round(amount * 100) / 100
  const [wholePart, fractionPart] = rounded.toFixed(2).split('.')
  const withThousands = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  if (fractionPart === '00') return withThousands
  return `${withThousands},${fractionPart.replace(/0+$/, '')}`
}
