import {
  addDays,
  endOfMonth,
  isBefore,
  startOfDay,
  startOfMonth,
  startOfYear,
} from 'date-fns'
import { ROOMS } from '../config/rooms'
import {
  countSeasonDaysInRange,
  getSeasonYearToDateRange,
  isDateInSeason,
  SEASON_LENGTH_DAYS,
} from '../config/season'
import { parseISODateSafe } from './formatters'
import { getMonthlyReservationIncome, RES_STATUS } from './reservationUtils'

export const ROOM_COUNT = ROOMS.length
export const SEASON_ROOM_NIGHTS_PER_YEAR = SEASON_LENGTH_DAYS * ROOM_COUNT

const isCancelled = (reservation) => reservation.reservationStatus === RES_STATUS.CANCELLED

/** Gecelik: giriş günü dahil, çıkış günü hariç. seasonOnly: sadece sezon içi geceler */
export const countReservationNightsInRange = (
  reservation,
  rangeStart,
  rangeEnd,
  { seasonOnly = false } = {},
) => {
  if (isCancelled(reservation)) return 0

  const checkIn = parseISODateSafe(reservation.checkInDate)
  const checkOut = parseISODateSafe(reservation.checkOutDate)
  if (!checkIn || !checkOut || checkOut <= checkIn) return 0

  const start = startOfDay(rangeStart)
  const end = startOfDay(rangeEnd)
  let count = 0
  let night = checkIn

  while (isBefore(night, checkOut)) {
    if (night >= start && night <= end && (!seasonOnly || isDateInSeason(night))) {
      count += 1
    }
    night = addDays(night, 1)
  }

  return count
}

export const getAvailableRoomNights = (rangeStart, rangeEnd) => {
  return countSeasonDaysInRange(rangeStart, rangeEnd) * ROOM_COUNT
}

const occupancyPercent = (occupied, available) => {
  if (!available) return 0
  return Math.min(100, Math.round((occupied / available) * 100))
}

export const getYearToDateReservationIncome = (reservations, referenceDate = new Date()) => {
  const yearStart = startOfYear(referenceDate)
  const today = startOfDay(referenceDate)
  let total = 0

  reservations.forEach((reservation) => {
    if (isCancelled(reservation)) return
    const checkIn = parseISODateSafe(reservation.checkInDate)
    if (!checkIn || checkIn < yearStart || checkIn > today) return
    total += Number(reservation.totalPrice) || 0
  })

  return total
}

export const getOccupancySnapshot = (reservations, referenceDate = new Date()) => {
  const today = startOfDay(new Date())
  const monthStart = startOfMonth(referenceDate)
  const monthEnd = endOfMonth(referenceDate)
  const yearRange = getSeasonYearToDateRange(today)
  const seasonDaysInMonth = countSeasonDaysInRange(monthStart, monthEnd)

  let monthOccupied = 0
  let yearOccupied = 0

  reservations.forEach((reservation) => {
    monthOccupied += countReservationNightsInRange(reservation, monthStart, monthEnd, {
      seasonOnly: true,
    })
    yearOccupied += countReservationNightsInRange(reservation, yearRange.start, yearRange.end, {
      seasonOnly: true,
    })
  })

  const monthAvailable = getAvailableRoomNights(monthStart, monthEnd)
  const yearAvailable = getAvailableRoomNights(yearRange.start, yearRange.end)
  const monthLodgingIncome = getMonthlyReservationIncome(reservations, referenceDate)
  const yearLodgingIncome = getYearToDateReservationIncome(reservations, today)

  return {
    monthOccupiedNights: monthOccupied,
    monthAvailableNights: monthAvailable,
    monthEmptyNights: Math.max(monthAvailable - monthOccupied, 0),
    monthOccupancyPercent: occupancyPercent(monthOccupied, monthAvailable),
    monthInSeason: seasonDaysInMonth > 0,
    yearOccupiedNights: yearOccupied,
    yearAvailableNights: yearAvailable,
    yearEmptyNights: Math.max(yearAvailable - yearOccupied, 0),
    yearOccupancyPercent: occupancyPercent(yearOccupied, yearAvailable),
    seasonDaysInMonth,
    seasonRoomNightsPerYear: SEASON_ROOM_NIGHTS_PER_YEAR,
    monthAverageDailyRate:
      monthOccupied > 0 ? Math.round(monthLodgingIncome / monthOccupied) : 0,
    monthLodgingIncome,
    yearLodgingIncome,
  }
}

export const getGoalProgress = (current, target) => {
  const safeTarget = Number(target) || 0
  const safeCurrent = Number(current) || 0
  if (safeTarget <= 0) {
    return { hasTarget: false, percent: 0, current: safeCurrent, target: 0, remaining: 0, achieved: false }
  }
  const achieved = safeCurrent >= safeTarget
  return {
    hasTarget: true,
    percent: Math.min(100, Math.round((safeCurrent / safeTarget) * 100)),
    current: safeCurrent,
    target: safeTarget,
    remaining: Math.max(0, safeTarget - safeCurrent),
    achieved,
  }
}
