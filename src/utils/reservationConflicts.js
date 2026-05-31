import { canonicalRoomName } from '../config/rooms'
import { formatDateTR } from './formatters'
import { blocksRoomAvailability, hasReservationDateConflict } from './reservationUtils'

const pairKey = (idA, idB) => [idA, idB].sort().join('|')

/** Aktif rezervasyonlarda aynı oda (normalize) + tarih çakışması */
export function findSameRoomDateConflicts(reservations) {
  const active = reservations.filter(blocksRoomAvailability)
  const pairs = []
  const seen = new Set()

  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const a = active[i]
      const b = active[j]

      if (
        !hasReservationDateConflict(
          { checkInDate: a.checkInDate, checkOutDate: a.checkOutDate },
          { checkInDate: b.checkInDate, checkOutDate: b.checkOutDate },
        )
      ) {
        continue
      }

      const canonicalRoom = canonicalRoomName(a.roomName)
      if (canonicalRoom !== canonicalRoomName(b.roomName)) continue

      const key = pairKey(a.id, b.id)
      if (seen.has(key)) continue
      seen.add(key)

      const rawA = (a.roomName || '').trim()
      const rawB = (b.roomName || '').trim()

      pairs.push({
        id: key,
        canonicalRoom,
        differentRawNames: rawA !== rawB,
        reservations: [a, b],
      })
    }
  }

  return pairs.sort((left, right) =>
    (left.reservations[0].checkInDate || '').localeCompare(right.reservations[0].checkInDate || ''),
  )
}

export function formatConflictDateRange(reservation) {
  return `${formatDateTR(reservation.checkInDate)} → ${formatDateTR(reservation.checkOutDate)}`
}
