import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  subDays,
} from 'date-fns'
import {
  getHotelDateTime,
  getHotelTodayIso,
  HOTEL_CHECK_IN_TIME,
  HOTEL_CHECK_OUT_TIME,
  isOnOrAfterCheckInTime,
  isOnOrAfterCheckOutTime,
} from '../config/hotelTime'
import { ACTIVE_ROOM_COUNT, canonicalRoomName, normalizeRoomName } from '../config/rooms'
import { getSeasonBoundsForYear } from '../config/season'
import { parseISODateSafe, normalizeFirestoreDate } from './formatters'

export const RES_STATUS = {
  ACTIVE: 'Aktif',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
}

/** Render / hesaplama öncesi bozuk kayıtları ayıklar */
export const sanitizeReservations = (reservations = []) =>
  reservations.filter((reservation) => reservation && typeof reservation === 'object' && reservation.id)

const RES_STATUS_ALIASES = {
  aktif: RES_STATUS.ACTIVE,
  active: RES_STATUS.ACTIVE,
  tamamlandı: RES_STATUS.COMPLETED,
  tamamlandi: RES_STATUS.COMPLETED,
  completed: RES_STATUS.COMPLETED,
  complete: RES_STATUS.COMPLETED,
  iptal: RES_STATUS.CANCELLED,
  cancelled: RES_STATUS.CANCELLED,
  canceled: RES_STATUS.CANCELLED,
}

/** Firestore / eski kayıtlardaki farklı yazımları tek forma getirir */
export const normalizeReservationStatus = (value) => {
  const raw = (value ?? '').toString().trim()
  if (!raw) return RES_STATUS.ACTIVE
  if (Object.values(RES_STATUS).includes(raw)) return raw
  const key = raw.toLocaleLowerCase('tr-TR')
  return RES_STATUS_ALIASES[key] ?? RES_STATUS.ACTIVE
}

export const getStoredReservationStatus = (reservation) =>
  normalizeReservationStatus(reservation?.reservationStatus)

/** Manuel «Tamamlandı» — yalnızca kayıtta hâlâ Aktif olanlar */
export const canMarkReservationComplete = (reservation) =>
  getStoredReservationStatus(reservation) === RES_STATUS.ACTIVE

/**
 * Çıkış tamamlandı mı? (İstanbul)
 * — Çıkış gününden sonraki günler: evet
 * — Çıkış günü 11:30 ve sonrası: evet
 */
export const isReservationCheckoutEnded = (reservation, referenceDate = new Date()) => {
  const checkOutDate = parseISODateSafe(reservation.checkOutDate)
  if (!checkOutDate) return false

  const checkoutIso = format(startOfDay(checkOutDate), 'yyyy-MM-dd')
  const hotel = getHotelDateTime(referenceDate)

  if (hotel.dateIso > checkoutIso) return true
  if (hotel.dateIso < checkoutIso) return false
  return isOnOrAfterCheckOutTime(hotel)
}

/**
 * Giriş başladı mı? (İstanbul)
 * — Giriş gününden önceki günler: hayır
 * — Giriş günü 14:00 ve sonrası: evet
 */
export const isReservationCheckInStarted = (reservation, referenceDate = new Date()) => {
  const checkInDate = parseISODateSafe(reservation.checkInDate)
  if (!checkInDate) return false

  const checkInIso = format(startOfDay(checkInDate), 'yyyy-MM-dd')
  const hotel = getHotelDateTime(referenceDate)

  if (hotel.dateIso > checkInIso) return true
  if (hotel.dateIso < checkInIso) return false
  return isOnOrAfterCheckInTime(hotel)
}

export const shouldAutoCompleteReservation = (reservation, referenceDate = new Date()) =>
  getStoredReservationStatus(reservation) === RES_STATUS.ACTIVE &&
  isReservationCheckoutEnded(reservation, referenceDate)

