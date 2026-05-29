import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth'
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  getNotificationSettings,
  getRegisteredDevices,
  saveNotificationSettings,
  sendTestNotification,
} from '../services/notificationSettingsService'
import { hasConfiguredVapidEnv, hasValidVapidEnv } from '../config/webPushPublicKey'
import {
  initPushNotifications,
  isNativeApp,
  isWebPushEnvironment,
  supportsPushNotifications,
} from '../utils/pushNotifications'

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
    title: 'Cihaz kaydı (web veya iOS)',
    hint: 'Bu sayfada “Bu cihazı kaydet” veya giriş sonrası otomatik',
  },
  {
    id: 'vapid',
    title: 'Web push anahtarı (VAPID)',
    hint: 'Firebase Console → Cloud Messaging → Web Push certificates',
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
  const web = isWebPushEnvironment()
  const [settings, setSettings] = useState(DEFAULT_NOTIFICATION_SETTINGS)
  const [pushSupported, setPushSupported] = useState(null)
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
    supportsPushNotifications().then(setPushSupported)
  }, [])

  useEffect(() => {
    if (!user) return

    let cancelled = false
    setRegistering(true)
    initPushNotifications(user, {
      requestPermission: web,
      sendTestOnSuccess: web,
    })
      .then((result) => {
        if (cancelled) return
        if (result.registered) {
          setPushStatus(
            native
              ? 'Bu cihaz otomatik olarak kaydedildi.'
              : 'Bu tarayıcı kaydedildi. Test bildirimi gönderildi (oturumda bir kez).',
          )
          loadPage()
        } else if (result.reason === 'permission-default' && web) {
          setPushStatus('Bildirim izni için tarayıcı uyarısına İzin ver deyin.')
        } else if (result.reason === 'permission-denied' && web) {
          setPushStatus('Bildirim izni kapalı. Adres çubuğundaki kilit → Bildirimler → İzin ver.')
        } else if (result.reason === 'invalid-vapid-key' && web) {
          setPushStatus(
            'VAPID anahtarı hatalı. Firebase Console → Cloud Messaging → Web Push → uzun anahtar (B ile başlar, ~88 karakter). Vercel’deki eski değeri silin veya düzeltin.',
          )
        } else if (result.reason === 'registration-error' && web) {
          setPushStatus(`Kayıt hatası: ${result.detail ?? 'Bilinmeyen hata'}`)
        }
      })
      .finally(() => {
        if (!cancelled) setRegistering(false)
      })

    return () => {
      cancelled = true
    }
  }, [user, native, web, loadPage])

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
    const result = await initPushNotifications(user, {
      requestPermission: true,
      sendTestOnSuccess: web,
    })
    setRegistering(false)

    if (result.registered) {
      setPushStatus(
        web
          ? 'Kaydedildi. Test bildirimi gönderildi (oturumda bir kez).'
          : 'Bu cihaz bildirimler için kaydedildi.',
      )
      await loadPage()
      return
    }

    if (result.reason === 'unsupported') {
      setPushStatus('Bu tarayıcı web bildirimlerini desteklemiyor (Chrome veya güncel Safari deneyin).')
      return
    }

    if (result.reason === 'permission-default') {
      setPushStatus('Bildirim izni istenmedi veya reddedildi. Tekrar deneyin ve İzin ver seçin.')
      return
    }

    if (result.reason === 'permission-denied') {
      setPushStatus(
        native
          ? 'Bildirim izni verilmedi. iPhone Ayarlar → Hansaray → Bildirimler.'
          : 'Bildirim izni kapalı. Adres çubuğu → kilit → Bildirimler → İzin ver.',
      )
      return
    }

    if (result.reason === 'invalid-vapid-key') {
      setPushStatus(
        'VAPID anahtarı geçersiz. Firebase’de “Key pair” satırındaki uzun anahtarı kopyalayın (ktGl… gibi kısa değil). Vercel’de VITE_FIREBASE_VAPID_KEY güncelleyin veya silin.',
      )
      return
    }

    if (result.reason === 'registration-error') {
      setPushStatus(`Kayıt hatası: ${result.detail ?? 'Service worker veya FCM ayarını kontrol edin.'}`)
      return
    }

    setPushStatus(
      native
        ? 'Cihaz kaydı tamamlanamadı. APNs ve TestFlight kurulumunu kontrol edin.'
        : 'Kayıt tamamlanamadı. Sayfayı yenileyip tekrar deneyin.',
    )
  }

  const vapidOk = !web || hasValidVapidEnv() || !hasConfiguredVapidEnv()

  const stepDone = {
    firebase: functionsOnline === true,
    apns: devices.length > 0 || testPassed,
    vapid: vapidOk,
    device: devices.length > 0,
    test: testPassed,
  }

  return (
    <section className='space-y-4'>
      <div className='card'>
        <h2 className='text-lg font-semibold text-blue-950'>Bildirimler</h2>
        <p className='mt-1 text-sm text-slate-600'>
          Kayıtlı cihazlara (web tarayıcı veya iOS) giriş/çıkış hatırlatmaları, ödeme uyarıları ve
          günlük özetler gider.
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
            Henüz kayıtlı cihaz yok. Web’de veya iOS uygulamasında giriş yapıp bu sayfada “Bu cihazı
            kaydet”e basın.
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
            disabled={registering || pushSupported === false}
          >
            {registering ? 'Kaydediliyor...' : 'Bu cihazı kaydet'}
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
        {web && pushSupported === false ? (
          <p className='text-xs text-slate-500'>
            Bu tarayıcı web push desteklemiyor. Chrome veya Safari (güncel) ile deneyin.
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
