const { addDays } = require('date-fns')
const { formatInTimeZone } = require('date-fns-tz')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getMessaging } = require('firebase-admin/messaging')
const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { setGlobalOptions } = require('firebase-functions/v2')

initializeApp()

setGlobalOptions({ region: 'europe-west1' })

const db = getFirestore()
const TZ = 'Europe/Istanbul'

const PAYMENT_PAID = 'Tamamı Ödendi'
const PAYMENT_DEPOSIT = 'Kapora Alındı'

const DEFAULT_SETTINGS = {
  enabled: true,
  dayBeforeEnabled: true,
  sameDayEnabled: true,
  sameDayTime: '09:00',
  notifyCheckIn: true,
  notifyCheckOut: true,
  sameDayTurnoverEnabled: true,
  paymentPendingEnabled: true,
  depositRemainingEnabled: true,
  newReservationEnabled: true,
  morningSummaryEnabled: true,
  morningSummaryTime: '08:00',
  eveningSummaryEnabled: true,
  eveningSummaryTime: '18:00',
}

const ROOM_ALIASES = {
  C: 'C/1',
  C1: 'C/1',
  'C/1': 'C/1',
  C2: 'C/2',
  'C/2': 'C/2',
  D: 'D/1',
  D1: 'D/1',
  'D/1': 'D/1',
  D2: 'D/2',
  'D/2': 'D/2',
  VIP: 'V.I.P',
  'V.I.P': 'V.I.P',
}

const todayIso = () => formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd')
const tomorrowIso = () => formatInTimeZone(addDays(new Date(), 1), TZ, 'yyyy-MM-dd')
const currentTime = () => formatInTimeZone(new Date(), TZ, 'HH:mm')

const normalizeRoomName = (name) => {
  const trimmed = name?.trim() ?? ''
  return ROOM_ALIASES[trimmed] ?? trimmed
}

const RES_ACTIVE = 'Aktif'
const CHECKOUT_COMPLETE_HOUR = 12

const isActiveReservation = (reservation) => {
  const status = (reservation?.reservationStatus ?? '').toString().trim()
  if (!status || status === 'İptal' || status === 'Tamamlandı') return false
  const key = status.toLocaleLowerCase('tr-TR')
  if (['iptal', 'cancelled', 'canceled', 'tamamlandı', 'tamamlandi', 'completed'].includes(key)) {
    return false
  }
  if (status !== RES_ACTIVE && key !== 'aktif' && key !== 'active') return false

  const checkOut = reservation?.checkOutDate
  if (!checkOut) return true

  const today = todayIso()
  const now = currentTime()
  if (today > checkOut) return false
  if (today < checkOut) return true
  return now < `${String(CHECKOUT_COMPLETE_HOUR).padStart(2, '0')}:00`
}

const hasPendingPayment = (reservation) => {
  if (reservation.paymentStatus === PAYMENT_PAID) return false
  const total = Number(reservation.totalPrice) || 0
  const deposit = Number(reservation.deposit) || 0
  return Math.max(total - deposit, 0) > 0
}

const formatMoney = (value) =>
  new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Number(value) || 0)

async function getSettings() {
  const snapshot = await db.doc('notificationSettings/default').get()
  if (!snapshot.exists) return DEFAULT_SETTINGS
  return { ...DEFAULT_SETTINGS, ...snapshot.data() }
}

async function getDeviceTokens() {
  const snapshot = await db.collection('deviceTokens').get()
  return snapshot.docs.map((document) => document.data().token).filter(Boolean)
}

async function getActiveReservations() {
  const snapshot = await db.collection('reservations').get()
  return snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .filter(isActiveReservation)
}

async function sendPushToAll(tokens, title, body) {
  if (!tokens.length) return { successCount: 0, failureCount: 0 }

  const messaging = getMessaging()
  const result = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    webpush: {
      notification: {
        title,
        body,
        icon: 'https://hansaray.vercel.app/favicon.svg',
      },
    },
    apns: { payload: { aps: { sound: 'default' } } },
  })

  return {
    successCount: result.successCount,
    failureCount: result.failureCount,
  }
}