/** Firestore güncellemesi için alanlar */
export const toReservationUpdateData = (reservation) => ({
  customerName: reservation.customerName,
  customerPhone: reservation.customerPhone,
  roomName: reservation.roomName,
  checkInDate: reservation.checkInDate,
  checkOutDate: reservation.checkOutDate,
  totalPrice: reservation.totalPrice,
  deposit: reservation.deposit,
  paymentStatus: reservation.paymentStatus,
  reservationStatus: reservation.reservationStatus,
  note: reservation.note,
  createdBy: reservation.createdBy ?? '',
})

export const PAYMENT_STATUS = {
  UNPAID: 'Ödenmedi',
  DEPOSIT: 'Kapora Alındı',
  PAID: 'Tamamı Ödendi',
}

export const derivePaymentStatus = (totalPrice, deposit) => {
  const total = Number(totalPrice) || 0
  const paid = Number(deposit) || 0

  if (paid <= 0) return PAYMENT_STATUS.UNPAID
  if (total > 0 && paid >= total) return PAYMENT_STATUS.PAID
  return PAYMENT_STATUS.DEPOSIT
}

export const getOutstandingPayment = (reservation) => {
  if (reservation.paymentStatus === PAYMENT_STATUS.PAID) return 0

  const totalPrice = Number(reservation.totalPrice) || 0
  const deposit = Number(reservation.deposit) || 0
  return Math.max(totalPrice - deposit, 0)
}

export const isFullyPaidReservation = (reservation) => {
  if (reservation.paymentStatus === PAYMENT_STATUS.PAID) return true
  const totalPrice = Number(reservation.totalPrice) || 0
  const deposit = Number(reservation.deposit) || 0
  return totalPrice > 0 && deposit >= totalPrice
}

export const isCancelledReservation = (reservation) =>
  getStoredReservationStatus(reservation) === RES_STATUS.CANCELLED

/** Yeni rezervasyon / tarih değişikliğinde odayı bloklayan aktif konaklamalar (çıkış 11:30 sonrası bloklamaz). */
export const blocksRoomAvailability = (reservation, referenceDate = new Date()) => {
  if (getStoredReservationStatus(reservation) !== RES_STATUS.ACTIVE) return false
  return !isReservationCheckoutEnded(reservation, referenceDate)
}

const normalizeReservationDate = (value) => normalizeFirestoreDate(value)

/**
 * Tarih aralığı çakışması — aynı gün devir (çıkış = giriş) izinli.
 * Örn. A çıkış 18 Haz, B giriş 18 Haz → çakışma yok (11:30 / 14:00 arası temizlik).
 */
export const hasReservationDateConflict = (incoming, existing) => {
  const inCheckIn = normalizeReservationDate(incoming.checkInDate)
  const inCheckOut = normalizeReservationDate(incoming.checkOutDate)
  const exCheckIn = normalizeReservationDate(existing.checkInDate)
  const exCheckOut = normalizeReservationDate(existing.checkOutDate)

  if (!inCheckIn || !inCheckOut || !exCheckIn || !exCheckOut) return false

  return inCheckIn < exCheckOut && inCheckOut > exCheckIn
}

