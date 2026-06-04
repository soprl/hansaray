import { getSensitiveSectionPin, SENSITIVE_SESSION_KEY } from '../config/sensitiveAccess'

export const isSensitiveSectionUnlocked = () =>
  sessionStorage.getItem(SENSITIVE_SESSION_KEY) === '1'

export const unlockSensitiveSection = () => {
  sessionStorage.setItem(SENSITIVE_SESSION_KEY, '1')
}

export const lockSensitiveSection = () => {
  sessionStorage.removeItem(SENSITIVE_SESSION_KEY)
}

export const verifySensitivePin = (input) => {
  const expected = getSensitiveSectionPin()
  if (!expected) return { ok: false, reason: 'missing_config' }
  const pin = input?.trim() ?? ''
  if (!pin) return { ok: false, reason: 'empty' }
  return { ok: pin === expected, reason: pin === expected ? null : 'wrong' }
}

export const isSensitivePinConfigured = () => Boolean(getSensitiveSectionPin())
