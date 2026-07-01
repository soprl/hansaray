/**
 * Oda müsaitliği — takvim ve rezervasyon formu için tek kaynak.
 * Kural: giriş 14:00, çıkış 11:30, aynı gün devir (çıkış günü = giriş günü) çakışma değil.
 */
import { addDays, format, isBefore, startOfDay } from 'date-fns'
import {
  ACTIVE_ROOM_COUNT,
  canonicalRoomName,
  isRoomBookable,
  isVipRoom,
  normalizeRoomName,
  STANDARD_ROOM_COUNT,
} from '../config/rooms'
import { normalizeFirestoreDate, parseISODateSafe } from './formatters'
import {
  blocksRoomAvailability,
} from './reservationStatus'

export const normalizeStayDates = (checkInDate, checkOutDate) => {
  const checkIn = normalizeFirestoreDate(checkInDate)
  const checkOut = normalizeFirestoreDate(checkOutDate)
  if (!checkIn || !checkOut || checkOut <= checkIn) return null
  return { checkInDate: checkIn, checkOutDate: checkOut }
}

/** Takvim + form: aynı gün devir ile çakışma kontrolü */
export const hasReservationDateConflict = (incoming, existing) => {
  const inCheckIn = normalizeFirestoreDate(incoming.checkInDate)
  const inCheckOut = normalizeFirestoreDate(incoming.checkOutDate)
  const exCheckIn = normalizeFirestoreDate(existing.checkInDate)
  const exCheckOut = normalizeFirestoreDate(existing.checkOutDate)

  if (!inCheckIn || !inCheckOut || !exCheckIn || !exCheckOut) return false

  return inCheckIn < exCheckOut && inCheckOut > exCheckIn
}

export const isSameDayTurnover = (checkoutDate, checkInDate) =>
  normalizeFirestoreDate(checkoutDate) === normalizeFirestoreDate(checkInDate) &&
  Boolean(normalizeFirestoreDate(checkoutDate))

/** Rezervasyon yeni konaklamayı engeller mi? (iptal / tamamlandı / çıkış geçmiş hariç) */
export const isReservationBlockingAvailability = (reservation, referenceDate = new Date()) =>
  blocksRoomAvailability(reservation, referenceDate)

/** Konaklama geceleri (giriş dahil, çıkış hariç) */
export const listStayNightIsos = (checkInDate, checkOutDate) => {
  const stay = normalizeStayDates(checkInDate, checkOutDate)
  if (!stay) return []

  const nights = []
  let night = parseISODateSafe(stay.checkInDate)
  const checkOut = parseISODateSafe(stay.checkOutDate)
  if (!night || !checkOut) return []

  while (isBefore(night, checkOut)) {
    nights.push(format(night, 'yyyy-MM-dd'))
    night = addDays(night, 1)
  }
  return nights
}

/** Takvim: bu gece oda dolu mu? (1 gece konaklama varsayımı) */
export const isReservationOccupyingNight = (reservation, date, referenceDate = new Date()) => {
  if (!isReservationBlockingAvailability(reservation, referenceDate)) return false

  const day = startOfDay(date)
  const dayIso = format(day, 'yyyy-MM-dd')
  const nextDayIso = format(addDays(day, 1), 'yyyy-MM-dd')

  return hasReservationDateConflict(
    { checkInDate: dayIso, checkOutDate: nextDayIso },
    reservation,
  )
}

export const getOccupiedRoomsOnDate = (reservations, date, referenceDate = new Date()) => {
  const occupied = new Set()
  reservations.forEach((reservation) => {
    if (!isReservationOccupyingNight(reservation, date, referenceDate)) return
    const room = canonicalRoomName(reservation.roomName)
    if (room) occupied.add(room)
  })
  return occupied.size
}

export const getStandardOccupiedRoomsOnDate = (reservations, date, referenceDate = new Date()) => {
  const occupied = new Set()
  reservations.forEach((reservation) => {
    if (!isReservationOccupyingNight(reservation, date, referenceDate)) return
    const room = canonicalRoomName(reservation.roomName)
    if (!room || isVipRoom(room)) return
    occupied.add(room)
  })
  return occupied.size
}

export const getFullyBookedNightsInRange = (
  reservations,
  checkInDate,
  checkOutDate,
  { excludeId, now = new Date(), standardOnly = false } = {},
) => {
  const stay = normalizeStayDates(checkInDate, checkOutDate)
  if (!stay) return []

  const scoped = excludeId
    ? reservations.filter((reservation) => reservation.id !== excludeId)
    : reservations

  const roomLimit = standardOnly ? STANDARD_ROOM_COUNT : ACTIVE_ROOM_COUNT
  const countOccupied = standardOnly ? getStandardOccupiedRoomsOnDate : getOccupiedRoomsOnDate

  return listStayNightIsos(stay.checkInDate, stay.checkOutDate).filter(
    (nightIso) => countOccupied(scoped, parseISODateSafe(nightIso), now) >= roomLimit,
  )
}

export const getFullyBookedStandardNightsInRange = (reservations, checkInDate, checkOutDate, options = {}) =>
  getFullyBookedNightsInRange(reservations, checkInDate, checkOutDate, { ...options, standardOnly: true })

