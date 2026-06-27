/**
 * Otel giriş/çıkış saati kuralları — hızlı doğrulama.
 * Çalıştır: npm run verify:hotel-time
 */
import assert from 'node:assert/strict'
import {
  CHECK_IN_HOUR,
  CHECK_IN_MINUTE,
  CHECK_OUT_HOUR,
  CHECK_OUT_MINUTE,
  getHotelDateTime,
  isOnOrAfterCheckInTime,
  isOnOrAfterCheckOutTime,
} from '../src/config/hotelTime.js'

const isoAtIstanbul = (dateIso, hour, minute = 0) => {
  const padded = `${dateIso}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
  return new Date(`${padded}+03:00`)
}

const isCheckoutEnded = (checkOutDate, referenceDate) => {
  const hotel = getHotelDateTime(referenceDate)
  if (hotel.dateIso > checkOutDate) return true
  if (hotel.dateIso < checkOutDate) return false
  return isOnOrAfterCheckOutTime(hotel)
}

const isCheckInStarted = (checkInDate, referenceDate) => {
  const hotel = getHotelDateTime(referenceDate)
  if (hotel.dateIso > checkInDate) return true
  if (hotel.dateIso < checkInDate) return false
  return isOnOrAfterCheckInTime(hotel)
}

const hasDateConflict = (incoming, existing) =>
  incoming.checkInDate < existing.checkOutDate && incoming.checkOutDate > existing.checkInDate

assert.ok(CHECK_IN_HOUR === 14 && CHECK_IN_MINUTE === 0, 'Giriş 14:00 olmalı')
assert.ok(CHECK_OUT_HOUR === 11 && CHECK_OUT_MINUTE === 30, 'Çıkış 11:30 olmalı')
assert.ok(
  CHECK_IN_HOUR * 60 + CHECK_IN_MINUTE > CHECK_OUT_HOUR * 60 + CHECK_OUT_MINUTE,
  'Aynı gün devir penceresi olmalı (giriş > çıkış)',
)

const turnoverDay = '2026-06-18'

assert.equal(isCheckoutEnded(turnoverDay, isoAtIstanbul(turnoverDay, 11, 29)), false)
assert.equal(isCheckoutEnded(turnoverDay, isoAtIstanbul(turnoverDay, 11, 30)), true)
assert.equal(isCheckInStarted(turnoverDay, isoAtIstanbul(turnoverDay, 13, 59)), false)
assert.equal(isCheckInStarted(turnoverDay, isoAtIstanbul(turnoverDay, 14, 0)), true)

assert.equal(
  hasDateConflict(
    { checkInDate: turnoverDay, checkOutDate: '2026-06-19' },
    { checkInDate: '2026-06-15', checkOutDate: turnoverDay },
  ),
  false,
  'Aynı gün devir çakışma değil',
)

assert.equal(
  hasDateConflict(
    { checkInDate: '2026-06-17', checkOutDate: '2026-06-19' },
    { checkInDate: '2026-06-15', checkOutDate: turnoverDay },
  ),
  true,
  'Gerçek örtüşme çakışma',
)

// Takvim doluluk = «bu güne 1 gece giriş» çakışması (form ile aynı)
const guest = { checkInDate: turnoverDay, checkOutDate: '2026-06-20' }

assert.equal(
  hasDateConflict({ checkInDate: turnoverDay, checkOutDate: '2026-06-19' }, guest),
  true,
  'Giriş günü takvimde dolu sayılmalı (saatten bağımsız)',
)
assert.equal(
  hasDateConflict({ checkInDate: '2026-06-20', checkOutDate: '2026-06-21' }, guest),
  false,
  'Çıkış günü takvimde boş (devir)',
)

console.log('✓ Otel saati kuralları doğrulandı (11:30 çıkış, 14:00 giriş, aynı gün devir).')
console.log('✓ Takvim doluluk = rezervasyon çakışma kuralı uyumlu.')
