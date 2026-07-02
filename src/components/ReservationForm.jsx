import { addDays, differenceInCalendarDays, format } from 'date-fns'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DatePickerField from './DatePickerField'
import MoneyInput from './MoneyInput'
import { useStayAvailability } from '../hooks/useStayAvailability'
import { formatMoneyInputDisplay, parseMoneyInput } from '../utils/moneyInput'
import {
  getRoomDisplayName,
  getRoomOptions,
  isRoomBookable,
  isVipRoom,
  normalizeRoomName,
  pickFirstAvailableStandardRoom,
  STANDARD_ROOM_COUNT,
  ACTIVE_ROOM_COUNT,
} from '../config/rooms'
import { getHotelTodayIso, HOTEL_CHECK_IN_TIME, HOTEL_CHECK_OUT_TIME, HOTEL_TIME_POLICY_LABEL } from '../config/hotelTime'
import { formatDateTR, normalizeFirestoreDate, parseISODateSafe } from '../utils/formatters'
import {
  findConflictingReservation,
  getConflictingNightsInRange,
  describeReservationConflict,
} from '../utils/roomAvailability'
import {
  derivePaymentStatus,
  sanitizeReservations,
  normalizeReservationStatus,
  PAYMENT_STATUS,
  RES_STATUS,
  validateActiveReservationDates,
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
  reservationStatus: RES_STATUS.ACTIVE,
  note: '',
}

const NIGHT_PRESETS = [1, 2, 3, 7]

function safeConflictingNights(incoming, existing) {
  try {
    return getConflictingNightsInRange(incoming, existing)
  } catch (error) {
    console.error('Çakışan gece listesi hesaplanamadı:', error)
    return []
  }
}

function addDaysIso(dateIso, days) {
  const parsed = parseISODateSafe(dateIso)
  if (!parsed) return undefined
  return format(addDays(parsed, days), 'yyyy-MM-dd')
}

function formStateFromInitialValues(initialValues) {
  if (!initialValues) return DEFAULT_FORM

  const merged = {
    ...DEFAULT_FORM,
    ...initialValues,
    roomName: normalizeRoomName(initialValues.roomName),
    checkInDate: normalizeFirestoreDate(initialValues.checkInDate),
    checkOutDate: normalizeFirestoreDate(initialValues.checkOutDate),
    totalPrice:
      initialValues.totalPrice !== undefined && initialValues.totalPrice !== null
        ? String(initialValues.totalPrice)
        : '',
    deposit:
      initialValues.deposit !== undefined && initialValues.deposit !== null
        ? String(initialValues.deposit)
        : '',
  }

  return {
    ...merged,
    reservationStatus: normalizeReservationStatus(merged.reservationStatus),
    paymentStatus: derivePaymentStatus(merged.totalPrice, merged.deposit),
  }
}

