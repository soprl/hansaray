import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { useEffect, useMemo, useState } from 'react'
import ReservationForm from '../components/ReservationForm'
import { useAuth } from '../context/useAuth'
import {
  addReservation,
  deleteReservation,
  getReservations,
  updateReservation,
} from '../services/reservationService'

const formatCurrency = (value) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(value) || 0)

const formatDate = (value) => {
  if (!value) return '-'
  try {
    return format(parseISO(value), 'dd.MM.yyyy', { locale: tr })
  } catch {
    return '-'
  }
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
      const matchSearch =
        !searchTerm ||
        reservation.customerName?.toLowerCase('tr').includes(searchTerm) ||
        reservation.customerPhone?.toLowerCase('tr').includes(searchTerm)
      const matchRoom = !filters.roomName || reservation.roomName === filters.roomName
      const matchStatus = filters.status === 'Tümü' || reservation.reservationStatus === filters.status

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

  const handleDelete = async (id) => {
    const confirmed = window.confirm('Bu rezervasyon silinsin mi?')
    if (!confirmed) return

    setError('')
    try {
      await deleteReservation(id)
      if (editingReservation?.id === id) {
        setEditingReservation(null)
      }
      await loadReservations()
    } catch (deleteError) {
      setError('Rezervasyon silinirken bir hata oluştu.')
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
            {filteredReservations.map((reservation) => (
              <article key={reservation.id} className='rounded-lg border border-slate-200 p-4'>
                <div className='flex flex-col justify-between gap-3 md:flex-row md:items-start'>
                  <div className='space-y-1'>
                    <p className='text-lg font-semibold text-blue-950'>{reservation.customerName}</p>
                    <p className='text-sm text-slate-600'>
                      {reservation.roomName} - {formatDate(reservation.checkInDate)} /{' '}
                      {formatDate(reservation.checkOutDate)}
                    </p>
                    <p className='text-sm text-slate-600'>Telefon: {reservation.customerPhone || '-'}</p>
                  </div>
                  <div className='space-y-1 text-sm'>
                    <p className='font-medium text-slate-700'>Toplam: {formatCurrency(reservation.totalPrice)}</p>
                    <p className='text-slate-600'>Kapora: {formatCurrency(reservation.deposit)}</p>
                    <p className='text-slate-600'>Kalan: {formatCurrency(reservation.remainingPayment)}</p>
                    <p className='text-slate-600'>Durum: {reservation.reservationStatus}</p>
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
                  <button type='button' className='btn-danger' onClick={() => handleDelete(reservation.id)}>
                    Sil
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default Reservations
