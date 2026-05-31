import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import ReservationNote from '../components/ReservationNote'
import { getReservations } from '../services/reservationService'
import { formatCurrencyTRY } from '../utils/formatters'
import { getFirestoreErrorMessage } from '../utils/firestoreAuth'
import {
  findSameRoomDateConflicts,
  formatConflictDateRange,
} from '../utils/reservationConflicts'

function ConflictReservationRow({ reservation }) {
  return (
    <div className='rounded-lg border border-slate-200 bg-slate-50 p-3'>
      <p className='font-medium text-blue-950'>{reservation.customerName || 'İsimsiz'}</p>
      <p className='mt-1 text-sm text-slate-600'>
        Oda kayıtta: <span className='font-mono font-medium text-amber-900'>{reservation.roomName || '—'}</span>
      </p>
      <p className='text-sm text-slate-600'>{formatConflictDateRange(reservation)}</p>
      <p className='text-sm text-slate-600'>{formatCurrencyTRY(reservation.totalPrice)}</p>
      <ReservationNote note={reservation.note} className='mt-1 text-xs' />
      <p className='mt-2 text-[11px] text-slate-400'>Kayıt id: {reservation.id}</p>
    </div>
  )
}

function ConflictCheck() {
  const { user } = useAuth()
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [onlyDifferentNames, setOnlyDifferentNames] = useState(false)

  useEffect(() => {
    if (!user) return

    let cancelled = false
    setLoading(true)
    setError('')

    getReservations()
      .then((data) => {
        if (!cancelled) setReservations(data)
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError(getFirestoreErrorMessage(fetchError, 'Rezervasyonlar yüklenemedi.'))
        }
        console.error(fetchError)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user])

  const allConflicts = useMemo(() => findSameRoomDateConflicts(reservations), [reservations])

  const conflicts = useMemo(
    () => (onlyDifferentNames ? allConflicts.filter((item) => item.differentRawNames) : allConflicts),
    [allConflicts, onlyDifferentNames],
  )

  return (
    <section className='space-y-4'>
      <div className='card space-y-2'>
        <h2 className='text-base font-semibold text-blue-950 sm:text-lg'>Çakışma kontrolü (deneme)</h2>
        <p className='text-sm text-slate-600'>
          Sadece <strong>aktif</strong> rezervasyonlar. Aynı oda (C1 ve C/1 birleşir) ve{' '}
          <strong>tarihleri çakışan</strong> çiftler listelenir — gözle kontrol edin.
        </p>
        <label className='flex cursor-pointer items-center gap-2 text-sm text-slate-700'>
          <input
            type='checkbox'
            className='h-4 w-4 rounded border-slate-300'
            checked={onlyDifferentNames}
            onChange={(event) => setOnlyDifferentNames(event.target.checked)}
          />
          Sadece farklı yazılmış oda adları (ör. C1 + C/1)
        </label>
        <p className='text-xs text-slate-500'>
          Düzenlemek için{' '}
          <Link to='/rezervasyonlar' className='font-medium text-blue-700 hover:underline'>
            Rezervasyonlar
          </Link>{' '}
          veya Firestore.
        </p>
      </div>

      {loading ? <p className='text-sm text-slate-500'>Yükleniyor...</p> : null}
      {error ? <p className='text-sm text-rose-600'>{error}</p> : null}

      {!loading && !error ? (
        <p className='text-sm text-slate-600'>
          {conflicts.length === 0
            ? 'Çakışma bulunamadı.'
            : `${conflicts.length} çakışan çift (${allConflicts.length} toplam)`}
        </p>
      ) : null}

      <ul className='space-y-4'>
        {conflicts.map((conflict) => (
          <li key={conflict.id} className='card border-amber-200 bg-amber-50/40'>
            <div className='mb-3 flex flex-wrap items-start justify-between gap-2'>
              <div>
                <p className='text-sm font-semibold text-amber-950'>
                  Oda (normalize): {conflict.canonicalRoom}
                </p>
                {conflict.differentRawNames ? (
                  <p className='mt-0.5 text-xs font-medium text-amber-800'>
                    Farklı kayıt adları — muhtemel C1 / C/1 karışıklığı
                  </p>
                ) : null}
              </div>
              <span className='rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-950'>
                Tarih çakışması
              </span>
            </div>
            <div className='grid gap-3 sm:grid-cols-2'>
              {conflict.reservations.map((reservation) => (
                <ConflictReservationRow key={reservation.id} reservation={reservation} />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default ConflictCheck
