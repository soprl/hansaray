import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { db, firebaseApp } from '../firebase'

const SETTINGS_DOC_ID = 'default'

export const DEFAULT_NOTIFICATION_SETTINGS = {
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
  timezone: 'Europe/Istanbul',
}

export async function getNotificationSettings() {
  const snapshot = await getDoc(doc(db, 'notificationSettings', SETTINGS_DOC_ID))

  if (!snapshot.exists()) {
    return { ...DEFAULT_NOTIFICATION_SETTINGS }
  }

  return {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...snapshot.data(),
  }
}

export async function saveNotificationSettings(settings) {
  await setDoc(
    doc(db, 'notificationSettings', SETTINGS_DOC_ID),
    {
      ...settings,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function registerDeviceToken({ userId, email, token, platform }) {
  if (!userId || !token) return

  const platformKey = (platform ?? 'unknown').replace(/\//g, '_')
  const docId = `${userId}_${platformKey}`

  await setDoc(doc(db, 'deviceTokens', docId), {
    userId,
    email: email ?? '',
    token,
    platform: platform ?? 'unknown',
    updatedAt: serverTimestamp(),
  })
}

export async function getRegisteredDevices() {
  const snapshot = await getDocs(collection(db, 'deviceTokens'))

  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }))
}

export async function sendTestNotification() {
  const functions = getFunctions(firebaseApp, 'europe-west1')
  const callable = httpsCallable(functions, 'sendTestNotification')
  const result = await callable()
  return result.data
}
