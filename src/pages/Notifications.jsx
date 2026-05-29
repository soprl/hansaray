import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  getNotificationSettings,
  saveNotificationSettings,
  sendTestNotification,
} from '../services/notificationSettingsService'

function Notifications() {
  const [settings, setSettings] = useState(DEFAULT_NOTIFICATION_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadPage = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const settingsData = await getNotificationSettings()
      setSettings(settingsData)
    } catch (loadError) {
      setError('Bildirim ayarları yüklenemedi.')
      console.error(loadError)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPage()
  }, [loadPage])

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setSettings((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSave = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')

    try {
      await saveNotificationSettings(settings)
      setMessage('Ayarlar kaydedildi.')
    } catch (saveError) {
      setError('Ayarlar kaydedilemedi.')
      console.error(saveError)
    } finally {
      setSaving(false)
    }
  }

  const handleTestNotification = async () => {
    setTesting(true)
    setMessage('')
    setError('')

    try {
      const result = await sendTestNotification()
      const count = result?.successCount ?? 0
      setMessage(
        count > 0
          ? (result?.message ?? `Test bildirimi gönderildi (${count} alıcı).`)
          : 'Bildirim gönderilemedi. Giriş yapıp tarayıcıda bildirim iznini verin, ardından tekrar deneyin.',
      )
    } catch (testError) {
      const code = testError?.code ?? ''
      if (code === 'functions/not-found' || code === 'functions/unavailable') {
        setError('Bildirim sunucusu henüz yayında değil. NOTIFICATIONS_SETUP.md')
      } else {
        setError(testError?.message ?? 'Test bildirimi gönderilemedi.')
      }
      console.error(testError)
    } finally {
      setTesting(false)
    }
  }

  return (
    <section className='space-y-4'>
      <div className='card'>
        <h2 className='text-lg font-semibold text-blue-950'>Bildirimler</h2>
        <p className='mt-1 text-sm text-slate-600'>
          Giriş yaptığınızda tarayıcı veya telefon bildirim izni isteyebilir. Hangi hatırlatmaların
          gideceğini buradan seçersiniz.
        </p>
        <button
          type='button'
          className='btn-success mt-3'
          onClick={handleTestNotification}
          disabled={testing || loading}
        >
          {testing ? 'Gönderiliyor...' : 'Test bildirimi gönder'}
        </button>
      </div>

      <form onSubmit={handleSave} className='card space-y-4'>
        <h3 className='font-semibold text-blue-950'>Bildirim ayarları</h3>

        <label className='flex items-center gap-2 text-sm'>
          <input type='checkbox' name='enabled' checked={settings.enabled} onChange={handleChange} />
          Bildirimler açık
        </label>

        <div className='space-y-2 rounded-lg border border-slate-200 p-3'>
          <p className='text-sm font-medium text-slate-800'>Giriş / çıkış</p>
          <label className='flex items-center gap-2 text-sm'>
            <input
              type='checkbox'
              name='dayBeforeEnabled'
              checked={settings.dayBeforeEnabled}
              onChange={handleChange}
              disabled={!settings.enabled}
            />
            1 gün önce hatırlat
          </label>
          <label className='flex items-center gap-2 text-sm'>
            <input
              type='checkbox'
              name='sameDayEnabled'
              checked={settings.sameDayEnabled}
              onChange={handleChange}
              disabled={!settings.enabled}
            />
            Aynı gün giriş / çıkış hatırlat
          </label>
          <label className='flex items-center gap-2 text-sm'>
            <input
              type='checkbox'
              name='sameDayTurnoverEnabled'
              checked={settings.sameDayTurnoverEnabled}
              onChange={handleChange}
              disabled={!settings.enabled}
            />
            Aynı gün oda değişimi (giriş + çıkış aynı odada)
          </label>
          <div>
            <label className='mb-1 block text-xs font-medium text-slate-600'>Giriş/çıkış saati</label>
            <input
              type='time'
              name='sameDayTime'
              value={settings.sameDayTime}
              onChange={handleChange}
              className='input max-w-xs'
              disabled={!settings.enabled}
            />
          </div>
          <div className='flex flex-wrap gap-4'>
            <label className='flex items-center gap-2 text-sm'>
              <input
                type='checkbox'
                name='notifyCheckIn'
                checked={settings.notifyCheckIn}
                onChange={handleChange}
                disabled={!settings.enabled}
              />
              Giriş
            </label>
            <label className='flex items-center gap-2 text-sm'>
              <input
                type='checkbox'
                name='notifyCheckOut'
                checked={settings.notifyCheckOut}
                onChange={handleChange}
                disabled={!settings.enabled}
              />
              Çıkış
            </label>
          </div>
        </div>

        <div className='space-y-2 rounded-lg border border-slate-200 p-3'>
          <p className='text-sm font-medium text-slate-800'>Ödeme</p>
          <label className='flex items-center gap-2 text-sm'>
            <input
              type='checkbox'
              name='paymentPendingEnabled'
              checked={settings.paymentPendingEnabled}
              onChange={handleChange}
              disabled={!settings.enabled}
            />
            Ödeme bekliyor (sabah, bugün ve yarın girişler)
          </label>
          <label className='flex items-center gap-2 text-sm'>
            <input
              type='checkbox'
              name='depositRemainingEnabled'
              checked={settings.depositRemainingEnabled}
              onChange={handleChange}
              disabled={!settings.enabled}
            />
            Kapora alındı — kalan tutar (anında)
          </label>
        </div>

        <div className='space-y-2 rounded-lg border border-slate-200 p-3'>
          <p className='text-sm font-medium text-slate-800'>Anlık</p>
          <label className='flex items-center gap-2 text-sm'>
            <input
              type='checkbox'
              name='newReservationEnabled'
              checked={settings.newReservationEnabled}
              onChange={handleChange}
              disabled={!settings.enabled}
            />
            Yeni rezervasyon eklendi
          </label>
        </div>

        <div className='space-y-2 rounded-lg border border-slate-200 p-3'>
          <p className='text-sm font-medium text-slate-800'>Günlük özet</p>
          <label className='flex items-center gap-2 text-sm'>
            <input
              type='checkbox'
              name='morningSummaryEnabled'
              checked={settings.morningSummaryEnabled}
              onChange={handleChange}
              disabled={!settings.enabled}
            />
            Sabah özeti
          </label>
          <input
            type='time'
            name='morningSummaryTime'
            value={settings.morningSummaryTime}
            onChange={handleChange}
            className='input max-w-xs'
            disabled={!settings.enabled || !settings.morningSummaryEnabled}
          />
          <label className='flex items-center gap-2 text-sm'>
            <input
              type='checkbox'
              name='eveningSummaryEnabled'
              checked={settings.eveningSummaryEnabled}
              onChange={handleChange}
              disabled={!settings.enabled}
            />
            Akşam özeti (yarın için)
          </label>
          <input
            type='time'
            name='eveningSummaryTime'
            value={settings.eveningSummaryTime}
            onChange={handleChange}
            className='input max-w-xs'
            disabled={!settings.enabled || !settings.eveningSummaryEnabled}
          />
          <p className='text-xs text-slate-500'>Tüm saatler Türkiye (Europe/Istanbul)</p>
        </div>

        {error ? <p className='text-sm text-rose-600'>{error}</p> : null}
        {message ? <p className='text-sm text-emerald-700'>{message}</p> : null}

        <button type='submit' className='btn-success' disabled={saving || loading}>
          {saving ? 'Kaydediliyor...' : 'Ayarları kaydet'}
        </button>
      </form>
    </section>
  )
}

export default Notifications
