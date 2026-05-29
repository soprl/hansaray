import { initNativePush, isNativeApp } from './nativePush'
import { initWebPush, isWebPushEnvironment, supportsWebPush } from './webPush'

export { isNativeApp, isWebPushEnvironment }

export async function supportsPushNotifications() {
  if (isNativeApp()) return true
  return supportsWebPush()
}

export async function initPushNotifications(user, options = {}) {
  if (!user?.uid) return { registered: false, reason: 'no-user' }
  if (isNativeApp()) return initNativePush(user)
  return initWebPush(user, options)
}
