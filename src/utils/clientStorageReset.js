/** Deploy sonrası bir kez çalışır — eski önbellek / oturum kalıntılarını temizler */
export const CLIENT_VERSION = '2026.07.02.6'

const CLIENT_VERSION_KEY = 'hansaray_client_version'

function clearBrowserCookies() {
  if (typeof document === 'undefined') return

  document.cookie.split(';').forEach((entry) => {
    const name = entry.split('=')[0]?.trim()
    if (!name) return

    const expired = 'expires=Thu, 01 Jan 1970 00:00:00 GMT'
    document.cookie = `${name}=;${expired};path=/`
    document.cookie = `${name}=;${expired};path=/;domain=${window.location.hostname}`
  })
}

export async function resetClientStorageIfVersionChanged() {
  if (typeof window === 'undefined') return

  const previous = localStorage.getItem(CLIENT_VERSION_KEY)
  if (previous === CLIENT_VERSION) return

  try {
    sessionStorage.clear()
  } catch {
    // Tarayıcı kısıtlaması
  }

  try {
    localStorage.clear()
  } catch {
    // Tarayıcı kısıtlaması
  }

  clearBrowserCookies()

  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
  } catch {
    // Cache API yok veya erişim yok
  }

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    }
  } catch {
    // Service worker temizlenemedi
  }

  localStorage.setItem(CLIENT_VERSION_KEY, CLIENT_VERSION)
}
