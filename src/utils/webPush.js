import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'
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

export async function initWebPush(user) {
  if (!user?.uid || isNativeApp()) return { registered: false, reason: 'not-web' }

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
  if (!vapidKey) {
    return { registered: false, reason: 'no-vapid-key' }
  }

  const supported = await supportsWebPush()
  if (!supported) {
    return { registered: false, reason: 'unsupported' }
  }

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    })

    const messaging = getMessaging(firebaseApp)
    attachForegroundListener(messaging)

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    })

    if (!token) {
      return { registered: false, reason: 'no-token' }
    }

    await registerDeviceToken({
      userId: user.uid,
      email: user.email,
      token,
      platform: 'web',
    })

    return { registered: true }
  } catch (error) {
    console.error('Web push registration failed', error)

    if (error?.code === 'messaging/permission-blocked') {
      return { registered: false, reason: 'permission-denied' }
    }

    return { registered: false, reason: 'registration-error' }
  }
}
