import { auth } from '../firebase'

export const ensureAuthReady = async () => {
  const user = auth.currentUser
  if (!user) {
    const error = new Error('Giriş gerekli')
    error.code = 'permission-denied'
    throw error
  }

  await user.getIdToken()
  return user
}

export const refreshAuthToken = async () => {
  const user = auth.currentUser
  if (!user) return false
  await user.getIdToken(true)
  return true
}

export const isPermissionDenied = (error) => error?.code === 'permission-denied'
