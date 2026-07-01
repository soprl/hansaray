/**
 * Rezervasyon formu hesap yolu — vite-node ile smoke test.
 * Çalıştır: npx vite-node scripts/form-smoke.mjs
 */
import { ACTIVE_ROOMS } from '../src/config/rooms.js'
import { evaluateStayBooking } from '../src/utils/stayBooking.js'
import { findBookingPlan } from '../src/utils/roomAssignmentUtils.js'
import { getConflictingNightsInRange } from '../src/utils/roomAvailability.js'

const bookable = ACTIVE_ROOMS.filter((r) => r !== 'V.I.P')

const reservations = [
  {
    id: '1',
    roomName: 'C/1',
    checkInDate: '2026-07-10',
    checkOutDate: '2026-07-15',
    reservationStatus: 'Aktif',
    customerName: 'Ali',
  },
  {
    id: '2',
    roomName: 'C/2',
    checkInDate: '2026-07-10',
    checkOutDate: '2026-07-20',
    reservationStatus: 'Aktif',
    customerName: 'Ayşe',
  },
  {
    id: 'bad',
    roomName: 'D/1',
    checkInDate: null,
    checkOutDate: undefined,
    reservationStatus: 'Aktif',
    customerName: 'Bozuk',
  },
  {
    id: 'bad2',
    checkInDate: '2026-08-01',
    checkOutDate: '2026-08-05',
    reservationStatus: 'Aktif',
    customerName: 'Idsiz',
  },
]

const ranges = [
  ['2026-07-02', '2026-07-03'],
  ['2026-07-10', '2026-07-12'],
  ['2026-07-10', '2026-07-20'],
  ['2026-08-01', '2026-08-03'],
]

let failures = 0

for (const [checkIn, checkOut] of ranges) {
  try {
    const base = evaluateStayBooking(reservations, {
      checkInDate: checkIn,
      checkOutDate: checkOut,
      roomNames: bookable,
    })
    const plan = findBookingPlan(reservations, {
      checkInDate: checkIn,
      checkOutDate: checkOut,
      roomNames: bookable,
    })
    const full = evaluateStayBooking(reservations, {
      checkInDate: checkIn,
      checkOutDate: checkOut,
      roomNames: bookable,
      bookingPlan: plan,
    })

    for (const room of full.roomAvailability ?? []) {
      if (!room.available && room.conflict) {
        getConflictingNightsInRange(
          { checkInDate: checkIn, checkOutDate: checkOut },
          room.conflict,
        )
      }
    }

    console.log(`OK ${checkIn}→${checkOut}`, {
      allRoomsFull: full.allRoomsFull,
      rooms: full.roomAvailability?.length,
      plan: plan?.targetRoom ?? null,
    })
  } catch (error) {
    failures += 1
    console.error(`FAIL ${checkIn}→${checkOut}`, error)
  }
}

if (failures > 0) {
  process.exit(1)
}

console.log('All smoke tests passed.')
