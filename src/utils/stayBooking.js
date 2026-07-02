/**
 * Konaklama aralığı rezervasyon kararı — takvim gece doluluk sayımı ile form aynı kaynak.
 * Kural: gece doluluğu = o gece konaklayanlar (giriş dahil, çıkış hariç, devir hariç).
 * Oda taşıması yok: misafir seçilen aralığın tamamında aynı odada kalmalı.
 */
import { isRoomBookable, isVipRoom, STANDARD_ROOM_COUNT, ACTIVE_ROOM_COUNT } from '../config/rooms'
import { parseISODateSafe } from './formatters'
import {
  getFullyBookedStandardNightsInRange,
  getOccupiedRoomsOnDate,
  getRoomAvailabilityList,
  getStandardOccupiedRoomsOnDate,
  listStayNightIsos,
  scopeReservationsForAvailability,
} from './roomAvailability'

export { scopeReservationsForAvailability } from './roomAvailability'

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
    if (!nightDate) {
      return {
        nightIso,
        standardOccupied: 0,
        allOccupied: 0,
        standardEmpty: STANDARD_ROOM_COUNT,
        allEmpty: ACTIVE_ROOM_COUNT,
        isStandardFullyBooked: false,
        isFullyBooked: false,
      }
    }

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
 * Oda taşıması yok — yalnızca aralığın tamamında boş kalan odalar sayılır.
 */
export const evaluateStayBooking = (
  reservations,
  {
    checkInDate,
    checkOutDate,
    excludeId,
    roomNames,
    isEditingVipReservation = false,
    referenceDate = new Date(),
  },
) => {
  try {
    return evaluateStayBookingUnsafe(reservations, {
      checkInDate,
      checkOutDate,
      excludeId,
      roomNames,
      isEditingVipReservation,
      referenceDate,
    })
  } catch (error) {
    console.error('evaluateStayBooking failed:', error)
    const bookableNames = (roomNames ?? []).filter((roomName) => isRoomBookable(roomName))
    return {
      nightOccupancy: [],
      fullyBookedNights: [],
      hasFullyBookedNight: false,
      hasStandardCapacityEachNight: false,
      noContinuousStandardRoom: false,
      roomAvailability: bookableNames.map((roomName) => ({
        roomName,
        available: false,
        conflict: null,
      })),
      directStandardRooms: [],
      vipAvailable: false,
      canBookStandard: false,
      canBookVip: false,
      standardBlockedOnly: false,
      allRoomsFull: false,
    }
  }
}

const evaluateStayBookingUnsafe = (
  reservations,
  {
    checkInDate,
    checkOutDate,
    excludeId,
    roomNames,
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

  const roomAvailability = getRoomAvailabilityList(
    scoped,
    { checkInDate, checkOutDate, excludeId, roomNames: bookableNames },
    referenceDate,
  )

  const directStandardRooms = roomAvailability.filter(
    (room) => room.available && isRoomBookable(room.roomName) && !isVipRoom(room.roomName),
  )
  const vipAvailable = roomAvailability.some(
    (room) => isVipRoom(room.roomName) && room.available,
  )

  const canBookStandard = !hasFullyBookedNight && directStandardRooms.length > 0

  const canBookVip = vipAvailable

  const standardBlockedOnly = !hasFullyBookedNight && !canBookStandard && vipAvailable

  /** Takvimde her gecede en az bir standart boş oda görünüyor mu? */
  const hasStandardCapacityEachNight =
    nightOccupancy.length > 0 && nightOccupancy.every((night) => night.standardEmpty > 0)

  /**
   * Her gecede boş standart oda var ama hiçbir standart oda tüm aralıkta boş değil.
   * Takvim tek gece gösterir; form tüm aralıkta aynı oda ister.
   */
  const noContinuousStandardRoom =
    !hasFullyBookedNight && !canBookStandard && !vipAvailable && hasStandardCapacityEachNight

  const allRoomsFull = isEditingVipReservation ? !vipAvailable : !canBookStandard && !canBookVip

  return {
    nightOccupancy,
    fullyBookedNights,
    hasFullyBookedNight,
    hasStandardCapacityEachNight,
    noContinuousStandardRoom,
    roomAvailability,
    directStandardRooms,
    vipAvailable,
    canBookStandard,
    canBookVip,
    standardBlockedOnly,
    allRoomsFull,
  }
}
