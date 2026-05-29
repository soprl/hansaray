/** Firebase Web Push VAPID public key (~88 karakter, genelde B ile başlar). */
export function isValidVapidPublicKey(key) {
  if (!key || typeof key !== 'string') return false

  const trimmed = key.trim()
  if (trimmed.length < 80 || trimmed.length > 200) return false

  try {
    const padding = '='.repeat((4 - (trimmed.length % 4)) % 4)
    const base64 = (trimmed + padding).replace(/-/g, '+').replace(/_/g, '/')
    const raw = atob(base64)
    return raw.length === 65 && raw.charCodeAt(0) === 0x04
  } catch {
    return false
  }
}

/** Geçerli env anahtarı; yoksa null (Firebase Console varsayılanı kullanılır). */
export function resolveWebVapidKey() {
  const fromEnv = import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim()
  if (!fromEnv) return null
  return isValidVapidPublicKey(fromEnv) ? fromEnv : null
}

export function hasConfiguredVapidEnv() {
  return Boolean(import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim())
}

export function hasValidVapidEnv() {
  return Boolean(resolveWebVapidKey())
}
