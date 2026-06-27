/** Otel iş kuralları — Türkiye saati */
export const HOTEL_TIMEZONE = 'Europe/Istanbul'

/** Misafir odaya en erken bu saatte girer (14:00) */
export const CHECK_IN_HOUR = 14
export const CHECK_IN_MINUTE = 0

/** Misafir odayı en geç bu saatte boşaltır; sonra oda boş sayılır (11:30) */
export const CHECK_OUT_HOUR = 11
export const CHECK_OUT_MINUTE = 30

/** @deprecated Dakika hassasiyeti için isOnOrAfterCheckOutTime kullanın */
export const CHECKOUT_COMPLETE_HOUR = CHECK_OUT_HOUR

export function formatHotelClockTime(hour, minute = 0) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export const HOTEL_CHECK_IN_TIME = formatHotelClockTime(CHECK_IN_HOUR, CHECK_IN_MINUTE)
export const HOTEL_CHECK_OUT_TIME = formatHotelClockTime(CHECK_OUT_HOUR, CHECK_OUT_MINUTE)

const hotelDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: HOTEL_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Verilen anı İstanbul takvim günü ve saatine çevirir */
export function getHotelDateTime(referenceDate = new Date()) {
  const parts = hotelDateTimeFormatter.formatToParts(referenceDate)
  const get = (type) => parts.find((part) => part.type === type)?.value ?? ''

  return {
    dateIso: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')) || 0,
    minute: Number(get('minute')) || 0,
  }
}

function getHotelMinutesSinceMidnight({ hour, minute }) {
  return hour * 60 + minute
}

function hotelTimeToMinutes(hour, minute = 0) {
  return hour * 60 + minute
}

export function isHotelTimeReached(hotelDateTime, hour, minute = 0) {
  return getHotelMinutesSinceMidnight(hotelDateTime) >= hotelTimeToMinutes(hour, minute)
}

export function isHotelTimeBefore(hotelDateTime, hour, minute = 0) {
  return getHotelMinutesSinceMidnight(hotelDateTime) < hotelTimeToMinutes(hour, minute)
}

export function isOnOrAfterCheckInTime(hotelDateTime) {
  return isHotelTimeReached(hotelDateTime, CHECK_IN_HOUR, CHECK_IN_MINUTE)
}

export function isOnOrAfterCheckOutTime(hotelDateTime) {
  return isHotelTimeReached(hotelDateTime, CHECK_OUT_HOUR, CHECK_OUT_MINUTE)
}

export const HOTEL_TIME_POLICY_LABEL = `Giriş ${HOTEL_CHECK_IN_TIME} · Çıkış ${HOTEL_CHECK_OUT_TIME}`

/** Bugünün tarihi (yyyy-MM-dd) — İstanbul takvim günü */
export function getHotelTodayIso(referenceDate = new Date()) {
  return getHotelDateTime(referenceDate).dateIso
}

export function isDateBeforeHotelToday(dateIso, referenceDate = new Date()) {
  if (!dateIso) return false
  return dateIso < getHotelTodayIso(referenceDate)
}

const checkInMinutes = hotelTimeToMinutes(CHECK_IN_HOUR, CHECK_IN_MINUTE)
const checkOutMinutes = hotelTimeToMinutes(CHECK_OUT_HOUR, CHECK_OUT_MINUTE)

if (checkInMinutes <= checkOutMinutes) {
  console.warn(
    '[hotelTime] Giriş saati çıkış saatinden sonra olmalı; aynı gün devir için 11:30 / 14:00 gibi aralık kullanın.',
  )
}
