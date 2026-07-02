/**
 * Rezervasyon denetimi — sistemdeki oda atamalarında tutarsızlıkları bulur.
 * Amaç: oda taşıma karışıklığı sonrası "açıkta / çakışan / odasız" kayıtları göstermek.
 */
import { canonicalRoomName, getRoomDisplayName, normalizeRoomName } from '../config/rooms'
import { hasReservationDateConflict } from './roomAvailability'
import { getStoredReservationStatus, RES_STATUS } from './reservationStatus'
import { normalizeFirestoreDate } from './formatters'

const isActive = (reservation) => getStoredReservationStatus(reservation) === RES_STATUS.ACTIVE

const hasValidDates = (reservation) => {
  const checkIn = normalizeFirestoreDate(reservation.checkInDate)
  const checkOut = normalizeFirestoreDate(reservation.checkOutDate)
  return Boolean(checkIn && checkOut && checkOut > checkIn)
}

/**
 * Aynı odada tarihleri çakışan aktif rezervasyon çiftleri.
 * Aynı gün devir (11:30 çıkış / 14:00 giriş) çakışma sayılmaz.
 */
export const findRoomConflicts = (reservations = []) => {
  const active = reservations.filter(
    (reservation) => reservation?.id && isActive(reservation) && hasValidDates(reservation),
  )

  const conflicts = []
  const seenPairs = new Set()

  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const a = active[i]
      const b = active[j]
      if (canonicalRoomName(a.roomName) !== canonicalRoomName(b.roomName)) continue
      if (!hasReservationDateConflict(a, b)) continue

      const pairKey = [a.id, b.id].sort().join('|')
      if (seenPairs.has(pairKey)) continue
      seenPairs.add(pairKey)

      conflicts.push({ a, b, roomName: canonicalRoomName(a.roomName) })
    }
  }

  return conflicts
}

/** Aktif ama oda atanmamış (roomName boş / tanımsız) rezervasyonlar. */
export const findMissingRoomReservations = (reservations = []) =>
  reservations.filter((reservation) => {
    if (!reservation?.id || !isActive(reservation)) return false
    const room = normalizeRoomName(reservation.roomName)
    return !room
  })

/** Tarihi geçersiz/eksik olan aktif rezervasyonlar. */
export const findInvalidDateReservations = (reservations = []) =>
  reservations.filter(
    (reservation) => reservation?.id && isActive(reservation) && !hasValidDates(reservation),
  )

/** Tüm denetim özeti. */
export const auditReservations = (reservations = []) => ({
  conflicts: findRoomConflicts(reservations),
  missingRoom: findMissingRoomReservations(reservations),
  invalidDates: findInvalidDateReservations(reservations),
})

/** İndirilebilir JSON metni üretir. */
export const buildReservationsExport = (reservations = []) => {
  const audit = auditReservations(reservations)

  const payload = {
    exportedAt: new Date().toISOString(),
    totalCount: reservations.length,
    summary: {
      roomConflicts: audit.conflicts.length,
      missingRoom: audit.missingRoom.length,
      invalidDates: audit.invalidDates.length,
    },
    conflicts: audit.conflicts.map(({ a, b, roomName }) => ({
      room: getRoomDisplayName(roomName),
      a: { id: a.id, customerName: a.customerName, checkInDate: a.checkInDate, checkOutDate: a.checkOutDate },
      b: { id: b.id, customerName: b.customerName, checkInDate: b.checkInDate, checkOutDate: b.checkOutDate },
    })),
    reservations,
  }

  return JSON.stringify(payload, null, 2)
}
