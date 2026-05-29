import { initNativePush, isNativeApp } from './nativePush'

export { isNativeApp }

/** Yalnızca iOS (Capacitor) uygulamasında; web’de kapalı. */
export async function initPushNotifications(user) {
  if (!user?.uid || !isNativeApp()) {
    return { registered: false, reason: 'not-native' }
  }
  return initNativePush(user)
}
