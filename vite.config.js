import { execSync } from 'node:child_process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const generateFirebaseMessagingSw = () => {
  try {
    execSync('node scripts/write-firebase-messaging-sw.mjs', { stdio: 'inherit' })
  } catch (error) {
    console.warn('firebase-messaging-sw.js oluşturulamadı', error)
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  loadEnv(mode, process.cwd(), '')
  generateFirebaseMessagingSw()

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
    },
  }
})
