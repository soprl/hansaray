import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { AuthContext } from './authContextValue'
import { auth } from '../firebase'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })

    return () => unsub()
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      logout: () => signOut(auth),
    }),
    [user],
  )

  return <AuthContext.Provider value={value}>{loading ? null : children}</AuthContext.Provider>
}
