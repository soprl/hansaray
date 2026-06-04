import { useState } from 'react'
import { FiLock } from 'react-icons/fi'
import {
  isSensitivePinConfigured,
  isSensitiveSectionUnlocked,
  unlockSensitiveSection,
  verifySensitivePin,
} from '../utils/sensitivePin'

function SensitivePinGate({ title, description, children }) {
  const [unlocked, setUnlocked] = useState(() => isSensitiveSectionUnlocked())
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const pinConfigured = isSensitivePinConfigured()

  const handleSubmit = (event) => {
    event.preventDefault()
    setError('')

    const result = verifySensitivePin(pin)
    if (result.reason === 'missing_config') {
      setError('PIN henüz yapılandırılmamış. Vercel ortam değişkenine VITE_SENSITIVE_SECTION_PIN ekleyin.')
      return
    }
    if (!result.ok) {
      setError('PIN hatalı.')
      return
    }

    unlockSensitiveSection()
    setUnlocked(true)
    setPin('')
  }

  if (unlocked) return children

  return (
    <section className='mx-auto flex min-h-[50vh] max-w-md flex-col justify-center py-8'>
      <div className='card space-y-4'>
        <div className='flex items-center gap-3'>
          <span className='flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-800'>
            <FiLock className='h-5 w-5' aria-hidden />
          </span>
          <div>
            <h2 className='text-lg font-semibold text-blue-950'>{title}</h2>
            <p className='text-sm text-slate-600'>{description}</p>
          </div>
        </div>

        {!pinConfigured ? (
          <p className='rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900'>
            Bu bölüm için PIN tanımlı değil. Yönetici{' '}
            <code className='text-xs'>VITE_SENSITIVE_SECTION_PIN</code> değişkenini ayarlamalı.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className='space-y-3'>
            <div>
              <label htmlFor='sensitive-pin' className='mb-1 block text-sm font-medium text-slate-700'>
                PIN
              </label>
              <input
                id='sensitive-pin'
                type='password'
                inputMode='numeric'
                autoComplete='off'
                className='input'
                placeholder='PIN girin'
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                autoFocus
              />
            </div>
            {error ? <p className='text-sm text-rose-600'>{error}</p> : null}
            <button type='submit' className='btn-success w-full'>
              Devam et
            </button>
          </form>
        )}

        <p className='text-xs text-slate-500'>
          Tarayıcıyı kapattığınızda PIN tekrar istenir. Ana giriş (e-posta) ayrıdır.
        </p>
      </div>
    </section>
  )
}

export default SensitivePinGate
