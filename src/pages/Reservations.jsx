import { useEffect, useMemo, useRef, useState } from 'react'
import ReservationForm from '../components/ReservationForm'
import ReservationNote from '../components/ReservationNote'
import { useAuth } from '../context/useAuth'
import {
  addReservation,
  deleteReservation,
  getReservations,
  updateReservation,
} from '../services/reservationService'
import { formatCurrencyTRY, formatDateTR } from '../utils/formatters'
import { getRoomOptions, normalizeRoomName } from '../config/rooms'
import { getFirestoreErrorMessage } from '../utils/firestoreAuth'
import {
  canMarkReservationComplete,
  getEffectiveReservationStatus,
  getOutstandingPayment,
  getStoredReservationStatus,
  isFullyPaidReservation,
  PAYMENT_STATUS,
  RES_STATUS,
  toReservationUpdateData,
} from '../utils/reservationUtils'
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

const LIST_TABS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
}

function Reservations() {
  const { user } = useAuth()
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [editingReservation, setEditingReservation] = useState(null)
  const [newReservationFormKey, setNewReservationFormKey] = useState(0)

  const [listTab, setListTab] = useState(LIST_TABS.ACTIVE)
  const formAnchorRef = useRef(null)
  const listAnchorRef = useRef(null)
  const [filters, setFilters] = useState({
    search: '',
    roomName: '',
  })

  useEffect(() => {
    if (!editingReservation) return
    formAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [editingReservation])

  const loadReservations = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getReservations()
      setReservations(data)
    } catch (fetchError) {
      setError(getFirestoreErrorMessage(fetchError, 'Rezervasyonlar yüklenirken bir hata oluştu.'))
      console.error(fetchError)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    loadReservations()
  }, [user])

  const roomOptions = useMemo(() => getRoomOptions(reservations), [reservations])

  const tabCounts = useMemo(() => {
    return reservations.reduce(
      (counts, reservation) => {
        const status = getEffectiveReservationStatus(reservation)
        if (status === RES_STATUS.CANCELLED) return counts
        if (status === RES_STATUS.COMPLETED) counts.completed += 1
        else counts.active += 1
        return counts
      },
      { active: 0, completed: 0 },
    )
  }, [reservations])

  const filteredReservations = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase('tr')
    const targetStatus =
      listTab === LIST_TABS.COMPLETED ? RES_STATUS.COMPLETED : RES_STATUS.ACTIVE

    return reservations
      .filter((reservation) => {
        const effectiveStatus = getEffectiveReservationStatus(reservation)
        const matchTab =
          listTab === LIST_TABS.COMPLETED
            ? effectiveStatus === RES_STATUS.COMPLETED
            : effectiveStatus === RES_STATUS.ACTIVE
        const matchSearch =
          !searchTerm ||
          reservation.customerName?.toLowerCase('tr').includes(searchTerm) ||
          reservation.customerPhone?.toLowerCase('tr').includes(searchTerm)
        const matchRoom =
          !filters.roomName || normalizeRoomName(reservation.roomName) === filters.roomName

        return matchTab && matchSearch && matchRoom
      })
      .sort((a, b) => {
        if (targetStatus === RES_STATUS.COMPLETED) {
          return b.checkOutDate.localeCompare(a.checkOutDate)
        }
        return a.checkInDate.localeCompare(b.checkInDate)
      })
  }, [reservations, filters, listTab])

  const handleSubmitReservation = async (formData) => {
    setSubmitting(true)
    setError('')
    setSuccessMessage('')

    try {
      const createdBy = user?.email ?? editingReservation?.createdBy ?? 'unknown'

      if (editingReservation?.id) {
        await updateReservation(
          editingReservation.id,
          buildReservationUpdatePayload(editingReservation, { ...formData, createdBy }),
        )
        setSuccessMessage('Rezervasyon güncellendi.')
      } else {
        const newId = await addReservation({ ...formData, createdBy })
        setNewReservationFormKey((key) => key + 1)
        setListTab(LIST_TABS.ACTIVE)
        setFilters((prev) => ({ ...prev, search: '', roomName: '' }))
        setSuccessMessage('Rezervasyon eklendi.')
        setReservations((prev) => {
          const nextReservation = {
            id: newId,
            ...formData,
            createdBy,
            reservationStatus: formData.reservationStatus ?? RES_STATUS.ACTIVE,
          }
          return [...prev, nextReservation].sort((a, b) =>
            (a.checkInDate || '').localeCompare(b.checkInDate || ''),
          )
        })
      }

      setEditingReservation(null)
      await loadReservations()
      listAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch (submitError) {
      if (submitError?.message === 'CONFLICT') {
        setError('Bu oda seçilen tarihlerde dolu. Başka oda veya tarih seçin.')
      } else {
        setError(
          getFirestoreErrorMessage(submitError, 'Rezervasyon kaydedilemedi. Lütfen tekrar deneyin.'),
        )
      }
      console.error(submitError)
    } finally {
      setSubmitting(false)
    }
  }

  const buildReservationUpdatePayload = (reservation, overrides = {}) => ({
    ...toReservationUpdateData(reservation),
    ...overrides,
  })

  const handleCompleteReservation = async (reservation) => {
    if (!canMarkReservationComplete(reservation)) return

    const confirmed = window.confirm('Rezervasyon tamamlandı olarak işaretlensin mi?')
    if (!confirmed) return

    setError('')
    try {
      await updateReservation(
        reservation.id,
        buildReservationUpdatePayload(reservation, { reservationStatus: RES_STATUS.COMPLETED }),
      )
      setReservations((prev) =>
        prev.map((item) =>
          item.id === reservation.id
            ? { ...item, reservationStatus: RES_STATUS.COMPLETED }
            : item,
        ),
      )
      if (editingReservation?.id === reservation.id) {
        setEditingReservation(null)
      }
      setListTab(LIST_TABS.COMPLETED)
    } catch (completeError) {
      setError(
        getFirestoreErrorMessage(completeError, 'Rezervasyon tamamlanırken bir hata oluştu.'),
      )
      console.error(completeError)
      await loadReservations()
    }
  }

  const handleMarkFullyPaid = async (reservation) => {
    const totalPrice = Number(reservation.totalPrice) || 0

    setError('')
    try {
      await updateReservation(
        reservation.id,
        buildReservationUpdatePayload(reservation, {
          paymentStatus: PAYMENT_STATUS.PAID,
          deposit: totalPrice,
        }),
      )
      if (editingReservation?.id === reservation.id) {
        setEditingReservation(null)
      }
      await loadReservations()
    } catch (paymentError) {
      setError('Ödeme durumu güncellenirken bir hata oluştu.')
      console.error(paymentError)
    }
  }

  const handleCancelReservation = async (reservation) => {
    const confirmed = window.confirm('Rezervasyon iptal edilsin mi?')
    if (!confirmed) return

    setError('')
    try {
      await updateReservation(
        reservation.id,
        buildReservationUpdatePayload(reservation, { reservationStatus: RES_STATUS.CANCELLED }),
      )
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
      <div ref={formAnchorRef} className='scroll-mt-4'>
        {successMessage ? (
          <p className='mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800'>
            {successMessage}
          </p>
        ) : null}
        {error ? (
          <p className='mb-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700'>
            {error}
          </p>
        ) : null}
        <ReservationForm
          key={editingReservation?.id ?? `new-${newReservationFormKey}`}
          initialValues={editingReservation}
          onSubmit={handleSubmitReservation}
          onCancel={() => setEditingReservation(null)}
          submitting={submitting}
          reservations={reservations}
          reservationsLoading={loading}
          excludeId={editingReservation?.id}
          relaxedEdit={listTab === LIST_TABS.COMPLETED}
        />
      </div>

      <div ref={listAnchorRef} className='card scroll-mt-4 space-y-4'>
        <div className='flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1'>
          <button
            type='button'
            onClick={() => setListTab(LIST_TABS.ACTIVE)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
              listTab === LIST_TABS.ACTIVE
                ? 'bg-white text-blue-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Aktif ve yaklaşan
            <span className='ml-1.5 text-xs text-slate-500'>({tabCounts.active})</span>
          </button>
          <button
            type='button'
            onClick={() => setListTab(LIST_TABS.COMPLETED)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
              listTab === LIST_TABS.COMPLETED
                ? 'bg-white text-blue-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tamamlanan
            <span className='ml-1.5 text-xs text-slate-500'>({tabCounts.completed})</span>
          </button>
        </div>

        <div className='flex flex-col gap-3 sm:flex-row'>
          <input
            className='input'
            placeholder='Müşteri adı veya telefon ara...'
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
          />
          <select
            className='input sm:max-w-xs'
            value={filters.roomName}
            onChange={(event) => setFilters((prev) => ({ ...prev, roomName: event.target.value }))}
          >
            <option value=''>Tüm Odalar</option>
            {roomOptions.map((room) => (
              <option key={room} value={room}>
                {room}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className='text-sm text-slate-500'>Rezervasyonlar yükleniyor...</p>
        ) : filteredReservations.length === 0 ? (
          <p className='text-sm text-slate-500'>
            {listTab === LIST_TABS.COMPLETED
              ? 'Tamamlanan rezervasyon yok.'
              : 'Aktif veya yaklaşan rezervasyon yok.'}
          </p>
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
                      {normalizeRoomName(reservation.roomName)} - {formatDateTR(reservation.checkInDate)} /{' '}
                      {formatDateTR(reservation.checkOutDate)}
                    </p>
                    <p className='text-sm text-slate-600'>Telefon: {reservation.customerPhone || '-'}</p>
                    <ReservationNote note={reservation.note} className='mt-1' />
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
                    {isFullyPaidReservation(reservation) ? (
                      <p className='text-emerald-700'>Ödeme tamam</p>
                    ) : (
                      <p className='text-slate-600'>Kalan: {formatCurrencyTRY(getOutstandingPayment(reservation))}</p>
                    )}
                  </div>
                </div>

                <div className='mt-3 flex flex-wrap gap-2'>
                  <button
                    type='button'
                    className='btn border border-slate-300 bg-white'
                    onClick={() => setEditingReservation(reservation)}
                  >
                    Düzenle
                  </button>
                  {reservation.paymentStatus !== PAYMENT_STATUS.PAID ? (
                    <button
                      type='button'
                      className='btn border border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      onClick={() => handleMarkFullyPaid(reservation)}
                    >
                      Tamamı Ödendi
                    </button>
                  ) : null}
                  {canMarkReservationComplete(reservation) ? (
                    <button
                      type='button'
                      className='btn-success'
                      onClick={() => handleCompleteReservation(reservation)}
                    >
                      Tamamlandı
                    </button>
                  ) : null}
                  {getStoredReservationStatus(reservation) !== RES_STATUS.CANCELLED ? (
                    <button
                      type='button'
                      className='btn-danger'
                      onClick={() => handleCancelReservation(reservation)}
                      disabled={effectiveStatus === RES_STATUS.CANCELLED}
                    >
                      Rezervasyonu İptal Et
                    </button>
                  ) : null}
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
