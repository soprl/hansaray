import { useEffect, useMemo, useState } from 'react'
import ReservationForm from '../components/ReservationForm'
import { useAuth } from '../context/useAuth'
import {
  addReservation,
  deleteReservation,
  getReservations,
  updateReservation,
} from '../services/reservationService'
import { formatCurrencyTRY, formatDateTR } from '../utils/formatters'
import { getEffectiveReservationStatus, RES_STATUS } from '../utils/reservationUtils'
const statusBadgeClass = {
  Aktif: 'bg-emerald-100 text-emerald-700',
  Tamamlandı: 'bg-slate-200 text-slate-700',
  İptal: 'bg-rose-100 text-rose-700',
}

const paymentBadgeClass = {
  Ödenmedi: 'bg-rose-100 text-rose-700',
  'Kapora Alındı': 'bg-amber-100 text-amber-700',
  'Tamamı Ödendi': 'bg-emerald-100 text-emerald-700',
}

function Reservations() {
  const { user } = useAuth()
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingReservation, setEditingReservation] = useState(null)

  const [filters, setFilters] = useState({
    search: '',
    roomName: '',
    status: 'Tümü',
  })

  const loadReservations = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getReservations()
      setReservations(data)
    } catch (fetchError) {
      setError('Rezervasyonlar yüklenirken bir hata oluştu.')
      console.error(fetchError)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    getReservations()
      .then((data) => {
        if (!cancelled) {
          setReservations(data)
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError('Rezervasyonlar yüklenirken bir hata oluştu.')
        }
        console.error(fetchError)
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const uniqueRooms = useMemo(
    () =>
      [...new Set(reservations.map((reservation) => reservation.roomName).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'tr'),
      ),
    [reservations],
  )

  const filteredReservations = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase('tr')

    return reservations.filter((reservation) => {
      const effectiveStatus = getEffectiveReservationStatus(reservation)
      const matchSearch =
        !searchTerm ||
        reservation.customerName?.toLowerCase('tr').includes(searchTerm) ||
        reservation.customerPhone?.toLowerCase('tr').includes(searchTerm)
      const matchRoom = !filters.roomName || reservation.roomName === filters.roomName
      const matchStatus = filters.status === 'Tümü' || effectiveStatus === filters.status

      return matchSearch && matchRoom && matchStatus
    })
  }, [reservations, filters])

  const handleSubmitReservation = async (formData) => {
    setSubmitting(true)
    setError('')

    try {
      const payload = {
        ...formData,
        createdBy: user?.email ?? 'unknown',
      }

      if (editingReservation?.id) {
        await updateReservation(editingReservation.id, payload)
      } else {
        await addReservation(payload)
      }

      setEditingReservation(null)
      await loadReservations()
    } catch (submitError) {
      if (submitError?.message === 'CONFLICT') {
        alert('Bu oda seçilen tarihlerde dolu')
      } else {
        alert('Rezervasyon kaydedilemedi. Lütfen tekrar deneyin.')
      }
      console.error(submitError)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelReservation = async (reservation) => {
    const confirmed = window.confirm('Rezervasyon iptal edilsin mi?')
    if (!confirmed) return

    setError('')
    try {
      await updateReservation(reservation.id, {
        ...reservation,
        reservationStatus: RES_STATUS.CANCELLED,
      })
      if (editingReservation?.id === reservation.id) {
        setEditingReservation(null)
      }
      await loadReservations()
    } catch (cancelError) {
      setError('Rezervasyon iptal edilirken bir hata oluştu.')
      console.error(cancelError)
    }
  }

  const handlePermanentDelete = async (id) => {
    const confirmed = window.confirm('Rezervasyon kalıcı olarak silinsin mi? Bu işlem geri alınamaz.')
    if (!confirmed) return

    setError('')
    try {
      await deleteReservation(id)
      if (editingReservation?.id === id) setEditingReservation(null)
      await loadReservations()
    } catch (deleteError) {
      setError('Rezervasyon kalıcı silinirken bir hata oluştu.')
      console.error(deleteError)
    }
  }

  return (
    <section className='space-y-4'>
      <ReservationForm
        key={editingReservation?.id ?? 'new'}
        initialValues={editingReservation}
        onSubmit={handleSubmitReservation}
        onCancel={() => setEditingReservation(null)}
        submitting={submitting}
      />

      <div className='card space-y-4'>
        <div className='flex flex-col gap-3 md:flex-row'>
          <input
            className='input'
            placeholder='Müşteri adı veya telefon ara...'
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
          />
          <select
            className='input'
            value={filters.roomName}
            onChange={(event) => setFilters((prev) => ({ ...prev, roomName: event.target.value }))}
          >
            <option value=''>Tüm Odalar</option>
            {uniqueRooms.map((room) => (
              <option key={room} value={room}>
                {room}
              </option>
            ))}
          </select>
          <select
            className='input'
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option>Tümü</option>
            <option>Aktif</option>
            <option>Tamamlandı</option>
            <option>İptal</option>
          </select>
        </div>

        {error ? <p className='text-sm text-rose-600'>{error}</p> : null}

        {loading ? (
          <p className='text-sm text-slate-500'>Rezervasyonlar yükleniyor...</p>
        ) : filteredReservations.length === 0 ? (
          <p className='text-sm text-slate-500'>Filtreye uygun rezervasyon yok.</p>
        ) : (
          <div className='grid gap-3'>
            {filteredReservations.map((reservation) => {
              const effectiveStatus = getEffectiveReservationStatus(reservation)

              return (
                <article key={reservation.id} className='rounded-lg border border-slate-200 p-4'>
                <div className='flex flex-col justify-between gap-3 md:flex-row md:items-start'>
                  <div className='space-y-1'>
                    <p className='text-lg font-semibold text-blue-950'>{reservation.customerName}</p>
                    <p className='text-sm text-slate-600'>
                      {reservation.roomName} - {formatDateTR(reservation.checkInDate)} /{' '}
                      {formatDateTR(reservation.checkOutDate)}
                    </p>
                    <p className='text-sm text-slate-600'>Telefon: {reservation.customerPhone || '-'}</p>
                    <div className='flex flex-wrap gap-2 pt-1'>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClass[effectiveStatus] ?? 'bg-slate-100 text-slate-700'}`}>
                        {effectiveStatus}
                      </span>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${paymentBadgeClass[reservation.paymentStatus] ?? 'bg-slate-100 text-slate-700'}`}>
                        {reservation.paymentStatus || '-'}
                      </span>
                    </div>
                  </div>
                  <div className='space-y-1 text-sm'>
                    <p className='font-medium text-slate-700'>Toplam: {formatCurrencyTRY(reservation.totalPrice)}</p>
                    <p className='text-slate-600'>Kapora: {formatCurrencyTRY(reservation.deposit)}</p>
                    <p className='text-slate-600'>Kalan: {formatCurrencyTRY(reservation.remainingPayment)}</p>
                  </div>
                </div>

                <div className='mt-3 flex gap-2'>
                  <button
                    type='button'
                    className='btn border border-slate-300 bg-white'
                    onClick={() => setEditingReservation(reservation)}
                  >
                    Düzenle
                  </button>
                  <button
                    type='button'
                    className='btn-danger'
                    onClick={() => handleCancelReservation(reservation)}
                    disabled={effectiveStatus === RES_STATUS.CANCELLED}
                  >
                    Rezervasyonu İptal Et
                  </button>
                  <button
                    type='button'
                    className='btn border border-slate-300 bg-white text-xs'
                    onClick={() => handlePermanentDelete(reservation.id)}
                  >
                    Kalıcı Sil
                  </button>
                </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

export default Reservations
