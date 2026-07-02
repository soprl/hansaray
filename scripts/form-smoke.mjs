/**
 * Rezervasyon formu hesap yolu — vite-node ile smoke test.
 * Çalıştır: npx vite-node scripts/form-smoke.mjs
 */
import assert from 'node:assert/strict'
import { ACTIVE_ROOMS, isRoomBookable, isVipRoom } from '../src/config/rooms.js'
import { evaluateStayBooking } from '../src/utils/stayBooking.js'
import {
  getConflictingNightsInRange,
  getRoomAvailabilityList,
  hasReservationDateConflict,
} from '../src/utils/roomAvailability.js'

const bookable = ACTIVE_ROOMS.filter((room) => isRoomBookable(room) && !isVipRoom(room))

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
    const result = evaluateStayBooking(reservations, {
      checkInDate: checkIn,
      checkOutDate: checkOut,
      roomNames: bookable,
    })

    for (const room of result.roomAvailability ?? []) {
      if (!room.available && room.conflict) {
        getConflictingNightsInRange(
          { checkInDate: checkIn, checkOutDate: checkOut },
          room.conflict,
        )
      }
    }

    console.log(`OK ${checkIn}→${checkOut}`, {
      allRoomsFull: result.allRoomsFull,
      rooms: result.roomAvailability?.length,
      directStandard: result.directStandardRooms?.map((r) => r.roomName) ?? [],
    })
  } catch (error) {
    failures += 1
    console.error(`FAIL ${checkIn}→${checkOut}`, error)
  }
}

if (failures > 0) {
  process.exit(1)
}

const augReservations = [
  { id: 'c1', roomName: 'C/1', checkInDate: '2026-08-07', checkOutDate: '2026-08-09', reservationStatus: 'Aktif', customerName: 'Zuhal Tosun' },
  { id: 'c2', roomName: 'C/2', checkInDate: '2026-08-08', checkOutDate: '2026-08-10', reservationStatus: 'Aktif', customerName: 'Halil Şen' },
  { id: 'd1', roomName: 'D/1', checkInDate: '2026-08-10', checkOutDate: '2026-08-16', reservationStatus: 'Aktif', customerName: 'Haluk Öztürk' },
  { id: 'd2', roomName: 'D/2', checkInDate: '2026-08-08', checkOutDate: '2026-08-10', reservationStatus: 'Aktif', customerName: 'Zeki Yıldız' },
  { id: 'vip', roomName: 'V.I.P', checkInDate: '2026-08-10', checkOutDate: '2026-09-13', reservationStatus: 'Aktif', customerName: 'Mustafa Ali Kurt' },
  { id: 'oda6', roomName: 'ODA/6', checkInDate: '2026-08-07', checkOutDate: '2026-08-10', reservationStatus: 'Aktif', customerName: 'Yavuz Bayrak' },
  { id: 'c1b', roomName: 'C/1', checkInDate: '2026-08-12', checkOutDate: '2026-08-20', reservationStatus: 'Aktif', customerName: 'Neslihan Aydın' },
]

const aug912 = getRoomAvailabilityList(augReservations, {
  checkInDate: '2026-08-09',
  checkOutDate: '2026-08-12',
  roomNames: [...bookable, 'V.I.P', 'ODA/6'],
})

const d1Aug912 = aug912.find((room) => room.roomName === 'D/1')
const c1Aug912 = aug912.find((room) => room.roomName === 'C/1')

if (!d1Aug912 || d1Aug912.available) {
  console.error('FAIL Aug 9-12: D/1 must be unavailable (Haluk conflict)')
  process.exit(1)
}

if (!c1Aug912?.available) {
  console.error('FAIL Aug 9-12: C/1 must be available')
  process.exit(1)
}

const d1Aug910 = getRoomAvailabilityList(augReservations, {
  checkInDate: '2026-08-09',
  checkOutDate: '2026-08-10',
  roomNames: ['D/1'],
})[0]