function ReservationForm({
  initialValues,
  onSubmit,
  onCancel,
  submitting,
  reservations = [],
  reservationsLoading = false,
  excludeId,
  relaxedEdit = false,
}) {
  const isEditing = Boolean(initialValues)
  const isEditingVipReservation = isEditing && isVipRoom(initialValues?.roomName)

  const [form, setForm] = useState(() => formStateFromInitialValues(initialValues))
  const [errors, setErrors] = useState({})
  const formRef = useRef(null)
  const [vipManuallySelected, setVipManuallySelected] = useState(
    () => Boolean(initialValues && isVipRoom(initialValues.roomName)),
  )

  useEffect(() => {
    if (!initialValues?.id) {
      setForm(DEFAULT_FORM)
      setVipManuallySelected(false)
      setErrors({})
      return
    }

    setForm(formStateFromInitialValues(initialValues))
    setVipManuallySelected(Boolean(isVipRoom(initialValues.roomName)))
    setErrors({})
  }, [initialValues?.id])

  const remainingPayment = useMemo(() => {
    const totalPrice = parseMoneyInput(form.totalPrice)
    const deposit = parseMoneyInput(form.deposit)
    return totalPrice - deposit
  }, [form.totalPrice, form.deposit])

  const datesValid = useMemo(() => {
    const checkIn = parseISODateSafe(form.checkInDate)
    const checkOut = parseISODateSafe(form.checkOutDate)
    return Boolean(checkIn && checkOut && checkOut > checkIn)
  }, [form.checkInDate, form.checkOutDate])

  const hotelTodayIso = getHotelTodayIso()

  const checkInMinDate = useMemo(() => {
    if (relaxedEdit) return undefined

    const existingCheckIn = normalizeFirestoreDate(initialValues?.checkInDate)
    if (
      isEditing &&
      existingCheckIn &&
      parseISODateSafe(existingCheckIn) &&
      existingCheckIn < hotelTodayIso
    ) {
      return existingCheckIn
    }

    return hotelTodayIso
  }, [relaxedEdit, isEditing, initialValues?.checkInDate, hotelTodayIso])

  const dateValidation = useMemo(() => {
    if (!datesValid || relaxedEdit) return { valid: true }

    return validateActiveReservationDates({
      checkInDate: form.checkInDate,
      checkOutDate: form.checkOutDate,
      reservationStatus: form.reservationStatus,
      originalCheckInDate: initialValues?.checkInDate,
    })
  }, [
    datesValid,
    relaxedEdit,
    form.checkInDate,
    form.checkOutDate,
    form.reservationStatus,
    initialValues?.checkInDate,
  ])

  const canSearchRooms = datesValid && (relaxedEdit || dateValidation.valid)

  const safeReservations = useMemo(() => sanitizeReservations(reservations), [reservations])

  const roomOptions = useMemo(() => getRoomOptions(safeReservations), [safeReservations])

  const bookableRoomNames = useMemo(
    () => roomOptions.filter((roomName) => isRoomBookable(roomName)),
    [roomOptions],
  )

  const stayAvailability = useStayAvailability({
    enabled: canSearchRooms,
    reservationsReady: !reservationsLoading,
    reservations: safeReservations,
    checkInDate: form.checkInDate,
    checkOutDate: form.checkOutDate,
    excludeId,
    roomNames: bookableRoomNames,
    isEditingVipReservation,
  })

  const isWaitingForReservations =
    canSearchRooms && stayAvailability.status === 'waiting_reservations'

  const isAvailabilityPending =
    canSearchRooms &&
    (isWaitingForReservations ||
      stayAvailability.status === 'pending' ||
      stayAvailability.status === 'idle')

  const stayBooking = stayAvailability.stayBooking
  const availabilityError = stayAvailability.error

  const nightCount = useMemo(() => {
    if (!datesValid) return 0
    const checkIn = parseISODateSafe(form.checkInDate)
    const checkOut = parseISODateSafe(form.checkOutDate)
    if (!checkIn || !checkOut) return 0
    return differenceInCalendarDays(checkOut, checkIn)
  }, [form.checkInDate, form.checkOutDate, datesValid])

  const stayNightLabels = useMemo(() => {
    if (!datesValid || nightCount <= 0) return []
    const checkIn = parseISODateSafe(form.checkInDate)
    const checkOut = parseISODateSafe(form.checkOutDate)
    if (!checkIn || !checkOut) return []

    const labels = []
    let night = checkIn
    while (night < checkOut) {
      labels.push(formatDateTR(format(night, 'yyyy-MM-dd')))
      night = addDays(night, 1)
    }
    return labels
  }, [datesValid, nightCount, form.checkInDate, form.checkOutDate])

  const fullyBookedNights = stayBooking?.fullyBookedNights ?? []
  const hasFullyBookedNight = stayBooking?.hasFullyBookedNight ?? false
  const stayNightOccupancy = stayBooking?.nightOccupancy ?? []
  const standardBlockedOnly = stayBooking?.standardBlockedOnly ?? false
  const noContinuousStandardRoom = stayBooking?.noContinuousStandardRoom ?? false

  const roomAvailabilityList = useMemo(() => {
    if (!datesValid) return []

    if (!canSearchRooms || !stayBooking || isAvailabilityPending || availabilityError) {
      return bookableRoomNames.map((roomName) => ({
        roomName,
        available: false,
        conflict: null,
        inactive: false,
        pendingDates: !canSearchRooms || isAvailabilityPending,
        waitingReservations: isWaitingForReservations,
      }))
    }

    const inactive = roomOptions
      .filter((roomName) => !isRoomBookable(roomName))
      .map((roomName) => ({ roomName, available: false, conflict: null, inactive: true }))

    return [...(stayBooking.roomAvailability ?? []), ...inactive]
  }, [
    datesValid,
    roomOptions,
    bookableRoomNames,
    canSearchRooms,
    stayBooking,
    isAvailabilityPending,
    isWaitingForReservations,
    availabilityError,
  ])

  const availableRooms = useMemo(
    () => roomAvailabilityList.filter((room) => room.available && isRoomBookable(room.roomName)),
    [roomAvailabilityList],
  )

  const autoPickableRooms = useMemo(
    () => availableRooms.filter((room) => !isVipRoom(room.roomName)),
    [availableRooms],
  )

  const turnoverAvailableCount = useMemo(
    () =>
      roomAvailabilityList.filter(
        (room) =>
          room.available &&
          isRoomBookable(room.roomName) &&
          !isVipRoom(room.roomName) &&
          room.turnoverCheckout,
      ).length,
    [roomAvailabilityList],
  )

  const vipRoomAvailable = stayBooking?.vipAvailable ?? false

  const allRoomsFull = stayBooking?.allRoomsFull ?? false

  const resolvedRoomName = useMemo(() => {
    try {
      if (!datesValid || relaxedEdit) return form.roomName
      if (hasFullyBookedNight) return ''
      if (isEditingVipReservation) return normalizeRoomName(initialValues?.roomName ?? '')

      if (
        vipManuallySelected &&
        form.roomName &&
        isVipRoom(form.roomName) &&
        availableRooms.some((room) => room.roomName === form.roomName)
      ) {
        return form.roomName
      }

      const preferred = normalizeRoomName(form.roomName)
      if (
        preferred &&
        availableRooms.some((room) => normalizeRoomName(room.roomName) === preferred) &&
        !(isVipRoom(preferred) && !vipManuallySelected)
      ) {
        return preferred
      }

      if (isEditing && !isEditingVipReservation && !form.roomName) {
        const originalRoom = normalizeRoomName(initialValues?.roomName)
        if (
          originalRoom &&
          !isVipRoom(originalRoom) &&
          availableRooms.some((room) => normalizeRoomName(room.roomName) === originalRoom)
        ) {
          return originalRoom
        }
      }

      const directStandard = pickFirstAvailableStandardRoom(
        availableRooms.filter((room) => !isVipRoom(room.roomName)).map((room) => room.roomName),
      )
      if (directStandard) return directStandard

      if (
        vipManuallySelected &&
        form.roomName &&
        isVipRoom(form.roomName) &&
        availableRooms.some((room) => room.roomName === form.roomName)
      ) {
        return form.roomName
      }

      return ''
    } catch (error) {
      console.error('Oda seçimi hesaplanamadı:', error)
      return ''
    }
  }, [
    datesValid,
    relaxedEdit,
    hasFullyBookedNight,
    isEditing,
    isEditingVipReservation,
    initialValues?.roomName,
    vipManuallySelected,
    form.roomName,
    availableRooms,
  ])

  const selectedRoomConflict = useMemo(() => {
    try {
      if (!datesValid || !resolvedRoomName) return null

      return findConflictingReservation(safeReservations, {
        roomName: resolvedRoomName,
        checkInDate: form.checkInDate,
        checkOutDate: form.checkOutDate,
        excludeId,
      })
    } catch (error) {
      console.error('Oda çakışması kontrol edilemedi:', error)
      return null
    }
  }, [
    safeReservations,
    resolvedRoomName,
    form.checkInDate,
    form.checkOutDate,
    excludeId,
    datesValid,
  ])

  const displayedRoomAvailabilityList = useMemo(() => {
    if (isEditingVipReservation) {
      return roomAvailabilityList.filter((room) => isVipRoom(room.roomName))
    }
    return roomAvailabilityList
  }, [roomAvailabilityList, isEditingVipReservation])

  const applyDateChange = useCallback(
    (partialOrFn) => {
      setForm((prev) => {
        const partial = typeof partialOrFn === 'function' ? partialOrFn(prev) : partialOrFn
        const next = { ...prev, ...partial }
        if (next.checkOutDate && next.checkInDate && next.checkOutDate <= next.checkInDate) {
          next.checkOutDate = ''
        }

        const datesChanged =
          next.checkInDate !== prev.checkInDate || next.checkOutDate !== prev.checkOutDate

        if (relaxedEdit || !datesChanged) return next

        return { ...next, roomName: '' }
      })

      if (!relaxedEdit) {
        setVipManuallySelected(false)
      }
    },
    [relaxedEdit],
  )

  const getRoomStatusLabel = (
    roomName,
    available,
    inactive = false,
    turnoverCheckout = null,
    pendingDates = false,
    waitingReservations = false,
  ) => {
    if (waitingReservations) return 'Rezervasyonlar yükleniyor…'
    if (pendingDates) return 'Müsaitlik hesaplanıyor…'
    if (inactive || !isRoomBookable(roomName)) return 'Pasif · şu an kapalı'
    if (isVipRoom(roomName)) {
      return available ? 'Müsait · VIP boş' : 'Dolu · VIP dolu — seçilemez'
    }
    if (!available) return 'Dolu · çakışma — seçilemez'
    if (turnoverCheckout) return 'Müsait · aynı gün devir'
    return 'Müsait'
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleMoneyChange = (name, value) => {
    setForm((prev) => {
      const next = { ...prev, [name]: value }
      next.paymentStatus = derivePaymentStatus(
        name === 'totalPrice' ? value : parseMoneyInput(prev.totalPrice),
        name === 'deposit' ? value : parseMoneyInput(prev.deposit),
      )
      return next
    })
  }

  const setCheckIn = (checkInDate) => {
    applyDateChange({ checkInDate })
  }

  const applyNightPreset = (nights) => {
    applyDateChange((prev) => {
      if (!prev.checkInDate) return {}
      const checkOutDate = addDaysIso(prev.checkInDate, nights)
      return checkOutDate ? { checkOutDate } : {}
    })
  }

  const selectRoom = (roomName) => {
    if (!isRoomBookable(roomName)) return
    if (isEditingVipReservation) return
    if (isVipRoom(roomName)) {
      setVipManuallySelected(true)
    } else {
      setVipManuallySelected(false)
    }
    setForm((prev) => ({ ...prev, roomName }))
  }

  const isRoomSelected = (roomName) => {
    if (resolvedRoomName !== roomName) return false
    if (isVipRoom(roomName)) return vipManuallySelected
    return true
  }

  const markFullyPaid = () => {
    const total = parseMoneyInput(form.totalPrice)
    if (total <= 0) return

    setForm((prev) => ({
      ...prev,
      deposit: total,
      paymentStatus: PAYMENT_STATUS.PAID,
    }))
  }

  const canMarkFullyPaid =
    form.paymentStatus !== PAYMENT_STATUS.PAID && parseMoneyInput(form.totalPrice) > 0

  const submitBlockedReason = useMemo(() => {
    if (submitting) return null
    if (reservationsLoading || isWaitingForReservations) {
      return 'Rezervasyon listesi yükleniyor, lütfen bekleyin.'
    }
    if (isAvailabilityPending) return 'Oda müsaitliği hesaplanıyor, lütfen bekleyin.'
    if (availabilityError) {
      return 'Oda müsaitliği hesaplanamadı. Tarihleri değiştirip tekrar deneyin.'
    }
    if (!datesValid) return 'Giriş ve çıkış tarihlerini seçin.'
    if (!relaxedEdit && !dateValidation.valid) return dateValidation.message
    if (!relaxedEdit && hasFullyBookedNight) {
      return `Bu gece(ler)de tüm standart odalar dolu (takvimde kırmızı): ${fullyBookedNights.map((night) => formatDateTR(night)).join(', ')}. Başka tarih seçin veya VIP odalar boşsa elle seçin.`
    }
    if (!relaxedEdit && noContinuousStandardRoom) {
      return 'Her gecede boş standart oda var ama seçilen tarihlerin tamamında aynı oda boş değil. Daha kısa aralık deneyin veya takvimde kırmızı (5/5 dolu) geceleri kontrol edin.'
    }
    if (!relaxedEdit && allRoomsFull) {
      return 'Bu tarih aralığında müsait oda yok. Takvimde o gecelerin standart doluluk rengine (5/5 kırmızı) bakın.'
    }
    if (!resolvedRoomName) {
      if (!relaxedEdit && availableRooms.some((room) => isVipRoom(room.roomName))) {
        return 'Standart odalar dolu. VIP odalar (Teras / Sahil) müsaitse odalar bölümünden elle seçin.'
      }
      return 'Müsait bir oda seçin.'
    }
    if (!relaxedEdit && isVipRoom(resolvedRoomName) && !vipManuallySelected) {
      return 'VIP odasını (Teras veya Sahil) odalar bölümünden elle seçin.'
    }
    if (
      resolvedRoomName &&
      !isRoomBookable(resolvedRoomName) &&
      !(isEditing && normalizeRoomName(initialValues?.roomName) === normalizeRoomName(resolvedRoomName))
    ) {
      return 'Seçilen oda şu an rezervasyona kapalı.'
    }
    if (!relaxedEdit && selectedRoomConflict) {
      return `${getRoomDisplayName(resolvedRoomName)} bu tarihlerde dolu. Başka oda veya tarih seçin.`
    }
    return null
  }, [
    submitting,
    reservationsLoading,
    isWaitingForReservations,
    isAvailabilityPending,
    availabilityError,
    datesValid,
    relaxedEdit,
    dateValidation,
    allRoomsFull,
    noContinuousStandardRoom,
    hasFullyBookedNight,
    fullyBookedNights,
    resolvedRoomName,
    availableRooms,
    vipManuallySelected,
    selectedRoomConflict,
    isEditing,
    initialValues?.roomName,
  ])

  const isSubmitDisabled = Boolean(submitBlockedReason)

  const scrollToFirstError = (nextErrors) => {
    const firstKey = Object.keys(nextErrors)[0]
    if (!firstKey || !formRef.current) return

    const target =
      formRef.current.querySelector(`[data-field="${firstKey}"]`) ??
      formRef.current.querySelector(`[name="${firstKey}"]`)

    target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const validate = () => {
    const nextErrors = {}
    const totalPrice = parseMoneyInput(form.totalPrice)
    const deposit = parseMoneyInput(form.deposit)

    if (!form.checkInDate) nextErrors.checkInDate = 'Giriş tarihi zorunludur.'
    if (!form.checkOutDate) nextErrors.checkOutDate = 'Çıkış tarihi zorunludur.'
    if (!relaxedEdit && datesValid && !dateValidation.valid) {
      nextErrors.checkInDate = dateValidation.message
    } else if (!relaxedEdit && hasFullyBookedNight) {
      nextErrors.checkOutDate = `Bu gece(ler)de tüm standart odalar dolu: ${fullyBookedNights.map((night) => formatDateTR(night)).join(', ')}`
    } else if (!relaxedEdit && noContinuousStandardRoom) {
      nextErrors.roomName =
        'Her gecede boş oda var ama seçilen aralığın tamamında aynı standart oda boş değil. Tarih aralığını kısaltın veya VIP oda seçin.'
    } else if (!relaxedEdit && allRoomsFull) {
      nextErrors.roomName = 'Bu tarihlerde tüm odalar dolu.'
    } else if (!resolvedRoomName) {
      nextErrors.roomName = 'Oda seçin.'
    } else if (
      !isRoomBookable(resolvedRoomName) &&
      !(isEditing && normalizeRoomName(initialValues?.roomName) === normalizeRoomName(resolvedRoomName))
    ) {
      nextErrors.roomName = 'Bu oda şu an rezervasyona kapalı.'
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

    if (!relaxedEdit && selectedRoomConflict) {
      nextErrors.roomName = 'Seçilen oda bu tarihlerde dolu.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      scrollToFirstError(nextErrors)
    }
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSubmitDisabled) return
    if (!validate()) return

    const targetRoom = normalizeRoomName(resolvedRoomName || form.roomName || initialValues?.roomName)

    await onSubmit({
      ...form,
      roomName: targetRoom,
      totalPrice: parseMoneyInput(form.totalPrice),
      deposit: parseMoneyInput(form.deposit),
      remainingPayment,
    })
  }

  return (
    <section className='card'>
      <h2 className='text-lg font-semibold text-blue-950'>
        {isEditing ? 'Rezervasyon Düzenle' : 'Yeni Rezervasyon'}
      </h2>
      <form ref={formRef} onSubmit={handleSubmit} className='mt-4 space-y-6'>
        <fieldset className='space-y-3'>
          <legend className='text-sm font-semibold text-slate-800'>1. Tarihler</legend>
          <p className='text-xs text-slate-500'>
            {HOTEL_TIME_POLICY_LABEL} (TR saati)
            {!relaxedEdit ? ' · Giriş bugün veya sonrası' : null}
            {isEditing && !relaxedEdit ? ' · Düzenlemede mevcut oda müsaitse korunur' : null}
            {!relaxedEdit ? (
              <span className='mt-1 block text-slate-400'>
                Oda taşıması yok — misafir seçilen aralığın tamamında aynı odada kalır. Takvimle aynı
                standart doluluk kuralı ({STANDARD_ROOM_COUNT} oda) kullanılır. VIP odalar (Teras,
                Sahil) yalnızca elle seçilir.
              </span>
            ) : null}
          </p>
          {!relaxedEdit && !dateValidation.valid && datesValid ? (
            <p className='text-xs font-medium text-rose-600' role='alert'>
              {dateValidation.message}
            </p>
          ) : null}
          <div className='grid gap-4 sm:grid-cols-2'>
            <div data-field='checkInDate'>
              <DatePickerField
                label='Giriş'
                value={form.checkInDate}
                onChange={setCheckIn}
                minDate={checkInMinDate}
                error={errors.checkInDate}
                placeholder='Giriş tarihi seçin'
              />
            </div>
            <div data-field='checkOutDate'>
              <DatePickerField
                label='Çıkış'
                value={form.checkOutDate}
                onChange={(checkOutDate) => applyDateChange({ checkOutDate })}
                minDate={
                  form.checkInDate
                    ? addDaysIso(form.checkInDate, 1)
                    : addDaysIso(checkInMinDate, 1)
                }
                disabled={!form.checkInDate}
                error={errors.checkOutDate}
                placeholder='Çıkış tarihi seçin'
              />
            </div>
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
            <div className='space-y-1'>
              <p className='text-sm text-slate-600'>
                {formatDateTR(form.checkInDate)} → {formatDateTR(form.checkOutDate)} ·{' '}
                <span className='font-medium text-blue-950'>{nightCount} gece</span>
              </p>
              {stayNightLabels.length > 0 ? (
                <p className='text-xs leading-relaxed text-slate-500'>
                  Konaklanan geceler: <strong>{stayNightLabels.join(', ')}</strong> —{' '}
                  {formatDateTR(form.checkOutDate)} sabah {HOTEL_CHECK_OUT_TIME} çıkış (o gece odada
                  kalınmaz). Aynı gün yeni misafir {HOTEL_CHECK_IN_TIME}&apos;da girebilir.
                </p>
              ) : null}
            </div>
          ) : (
            <p className='text-xs text-slate-500'>Önce giriş tarihini, sonra çıkışı veya gece sayısını seçin.</p>
          )}
        </fieldset>

        <fieldset className='space-y-3' disabled={!datesValid} data-field='roomName'>
          <legend className='text-sm font-semibold text-slate-800'>2. Oda seç</legend>
          {!datesValid ? (
            <p className='text-sm text-slate-500'>Oda müsaitliği için tarihleri seçin.</p>
          ) : (
            <>
              {availabilityError ? (
                <div
                  className='rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900'
                  role='alert'
                >
                  <p className='font-semibold'>Oda müsaitliği hesaplanamadı</p>
                  <p className='mt-1 text-xs leading-relaxed text-rose-800'>
                    Tarihleri değiştirip tekrar deneyin. Sorun sürerse sayfayı yenileyin.
                  </p>
                </div>
              ) : null}
              {turnoverAvailableCount > 0 ? (
                <p className='text-xs font-medium text-emerald-800'>
                  {turnoverAvailableCount} standart odada önceki misafir giriş gününüzde{' '}
                  {HOTEL_CHECK_OUT_TIME}&apos;da çıkıyor — {HOTEL_CHECK_IN_TIME} giriş için müsait.
                </p>
              ) : null}
              {allRoomsFull ? (
                <div
                  className='rounded-xl border-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm text-rose-800'
                  role='alert'
                >
                  <p className='font-semibold text-rose-700'>
                    {hasFullyBookedNight
                      ? 'Seçilen tarihlerde tüm standart odalar dolu gece var. Rezervasyon yapılamaz.'
                      : isEditingVipReservation
                        ? 'Bu tarihlerde VIP odalar dolu. Tarih değiştirin veya başka çözüm uygulayın.'
                        : 'Bu tarih aralığında uygun oda bulunamadı.'}
                  </p>
                  {stayNightOccupancy.length > 0 ? (
                    <p className='mt-1.5 text-xs leading-relaxed text-rose-700/90'>
                      Takvimle aynı gece sayımı:{' '}
                      {stayNightOccupancy
                        .map(
                          ({ nightIso, standardOccupied, allOccupied, standardEmpty, allEmpty }) =>
                            `${formatDateTR(nightIso)} — standart ${standardOccupied}/${STANDARD_ROOM_COUNT} dolu (${standardEmpty} boş), toplam ${allOccupied}/${ACTIVE_ROOM_COUNT} dolu (${allEmpty} boş)`,
                        )
                        .join(' · ')}
                    </p>
                  ) : null}
                  {hasFullyBookedNight ? (
                    <p className='mt-1.5 text-xs leading-relaxed text-rose-700/90'>
                      Dolu geceler:{' '}
                      <strong>{fullyBookedNights.map((night) => formatDateTR(night)).join(', ')}</strong>
                      {' '}
                      ({STANDARD_ROOM_COUNT}/{STANDARD_ROOM_COUNT} standart oda dolu — o gecelere yeni
                      standart misafir sığmaz; VIP odalar ayrı).
                      Takvimde baktığınız tek gün boş olsa bile, aralıktaki başka bir gece tam dolu olabilir.
                    </p>
                  ) : !isEditingVipReservation ? (
                    <p className='mt-1.5 text-xs leading-relaxed text-rose-700/90'>
                      Takvim tek bir geceyi gösterir; form giriş–çıkış aralığının{' '}
                      <strong>tamamında aynı odada</strong> yer olup olmadığına bakar. Oda taşıması
                      yapılmaz — misafir kayıtlı odasında kalır. Gecelerin birinde{' '}
                      {STANDARD_ROOM_COUNT}/{STANDARD_ROOM_COUNT} standart dolu olsa bile takvimde o
                      gün turuncu/kırmızı görünür.
                    </p>
                  ) : null}
                </div>
              ) : noContinuousStandardRoom ? (
                <div
                  className='rounded-xl border-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950'
                  role='alert'
                >
                  <p className='font-semibold text-amber-900'>
                    Her gecede boş standart oda var — ama seçilen aralığın tamamında aynı oda boş değil
                  </p>
                  {stayNightOccupancy.length > 0 ? (
                    <p className='mt-1.5 text-xs leading-relaxed text-amber-900/90'>
                      Gece doluluk (takvimle aynı):{' '}
                      {stayNightOccupancy
                        .map(
                          ({ nightIso, standardOccupied, standardEmpty }) =>
                            `${formatDateTR(nightIso)} — ${standardOccupied}/${STANDARD_ROOM_COUNT} dolu (${standardEmpty} boş)`,
                        )
                        .join(' · ')}
                    </p>
                  ) : null}
                  <p className='mt-1.5 text-xs leading-relaxed text-amber-900/90'>
                    Örnek: Pazartesi C/1 boş, salı D/2 boş — ama hiçbir oda iki gece üst üste boş
                    değilse rezervasyon yapılamaz. Daha kısa tarih aralığı deneyin veya VIP boşsa
                    elle seçin.
                  </p>
                </div>
              ) : isEditingVipReservation ? (
                <p className='text-xs text-amber-800'>
                  VIP rezervasyonunda oda değiştirilemez. Misafir seçili VIP odasında kalır.
                </p>
              ) : standardBlockedOnly ? (
                <p className='text-xs text-amber-800'>
                  Takvimde bazı geceler boş görünse bile bu aralıkta standart oda yok. VIP boşsa
                  odalar bölümünden elle seçin.
                </p>
              ) : autoPickableRooms.length > 0 && resolvedRoomName && !vipManuallySelected ? (
                <p className='text-xs text-emerald-700'>
                  Boş standart odalardan biri otomatik seçildi. VIP odalar yalnızca elle seçilir.
                </p>
              ) : autoPickableRooms.length === 0 && availableRooms.some((r) => isVipRoom(r.roomName)) ? (
                <p className='text-xs text-amber-800'>
                  Standart odalar dolu. VIP boşsa yalnızca odalar bölümünden elle seçebilirsiniz;
                  otomatik taşınmaz.
                </p>
              ) : null}

              <p className='text-xs text-slate-500'>
                Kırmızı odalar seçili tarihlerde <strong>çakışır</strong> — tıklanamaz. Yalnızca yeşil
                «Müsait» odalar seçilebilir.
              </p>
              <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6'>
                {displayedRoomAvailabilityList.map(
                  ({
                    roomName,
                    available,
                    conflict,
                    conflictingNights: roomConflictingNights,
                    inactive,
                    turnoverCheckout,
                    incomingOnCheckoutDay,
                    pendingDates,
                    waitingReservations,
                  }) => {
                  const isSelected = isRoomSelected(roomName)
                  const vip = isVipRoom(roomName)
                  const isInactive = inactive || !isRoomBookable(roomName)
                  const canSelect =
                    available && !isInactive && !isEditingVipReservation && !pendingDates
                  const conflictNights =
                    !isInactive && !available && !pendingDates && conflict
                      ? roomConflictingNights?.length
                        ? roomConflictingNights
                        : safeConflictingNights(
                            {
                              checkInDate: form.checkInDate,
                              checkOutDate: form.checkOutDate,
                            },
                            conflict,
                          )
                      : []
                  return (
                    <button
                      key={roomName}
                      type='button'
                      onClick={() => canSelect && selectRoom(roomName)}
                      disabled={!canSelect}
                      className={`rounded-xl border-2 p-3 text-left transition sm:p-4 ${
                        pendingDates
                          ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-80'
                          : isInactive
                          ? 'cursor-not-allowed border-slate-200 bg-slate-100 opacity-70'
                          : isSelected
                            ? vip
                              ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200'
                              : 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                            : available
                              ? vip
                                ? 'border-dashed border-amber-400 bg-white hover:border-amber-500 hover:bg-amber-50/40'
                                : 'border-emerald-300 bg-white hover:border-emerald-500 hover:bg-emerald-50/50'
                              : 'cursor-not-allowed border-rose-400 bg-rose-50 ring-1 ring-rose-300'
                      }`}
                    >
                      <p
                        className={`text-base font-bold sm:text-lg ${
                          isInactive ? 'text-slate-400' : vip ? 'text-amber-900' : 'text-blue-950'
                        }`}
                      >
                        {getRoomDisplayName(roomName)}
                      </p>
                      {vip && canSelect && !isSelected ? (
                        <p className='mt-0.5 text-[10px] font-medium text-amber-700'>Manuel seçim</p>
                      ) : null}
                      <p
                        className={`mt-1 text-[11px] font-semibold leading-snug sm:text-xs ${
                          pendingDates
                            ? 'text-slate-500'
                            : isInactive
                            ? 'text-slate-500'
                            : available
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                        }`}
                      >
                        {getRoomStatusLabel(
                          roomName,
                          available,
                          isInactive,
                          turnoverCheckout,
                          pendingDates,
                          waitingReservations,
                        )}
                      </p>
                      {!isInactive && !available ? (
                        <p className='mt-1 text-[10px] font-semibold leading-snug text-rose-700'>
                          Bu tarihlerde konaklayamazsınız
                        </p>
                      ) : null}
                      {!isInactive && !available && conflict ? (
                        <p className='mt-0.5 text-[10px] leading-snug text-rose-700'>
                          {describeReservationConflict(
                            {
                              checkInDate: form.checkInDate,
                              checkOutDate: form.checkOutDate,
                            },
                            conflict,
                            { formatDate: formatDateTR },
                          )}
                        </p>
                      ) : null}
                      {available && turnoverCheckout?.customerName ? (
                        <p className='mt-1 text-[10px] leading-snug text-emerald-800'>
                          {turnoverCheckout.customerName} bu gün {HOTEL_CHECK_OUT_TIME}&apos;da çıkıyor
                        </p>
                      ) : null}
                      {available && incomingOnCheckoutDay?.customerName ? (
                        <p className='mt-1 text-[10px] leading-snug text-emerald-800'>
                          {incomingOnCheckoutDay.customerName} sizin çıkış gününüzde{' '}
                          {HOTEL_CHECK_IN_TIME}&apos;da giriş yapacak
                        </p>
                      ) : null}
                      {!isInactive && !available && conflict?.customerName ? (
                        <>
                          <p className='mt-1 truncate text-xs font-medium text-slate-600' title={conflict.customerName}>
                            {conflict.customerName}
                          </p>
                          <p className='mt-0.5 text-[10px] leading-snug text-slate-500'>
                            {formatDateTR(conflict.checkInDate)} – {formatDateTR(conflict.checkOutDate)}
                          </p>
                          {conflictNights.length > 0 ? (
                            <p className='mt-0.5 text-[10px] font-medium leading-snug text-rose-600'>
                              Çakışan gece: {conflictNights.map((night) => formatDateTR(night)).join(', ')}
                            </p>
                          ) : null}
                        </>
                      ) : null}
                    </button>
                  )
                })}
              </div>
              {errors.roomName ? <p className='text-xs text-rose-600'>{errors.roomName}</p> : null}
              {resolvedRoomName && selectedRoomConflict ? (
                <p className='text-xs font-medium text-rose-600'>
                  {getRoomDisplayName(resolvedRoomName)} dolu: {selectedRoomConflict.customerName} (
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
            <div data-field='customerName'>
              <label className='mb-1 block text-sm font-medium'>Ad Soyad</label>
              <input name='customerName' value={form.customerName} onChange={handleChange} className='input' />
              {errors.customerName ? (
                <p className='mt-1 text-xs text-rose-600'>{errors.customerName}</p>
              ) : null}
            </div>
            <div data-field='customerPhone'>
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
            <div data-field='totalPrice'>
              <label className='mb-1 block text-sm font-medium'>Toplam (TL)</label>
              <MoneyInput name='totalPrice' value={form.totalPrice} onChange={handleMoneyChange} />
              {errors.totalPrice ? <p className='mt-1 text-xs text-rose-600'>{errors.totalPrice}</p> : null}
            </div>
            <div data-field='deposit'>
              <label className='mb-1 block text-sm font-medium'>Kapora (TL)</label>
              <MoneyInput name='deposit' value={form.deposit} onChange={handleMoneyChange} />
              {errors.deposit ? <p className='mt-1 text-xs text-rose-600'>{errors.deposit}</p> : null}
            </div>
            <div>
              <label className='mb-1 block text-sm font-medium'>Kalan</label>
              <input
                value={formatMoneyInputDisplay(remainingPayment)}
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
                <option value={RES_STATUS.ACTIVE}>{RES_STATUS.ACTIVE}</option>
                <option value={RES_STATUS.COMPLETED}>{RES_STATUS.COMPLETED}</option>
                <option value={RES_STATUS.CANCELLED}>{RES_STATUS.CANCELLED}</option>
              </select>
            </div>
          </div>
        ) : null}

        <div>
          <label className='mb-1 block text-sm font-medium'>Not (isteğe bağlı)</label>
          <textarea name='note' value={form.note} onChange={handleChange} rows={2} className='input' />
        </div>

        <div className='flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4'>
          <button type='submit' className='btn-success' disabled={submitting || isSubmitDisabled}>
            {submitting ? 'Kaydediliyor...' : isEditing ? 'Güncelle' : 'Rezervasyon Ekle'}
          </button>
          {submitBlockedReason ? (
            <p className='w-full text-sm text-amber-800' role='status'>
              {submitBlockedReason}
            </p>
          ) : null}
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