export const getConflictingNightsInRange = (incoming, existing) => {
  const stay = normalizeStayDates(incoming.checkInDate, incoming.checkOutDate)
  if (!stay) return []

  return listStayNightIsos(stay.checkInDate, stay.checkOutDate).filter((nightIso) => {
    const nextDayIso = format(addDays(parseISODateSafe(nightIso), 1), 'yyyy-MM-dd')
    return hasReservationDateConflict(
      { checkInDate: nightIso, checkOutDate: nextDayIso },
      existing,
    )
  })
}

export const findConflictingReservation = (
  reservations,
  { roomName, checkInDate, checkOutDate, excludeId },
  referenceDate = new Date(),
) => {
  const stay = normalizeStayDates(checkInDate, checkOutDate)
  const trimmedRoom = roomName?.trim()
  if (!stay || !trimmedRoom) return null

  return (
    reservations.find((reservation) => {
      if (!reservation?.id) return false
      if (excludeId && reservation.id === excludeId) return false
      if (!isReservationBlockingAvailability(reservation, referenceDate)) return false
      if (normalizeRoomName(reservation.roomName) !== normalizeRoomName(trimmedRoom)) return false
      return hasReservationDateConflict(stay, reservation)
    }) ?? null
  )
}

const findTurnoverCheckoutGuest = (
  reservations,
  { roomName, checkInDate, checkOutDate, excludeId },
  referenceDate,
) => {
  const stay = normalizeStayDates(checkInDate, checkOutDate)
  if (!stay) return null

  return (
    reservations.find((reservation) => {
      if (!reservation?.id) return false
      if (excludeId && reservation.id === excludeId) return false
      if (!isReservationBlockingAvailability(reservation, referenceDate)) return false
      if (normalizeRoomName(reservation.roomName) !== normalizeRoomName(roomName)) return false
      if (!isSameDayTurnover(reservation.checkOutDate, stay.checkInDate)) return false
      return !hasReservationDateConflict(stay, reservation)
    }) ?? null
  )
}

const findIncomingOnCheckoutDayGuest = (
  reservations,
  { roomName, checkInDate, checkOutDate, excludeId },
  referenceDate,
) => {
  const stay = normalizeStayDates(checkInDate, checkOutDate)
  if (!stay) return null

  return (
    reservations.find((reservation) => {
      if (!reservation?.id) return false
      if (excludeId && reservation.id === excludeId) return false
      if (!isReservationBlockingAvailability(reservation, referenceDate)) return false
      if (normalizeRoomName(reservation.roomName) !== normalizeRoomName(roomName)) return false
      if (!isSameDayTurnover(stay.checkOutDate, reservation.checkInDate)) return false
      return !hasReservationDateConflict(stay, reservation)
    }) ?? null
  )
}

export const getRoomAvailabilityList = (
  reservations,
  { checkInDate, checkOutDate, excludeId, roomNames },
  referenceDate = new Date(),
) => {
  const stay = normalizeStayDates(checkInDate, checkOutDate)
  if (!stay) return []

  return (roomNames ?? []).map((roomName) => {
    const conflict = findConflictingReservation(
      reservations,
      { roomName, ...stay, excludeId },
      referenceDate,
    )

    const turnoverCheckout = conflict
      ? null
      : findTurnoverCheckoutGuest(reservations, { roomName, ...stay, excludeId }, referenceDate)

    const incomingOnCheckoutDay = conflict
      ? null
      : findIncomingOnCheckoutDayGuest(reservations, { roomName, ...stay, excludeId }, referenceDate)

    return {
      roomName,
      available: !conflict,
      conflict,
      turnoverCheckout,
      incomingOnCheckoutDay,
    }
  })
}

export const applyBookingPlanToAvailability = (availability = [], bookingPlan) => {
  if (!bookingPlan?.targetRoom) return availability

  const targetRoom = normalizeRoomName(bookingPlan.targetRoom)

  return availability.map((room) => {
    if (normalizeRoomName(room.roomName) !== targetRoom) return room
    return {
      ...room,
      available: true,
      conflict: null,
      viaShuffle: Boolean(bookingPlan.shuffled),
    }
  })
}

/** Form özeti — takvim ile uyumlu */
export const getStayAvailabilitySummary = (
  reservations,
  { checkInDate, checkOutDate, excludeId, roomNames },
  referenceDate = new Date(),
) => {
  const stay = normalizeStayDates(checkInDate, checkOutDate)
  if (!stay) {
    return {
      stayNights: [],
      fullyBookedNights: [],
      rooms: [],
      availableStandardCount: 0,
      availableVip: false,
      canBookStandard: false,
    }
  }

  const fullyBookedNights = getFullyBookedStandardNightsInRange(
    reservations,
    stay.checkInDate,
    stay.checkOutDate,
    { excludeId, now: referenceDate },
  )

  const rooms = getRoomAvailabilityList(
    reservations,
    { ...stay, excludeId, roomNames },
    referenceDate,
  )

  const standardRooms = rooms.filter((room) => isRoomBookable(room.roomName) && !isVipRoom(room.roomName))
  const availableStandard = standardRooms.filter((room) => room.available)
  const availableVip = rooms.some((room) => isVipRoom(room.roomName) && room.available)

  return {
    stayNights: listStayNightIsos(stay.checkInDate, stay.checkOutDate),
    fullyBookedNights,
    rooms,
    availableStandardCount: availableStandard.length,
    availableVip,
    canBookStandard: fullyBookedNights.length === 0 && availableStandard.length > 0,
  }
}
