import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { AuthContext } from './authContextValue'
import { auth } from '../firebase'
import { isNativeApp } from '../utils/nativePush'
import { initPushNotifications } from '../utils/pushNotifications'
import { lockSensitiveSection } from '../utils/sensitivePin'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          await currentUser.getIdToken()
        } catch (tokenError) {
          console.warn('Auth token alınamadı', tokenError)
        }

        if (isNativeApp()) {
          initPushNotifications(currentUser).catch((error) => {
            console.warn('iOS bildirim hazırlığı atlandı', error)
          })
        }
      }

      setUser(currentUser)
      setLoading(false)
    })

    return () => unsub()
  }, [])

  const value = useMemo(
    () => ({
      user,
      authLoading: loading,
      isAuthenticated: Boolean(user),
      logout: () => {
        lockSensitiveSection()
        return signOut(auth)
      },
    }),
    [user, loading],
  )

  if (loading) {
    return (
      <AuthContext.Provider value={value}>
        <div className='flex min-h-screen items-center justify-center bg-slate-50 px-6'>
          <p className='text-sm text-slate-600'>Oturum kontrol ediliyor…</p>
        </div>
      </AuthContext.Provider>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
