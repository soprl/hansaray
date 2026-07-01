/**
 * Konaklama aralığı rezervasyon kararı — takvim gece doluluk sayımı ile form aynı kaynak.
 * Kural: gece doluluğu = o gece konaklayanlar (giriş dahil, çıkış hariç, devir hariç).
 */
import { isRoomBookable, isVipRoom, STANDARD_ROOM_COUNT, ACTIVE_ROOM_COUNT } from '../config/rooms'
import { parseISODateSafe } from './formatters'
import { isCancelledReservation } from './reservationStatus'
import {
  applyBookingPlanToAvailability,
  getFullyBookedStandardNightsInRange,
  getOccupiedRoomsOnDate,
  getRoomAvailabilityList,
  getStandardOccupiedRoomsOnDate,
  listStayNightIsos,
} from './roomAvailability'

export const scopeReservationsForAvailability = (reservations = [], { excludeId } = {}) =>
  reservations.filter((reservation) => {
    if (!reservation?.id) return false
    if (excludeId && reservation.id === excludeId) return false
    if (isCancelledReservation(reservation)) return false
    return true
  })

/** Takvim kutucuğu ile aynı gece doluluk özeti */
export const getNightOccupancyBreakdown = (
  reservations,
  checkInDate,
  checkOutDate,
  { excludeId, referenceDate = new Date() } = {},
) => {
  const scoped = scopeReservationsForAvailability(reservations, { excludeId })

  return listStayNightIsos(checkInDate, checkOutDate).map((nightIso) => {
    const nightDate = parseISODateSafe(nightIso)
    const standardOccupied = getStandardOccupiedRoomsOnDate(scoped, nightDate, referenceDate)
    const allOccupied = getOccupiedRoomsOnDate(scoped, nightDate, referenceDate)

    return {
      nightIso,
      standardOccupied,
      allOccupied,
      standardEmpty: STANDARD_ROOM_COUNT - standardOccupied,
      allEmpty: ACTIVE_ROOM_COUNT - allOccupied,
      isStandardFullyBooked: standardOccupied >= STANDARD_ROOM_COUNT,
      isFullyBooked: allOccupied >= ACTIVE_ROOM_COUNT,
    }
  })
}

/**
 * Seçilen giriş–çıkış için rezervasyon yapılabilir mi?
 * Takvimde gece başına boş oda varken formun yanlışlıkla tam dolu dememesi için tek karar noktası.
 */
export const evaluateStayBooking = (
  reservations,
  {
    checkInDate,
    checkOutDate,
    excludeId,
    roomNames,
    bookingPlan = null,
    isEditingVipReservation = false,
    referenceDate = new Date(),
  },
) => {
  const scoped = scopeReservationsForAvailability(reservations, { excludeId })
  const bookableNames = (roomNames ?? []).filter((roomName) => isRoomBookable(roomName))

  const nightOccupancy = getNightOccupancyBreakdown(scoped, checkInDate, checkOutDate, {
    referenceDate,
  })

  const fullyBookedNights = getFullyBookedStandardNightsInRange(
    scoped,
    checkInDate,
    checkOutDate,
    { now: referenceDate },
  )
  const hasFullyBookedNight = fullyBookedNights.length > 0

  const baseAvailability = getRoomAvailabilityList(
    scoped,
    { checkInDate, checkOutDate, excludeId, roomNames: bookableNames },
    referenceDate,
  )

  const roomAvailability = applyBookingPlanToAvailability(baseAvailability, bookingPlan)

  const directStandardRooms = roomAvailability.filter(
    (room) => room.available && isRoomBookable(room.roomName) && !isVipRoom(room.roomName),
  )
  const vipAvailable = roomAvailability.some(
    (room) => isVipRoom(room.roomName) && room.available,
  )

  const canBookStandard =
    !hasFullyBookedNight &&
    (directStandardRooms.length > 0 ||
      Boolean(bookingPlan?.targetRoom && !isVipRoom(bookingPlan.targetRoom)))

  const canBookVip = isEditingVipReservation ? vipAvailable : vipAvailable

  const standardBlockedOnly = !hasFullyBookedNight && !canBookStandard && vipAvailable

  const allRoomsFull = isEditingVipReservation
    ? !vipAvailable
    : hasFullyBookedNight
      ? true
      : !canBookStandard && !vipAvailable

  return {
    nightOccupancy,
    fullyBookedNights,
    hasFullyBookedNight,
    bookingPlan,
    roomAvailability,
    directStandardRooms,
    vipAvailable,
    canBookStandard,
    canBookVip,
    standardBlockedOnly,
    allRoomsFull,
  }
}
