import {
  addMonths,
  endOfMonth,
  isAfter,
  isSameDay,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  subDays,
} from 'date-fns'
import { parseISODateSafe } from './formatters'

export const RES_STATUS = {
  ACTIVE: 'Aktif',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
}

export const isCancelledReservation = (reservation) => reservation.reservationStatus === RES_STATUS.CANCELLED

export const isRevenueEligibleReservation = (reservation) =>
  reservation.reservationStatus === RES_STATUS.ACTIVE || reservation.reservationStatus === RES_STATUS.COMPLETED

export const getReservationStatusCounts = (reservations) =>
  reservations.reduce(
    (acc, reservation) => {
      if (reservation.reservationStatus === RES_STATUS.ACTIVE) acc.active += 1
      if (reservation.reservationStatus === RES_STATUS.COMPLETED) acc.completed += 1
      if (reservation.reservationStatus === RES_STATUS.CANCELLED) acc.cancelled += 1
      return acc
    },
    { total: reservations.length, active: 0, completed: 0, cancelled: 0 },
  )

export const isReservationStayOnDate = (reservation, date) => {
  const checkIn = parseISODateSafe(reservation.checkInDate)
  const checkOut = parseISODateSafe(reservation.checkOutDate)
  if (!checkIn || !checkOut || checkOut <= checkIn) return false

  return isWithinInterval(date, { start: checkIn, end: subDays(checkOut, 1) })
}

export const getMonthlyReservationIncome = (reservations, referenceDate = new Date()) => {
  const monthStart = startOfMonth(referenceDate)
  const monthEnd = endOfMonth(referenceDate)

  return reservations.reduce((total, reservation) => {
    if (!isRevenueEligibleReservation(reservation)) return total

    const checkInDate = parseISODateSafe(reservation.checkInDate)
    if (!checkInDate || !isWithinInterval(checkInDate, { start: monthStart, end: monthEnd })) return total

    return total + (Number(reservation.totalPrice) || 0)
  }, 0)
}

export const getAllTimeReservationIncome = (reservations) =>
  reservations.reduce((total, reservation) => {
    if (!isRevenueEligibleReservation(reservation)) return total
    return total + (Number(reservation.totalPrice) || 0)
  }, 0)

export const getTopUsedRooms = (reservations, limit = 6) => {
  const usageMap = new Map()

  reservations.forEach((reservation) => {
    if (isCancelledReservation(reservation) || !reservation.roomName) return
    usageMap.set(reservation.roomName, (usageMap.get(reservation.roomName) ?? 0) + 1)
  })

  return [...usageMap.entries()]
    .map(([roomName, count]) => ({ roomName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export const getMonthlyReservationIncomeSeries = (reservations, months = 6, referenceDate = new Date()) => {
  const pivotMonth = startOfMonth(referenceDate)

  return Array.from({ length: months }).map((_, index) => {
    const monthDate = addMonths(pivotMonth, index - (months - 1))
    const monthStart = startOfMonth(monthDate)
    const monthEnd = endOfMonth(monthDate)

    const reservationIncome = reservations.reduce((sum, reservation) => {
      if (isCancelledReservation(reservation)) return sum

      const checkInDate = parseISODateSafe(reservation.checkInDate)
      if (!checkInDate || !isWithinInterval(checkInDate, { start: monthStart, end: monthEnd })) return sum
      return sum + (Number(reservation.totalPrice) || 0)
    }, 0)

    return {
      monthDate,
      reservationIncome,
    }
  })
}

export const getDashboardReservationMetrics = (reservations, referenceDate = new Date()) => {
  const today = startOfDay(referenceDate)
  const activeReservations = reservations.filter((reservation) => reservation.reservationStatus === RES_STATUS.ACTIVE)

  const todaysOccupancyCount = activeReservations.filter((reservation) => isReservationStayOnDate(reservation, today)).length
  const todaysCheckIns = activeReservations.filter((reservation) => {
    const checkInDate = parseISODateSafe(reservation.checkInDate)
    return checkInDate ? isSameDay(checkInDate, today) : false
  })
  const todaysCheckOuts = activeReservations.filter((reservation) => {
    const checkOutDate = parseISODateSafe(reservation.checkOutDate)
    return checkOutDate ? isSameDay(checkOutDate, today) : false
  })
  const upcomingReservations = activeReservations
    .filter((reservation) => {
      const checkInDate = parseISODateSafe(reservation.checkInDate)
      return checkInDate ? isAfter(checkInDate, today) : false
    })
    .sort((a, b) => a.checkInDate.localeCompare(b.checkInDate))
    .slice(0, 5)

  const monthlyReservationIncome = getMonthlyReservationIncome(reservations, today)
  const statusCounts = getReservationStatusCounts(reservations)

  return {
    todaysOccupancyCount,
    todaysCheckIns,
    todaysCheckOuts,
    upcomingReservations,
    monthlyReservationIncome,
    activeCount: statusCounts.active,
    cancelledCount: statusCounts.cancelled,
  }
}
