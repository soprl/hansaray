import { endOfMonth, startOfDay, startOfMonth, startOfYear } from 'date-fns'
import { canonicalRoomName } from '../config/rooms'
import { EV_UNITS } from '../config/units'
import {
  countSeasonDaysInRange,
  getSeasonYearToDateRange,
  SEASON_LENGTH_DAYS,
} from '../config/season'
import { parseISODateSafe } from './formatters'
import {
  countReservationNightsInRange,
  getGoalProgress,
} from './occupancyUtils'
import { RES_STATUS } from './reservationUtils'

const isCancelled = (reservation) => reservation.reservationStatus === RES_STATUS.CANCELLED

const occupancyPercent = (occupied, available) => {
  if (!available) return 0
  return Math.min(100, Math.round((occupied / available) * 100))
}

const getUnitYearLodgingIncome = (reservations, roomId, referenceDate = new Date()) => {
  const yearStart = startOfYear(referenceDate)
  const today = startOfDay(referenceDate)
  let total = 0

  reservations.forEach((reservation) => {
    if (isCancelled(reservation)) return
    if (canonicalRoomName(reservation.roomName) !== roomId) return
    const checkIn = parseISODateSafe(reservation.checkInDate)
    if (!checkIn || checkIn < yearStart || checkIn > today) return
    total += Number(reservation.totalPrice) || 0
  })

  return total
}

export function getUnitOccupancySnapshots(reservations, referenceDate = new Date()) {
  const today = startOfDay(new Date())
  const monthStart = startOfMonth(referenceDate)
  const monthEnd = endOfMonth(referenceDate)
  const yearRange = getSeasonYearToDateRange(today)
  const seasonDaysInMonth = countSeasonDaysInRange(monthStart, monthEnd)
  const seasonDaysYearToDate = countSeasonDaysInRange(yearRange.start, yearRange.end)

  return EV_UNITS.map((unit) => {
    const { roomId } = unit
    let monthOccupied = 0
    let yearOccupied = 0

    reservations.forEach((reservation) => {
      if (canonicalRoomName(reservation.roomName) !== roomId) return
      monthOccupied += countReservationNightsInRange(reservation, monthStart, monthEnd, {
        seasonOnly: true,
      })
      yearOccupied += countReservationNightsInRange(reservation, yearRange.start, yearRange.end, {
        seasonOnly: true,
      })
    })

    const monthAvailable = seasonDaysInMonth
    const yearAvailable = seasonDaysYearToDate

    return {
      ...unit,
      monthOccupiedNights: monthOccupied,
      monthAvailableNights: monthAvailable,
      monthEmptyNights: Math.max(monthAvailable - monthOccupied, 0),
      monthOccupancyPercent: occupancyPercent(monthOccupied, monthAvailable),
      monthInSeason: seasonDaysInMonth > 0,
      yearOccupiedNights: yearOccupied,
      yearAvailableNights: yearAvailable,
      yearEmptyNights: Math.max(yearAvailable - yearOccupied, 0),
      yearOccupancyPercent: occupancyPercent(yearOccupied, yearAvailable),
      yearLodgingIncome: getUnitYearLodgingIncome(reservations, roomId, today),
      maxNightsPerSeason: SEASON_LENGTH_DAYS,
      yearRevenueGoal: null,
      yearOccupancyGoal: null,
    }
  })
}

export function attachUnitGoals(unitSnapshots, unitTargets = {}) {
  return unitSnapshots.map((unit) => {
    const targets = unitTargets[unit.roomId] ?? {}
    return {
      ...unit,
      yearRevenueGoal: getGoalProgress(unit.yearLodgingIncome, targets.yearlyLodgingTarget),
      yearOccupancyGoal: getGoalProgress(unit.yearOccupancyPercent, targets.yearlyOccupancyTargetPercent),
    }
  })
}
