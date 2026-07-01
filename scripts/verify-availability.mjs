/**
 * Temmuz 2026 senaryosu — takvim ve form müsaitliği
 * Çalıştır: node scripts/verify-availability.mjs
 */
import assert from 'node:assert/strict'

const STANDARD_ROOM_COUNT = 5

const hasReservationDateConflict = (incoming, existing) =>
  incoming.checkInDate < existing.checkOutDate && incoming.checkOutDate > existing.checkInDate

const listStayNightIsos = (checkInDate, checkOutDate) => {
  const nights = []
  let d = new Date(`${checkInDate}T12:00:00+03:00`)
  const end = new Date(`${checkOutDate}T12:00:00+03:00`)
  while (d < end) {
    nights.push(d.toISOString().slice(0, 10))
    d = new Date(d.getTime() + 86400000)
  }
  return nights
}

const isReservationOccupyingNight = (reservation, nightIso) =>
  hasReservationDateConflict(
    { checkInDate: nightIso, checkOutDate: listStayNightIsos(nightIso, nightIso)[0] ? formatNext(nightIso) : nightIso },
    reservation,
  )

function formatNext(iso) {
  const d = new Date(`${iso}T12:00:00+03:00`)
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

const getStandardOccupiedOnNight = (reservations, nightIso) => {
  const rooms = new Set()
  for (const r of reservations) {
    if (hasReservationDateConflict({ checkInDate: nightIso, checkOutDate: formatNext(nightIso) }, r)) {
      if (r.roomName !== 'V.I.P') rooms.add(r.roomName)
    }
  }
  return rooms.size
}

const getRoomAvailability = (reservations, checkIn, checkOut, roomNames) =>
  roomNames.map((roomName) => {
    const conflict = reservations.find(
      (r) =>
        r.roomName === roomName &&
        hasReservationDateConflict({ checkInDate: checkIn, checkOutDate: checkOut }, r),
    )
    return { roomName, available: !conflict, conflict: conflict?.customerName }
  })

const reservations = [
  { customerName: 'Turhan', roomName: 'C/1', checkInDate: '2026-07-22', checkOutDate: '2026-07-24' },
  { customerName: 'Mehmet', roomName: 'C/2', checkInDate: '2026-07-23', checkOutDate: '2026-07-25' },
  { customerName: 'Tuğba', roomName: 'D/1', checkInDate: '2026-07-23', checkOutDate: '2026-07-27' },
  { customerName: 'ELİF', roomName: 'D/2', checkInDate: '2026-07-24', checkOutDate: '2026-07-26' },
  { customerName: 'Abdülaziz', roomName: 'ODA/6', checkInDate: '2026-07-23', checkOutDate: '2026-07-24' },
]

const standardRooms = ['C/1', 'C/2', 'D/1', 'D/2', 'ODA/6']

assert.equal(getStandardOccupiedOnNight(reservations, '2026-07-23'), 4, '23 Tem: 4/5 dolu')
assert.equal(getStandardOccupiedOnNight(reservations, '2026-07-24'), 3, '24 Tem gece: 3/5 (Mehmet, Tuğba, ELİF)')

const jul23_24 = getRoomAvailability(reservations, '2026-07-23', '2026-07-24', [...standardRooms, 'V.I.P'])
const available23_24 = jul23_24.filter((r) => r.available).map((r) => r.roomName)
assert.ok(available23_24.includes('D/2'), 'D/2 müsait olmalı (23–24)')
assert.ok(available23_24.includes('V.I.P'), 'VIP müsait olmalı (23–24)')

const fullNights23_24 = listStayNightIsos('2026-07-23', '2026-07-24').filter(
  (n) => getStandardOccupiedOnNight(reservations, n) >= STANDARD_ROOM_COUNT,
)
assert.equal(fullNights23_24.length, 0, '23–24 aralığında tam dolu gece olmamalı')

console.log('✓ 23–24 Tem: D/2 ve VIP müsait, tam dolu gece yok')
console.log('  Müsait:', available23_24.join(', '))
console.log('  Dolu:', jul23_24.filter((r) => !r.available).map((r) => `${r.roomName} (${r.conflict})`).join(', '))
