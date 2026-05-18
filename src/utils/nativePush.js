import { registerDeviceToken } from '../services/notificationSettingsService'

export const isNativeApp = () =>
  typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true

export async function initNativePush(user) {
  if (!user?.uid || !isNativeApp()) return { registered: false, reason: 'not-native' }

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    const permission = await PushNotifications.requestPermissions()
    if (permission.receive !== 'granted') {
      return { registered: false, reason: 'permission-denied' }
    }

    await PushNotifications.register()

    return await new Promise((resolve) => {
      let settled = false
      const finish = async (result, listeners) => {
        if (settled) return
        settled = true
        await Promise.all(listeners.map((listener) => listener.remove()))
        resolve(result)
      }

      const listeners = []

      PushNotifications.addListener('registration', async (token) => {
        await registerDeviceToken({
          userId: user.uid,
          email: user.email,
          token: token.value,
          platform: window.Capacitor.getPlatform(),
        })
        finish({ registered: true }, listeners)
      }).then((listener) => listeners.push(listener))

      PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error', error)
        finish({ registered: false, reason: 'registration-error' }, listeners)
      }).then((listener) => listeners.push(listener))

      setTimeout(() => {
        finish({ registered: false, reason: 'timeout' }, listeners)
      }, 15000)
    })
  } catch (error) {
    console.warn('Native push not available', error)
    return { registered: false, reason: 'unavailable' }
  }
}