async function sendIfEnabled(title, body) {
  const settings = await getSettings()
  if (!settings.enabled) return

  const tokens = await getDeviceTokens()
  if (!tokens.length) return

  await sendPushToAll(tokens, title, body)
}

function buildReminderMessages(reservations, targetDate, settings, prefix) {
  const messages = []

  reservations.forEach((reservation) => {
    const room = normalizeRoomName(reservation.roomName) || 'Oda'
    const customer = reservation.customerName || 'Misafir'

    if (settings.notifyCheckIn && reservation.checkInDate === targetDate) {
      messages.push({
        title: `${prefix} Giriş`,
        body: `${room} · ${customer}`,
      })
    }

    if (settings.notifyCheckOut && reservation.checkOutDate === targetDate) {
      messages.push({
        title: `${prefix} Çıkış`,
        body: `${room} · ${customer}`,
      })
    }
  })

  return messages
}

function buildTurnoverMessages(reservations, today) {
  const byRoom = new Map()

  reservations.forEach((reservation) => {
    const room = normalizeRoomName(reservation.roomName) || 'Oda'
    if (!byRoom.has(room)) {
      byRoom.set(room, { checkIns: [], checkOuts: [] })
    }
    const entry = byRoom.get(room)
    if (reservation.checkInDate === today) entry.checkIns.push(reservation)
    if (reservation.checkOutDate === today) entry.checkOuts.push(reservation)
  })

  const messages = []
  byRoom.forEach((entry, room) => {
    if (!entry.checkIns.length || !entry.checkOuts.length) return

    const outName = entry.checkOuts[0]?.customerName || 'Misafir'
    const inName = entry.checkIns[0]?.customerName || 'Misafir'
    messages.push({
      title: 'Bugün oda değişimi',
      body: `${room} · Çıkış: ${outName} · Giriş: ${inName}`,
    })
  })

  return messages
}

function buildPaymentPendingMessages(reservations, checkInDate) {
  return reservations
    .filter((reservation) => reservation.checkInDate === checkInDate && hasPendingPayment(reservation))
    .map((reservation) => {
      const room = normalizeRoomName(reservation.roomName) || 'Oda'
      const customer = reservation.customerName || 'Misafir'
      const total = Number(reservation.totalPrice) || 0
      const deposit = Number(reservation.deposit) || 0
      const remaining = Math.max(total - deposit, 0)

      return {
        title: 'Ödeme bekliyor',
        body: `${room} · ${customer} · Kalan ${formatMoney(remaining)} TL`,
      }
    })
}

function buildMorningSummary(reservations, today, tomorrow) {
  const checkInsToday = reservations.filter((r) => r.checkInDate === today).length
  const checkOutsToday = reservations.filter((r) => r.checkOutDate === today).length
  const checkInsTomorrow = reservations.filter((r) => r.checkInDate === tomorrow).length
  const checkOutsTomorrow = reservations.filter((r) => r.checkOutDate === tomorrow).length
  const unpaidTomorrow = reservations.filter(
    (r) => r.checkInDate === tomorrow && hasPendingPayment(r),
  ).length

  let body = `Bugün ${checkInsToday} giriş, ${checkOutsToday} çıkış`
  body += ` · Yarın ${checkInsTomorrow} giriş, ${checkOutsTomorrow} çıkış`
  if (unpaidTomorrow > 0) {
    body += ` · ${unpaidTomorrow} ödeme bekliyor`
  }

  return { title: 'Sabah özeti', body }
}

function buildEveningSummary(reservations, tomorrow) {
  const checkInsTomorrow = reservations.filter((r) => r.checkInDate === tomorrow).length
  const checkOutsTomorrow = reservations.filter((r) => r.checkOutDate === tomorrow).length
  const turnoversTomorrow = buildTurnoverMessages(reservations, tomorrow).length

  let body = `Yarın ${checkInsTomorrow} giriş, ${checkOutsTomorrow} çıkış`
  if (turnoversTomorrow > 0) {
    body += ` · ${turnoversTomorrow} oda değişimi`
  }

  return { title: 'Akşam özeti', body }
}

