import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'

export const formatCurrencyTRY = (value) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(value) || 0)

export const parseISODateSafe = (value) => {
  try {
    return parseISO(value)
  } catch {
    return null
  }
}

export const formatDateTR = (value, pattern = 'dd.MM.yyyy') => {
  const parsed = parseISODateSafe(value)
  if (!parsed) return '-'
  return format(parsed, pattern, { locale: tr })
}
