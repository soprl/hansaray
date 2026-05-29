/** Web Push VAPID public key (tarayıcıda görünür; gizli değildir). */
const FALLBACK_VAPID_KEY = 'ktGl10S8fUb0HbK9xWgaozmeOr6xRbtMGvDNB2iQQJ4'

export function getWebVapidKey() {
  const fromEnv = import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim()
  return fromEnv || FALLBACK_VAPID_KEY
}

export function hasWebVapidKey() {
  return Boolean(getWebVapidKey())
}
