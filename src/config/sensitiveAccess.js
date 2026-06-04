/** Gelir/Gider ve Raporlar için ek PIN (sessionStorage — tarayıcı kapanınca silinir) */
export const SENSITIVE_SESSION_KEY = 'hansaray_sensitive_unlocked'

/** Vercel / .env.local: VITE_SENSITIVE_SECTION_PIN=xxxx */
export const getSensitiveSectionPin = () => import.meta.env.VITE_SENSITIVE_SECTION_PIN?.trim() ?? ''
