/** Otel iş kuralları — Türkiye saati */
export const HOTEL_TIMEZONE = 'Europe/Istanbul'

/** Çıkış günü bu saatten sonra konaklama biter, oda boşalır */
export const CHECKOUT_COMPLETE_HOUR = 12

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
