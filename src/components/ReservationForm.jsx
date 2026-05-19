import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { useEffect, useMemo, useRef, useState } from 'react'
import DatePickerField from './DatePickerField'
import { getRoomOptions, isVipRoom, normalizeRoomName } from '../config/rooms'
import { formatDateTR } from '../utils/formatters'
import {
  derivePaymentStatus,
  findConflictingReservation,
  getRoomAvailabilityList,
  PAYMENT_STATUS,
} from '../utils/reservationUtils'

const DEFAULT_FORM = {
  customerName: '',
  customerPhone: '',
  roomName: '',
  checkInDate: '',
  checkOutDate: '',
  totalPrice: '',
  deposit: '',
  paymentStatus: 'Ödenmedi',
  reservationStatus: 'Aktif',
  note: '',
}

const NIGHT_PRESETS = [1, 2, 3, 7]

const sanitizeMoneyInput = (value) => {
  if (!value) return ''
  let cleaned = value.replace(/[^\d.,]/g, '')
  const separatorIndex = cleaned.search(/[.,]/)
  if (separatorIndex === -1) return cleaned

  const whole = cleaned.slice(0, separatorIndex)
  const fraction = cleaned.slice(separatorIndex + 1).replace(/[.,]/g, '')
  return fraction ? `${whole}.${fraction}` : whole
}

