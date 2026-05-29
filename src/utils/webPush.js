import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'
import {
  hasConfiguredVapidEnv,
  hasValidVapidEnv,
  resolveWebVapidKey,
} from '../config/webPushPublicKey'
import { firebaseApp } from '../firebase'
import { registerDeviceToken } from '../services/notificationSettingsService'
import { isNativeApp } from './nativePush'

let foregroundListenerReady = false

const attachForegroundListener = (messaging) => {
  if (foregroundListenerReady) return
  foregroundListenerReady = true

  onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? 'Hansaray Otel'
    const body = payload.notification?.body ?? ''
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.svg' })
    }
  })
}

export const isWebPushEnvironment = () =>
  typeof window !== 'undefined' && !isNativeApp() && 'serviceWorker' in navigator

export async function supportsWebPush() {
  if (!isWebPushEnvironment()) return false
  try {
    return await isSupported()
  } catch {
    return false
  }
}

async function requestWebNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

async function maybeSendWelcomeTest() {
  if (typeof sessionStorage === 'undefined') return
  if (sessionStorage.getItem('hansaray_push_test_sent')) return

  try {
    const { sendTestNotification } = await import('../services/notificationSettingsService')
    await sendTestNotification()
    sessionStorage.setItem('hansaray_push_test_sent', '1')
  } catch (error) {
    console.warn('Hoş geldin test bildirimi gönderilemedi', error)
  }
}

function mapRegistrationError(error) {
  const code = error?.code ?? ''
  if (code === 'messaging/permission-blocked' || Notification.permission === 'denied') {
    return { registered: false, reason: 'permission-denied', detail: error?.message }
  }
  if (code === 'messaging/permission-default') {
    return { registered: false, reason: 'permission-default', detail: error?.message }
  }
  if (code === 'messaging/unsupported-browser') {
    return { registered: false, reason: 'unsupported', detail: error?.message }
  }
  const message = error?.message || String(error)
  if (message.includes('applicationServerKey') || message.includes('P-256')) {
    return { registered: false, reason: 'invalid-vapid-key', detail: message }
  }
  return {
    registered: false,
    reason: 'registration-error',
    detail: message,
  }
}

async function fetchFcmToken(messaging, registration) {
  const vapidKey = resolveWebVapidKey()
  const tokenOptions = { serviceWorkerRegistration: registration }
  if (vapidKey) {
    tokenOptions.vapidKey = vapidKey
  }

  try {
    return await getToken(messaging, tokenOptions)
  } catch (error) {
    const message = error?.message || ''
    if (
      vapidKey &&
      hasConfiguredVapidEnv() &&
      !hasValidVapidEnv() &&
      (message.includes('applicationServerKey') || message.includes('P-256'))
    ) {
      return getToken(messaging, { serviceWorkerRegistration: registration })
    }
    throw error
  }
}

export async function initWebPush(user, options = {}) {
  const { requestPermission = true, sendTestOnSuccess = false } = options

  if (!user?.uid || isNativeApp()) return { registered: false, reason: 'not-web' }

  if (hasConfiguredVapidEnv() && !hasValidVapidEnv()) {
    console.warn(
      'VITE_FIREBASE_VAPID_KEY geçersiz; Firebase Console Web Push anahtarı kullanılacak.',
    )
  }

  const supported = await supportsWebPush()
  if (!supported) {
    return { registered: false, reason: 'unsupported' }
  }

  if (requestPermission) {
    const permission = await requestWebNotificationPermission()
    if (permission === 'denied') {
      return { registered: false, reason: 'permission-denied' }
    }
    if (permission !== 'granted') {
      return { registered: false, reason: 'permission-default' }
    }
  } else if (Notification.permission !== 'granted') {
    return { registered: false, reason: 'permission-default' }
  }

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    })
    await navigator.serviceWorker.ready

    const messaging = getMessaging(firebaseApp)
    attachForegroundListener(messaging)

    const token = await fetchFcmToken(messaging, registration)

    if (!token) {
      return { registered: false, reason: 'no-token' }
    }

    await registerDeviceToken({
      userId: user.uid,
      email: user.email,
      token,
      platform: 'web',
    })

    if (sendTestOnSuccess) {
      await maybeSendWelcomeTest()
    }

    return { registered: true }
  } catch (error) {
    console.error('Web push registration failed', error)
    return mapRegistrationError(error)
  }
}