if (!d1Aug910?.available) {
  console.error('FAIL Aug 9-10: D/1 should be available with same-day turnover')
  process.exit(1)
}

console.log('Aug 9-12 regression OK:', {
  d1: 'dolu',
  c1: 'müsait',
  d1Nights: d1Aug912.conflictingNights,
})

// 11:30 çıkış aynı gün → müsait; 14:00 giriş aralıkta → dolu
assert.equal(
  hasReservationDateConflict(
    { checkInDate: '2026-08-09', checkOutDate: '2026-08-12' },
    { checkInDate: '2026-08-07', checkOutDate: '2026-08-09' },
  ),
  false,
  '11:30 çıkış + aynı gün 14:00 giriş = çakışma yok',
)

assert.equal(
  hasReservationDateConflict(
    { checkInDate: '2026-08-09', checkOutDate: '2026-08-12' },
    { checkInDate: '2026-08-10', checkOutDate: '2026-08-16' },
  ),
  true,
  '14:00 giriş (10 Ağu) seçilen aralıkla çakışır',
)

const turnoverOnly = getRoomAvailabilityList(
  [{ id: 'z', roomName: 'C/1', checkInDate: '2026-08-07', checkOutDate: '2026-08-09', reservationStatus: 'Aktif', customerName: 'Zuhal' }],
  { checkInDate: '2026-08-09', checkOutDate: '2026-08-12', roomNames: ['C/1'] },
)[0]

if (!turnoverOnly?.available) {
  console.error('FAIL: 11:30 çıkış günü giriş müsait olmalı')
  process.exit(1)
}

const blockedByCheckIn = getRoomAvailabilityList(
  [{ id: 'h', roomName: 'D/1', checkInDate: '2026-08-10', checkOutDate: '2026-08-16', reservationStatus: 'Aktif', customerName: 'Haluk' }],
  { checkInDate: '2026-08-09', checkOutDate: '2026-08-12', roomNames: ['D/1'] },
)[0]

if (blockedByCheckIn?.available) {
  console.error('FAIL: 14:00 giriş (10 Ağu) varken rezervasyon yapılmamalı')
  process.exit(1)
}

// VIP elle seçildiğinde standart dolu geceler kaydı engellememeli
const fullStandardNights = [
  { id: 'c1', roomName: 'C/1', checkInDate: '2026-08-07', checkOutDate: '2026-08-09', reservationStatus: 'Aktif', customerName: 'A' },
  { id: 'c2', roomName: 'C/2', checkInDate: '2026-08-07', checkOutDate: '2026-08-09', reservationStatus: 'Aktif', customerName: 'B' },
  { id: 'd1', roomName: 'D/1', checkInDate: '2026-08-07', checkOutDate: '2026-08-09', reservationStatus: 'Aktif', customerName: 'C' },
  { id: 'd2', roomName: 'D/2', checkInDate: '2026-08-07', checkOutDate: '2026-08-09', reservationStatus: 'Aktif', customerName: 'D' },
  { id: 'vip', roomName: 'V.I.P', checkInDate: '2026-08-10', checkOutDate: '2026-08-20', reservationStatus: 'Aktif', customerName: 'VIP guest' },
]

const vipBooking = evaluateStayBooking(fullStandardNights, {
  checkInDate: '2026-08-07',
  checkOutDate: '2026-08-09',
  roomNames: [...bookable, 'V.I.P', 'ODA/6'],
})

assert.equal(vipBooking.hasFullyBookedNight, true, 'standart geceler tam dolu')
assert.equal(vipBooking.canBookVip, true, 'VIP müsait olmalı')
assert.equal(vipBooking.allRoomsFull, false, 'VIP varken tüm odalar dolu sayılmamalı')

const oda6Aug78 = vipBooking.roomAvailability?.find((room) => room.roomName === 'ODA/6')
assert.equal(oda6Aug78?.available, true, 'standart dolu gecede VIP (Sahil) müsait')

console.log('VIP manual booking regression OK')

console.log('All smoke tests passed.')
