import { addDays, differenceInCalendarDays, max as maxDate, min as minDate, startOfDay } from 'date-fns'

/** Yılda açık gün sayısı (5 oda × bu gün = yıllık kapasite gece) */
export const SEASON_LENGTH_DAYS = 180

/** Her yıl tekrarlayan sezon başlangıcı */
export const SEASON_START_MONTH = 4
export const SEASON_START_DAY = 1

export function getSeasonBoundsForYear(year) {
  const start = startOfDay(new Date(year, SEASON_START_MONTH - 1, SEASON_START_DAY))
  const end = addDays(start, SEASON_LENGTH_DAYS - 1)
  return { start, end }
}

export function isDateInSeason(date) {
  const day = startOfDay(date)
  const { start, end } = getSeasonBoundsForYear(day.getFullYear())
  return day >= start && day <= end
}

/** [rangeStart, rangeEnd] ile kesişen sezon gün sayısı */
export function countSeasonDaysInRange(rangeStart, rangeEnd) {
  const start = startOfDay(rangeStart)
  const end = startOfDay(rangeEnd)
  if (end < start) return 0

  let total = 0
  for (let year = start.getFullYear(); year <= end.getFullYear(); year += 1) {
    const { start: seasonStart, end: seasonEnd } = getSeasonBoundsForYear(year)
    const overlapStart = maxDate([start, seasonStart])
    const overlapEnd = minDate([end, seasonEnd])
    if (overlapStart <= overlapEnd) {
      total += differenceInCalendarDays(addDays(overlapEnd, 1), overlapStart)
    }
  }
  return total
}

/** Sezon başından referenceDate'e kadar (sezon öncesi → 0 gün) */
export function getSeasonYearToDateRange(referenceDate = new Date()) {
  const today = startOfDay(referenceDate)
  const { start, end } = getSeasonBoundsForYear(today.getFullYear())
  if (today < start) {
    return { start, end: addDays(start, -1) }
  }
  return { start, end: minDate([today, end]) }
}

export function formatSeasonLabel(unitCount, { unitName = 'ev' } = {}) {
  return `${unitCount} ${unitName} · ${SEASON_LENGTH_DAYS} gün/${unitName} (${unitCount * SEASON_LENGTH_DAYS} gece/yıl)`
}
