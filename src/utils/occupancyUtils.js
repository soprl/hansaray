import {
  addDays,
  endOfMonth,
  isBefore,
  startOfDay,
  startOfMonth,
} from 'date-fns'
import {
  ACTIVE_ROOM_COUNT,
  canonicalRoomName,
  getRoomDisplayName,
  isRoomBookable,
  isVipRoom,
  STANDARD_ROOM_COUNT,
  STANDARD_ROOMS,
  VIP_ROOMS,
} from '../config/rooms'
import {
  countSeasonDaysInRange,
  getSeasonYearToDateRange,
  isDateInSeason,
  SEASON_LENGTH_DAYS,
} from '../config/season'
import { parseISODateSafe } from './formatters'
import {
  getMonthlyReservationIncome,
  getSeasonLodgingIncome,
  isCancelledReservation,
} from './reservationUtils'

/** @deprecated Takvimde standart doluluk için STANDARD_ROOM_COUNT kullanın */
export const ROOM_COUNT = ACTIVE_ROOM_COUNT
export const SEASON_ROOM_NIGHTS_PER_YEAR = SEASON_LENGTH_DAYS * ACTIVE_ROOM_COUNT

/**
 * O gece konaklayanlar — rezervasyon formu ile uyumlu.
 * Doluluk rengi standart odalara göre; V.I.P Teras / V.I.P Sahil ayrı sayılır.
 */
export const getOvernightStayStats = (stayList = []) => {
  const occupiedRooms = new Set()
  const occupiedStandardRooms = new Set()
  const occupiedVipRooms = new Set()

  stayList.forEach((reservation) => {
    const room = canonicalRoomName(reservation.roomName)
    if (!room || !isRoomBookable(room)) return
    occupiedRooms.add(room)
    if (isVipRoom(room)) {
      occupiedVipRooms.add(room)
    } else {
      occupiedStandardRooms.add(room)
    }
  })

  const guestCount = stayList.length
  const occupiedRoomCount = occupiedRooms.size
  const standardOccupiedRoomCount = occupiedStandardRooms.size
  const freeStandardRoomCount = Math.max(STANDARD_ROOM_COUNT - standardOccupiedRoomCount, 0)
  const freeStandardRooms = STANDARD_ROOMS.filter((room) => !occupiedStandardRooms.has(room))
  const vipFreeRooms = VIP_ROOMS.filter((room) => !occupiedVipRooms.has(room))
  const vipOccupied = occupiedVipRooms.size > 0
  const vipFree = vipFreeRooms.length > 0

  const isStandardFull = standardOccupiedRoomCount >= STANDARD_ROOM_COUNT
  const isNearlyFull =
    standardOccupiedRoomCount === STANDARD_ROOM_COUNT - 1 && !isStandardFull
  const vipFull = vipFreeRooms.length === 0
  const isAllRoomsFull = isStandardFull && vipFull

  let level = 'empty'
  if (isStandardFull && vipFull) {
    level = 'full'
  } else if (isStandardFull && vipFree) {
    level = 'vip-open'
  } else if (isNearlyFull) {
    level = 'high'
  } else if (vipFull && freeStandardRoomCount > 0) {
    level = 'standard-open'
  } else if (guestCount > 0) {
    level = 'normal'
  }

  return {
    guestCount,
    occupiedRoomCount,
    standardOccupiedRoomCount,
    freeStandardRoomCount,
    freeStandardRooms,
    occupiedVipRooms,
    vipFreeRooms,
    vipOccupied,
    vipFree,
    vipFull,
    isAllRoomsFull,
    isStandardFull,
    isNearlyFull,
    level,
  }
}

export const getOccupancyLevel = (stats) => stats.level ?? 'empty'

export const formatVipOccupancyShort = (stats) => {
  if (!stats) return ''
  const freeVip = stats.vipFreeRooms ?? []
  if (freeVip.length === VIP_ROOMS.length) return 'VIP boş'
  if (freeVip.length === 0) return 'VIP dolu'
  return `${freeVip.map(getRoomDisplayName).join(', ')} boş`
}

export const formatVipOccupancyDetail = (stats) =>
  VIP_ROOMS.map((room) => {
    const occupied = stats?.occupiedVipRooms?.has(room)
    return `${getRoomDisplayName(room)}: ${occupied ? 'dolu' : 'boş'}`
  }).join(' · ')

export const formatStandardOccupancyLabel = (stats) => {
  if (!stats) return null

  const { standardOccupiedRoomCount, vipOccupied } = stats
  if (standardOccupiedRoomCount <= 0 && !vipOccupied) return null

  const vipShort = formatVipOccupancyShort(stats)
  if (standardOccupiedRoomCount > 0) {
    return `${standardOccupiedRoomCount}/${STANDARD_ROOM_COUNT} · ${vipShort}`
  }

  return vipShort
}

export const formatStandardOccupancyDetail = (stats) => {
  if (!stats) {
    return `Standart odalar boş · ${formatVipOccupancyDetail(stats)}`
  }

  const vipNote = formatVipOccupancyDetail(stats)

  if (stats.standardOccupiedRoomCount <= 0) {
    return `Standart odalar boş (${STANDARD_ROOM_COUNT}/${STANDARD_ROOM_COUNT} müsait) · ${vipNote}`
  }

  const { standardOccupiedRoomCount, freeStandardRoomCount, freeStandardRooms, guestCount, occupiedRoomCount } = stats
  const freeNames =
    freeStandardRooms.length > 0
      ? freeStandardRooms.map(getRoomDisplayName).join(', ')
      : 'yok'

  let base = `Standart ${standardOccupiedRoomCount}/${STANDARD_ROOM_COUNT} dolu`
  if (freeStandardRoomCount > 0) {
    base += ` · boş: ${freeNames}`
  } else {
    base += ' — standart oda kalmadı'
  }

  base += ` · ${vipNote}`

  if (guestCount !== occupiedRoomCount) {
    return `${base} (${guestCount} kayıt)`
  }

  return base
}

const isCancelled = (reservation) => isCancelledReservation(reservation)

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
  const yearLodgingIncome = getSeasonLodgingIncome(reservations, today)

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
