import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'

export const isPermissionDenied = (error) => error?.code === 'permission-denied'

export const getFirestoreErrorMessage = (error, fallback = 'Veriler yüklenemedi.') => {
  const code = error?.code ?? ''

  if (code === 'permission-denied') {
    return 'Firestore erişimi reddedildi. Firebase Console → Firestore → Rules → Publish (deviceTokens + businessTargets). Mac’te: npm run firebase:rules'
  }

  if (code === 'unavailable' || code === 'network-request-failed') {
    return 'İnternet veya Firebase bağlantısı yok. Bağlantınızı kontrol edin.'
  }

  if (code === 'auth/timeout') {
    return 'Oturum henüz hazır değil. Sayfayı yenileyin veya tekrar giriş yapın.'
  }

  return fallback
}

const waitForAuthUser = (timeoutMs = 12000) =>
  new Promise((resolve, reject) => {
    if (auth.currentUser) {
      resolve(auth.currentUser)
      return
    }

    const timer = setTimeout(() => {
      unsub()
      const error = new Error('Oturum hazır değil')
      error.code = 'auth/timeout'
      reject(error)
    }, timeoutMs)

    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) return

      clearTimeout(timer)
      unsub()
      resolve(user)
    })
  })

export const ensureAuthReady = async () => {
  const user = await waitForAuthUser()
  await user.getIdToken()
  return user
}

export const refreshAuthToken = async () => {
  const user = auth.currentUser
  if (!user) return false
  await user.getIdToken(true)
  return true
}
