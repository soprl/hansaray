import { startOfDay } from 'date-fns'

/** Takvimde gezinilebilir yıllar (otel işletmesi) */
export const CALENDAR_MIN_DATE = startOfDay(new Date(2026, 0, 1))
export const CALENDAR_MAX_DATE = startOfDay(new Date(2030, 11, 31))

export function clampCalendarDate(date) {
  const day = startOfDay(date)
  if (day < CALENDAR_MIN_DATE) return CALENDAR_MIN_DATE
  if (day > CALENDAR_MAX_DATE) return CALENDAR_MAX_DATE
  return day
}