function ReservationForm({
  initialValues,
  onSubmit,
  onCancel,
  submitting,
  reservations = [],
  excludeId,
}) {
  const isEditing = Boolean(initialValues)

  const [form, setForm] = useState(() => {
    if (!initialValues) return DEFAULT_FORM
    const merged = {
      ...DEFAULT_FORM,
      ...initialValues,
      roomName: normalizeRoomName(initialValues.roomName),
    }
    return {
      ...merged,
      paymentStatus: derivePaymentStatus(merged.totalPrice, merged.deposit),
    }
  })
  const [errors, setErrors] = useState({})
  const [vipManuallySelected, setVipManuallySelected] = useState(
    () => Boolean(initialValues && isVipRoom(initialValues.roomName)),
  )
  const lastAutoPickDatesRef = useRef({
    checkIn: initialValues?.checkInDate ?? '',
    checkOut: initialValues?.checkOutDate ?? '',
  })

  const remainingPayment = useMemo(() => {
    const totalPrice = Number(form.totalPrice) || 0
    const deposit = Number(form.deposit) || 0
    return totalPrice - deposit
  }, [form.totalPrice, form.deposit])

  const datesValid =
    form.checkInDate && form.checkOutDate && form.checkOutDate > form.checkInDate

  const roomOptions = useMemo(() => getRoomOptions(reservations), [reservations])

  const nightCount = useMemo(() => {
    if (!datesValid) return 0
    return differenceInCalendarDays(parseISO(form.checkOutDate), parseISO(form.checkInDate))
  }, [form.checkInDate, form.checkOutDate, datesValid])

  const roomAvailabilityList = useMemo(() => {
    if (!datesValid) return []
    return getRoomAvailabilityList(reservations, {
      checkInDate: form.checkInDate,
      checkOutDate: form.checkOutDate,
      excludeId,
      roomNames: roomOptions,
    })
  }, [reservations, roomOptions, form.checkInDate, form.checkOutDate, excludeId, datesValid])

  const selectedRoomConflict = useMemo(() => {
    if (!datesValid || !form.roomName) return null
    return findConflictingReservation(reservations, {
      roomName: form.roomName,
      checkInDate: form.checkInDate,
      checkOutDate: form.checkOutDate,
      excludeId,
    })
  }, [reservations, form.roomName, form.checkInDate, form.checkOutDate, excludeId, datesValid])

  const availableRooms = useMemo(
    () => roomAvailabilityList.filter((room) => room.available),
    [roomAvailabilityList],
  )

  const autoPickableRooms = useMemo(
    () => availableRooms.filter((room) => !isVipRoom(room.roomName)),
    [availableRooms],
  )

  const allRoomsFull = datesValid && roomAvailabilityList.length > 0 && availableRooms.length === 0

  useEffect(() => {
    if (!datesValid || roomAvailabilityList.length === 0) return

    if (availableRooms.length === 0) {
      setVipManuallySelected(false)
      setForm((prev) => (prev.roomName ? { ...prev, roomName: '' } : prev))
      return
    }

    const datesChanged =
      form.checkInDate !== lastAutoPickDatesRef.current.checkIn ||
      form.checkOutDate !== lastAutoPickDatesRef.current.checkOut

    const currentStillAvailable = availableRooms.some((room) => room.roomName === form.roomName)
    const vipHeldByUser =
      vipManuallySelected && form.roomName && isVipRoom(form.roomName) && currentStillAvailable

    if (vipHeldByUser && !datesChanged) {
      lastAutoPickDatesRef.current = {
        checkIn: form.checkInDate,
        checkOut: form.checkOutDate,
      }
      return
    }

    const needsAutoPick =
      datesChanged ||
      !form.roomName ||
      !currentStillAvailable ||
      (form.roomName && isVipRoom(form.roomName) && !vipManuallySelected)

    if (!needsAutoPick) return

    setVipManuallySelected(false)

    if (autoPickableRooms.length === 0) {
      setForm((prev) => (prev.roomName ? { ...prev, roomName: '' } : prev))
      lastAutoPickDatesRef.current = {
        checkIn: form.checkInDate,
        checkOut: form.checkOutDate,
      }
      return
    }

    const picked = autoPickableRooms[Math.floor(Math.random() * autoPickableRooms.length)]
    if (isVipRoom(picked.roomName)) return

    lastAutoPickDatesRef.current = {
      checkIn: form.checkInDate,
      checkOut: form.checkOutDate,
    }
    setForm((prev) => ({ ...prev, roomName: picked.roomName }))
  }, [
    datesValid,
    form.checkInDate,
    form.checkOutDate,
    form.roomName,
    roomAvailabilityList,
    availableRooms,
    autoPickableRooms,
    vipManuallySelected,
  ])

  const getRoomStatusLabel = (roomName, available) => {
    if (isVipRoom(roomName)) {
      return available ? 'Müsait · VIP boş' : 'Dolu · Bu tarihlerde VIP dolu'
    }
    return available ? 'Müsait' : 'Dolu'
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    const nextValue = name === 'totalPrice' || name === 'deposit' ? sanitizeMoneyInput(value) : value

    setForm((prev) => {
      const next = { ...prev, [name]: nextValue }
      if (name === 'totalPrice' || name === 'deposit') {
        next.paymentStatus = derivePaymentStatus(
          name === 'totalPrice' ? nextValue : prev.totalPrice,
          name === 'deposit' ? nextValue : prev.deposit,
        )
      }
      return next
    })
  }

  const setCheckIn = (checkInDate) => {
    setForm((prev) => {
      const next = { ...prev, checkInDate }
      if (prev.checkOutDate && checkInDate && prev.checkOutDate <= checkInDate) {
        next.checkOutDate = ''
      }
      return next
    })
  }

  const applyNightPreset = (nights) => {
    if (!form.checkInDate) return
    const checkOutDate = format(addDays(parseISO(form.checkInDate), nights), 'yyyy-MM-dd')
    setForm((prev) => ({ ...prev, checkOutDate }))
  }

  const selectRoom = (roomName) => {
    if (isVipRoom(roomName)) {
      setVipManuallySelected(true)
    } else {
      setVipManuallySelected(false)
    }
    setForm((prev) => ({ ...prev, roomName }))
  }

  const isRoomSelected = (roomName) => {
    if (form.roomName !== roomName) return false
    if (isVipRoom(roomName)) return vipManuallySelected
    return true
  }

  const markFullyPaid = () => {
    const total = Number(form.totalPrice) || 0
    if (total <= 0) return

    setForm((prev) => ({
      ...prev,
      deposit: String(total),
      paymentStatus: PAYMENT_STATUS.PAID,
    }))
  }

  const canMarkFullyPaid =
    form.paymentStatus !== PAYMENT_STATUS.PAID && (Number(form.totalPrice) || 0) > 0

  const validate = () => {
    const nextErrors = {}
    const totalPrice = Number(form.totalPrice)
    const deposit = Number(form.deposit)

    if (!form.checkInDate) nextErrors.checkInDate = 'Giriş tarihi zorunludur.'
    if (!form.checkOutDate) nextErrors.checkOutDate = 'Çıkış tarihi zorunludur.'
    if (allRoomsFull) {
      nextErrors.roomName = 'Bu tarihlerde tüm odalar dolu.'
    } else if (!form.roomName) {
      nextErrors.roomName = 'Oda seçin.'
    }
    if (!form.customerName.trim()) nextErrors.customerName = 'Müşteri adı zorunludur.'
    if (!form.customerPhone.trim()) nextErrors.customerPhone = 'Telefon zorunludur.'

    if (!Number.isFinite(totalPrice) || totalPrice < 0) {
      nextErrors.totalPrice = 'Toplam ücret 0 veya daha büyük olmalıdır.'
    }

    if (!Number.isFinite(deposit) || deposit < 0) {
      nextErrors.deposit = 'Kapora 0 veya daha büyük olmalıdır.'
    }

    if (Number.isFinite(totalPrice) && Number.isFinite(deposit) && deposit > totalPrice) {
      nextErrors.deposit = 'Kapora toplam ücretten büyük olamaz.'
    }

    if (form.checkInDate && form.checkOutDate && form.checkOutDate <= form.checkInDate) {
      nextErrors.checkOutDate = 'Çıkış tarihi giriş tarihinden sonra olmalıdır.'
    }

    if (selectedRoomConflict) {
      nextErrors.roomName = 'Seçilen oda bu tarihlerde dolu.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validate()) return

    await onSubmit({
      ...form,
      roomName: normalizeRoomName(form.roomName),
      totalPrice: Number(form.totalPrice) || 0,
      deposit: Number(form.deposit) || 0,
      remainingPayment,
    })
  }

  return (
    <section className='card'>
      <h2 className='text-lg font-semibold text-blue-950'>
        {isEditing ? 'Rezervasyon Düzenle' : 'Yeni Rezervasyon'}
      </h2>

      <form onSubmit={handleSubmit} className='mt-4 space-y-6'>
        <fieldset className='space-y-3'>
          <legend className='text-sm font-semibold text-slate-800'>1. Tarihler</legend>
          <div className='grid gap-4 sm:grid-cols-2'>
            <DatePickerField
              label='Giriş'
              value={form.checkInDate}
              onChange={setCheckIn}
              error={errors.checkInDate}
              placeholder='Giriş tarihi seçin'
            />
            <DatePickerField
              label='Çıkış'
              value={form.checkOutDate}
              onChange={(checkOutDate) => setForm((prev) => ({ ...prev, checkOutDate }))}
              minDate={
                form.checkInDate
                  ? format(addDays(parseISO(form.checkInDate), 1), 'yyyy-MM-dd')
                  : undefined
              }
              disabled={!form.checkInDate}
              error={errors.checkOutDate}
              placeholder='Çıkış tarihi seçin'
            />
          </div>

          {form.checkInDate ? (
            <div className='flex flex-wrap items-center gap-2'>
              <span className='text-xs text-slate-500'>Hızlı seçim:</span>
              {NIGHT_PRESETS.map((nights) => (
                <button
                  key={nights}
                  type='button'
                  onClick={() => applyNightPreset(nights)}
                  className='rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                >
                  {nights} gece
                </button>
              ))}
            </div>
          ) : null}

          {datesValid ? (
            <p className='text-sm text-slate-600'>
              {formatDateTR(form.checkInDate)} → {formatDateTR(form.checkOutDate)} ·{' '}
              <span className='font-medium text-blue-950'>{nightCount} gece</span>
            </p>
          ) : (
            <p className='text-xs text-slate-500'>Önce giriş tarihini, sonra çıkışı veya gece sayısını seçin.</p>
          )}
        </fieldset>

        <fieldset className='space-y-3' disabled={!datesValid}>
          <legend className='text-sm font-semibold text-slate-800'>2. Oda seç</legend>
          {!datesValid ? (
            <p className='text-sm text-slate-500'>Oda müsaitliği için tarihleri seçin.</p>
          ) : (
            <>
              {allRoomsFull ? (
                <div
                  className='rounded-xl border-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700'
                  role='alert'
                >
                  Bu tarihlerde tüm odalar dolu. Lütfen başka tarih seçin.
                </div>
              ) : autoPickableRooms.length > 0 && form.roomName && !vipManuallySelected ? (
                <p className='text-xs text-emerald-700'>
                  Boş standart odalardan biri otomatik seçildi. V.I.P yalnızca elle seçilir.
                </p>
              ) : autoPickableRooms.length === 0 && availableRooms.some((r) => isVipRoom(r.roomName)) ? (
                <p className='text-xs text-amber-800'>
                  Standart odalar dolu. V.I.P müsaitse manuel olarak seçebilirsiniz.
                </p>
              ) : null}

              <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5'>
                {roomAvailabilityList.map(({ roomName, available, conflict }) => {
                  const isSelected = isRoomSelected(roomName)
                  const vip = isVipRoom(roomName)
                  return (
                    <button
                      key={roomName}
                      type='button'
                      onClick={() => available && selectRoom(roomName)}
                      disabled={!available}
                      className={`rounded-xl border-2 p-3 text-left transition sm:p-4 ${
                        isSelected
                          ? vip
                            ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200'
                            : 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : available
                            ? vip
                              ? 'border-dashed border-amber-400 bg-white hover:border-amber-500 hover:bg-amber-50/40'
                              : 'border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/50'
                            : 'cursor-not-allowed border-rose-200 bg-rose-50/80'
                      }`}
                    >
                      <p className={`text-base font-bold sm:text-lg ${vip ? 'text-amber-900' : 'text-blue-950'}`}>
                        {roomName}
                      </p>
                      {vip && available && !isSelected ? (
                        <p className='mt-0.5 text-[10px] font-medium text-amber-700'>Manuel seçim</p>
                      ) : null}
                      <p
                        className={`mt-1 text-[11px] font-semibold leading-snug sm:text-xs ${
                          available ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {getRoomStatusLabel(roomName, available)}
                      </p>
                      {!available && conflict ? (
                        <p className='mt-1 truncate text-xs text-slate-500' title={conflict.customerName}>
                          {conflict.customerName}
                        </p>
                      ) : null}
                    </button>
                  )
                })}
              </div>
              {errors.roomName ? <p className='text-xs text-rose-600'>{errors.roomName}</p> : null}
              {form.roomName && selectedRoomConflict ? (
                <p className='text-xs font-medium text-rose-600'>
                  {form.roomName} dolu: {selectedRoomConflict.customerName} (
                  {formatDateTR(selectedRoomConflict.checkInDate)} –{' '}
                  {formatDateTR(selectedRoomConflict.checkOutDate)})
                </p>
              ) : null}
            </>
          )}
        </fieldset>

        <fieldset className='space-y-3'>
          <legend className='text-sm font-semibold text-slate-800'>3. Müşteri</legend>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div>
              <label className='mb-1 block text-sm font-medium'>Ad Soyad</label>
              <input name='customerName' value={form.customerName} onChange={handleChange} className='input' />
              {errors.customerName ? (
                <p className='mt-1 text-xs text-rose-600'>{errors.customerName}</p>
              ) : null}
            </div>
            <div>
              <label className='mb-1 block text-sm font-medium'>Telefon</label>
              <input
                name='customerPhone'
                value={form.customerPhone}
                onChange={handleChange}
                className='input'
                type='tel'
              />
              {errors.customerPhone ? (
                <p className='mt-1 text-xs text-rose-600'>{errors.customerPhone}</p>
              ) : null}
            </div>
          </div>
        </fieldset>

        <fieldset className='space-y-3'>
          <legend className='text-sm font-semibold text-slate-800'>4. Ödeme</legend>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <div>
              <label className='mb-1 block text-sm font-medium'>Toplam (TL)</label>
              <input
                type='text'
                inputMode='decimal'
                name='totalPrice'
                value={form.totalPrice}
                onChange={handleChange}
                className='input'
                autoComplete='off'
              />
              {errors.totalPrice ? <p className='mt-1 text-xs text-rose-600'>{errors.totalPrice}</p> : null}
            </div>
            <div>
              <label className='mb-1 block text-sm font-medium'>Kapora (TL)</label>
              <input
                type='text'
                inputMode='decimal'
                name='deposit'
                value={form.deposit}
                onChange={handleChange}
                className='input'
                autoComplete='off'
              />
              {errors.deposit ? <p className='mt-1 text-xs text-rose-600'>{errors.deposit}</p> : null}
            </div>
            <div>
              <label className='mb-1 block text-sm font-medium'>Kalan</label>
              <input
                value={Number.isFinite(remainingPayment) ? remainingPayment : 0}
                readOnly
                className='input bg-slate-100'
              />
            </div>
            <div>
              <label className='mb-1 block text-sm font-medium'>Ödeme durumu</label>
              <input readOnly value={form.paymentStatus} className='input bg-slate-100' />
              {canMarkFullyPaid ? (
                <button
                  type='button'
                  onClick={markFullyPaid}
                  className='mt-2 w-full rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100'
                >
                  Tamamı Ödendi
                </button>
              ) : null}
              <p className='mt-1 text-[11px] text-slate-500'>
                Kapora girilince otomatik güncellenir; peşin ödendiyse butona basın.
              </p>
            </div>
          </div>
        </fieldset>

        {isEditing ? (
          <div className='grid gap-4 sm:grid-cols-2'>
            <div>
              <label className='mb-1 block text-sm font-medium'>Rezervasyon durumu</label>
              <select
                name='reservationStatus'
                value={form.reservationStatus}
                onChange={handleChange}
                className='input'
              >
                <option>Aktif</option>
                <option>Tamamlandı</option>
                <option>İptal</option>
              </select>
            </div>
          </div>
        ) : null}

        <div>
          <label className='mb-1 block text-sm font-medium'>Not (isteğe bağlı)</label>
          <textarea name='note' value={form.note} onChange={handleChange} rows={2} className='input' />
        </div>

        <div className='flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4'>
          <button
            type='submit'
            className='btn-success'
            disabled={
              submitting ||
              !datesValid ||
              allRoomsFull ||
              !form.roomName ||
              (isVipRoom(form.roomName) && !vipManuallySelected) ||
              Boolean(selectedRoomConflict)
            }
          >
            {submitting ? 'Kaydediliyor...' : isEditing ? 'Güncelle' : 'Rezervasyon Ekle'}
          </button>
          {isEditing ? (
            <button type='button' className='btn border border-slate-300 bg-white' onClick={onCancel}>
              Vazgeç
            </button>
          ) : null}
        </div>
      </form>
    </section>
  )
}

export default ReservationForm
