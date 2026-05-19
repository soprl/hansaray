import {
  addMonths,
  endOfMonth,
  isBefore,
  isAfter,
  isSameDay,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  subDays,
} from 'date-fns'
import { normalizeRoomName } from '../config/rooms'
import { parseISODateSafe } from './formatters'

export const RES_STATUS = {
  ACTIVE: 'Aktif',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
}

export const PAYMENT_STATUS = {
  UNPAID: 'Ödenmedi',
  DEPOSIT: 'Kapora Alındı',
  PAID: 'Tamamı Ödendi',
}

export const getOutstandingPayment = (reservation) => {
  if (reservation.paymentStatus === PAYMENT_STATUS.PAID) return 0

  const remaining = Number(reservation.remainingPayment)
  if (Number.isFinite(remaining) && remaining >= 0) return remaining

  const totalPrice = Number(reservation.totalPrice) || 0
  const deposit = Number(reservation.deposit) || 0
  return Math.max(totalPrice - deposit, 0)
}

export const isFullyPaidReservation = (reservation) => getOutstandingPayment(reservation) <= 0

export const isCancelledReservation = (reservation) => reservation.reservationStatus === RES_STATUS.CANCELLED

export const blocksRoomAvailability = (reservation) => reservation.reservationStatus !== RES_STATUS.CANCELLED

export const hasReservationDateConflict = (incoming, existing) =>
  incoming.checkInDate < existing.checkOutDate && incoming.checkOutDate > existing.checkInDate

export const findConflictingReservation = (
  reservations,
  { roomName, checkInDate, checkOutDate, excludeId },
) => {
  const trimmedRoom = roomName?.trim()
  if (!trimmedRoom || !checkInDate || !checkOutDate || checkOutDate <= checkInDate) return null

  const incoming = { checkInDate, checkOutDate }

  return (
    reservations.find((reservation) => {
      if (excludeId && reservation.id === excludeId) return false
      if (!blocksRoomAvailability(reservation)) return false
      if (normalizeRoomName(reservation.roomName) !== normalizeRoomName(trimmedRoom)) return false
      return hasReservationDateConflict(incoming, reservation)
    }) ?? null
  )
}

export const getRoomAvailabilityList = (
  reservations,
  { checkInDate, checkOutDate, excludeId, roomNames },
) => {
  if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) return []

  return roomNames.map((roomName) => {
    const conflict = findConflictingReservation(reservations, {
      roomName,
      checkInDate,
      checkOutDate,
      excludeId,
    })

    return {
      roomName,
      available: !conflict,
      conflict,
    }
  })
}

export const getEffectiveReservationStatus = (reservation, referenceDate = new Date()) => {
  if (reservation.reservationStatus === RES_STATUS.CANCELLED) return RES_STATUS.CANCELLED

  const checkOutDate = parseISODateSafe(reservation.checkOutDate)
  const today = startOfDay(referenceDate)
  if (
    reservation.reservationStatus === RES_STATUS.ACTIVE &&
    checkOutDate &&
    isBefore(checkOutDate, today)
  ) {
    return RES_STATUS.COMPLETED
  }

  return reservation.reservationStatus
}

export const withEffectiveReservationStatus = (reservation, referenceDate = new Date()) => ({
  ...reservation,
  effectiveStatus: getEffectiveReservationStatus(reservation, referenceDate),
})

export const isRevenueEligibleReservation = (reservation) =>
  [RES_STATUS.ACTIVE, RES_STATUS.COMPLETED].includes(
    getEffectiveReservationStatus(reservation),
  )

export const getReservationStatusCounts = (reservations) =>
  reservations.reduce(
    (acc, reservation) => {
      const status = getEffectiveReservationStatus(reservation)
      if (status === RES_STATUS.ACTIVE) acc.active += 1
      if (status === RES_STATUS.COMPLETED) acc.completed += 1
      if (status === RES_STATUS.CANCELLED) acc.cancelled += 1
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
  const mappedReservations = reservations.map((reservation) =>
    withEffectiveReservationStatus(reservation, referenceDate),
  )
  const activeReservations = mappedReservations.filter(
    (reservation) => reservation.effectiveStatus === RES_STATUS.ACTIVE,
  )
  const nonCancelledReservations = mappedReservations.filter(
    (reservation) => reservation.effectiveStatus !== RES_STATUS.CANCELLED,
  )

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
    .slice(0, 10)

  const monthlyReservationIncome = getMonthlyReservationIncome(mappedReservations, today)
  const statusCounts = getReservationStatusCounts(mappedReservations)
  const totalPendingPayment = nonCancelledReservations.reduce(
    (sum, reservation) => sum + getOutstandingPayment(reservation),
    0,
  )
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)
  const monthlyDeposit = nonCancelledReservations.reduce((sum, reservation) => {
    const checkInDate = parseISODateSafe(reservation.checkInDate)
    if (!checkInDate || !isWithinInterval(checkInDate, { start: monthStart, end: monthEnd })) return sum
    if (reservation.paymentStatus !== PAYMENT_STATUS.DEPOSIT) return sum
    return sum + (Number(reservation.deposit) || 0)
  }, 0)
  const monthlyFullyPaidCount = nonCancelledReservations.filter((reservation) => {
    const checkInDate = parseISODateSafe(reservation.checkInDate)
    if (!checkInDate || !isWithinInterval(checkInDate, { start: monthStart, end: monthEnd })) return false
    return reservation.paymentStatus === PAYMENT_STATUS.PAID
  }).length

  return {
    todaysOccupancyCount,
    todaysCheckIns,
    todaysCheckOuts,
    upcomingReservations,
    monthlyReservationIncome,
    totalPendingPayment,
    monthlyDeposit,
    monthlyFullyPaidCount,
    activeCount: statusCounts.active,
    cancelledCount: statusCounts.cancelled,
  }
}

export const getMonthlyReservationBreakdown = (reservations, referenceDate = new Date()) => {
  const monthStart = startOfMonth(referenceDate)
  const monthEnd = endOfMonth(referenceDate)
  const today = startOfDay(new Date())

  const counts = {
    total: 0,
    completed: 0,
    ongoing: 0,
    upcoming: 0,
    cancelled: 0,
  }

  reservations.forEach((reservation) => {
    const checkInDate = parseISODateSafe(reservation.checkInDate)
    if (!checkInDate || !isWithinInterval(checkInDate, { start: monthStart, end: monthEnd })) return

    if (reservation.reservationStatus === RES_STATUS.CANCELLED) {
      counts.cancelled += 1
      return
    }

    counts.total += 1
    const effectiveStatus = getEffectiveReservationStatus(reservation, today)

    if (effectiveStatus === RES_STATUS.COMPLETED) {
      counts.completed += 1
      return
    }

    if (isAfter(startOfDay(checkInDate), today)) {
      counts.upcoming += 1
      return
    }

    counts.ongoing += 1
  })

  return counts
}

export const getPaymentStatusCounts = (reservations, referenceDate = new Date()) =>
  reservations.reduce(
    (acc, reservation) => {
      if (getEffectiveReservationStatus(reservation, referenceDate) === RES_STATUS.CANCELLED) return acc
      if (reservation.paymentStatus === PAYMENT_STATUS.UNPAID) acc.unpaid += 1
      if (reservation.paymentStatus === PAYMENT_STATUS.DEPOSIT) acc.deposit += 1
      if (reservation.paymentStatus === PAYMENT_STATUS.PAID) acc.paid += 1
      return acc
    },
    { unpaid: 0, deposit: 0, paid: 0 },
  )
