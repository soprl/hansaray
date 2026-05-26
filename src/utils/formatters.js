import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'

export const formatCurrencyTRY = (value) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(value) || 0)

export const normalizeFirestoreDate = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value?.toDate === 'function') {
    return format(value.toDate(), 'yyyy-MM-dd')
  }
  if (value instanceof Date) {
    return format(value, 'yyyy-MM-dd')
  }
  return String(value)
}

export const parseISODateSafe = (value) => {
  const normalized = typeof value === 'string' ? value : normalizeFirestoreDate(value)
  if (!normalized) return null

  try {
    const parsed = parseISO(normalized)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  } catch {
    return null
  }
}

export const formatDateTR = (value, pattern = 'dd.MM.yyyy') => {
  const parsed = parseISODateSafe(value)
  if (!parsed) return '-'
  return format(parsed, pattern, { locale: tr })
}
