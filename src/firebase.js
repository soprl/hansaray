import { initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key)

if (missingKeys.length > 0) {
  console.error('Firebase yapılandırması eksik:', missingKeys.join(', '))
}

export const firebaseProjectId = firebaseConfig.projectId

export const firebaseApp = initializeApp(firebaseConfig)

/** Mobilde (özellikle iOS Safari) oturum kalsın: IndexedDB + localStorage */
function createAuth() {
  try {
    return initializeAuth(firebaseApp, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    })
  } catch (error) {
    if (error?.code === 'auth/already-initialized') {
      return getAuth(firebaseApp)
    }
    throw error
  }
}

export const auth = createAuth()
export const db = getFirestore(firebaseApp)
