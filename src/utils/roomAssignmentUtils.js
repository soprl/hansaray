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
  getReservationNightCount,
  getRoomAvailabilityList,
  hasReservationDateConflict,
  hasValidReservationDates,
  isCancelledReservation,
  sanitizeReservations,
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
    if (!reservation?.id) return false
    if (excludeId && reservation.id === excludeId) return false
    if (isCancelledReservation(reservation)) return false
    if (isVipRoom(reservation.roomName)) return false
    if (!hasValidReservationDates(reservation)) return false
    return blocksRoomAvailability(reservation, referenceDate)
  })

const getMovableReservationsInRange = (
  reservations,
  checkInDate,
  checkOutDate,
  excludeId,
  referenceDate = new Date(),
) =>
  getMovableReservations(reservations, excludeId, referenceDate).filter((reservation) =>
    incomingOverlaps(checkInDate, checkOutDate, reservation),
  )

const getFixedVipReservations = (reservations, excludeId, referenceDate = new Date()) =>
  reservations.filter((reservation) => {
    if (excludeId && reservation.id === excludeId) return false
    if (isCancelledReservation(reservation)) return false
    if (!isVipRoom(reservation.roomName)) return false
    if (!hasValidReservationDates(reservation)) return false
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
    if (!toRoom || fromRoom === toRoom || isVipRoom(toRoom)) return []
    return [{ reservation, fromRoom, toRoom }]
  })

/** Taşımaları kayıt öncesi güvenli sıraya koyar — hedef oda hâlâ doluyken girişi engeller */
export const sortReassignmentsForApply = (reassignments = []) => {
  if (reassignments.length <= 1) return [...reassignments]

  const pending = [...reassignments]
  const ordered = []

  while (pending.length > 0) {
    const nextIndex = pending.findIndex((move) => {
      const targetRoom = normalizeRoomName(move.toRoom)
      return !pending.some(
        (other) =>
          other !== move &&
          normalizeRoomName(other.fromRoom) === targetRoom &&
          other.reservation?.id !== move.reservation?.id,
      )
    })

    if (nextIndex === -1) {
      ordered.push(...pending)
      break
    }

    ordered.push(pending[nextIndex])
    pending.splice(nextIndex, 1)
  }

  return ordered
}

/**
 * VIP hariç standart misafirleri yeniden yerleştirerek seçilen tarihler için boş oda bulur.
 * @returns {{ targetRoom: string, reassignments: Array, shuffled: boolean } | null}
 */
export const findBookingPlan = (
  reservations,
  { checkInDate, checkOutDate, excludeId, roomNames, preferredRoom },
  referenceDate = new Date(),
) => {
  try {
    return findBookingPlanUnsafe(
      reservations,
      { checkInDate, checkOutDate, excludeId, roomNames, preferredRoom },
      referenceDate,
    )
  } catch (error) {
    console.error('findBookingPlan failed:', error)
    return null
  }
}

const MAX_SHUFFLE_DEPTH = 12
const MAX_SHUFFLE_STEPS = 8000

const findBookingPlanUnsafe = (
  reservations,
  { checkInDate, checkOutDate, excludeId, roomNames, preferredRoom },
  referenceDate = new Date(),
) => {
  if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) return null

  const scopedReservations = sanitizeReservations(reservations)

  if (
    getFullyBookedNightsInRange(scopedReservations, checkInDate, checkOutDate, {
      excludeId,
      now: referenceDate,
    }).length > 0
  ) {
    return null
  }

  const standardRooms = getStandardRooms()
  if (standardRooms.length === 0) return null

  const simpleAvailability = getRoomAvailabilityList(scopedReservations, {
    checkInDate,
    checkOutDate,
    excludeId,
    roomNames: roomNames ?? standardRooms,
  })

  const directlyAvailable = simpleAvailability.filter(
    (room) => room.available && isRoomBookable(room.roomName) && !isVipRoom(room.roomName),
  )

  const normalizedPreferred = preferredRoom ? normalizeRoomName(preferredRoom) : null

  if (directlyAvailable.length > 0) {
    const preferredStillFree =
      normalizedPreferred &&
      directlyAvailable.some((room) => normalizeRoomName(room.roomName) === normalizedPreferred)

    return {
      targetRoom: preferredStillFree
        ? normalizedPreferred
        : pickFirstAvailableStandardRoom(directlyAvailable.map((room) => room.roomName)),
      reassignments: [],
      shuffled: false,
    }
  }

  const movable = getMovableReservationsInRange(
    scopedReservations,
    checkInDate,
    checkOutDate,
    excludeId,
    referenceDate,
  )
  const fixedVip = getFixedVipReservations(scopedReservations, excludeId, referenceDate)
  const safeReservations = scopedReservations
  const reservationsById = new Map(safeReservations.map((reservation) => [reservation.id, reservation]))

  let searchSteps = 0

  for (let i = 0; i < fixedVip.length; i += 1) {
    for (let j = i + 1; j < fixedVip.length; j += 1) {
      if (reservationsOverlap(fixedVip[i], fixedVip[j])) return null
    }
  }

  const sortedMovable = [...movable].sort((a, b) => {
    const nightsA = getReservationNightCount(a) ?? 0
    const nightsB = getReservationNightCount(b) ?? 0
    return nightsB - nightsA
  })

  const targetRoomOrder =
    normalizedPreferred && standardRooms.includes(normalizedPreferred)
      ? [normalizedPreferred, ...standardRooms.filter((room) => room !== normalizedPreferred)]
      : standardRooms

  for (const targetRoom of targetRoomOrder) {
    const assignment = new Map()

    const search = (index, depth = 0) => {
      if (depth > MAX_SHUFFLE_DEPTH) return null
      searchSteps += 1
      if (searchSteps > MAX_SHUFFLE_STEPS) return null

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
      if (!reservation?.id) return null
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
        const result = search(index + 1, depth + 1)
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