exports.sendTestNotification = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Giriş yapmanız gerekiyor.')
  }

  try {
    const tokens = await getDeviceTokens()
    if (!tokens.length) {
      throw new HttpsError(
        'failed-precondition',
        'Bildirim alıcısı yok. Giriş yapıp tarayıcıda bildirim iznini verin, birkaç saniye bekleyin.',
      )
    }

    const result = await sendPushToAll(
      tokens,
      'Test bildirimi',
      'Otel paneli bildirimleri çalışıyor.',
    )

    if (result.successCount === 0) {
      throw new HttpsError(
        'failed-precondition',
        'Gönderim başarısız. Çıkış yapıp tekrar giriş yapın ve izin verin.',
      )
    }

    return {
      message: `${result.successCount} alıcıya test bildirimi gönderildi.`,
      successCount: result.successCount,
      failureCount: result.failureCount,
    }
  } catch (error) {
    if (error instanceof HttpsError) throw error
    console.error('sendTestNotification', error)
    throw new HttpsError('internal', error?.message || 'Bildirim sunucusu hatası.')
  }
})

exports.onReservationCreated = onDocumentCreated('reservations/{reservationId}', async (event) => {
  const settings = await getSettings()
  if (!settings.enabled || !settings.newReservationEnabled) return

  const reservation = event.data?.data()
  if (!isActiveReservation(reservation)) return

  const room = normalizeRoomName(reservation.roomName) || 'Oda'
  const customer = reservation.customerName || 'Misafir'

  await sendIfEnabled(
    'Yeni rezervasyon',
    `${room} · ${customer} · ${reservation.checkInDate} → ${reservation.checkOutDate}`,
  )
})

exports.onReservationUpdated = onDocumentUpdated('reservations/{reservationId}', async (event) => {
  const settings = await getSettings()
  if (!settings.enabled || !settings.depositRemainingEnabled) return

  const before = event.data.before.data()
  const after = event.data.after.data()
  if (!isActiveReservation(after)) return

  if (before.paymentStatus === after.paymentStatus) return
  if (after.paymentStatus !== PAYMENT_DEPOSIT) return
  if (!hasPendingPayment(after)) return

  const room = normalizeRoomName(after.roomName) || 'Oda'
  const customer = after.customerName || 'Misafir'
  const remaining =
    Number(after.remainingPayment) ||
    Number(after.totalPrice || 0) - Number(after.deposit || 0)

  await sendIfEnabled(
    'Kapora alındı',
    `${room} · ${customer} · Kalan ${formatMoney(remaining)} TL`,
  )
})

exports.scheduledDailyReminders = onSchedule(
  {
    schedule: 'every 60 minutes',
    timeZone: TZ,
  },
  async () => {
    const settings = await getSettings()
    if (!settings.enabled) return

    const tokens = await getDeviceTokens()
    if (!tokens.length) return

    const reservations = await getActiveReservations()
    const today = todayIso()
    const tomorrow = tomorrowIso()
    const time = currentTime()
    const messages = []

    if (settings.dayBeforeEnabled && time === settings.sameDayTime) {
      messages.push(...buildReminderMessages(reservations, tomorrow, settings, 'Yarın'))
    }

    if (settings.sameDayEnabled && time === settings.sameDayTime) {
      messages.push(...buildReminderMessages(reservations, today, settings, 'Bugün'))
    }

    if (settings.sameDayTurnoverEnabled && time === settings.sameDayTime) {
      messages.push(...buildTurnoverMessages(reservations, today))
    }

    if (settings.paymentPendingEnabled && time === settings.morningSummaryTime) {
      messages.push(...buildPaymentPendingMessages(reservations, today))
      messages.push(...buildPaymentPendingMessages(reservations, tomorrow))
    }

    if (settings.morningSummaryEnabled && time === settings.morningSummaryTime) {
      messages.push(buildMorningSummary(reservations, today, tomorrow))
    }

    if (settings.eveningSummaryEnabled && time === settings.eveningSummaryTime) {
      messages.push(buildEveningSummary(reservations, tomorrow))
    }

    if (!messages.length) return

    for (const item of messages.slice(0, 25)) {
      await sendPushToAll(tokens, item.title, item.body)
    }
  },
)