export const findConflictingReservation = (
  reservations,
  { roomName, checkInDate, checkOutDate, excludeId },
) => {
  const trimmedRoom = roomName?.trim()
  if (!trimmedRoom || !checkInDate || !checkOutDate || checkOutDate <= checkInDate) return null

  const incoming = { checkInDate, checkOutDate }

  return (
    reservations.find((reservation) => {
      if (!reservation?.id) return false
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
  const storedStatus = getStoredReservationStatus(reservation)
  if (storedStatus === RES_STATUS.CANCELLED) return RES_STATUS.CANCELLED

  if (
    storedStatus === RES_STATUS.ACTIVE &&
    isReservationCheckoutEnded(reservation, referenceDate)
  ) {
    return RES_STATUS.COMPLETED
  }

  return storedStatus
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

  const day = startOfDay(date)
  return isWithinInterval(day, { start: startOfDay(checkIn), end: startOfDay(subDays(checkOut, 1)) })
}

const isReservationScheduledOnDay = (reservation, day) => {
  const checkIn = parseISODateSafe(reservation.checkInDate)
  const checkOut = parseISODateSafe(reservation.checkOutDate)
  if (!checkIn || !checkOut) return false

  return (
    isSameDay(checkIn, day) ||
    isSameDay(checkOut, day) ||
    isReservationStayOnDate(reservation, day)
  )
}

/**
 * Takvim doluluk rengi — rezervasyon formu ile aynı çakışma kuralı.
 * «Bu güne giriş yapılsa (1 gece)» oda dolu mu? (çıkış günü devir hariç)
 */
export const isReservationCountedForOccupancyOnDate = (reservation, date, now = new Date()) => {
  if (isCancelledReservation(reservation)) return false
  if (!blocksRoomAvailability(reservation, now)) return false

  const day = startOfDay(date)
  const dayIso = format(day, 'yyyy-MM-dd')
  const nextDayIso = format(addDays(day, 1), 'yyyy-MM-dd')

  return hasReservationDateConflict(
    { checkInDate: dayIso, checkOutDate: nextDayIso },
    reservation,
  )
}

/** Seçili günde dolu oda sayısı (takvim rengi ile rezervasyon formu uyumlu) */
export const getOccupiedRoomsOnDate = (reservations, date, now = new Date()) => {
  const occupied = new Set()

  reservations.forEach((reservation) => {
    if (!reservation?.id) return
    if (!isReservationCountedForOccupancyOnDate(reservation, date, now)) return
    const room = canonicalRoomName(reservation.roomName)
    if (room) occupied.add(room)
  })

  return occupied.size
}

/** Seçilen konaklama aralığında tüm evlerin dolu olduğu geceler (giriş dahil, çıkış hariç) */
export const getFullyBookedNightsInRange = (
  reservations,
  checkInDate,
  checkOutDate,
  { excludeId, now = new Date() } = {},
) => {
  const checkIn = parseISODateSafe(checkInDate)
  const checkOut = parseISODateSafe(checkOutDate)
  if (!checkIn || !checkOut || checkOut <= checkIn) return []

  const scopedReservations = excludeId
    ? reservations.filter((reservation) => reservation.id !== excludeId)
    : reservations

  const fullNights = []
  let night = startOfDay(checkIn)

  while (isBefore(night, checkOut)) {
    if (getOccupiedRoomsOnDate(scopedReservations, night, now) >= ACTIVE_ROOM_COUNT) {
      fullNights.push(format(night, 'yyyy-MM-dd'))
    }
    night = addDays(night, 1)
  }

  return fullNights
}

/** Aktif rezervasyonlarda geçmiş giriş tarihini engeller (devam eden konaklama hariç) */
export const validateActiveReservationDates = (
  { checkInDate, checkOutDate, reservationStatus, originalCheckInDate },
  referenceDate = new Date(),
) => {
  const checkIn = normalizeFirestoreDate(checkInDate)
  const checkOut = normalizeFirestoreDate(checkOutDate)

  if (!checkIn || !checkOut) {
    return { valid: false, message: 'Giriş ve çıkış tarihi zorunludur.' }
  }

  if (checkOut <= checkIn) {
    return { valid: false, message: 'Çıkış tarihi giriş tarihinden sonra olmalıdır.' }
  }

  if (normalizeReservationStatus(reservationStatus) !== RES_STATUS.ACTIVE) {
    return { valid: true }
  }

  const todayIso = getHotelTodayIso(referenceDate)
  const originalCheckIn = normalizeFirestoreDate(originalCheckInDate)
  const unchangedPastStay =
    originalCheckIn && checkIn === originalCheckIn && checkIn < todayIso
  const ongoingStayCheckInAdjust =
    originalCheckIn &&
    originalCheckIn < todayIso &&
    checkIn >= originalCheckIn &&
    checkIn <= todayIso &&
    normalizeReservationStatus(reservationStatus) === RES_STATUS.ACTIVE

  if (checkIn < todayIso && !unchangedPastStay && !ongoingStayCheckInAdjust) {
    return {
      valid: false,
      message: 'Geçmiş tarihe rezervasyon yapılamaz. Giriş bugün veya sonrası olmalıdır.',
    }
  }

  return { valid: true }
}

export const getReservationNightCount = (reservation) => {
  const checkIn = parseISODateSafe(reservation.checkInDate)
  const checkOut = parseISODateSafe(reservation.checkOutDate)
  if (!checkIn || !checkOut) return null

  const nights = differenceInCalendarDays(checkOut, checkIn)
  return nights > 0 ? nights : null
}

export const hasValidReservationDates = (reservation) =>
  getReservationNightCount(reservation) !== null

/** Seçilen günden itibaren kalan konaklama (takvim detayı) */
export const getRemainingStayLabel = (reservation, referenceDate = new Date()) => {
  const checkIn = parseISODateSafe(reservation.checkInDate)
  const checkOut = parseISODateSafe(reservation.checkOutDate)
  if (!checkIn || !checkOut) return null

  const day = startOfDay(referenceDate)
  const now = new Date()
  const totalNights = differenceInCalendarDays(checkOut, checkIn)
  if (totalNights <= 0) return null

  if (isSameDay(checkOut, day)) {
    if (isSameDay(day, startOfDay(now)) && !isReservationCheckoutEnded(reservation, now)) {
      return `Bugün çıkış · ${HOTEL_CHECK_OUT_TIME}'a kadar`
    }
    return 'Bugün çıkış'
  }
  if (checkIn && isSameDay(checkIn, day)) {
    if (isSameDay(day, startOfDay(now)) && !isReservationCheckInStarted(reservation, now)) {
      return `${totalNights} gece · giriş ${HOTEL_CHECK_IN_TIME}`
    }
    return `${totalNights} gece kalacak`
  }

  const remaining = differenceInCalendarDays(checkOut, day)
  if (remaining <= 0) return 'Bugün çıkış'
  return `${remaining} gece daha kalacak`
}

/** Seçilen gün için giriş, çıkış ve konaklama listeleri (Dashboard ile aynı mantık). */
export const getCalendarDayReservations = (reservations, referenceDate = new Date()) => {
  const day = startOfDay(referenceDate)
  const now = new Date()
  const timeReference = isSameDay(day, startOfDay(now)) ? now : referenceDate

  const mappedReservations = reservations.map((reservation) =>
    withEffectiveReservationStatus(reservation, timeReference),
  )

  const visibleReservations = mappedReservations.filter(
    (reservation) => getStoredReservationStatus(reservation) !== RES_STATUS.CANCELLED,
  )

  const checkIns = visibleReservations.filter((reservation) => {
    const checkInDate = parseISODateSafe(reservation.checkInDate)
    return checkInDate ? isSameDay(checkInDate, day) : false
  })

  const checkOuts = visibleReservations.filter((reservation) => {
    const checkOutDate = parseISODateSafe(reservation.checkOutDate)
    return checkOutDate ? isSameDay(checkOutDate, day) : false
  })

  const stays = visibleReservations.filter((reservation) =>
    isReservationCountedForOccupancyOnDate(reservation, day, timeReference),
  )

  const stayingOnly = stays.filter((reservation) => {
    const checkInDate = parseISODateSafe(reservation.checkInDate)
    const checkOutDate = parseISODateSafe(reservation.checkOutDate)
    const isCheckInDay = checkInDate ? isSameDay(checkInDate, day) : false
    const isCheckOutDay = checkOutDate ? isSameDay(checkOutDate, day) : false
    return !isCheckInDay && !isCheckOutDay
  })

  const allForDay = [...stays]
  const seen = new Set(stays.map((reservation) => reservation.id))
  ;[...checkIns, ...checkOuts].forEach((reservation) => {
    if (seen.has(reservation.id)) return
    if (!isReservationScheduledOnDay(reservation, day)) return
    seen.add(reservation.id)
    allForDay.push(reservation)
  })

  return { checkIns, checkOuts, stayingOnly, stays, allForDay }
}

export const matchesReservationNameSearch = (reservation, query) => {
  const term = query.trim().toLocaleLowerCase('tr')
  if (!term) return false
  const name = (reservation.customerName || '').toLocaleLowerCase('tr')
  return name.includes(term)
}

export const filterReservationsByName = (reservations, query) => {
  if (!query.trim()) return []
  return reservations.filter((reservation) => matchesReservationNameSearch(reservation, query))
}

/** Takvim gün listesinde gösterilecek etiketler: Giriş, Çıkış, Konaklıyor */
export const getReservationDayTags = (reservation, referenceDate = new Date()) => {
  const day = startOfDay(referenceDate)
  const tags = []
  const checkInDate = parseISODateSafe(reservation.checkInDate)
  const checkOutDate = parseISODateSafe(reservation.checkOutDate)

  if (checkInDate && isSameDay(checkInDate, day)) tags.push('Giriş')
  if (checkOutDate && isSameDay(checkOutDate, day)) tags.push('Çıkış')
  if (tags.length === 0 && isReservationStayOnDate(reservation, day)) tags.push('Konaklıyor')

  return tags
}

/** Takvim satırında ödeme metinleri */
export const getCalendarPaymentDisplay = (reservation) => {
  if (isFullyPaidReservation(reservation)) {
    return { primary: 'Tamamı ödendi', primaryTone: 'paid', showUnpaid: false }
  }

  const hasDeposit =
    reservation.paymentStatus === PAYMENT_STATUS.DEPOSIT || (Number(reservation.deposit) || 0) > 0

  return {
    primary: hasDeposit ? 'Kapora alındı' : null,
    primaryTone: 'deposit',
    showUnpaid: true,
  }
}

/** Sezon boyunca girişi olan tüm rezervasyonlar (gelecek dahil) — yıllık gelir hedefi için */
export const getSeasonLodgingIncome = (
  reservations,
  referenceDate = new Date(),
  { roomId } = {},
) => {
  const year = startOfDay(referenceDate).getFullYear()
  const { start, end } = getSeasonBoundsForYear(year)

  return reservations.reduce((total, reservation) => {
    if (!isRevenueEligibleReservation(reservation)) return total
    if (roomId && canonicalRoomName(reservation.roomName) !== roomId) return total

    const checkIn = parseISODateSafe(reservation.checkInDate)
    if (!checkIn || checkIn < start || checkIn > end) return total

    return total + (Number(reservation.totalPrice) || 0)
  }, 0)
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

  const {
    checkIns: todaysCheckIns,
    checkOuts: todaysCheckOuts,
    stayingOnly: todaysCurrentlyStaying,
    stays,
  } = getCalendarDayReservations(reservations, referenceDate)
  const todaysOccupancyCount = stays.length
  const upcomingReservations = activeReservations
    .filter((reservation) => {
      const checkInDate = parseISODateSafe(reservation.checkInDate)
      return checkInDate ? isAfter(checkInDate, today) : false
    })
    .sort((a, b) => (a.checkInDate || '').localeCompare(b.checkInDate || ''))
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
    return isFullyPaidReservation(reservation)
  }).length

  return {
    todaysOccupancyCount,
    todaysCheckIns,
    todaysCheckOuts,
    todaysCurrentlyStaying,
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

    if (isCancelledReservation(reservation)) {
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
