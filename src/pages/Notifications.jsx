import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth'
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  getNotificationSettings,
  getRegisteredDevices,
  saveNotificationSettings,
  sendTestNotification,
} from '../services/notificationSettingsService'
import { initNativePush, isNativeApp } from '../utils/nativePush'

const SETUP_STEPS = [
  {
    id: 'firebase',
    title: 'Firebase Functions yayında',
    hint: 'Mac’te: npm run mobile:firebase (NOTIFICATIONS_SETUP.md)',
  },
  {
    id: 'apns',
    title: 'Apple APNs anahtarı (Firebase Console)',
    hint: 'Cloud Messaging → Apple → .p8 dosyası, bundle: com.hansaray.otel',
  },
  {
    id: 'device',
    title: 'iOS uygulamasında cihaz kaydı',
    hint: 'TestFlight uygulaması, giriş, bildirim izni',
  },
  {
    id: 'test',
    title: 'Test bildirimi başarılı',
    hint: 'Aşağıdaki “Test bildirimi gönder” butonu',
  },
]

function Notifications() {
  const { user } = useAuth()
  const native = isNativeApp()
  const [settings, setSettings] = useState(DEFAULT_NOTIFICATION_SETTINGS)
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [pushStatus, setPushStatus] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [testPassed, setTestPassed] = useState(false)
  const [functionsOnline, setFunctionsOnline] = useState(null)

  const loadPage = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [settingsData, deviceList] = await Promise.all([
        getNotificationSettings(),
        getRegisteredDevices(),
      ])
      setSettings(settingsData)
      setDevices(deviceList)
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

  useEffect(() => {
    if (!user || !native) return

    let cancelled = false
    setRegistering(true)
    initNativePush(user)
      .then((result) => {
        if (cancelled) return
        if (result.registered) {
          setPushStatus('Bu cihaz otomatik olarak kaydedildi.')
          loadPage()
        }
      })
      .finally(() => {
        if (!cancelled) setRegistering(false)
      })

    return () => {
      cancelled = true
    }
  }, [user, native, loadPage])

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
      setFunctionsOnline(true)
      setTestPassed((result?.successCount ?? 0) > 0)
      setMessage(
        result?.message ??
          `Test bildirimi gönderildi (${result?.successCount ?? 0} cihaz).`,
      )
    } catch (testError) {
      const code = testError?.code ?? ''
      setTestPassed(false)
      if (code === 'functions/not-found' || code === 'functions/unavailable') {
        setFunctionsOnline(false)
        setError(
          'Cloud Function henüz yayında değil. NOTIFICATIONS_SETUP.md — npm run mobile:firebase',
        )
      } else {
        setError(testError?.message ?? 'Test bildirimi gönderilemedi.')
      }
      console.error(testError)
    } finally {
      setTesting(false)
    }
  }

  const handleRegisterThisDevice = async () => {
    setPushStatus('')
    setError('')
    setRegistering(true)
    const result = await initNativePush(user)
    setRegistering(false)

    if (result.registered) {
      setPushStatus('Bu cihaz bildirimler için kaydedildi.')
      await loadPage()
      return
    }

    if (result.reason === 'not-native') {
      setPushStatus(
        'Web tarayıcısında push kaydı yok. iOS uygulamasını (TestFlight) kullanın.',
      )
      return
    }

    if (result.reason === 'permission-denied') {
      setPushStatus('Bildirim izni verilmedi. iPhone Ayarlar → Hansaray → Bildirimler.')
      return
    }

    setPushStatus('Cihaz kaydı tamamlanamadı. APNs ve TestFlight kurulumunu kontrol edin.')
  }

  const stepDone = {
    firebase: functionsOnline === true,
    apns: devices.length > 0 || testPassed,
    device: devices.length > 0,
    test: testPassed,
  }

  return (
    <section className='space-y-4'>
      <div className='card'>
        <h2 className='text-lg font-semibold text-blue-950'>Bildirimler</h2>
        <p className='mt-1 text-sm text-slate-600'>
          Kayıtlı telefonlara giriş/çıkış hatırlatmaları, ödeme uyarıları ve günlük özetler gider.
        </p>
      </div>

      <div className='card space-y-3'>
        <h3 className='font-semibold text-blue-950'>Canlıya alma kontrol listesi</h3>
        <p className='text-xs text-slate-500'>
          Ayrıntılı adımlar: proje kökünde <strong>NOTIFICATIONS_SETUP.md</strong>
        </p>
        <ol className='space-y-2'>
          {SETUP_STEPS.map((step, index) => {
            const done = stepDone[step.id]
            return (
              <li
                key={step.id}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  done ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <p className='font-medium text-slate-800'>
                  {done ? '✓' : `${index + 1}.`} {step.title}
                </p>
                <p className='text-xs text-slate-500'>{step.hint}</p>
              </li>
            )
          })}
        </ol>
        {functionsOnline === false ? (
          <p className='text-sm font-medium text-rose-600'>
            Functions deploy edilmemiş görünüyor. Terminalde: npm run mobile:firebase
          </p>
        ) : null}
      </div>

      <div className='card space-y-4'>
        <h3 className='font-semibold text-blue-950'>Kayıtlı cihazlar</h3>
        {loading ? (
          <p className='text-sm text-slate-500'>Yükleniyor...</p>
        ) : devices.length === 0 ? (
          <p className='text-sm text-slate-500'>
            Henüz kayıtlı telefon yok. TestFlight uygulamasında giriş yapın; bu sayfayı açınca cihaz
            otomatik kayıt olur.
          </p>
        ) : (
          <ul className='space-y-2'>
            {devices.map((device) => (
              <li
                key={device.id}
                className='rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700'
              >
                <p className='font-medium'>{device.email || device.userId}</p>
                <p className='text-xs text-slate-500'>
                  {device.platform} ·{' '}
                  {device.updatedAt?.toDate
                    ? device.updatedAt.toDate().toLocaleString('tr-TR')
                    : '—'}
                </p>
              </li>
            ))}
          </ul>
        )}

        <div className='flex flex-wrap gap-2'>
          <button
            type='button'
            className='btn border border-slate-300 bg-white'
            onClick={handleRegisterThisDevice}
            disabled={!native || registering}
          >
            {registering ? 'Kaydediliyor...' : 'Bu cihazı yeniden kaydet'}
          </button>
          <button
            type='button'
            className='btn-success'
            onClick={handleTestNotification}
            disabled={testing || devices.length === 0}
          >
            {testing ? 'Gönderiliyor...' : 'Test bildirimi gönder'}
          </button>
        </div>

        {pushStatus ? <p className='text-sm text-slate-600'>{pushStatus}</p> : null}
        {!native ? (
          <p className='text-xs text-slate-500'>
            Şu an web sürümündesiniz. Push için iOS uygulamasını (TestFlight) kullanın; mobil menüde
            Bildirim sekmesi görünür.
          </p>
        ) : null}
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
