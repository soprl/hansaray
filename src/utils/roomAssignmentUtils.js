import { differenceInCalendarDays, parseISO } from 'date-fns'
import {
  ACTIVE_ROOMS,
  isRoomBookable,
  isVipRoom,
  normalizeRoomName,
  pickFirstAvailableStandardRoom,
} from '../config/rooms'
import {
  blocksRoomAvailability,
  getFullyBookedNightsInRange,
  getRoomAvailabilityList,
  hasReservationDateConflict,
  isCancelledReservation,
} from './reservationUtils'

const reservationsOverlap = (a, b) =>
  hasReservationDateConflict(
    { checkInDate: a.checkInDate, checkOutDate: a.checkOutDate },
    { checkInDate: b.checkInDate, checkOutDate: b.checkOutDate },
  )

const incomingOverlaps = (checkInDate, checkOutDate, reservation) =>
  hasReservationDateConflict(
    { checkInDate, checkOutDate },
    { checkInDate: reservation.checkInDate, checkOutDate: reservation.checkOutDate },
  )

const getMovableReservations = (reservations, excludeId, referenceDate = new Date()) =>
  reservations.filter((reservation) => {
    if (excludeId && reservation.id === excludeId) return false
    if (isCancelledReservation(reservation)) return false
    if (isVipRoom(reservation.roomName)) return false
    return blocksRoomAvailability(reservation, referenceDate)
  })

const getFixedVipReservations = (reservations, excludeId, referenceDate = new Date()) =>
  reservations.filter((reservation) => {
    if (excludeId && reservation.id === excludeId) return false
    if (isCancelledReservation(reservation)) return false
    if (!isVipRoom(reservation.roomName)) return false
    return blocksRoomAvailability(reservation, referenceDate)
  })

const getStandardRooms = () => ACTIVE_ROOMS.filter((room) => isRoomBookable(room) && !isVipRoom(room))

const canPlaceOnRoom = (reservation, roomName, assignment, reservationsById, fixedVip) => {
  const room = normalizeRoomName(roomName)
  if (isVipRoom(room)) return false

  for (const [id, assignedRoom] of assignment) {
    if (normalizeRoomName(assignedRoom) !== room) continue
    const other = reservationsById.get(id)
    if (other && reservationsOverlap(reservation, other)) return false
  }

  for (const vip of fixedVip) {
    if (normalizeRoomName(vip.roomName) !== room) continue
    if (reservationsOverlap(reservation, vip)) return false
  }

  return true
}

const targetRoomBlocksIncoming = (
  checkInDate,
  checkOutDate,
  targetRoom,
  assignment,
  reservationsById,
  fixedVip,
) => {
  const room = normalizeRoomName(targetRoom)

  for (const [id, assignedRoom] of assignment) {
    if (normalizeRoomName(assignedRoom) !== room) continue
    const reservation = reservationsById.get(id)
    if (reservation && incomingOverlaps(checkInDate, checkOutDate, reservation)) return true
  }

  for (const vip of fixedVip) {
    if (normalizeRoomName(vip.roomName) !== room) continue
    if (incomingOverlaps(checkInDate, checkOutDate, vip)) return true
  }

  return false
}

const buildReassignments = (movable, assignment) =>
  movable.flatMap((reservation) => {
    const toRoom = assignment.get(reservation.id)
    const fromRoom = normalizeRoomName(reservation.roomName)
    if (!toRoom || fromRoom === toRoom) return []
    return [{ reservation, fromRoom, toRoom }]
  })

/**
 * VIP hariç standart misafirleri yeniden yerleştirerek seçilen tarihler için boş oda bulur.
 * @returns {{ targetRoom: string, reassignments: Array, shuffled: boolean } | null}
 */
export const findBookingPlan = (
  reservations,
  { checkInDate, checkOutDate, excludeId, roomNames },
  referenceDate = new Date(),
) => {
  if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) return null

  if (
    getFullyBookedNightsInRange(reservations, checkInDate, checkOutDate, {
      excludeId,
      now: referenceDate,
    }).length > 0
  ) {
    return null
  }

  const standardRooms = getStandardRooms()
  if (standardRooms.length === 0) return null

  const simpleAvailability = getRoomAvailabilityList(reservations, {
    checkInDate,
    checkOutDate,
    excludeId,
    roomNames: roomNames ?? standardRooms,
  })

  const directlyAvailable = simpleAvailability.filter(
    (room) => room.available && isRoomBookable(room.roomName) && !isVipRoom(room.roomName),
  )

  if (directlyAvailable.length > 0) {
    return {
      targetRoom: pickFirstAvailableStandardRoom(directlyAvailable.map((room) => room.roomName)),
      reassignments: [],
      shuffled: false,
    }
  }

  const movable = getMovableReservations(reservations, excludeId, referenceDate)
  const fixedVip = getFixedVipReservations(reservations, excludeId, referenceDate)
  const reservationsById = new Map(reservations.map((reservation) => [reservation.id, reservation]))

  for (let i = 0; i < fixedVip.length; i += 1) {
    for (let j = i + 1; j < fixedVip.length; j += 1) {
      if (reservationsOverlap(fixedVip[i], fixedVip[j])) return null
    }
  }

  const sortedMovable = [...movable].sort((a, b) => {
    const nightsA = differenceInCalendarDays(parseISO(a.checkOutDate), parseISO(a.checkInDate))
    const nightsB = differenceInCalendarDays(parseISO(b.checkOutDate), parseISO(b.checkInDate))
    return nightsB - nightsA
  })

  for (const targetRoom of standardRooms) {
    const assignment = new Map()

    const search = (index) => {
      if (index === sortedMovable.length) {
        if (
          targetRoomBlocksIncoming(
            checkInDate,
            checkOutDate,
            targetRoom,
            assignment,
            reservationsById,
            fixedVip,
          )
        ) {
          return null
        }

        return {
          targetRoom,
          reassignments: buildReassignments(sortedMovable, assignment),
          shuffled: true,
        }
      }

      const reservation = sortedMovable[index]
      const currentRoom = normalizeRoomName(reservation.roomName)
      const candidateRooms = [...standardRooms].sort((a, b) => {
        if (a === currentRoom) return -1
        if (b === currentRoom) return 1
        return 0
      })

      for (const room of candidateRooms) {
        if (
          normalizeRoomName(room) === normalizeRoomName(targetRoom) &&
          incomingOverlaps(checkInDate, checkOutDate, reservation)
        ) {
          continue
        }

        if (!canPlaceOnRoom(reservation, room, assignment, reservationsById, fixedVip)) continue

        assignment.set(reservation.id, room)
        const result = search(index + 1)
        if (result) return result
        assignment.delete(reservation.id)
      }

      return null
    }

    const plan = search(0)
    if (plan) return plan
  }

  return null
}
