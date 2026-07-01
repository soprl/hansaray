import { format, startOfDay } from 'date-fns'
import {
  getHotelDateTime,
  isOnOrAfterCheckInTime,
  isOnOrAfterCheckOutTime,
} from '../config/hotelTime'
import { parseISODateSafe } from './formatters'

export const RES_STATUS = {
  ACTIVE: 'Aktif',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
}

const RES_STATUS_ALIASES = {
  aktif: RES_STATUS.ACTIVE,
  active: RES_STATUS.ACTIVE,
  tamamlandı: RES_STATUS.COMPLETED,
  tamamlandi: RES_STATUS.COMPLETED,
  completed: RES_STATUS.COMPLETED,
  complete: RES_STATUS.COMPLETED,
  iptal: RES_STATUS.CANCELLED,
  cancelled: RES_STATUS.CANCELLED,
  canceled: RES_STATUS.CANCELLED,
}

export const normalizeReservationStatus = (value) => {
  const raw = (value ?? '').toString().trim()
  if (!raw) return RES_STATUS.ACTIVE
  if (Object.values(RES_STATUS).includes(raw)) return raw
  const key = raw.toLocaleLowerCase('tr-TR')
  return RES_STATUS_ALIASES[key] ?? RES_STATUS.ACTIVE
}

export const getStoredReservationStatus = (reservation) =>
  normalizeReservationStatus(reservation?.reservationStatus)

export const isCancelledReservation = (reservation) =>
  getStoredReservationStatus(reservation) === RES_STATUS.CANCELLED

export const isReservationCheckoutEnded = (reservation, referenceDate = new Date()) => {
  const checkOutDate = parseISODateSafe(reservation.checkOutDate)
  if (!checkOutDate) return false

  const checkoutIso = format(startOfDay(checkOutDate), 'yyyy-MM-dd')
  const hotel = getHotelDateTime(referenceDate)

  if (hotel.dateIso > checkoutIso) return true
  if (hotel.dateIso < checkoutIso) return false
  return isOnOrAfterCheckOutTime(hotel)
}

export const isReservationCheckInStarted = (reservation, referenceDate = new Date()) => {
  const checkInDate = parseISODateSafe(reservation.checkInDate)
  if (!checkInDate) return false

  const checkInIso = format(startOfDay(checkInDate), 'yyyy-MM-dd')
  const hotel = getHotelDateTime(referenceDate)

  if (hotel.dateIso > checkInIso) return true
  if (hotel.dateIso < checkInIso) return false
  return isOnOrAfterCheckInTime(hotel)
}

export const shouldAutoCompleteReservation = (reservation, referenceDate = new Date()) =>
  getStoredReservationStatus(reservation) === RES_STATUS.ACTIVE &&
  isReservationCheckoutEnded(reservation, referenceDate)

/** Aktif konaklama odayı bloklar (çıkış 11:30 sonrası bloklamaz). */
export const blocksRoomAvailability = (reservation, referenceDate = new Date()) => {
  if (getStoredReservationStatus(reservation) !== RES_STATUS.ACTIVE) return false
  return !isReservationCheckoutEnded(reservation, referenceDate)
}
