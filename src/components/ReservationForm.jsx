import { addDays, differenceInCalendarDays, format } from 'date-fns'
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import DatePickerField from './DatePickerField'
import MoneyInput from './MoneyInput'
import { formatMoneyInputDisplay, parseMoneyInput } from '../utils/moneyInput'
import {
  getRoomDisplayName,
  getRoomOptions,
  isRoomBookable,
  isVipRoom,
  normalizeRoomName,
  pickFirstAvailableStandardRoom,
} from '../config/rooms'
import { getHotelTodayIso, HOTEL_TIME_POLICY_LABEL } from '../config/hotelTime'
import { formatDateTR, normalizeFirestoreDate, parseISODateSafe } from '../utils/formatters'
import { findBookingPlan } from '../utils/roomAssignmentUtils'
import {
  derivePaymentStatus,
  findConflictingReservation,
  getFullyBookedNightsInRange,
  getRoomAvailabilityList,
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
  const lastAutoPickDatesRef = useRef({
    checkIn: normalizeFirestoreDate(initialValues?.checkInDate),
    checkOut: normalizeFirestoreDate(initialValues?.checkOutDate),
  })

  useEffect(() => {
    if (!initialValues?.id) {
      setForm(DEFAULT_FORM)
      setVipManuallySelected(false)
      lastAutoPickDatesRef.current = { checkIn: '', checkOut: '' }
      setErrors({})
      return
    }

    setForm(formStateFromInitialValues(initialValues))
    setVipManuallySelected(Boolean(isVipRoom(initialValues.roomName)))
    lastAutoPickDatesRef.current = {
      checkIn: normalizeFirestoreDate(initialValues.checkInDate),
      checkOut: normalizeFirestoreDate(initialValues.checkOutDate),
    }
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

  const deferredCheckIn = useDeferredValue(form.checkInDate)
  const deferredCheckOut = useDeferredValue(form.checkOutDate)
  const deferredCanSearch =
    Boolean(
      parseISODateSafe(deferredCheckIn) &&
        parseISODateSafe(deferredCheckOut) &&
        parseISODateSafe(deferredCheckOut) > parseISODateSafe(deferredCheckIn),
    ) &&
    (relaxedEdit ||
      validateActiveReservationDates({
        checkInDate: deferredCheckIn,
        checkOutDate: deferredCheckOut,
        reservationStatus: form.reservationStatus,
        originalCheckInDate: initialValues?.checkInDate,
      }).valid)

  const safeReservations = useMemo(() => sanitizeReservations(reservations), [reservations])

  const roomOptions = useMemo(() => getRoomOptions(safeReservations), [safeReservations])

  const nightCount = useMemo(() => {
    if (!datesValid) return 0
    const checkIn = parseISODateSafe(form.checkInDate)
    const checkOut = parseISODateSafe(form.checkOutDate)
    if (!checkIn || !checkOut) return 0
    return differenceInCalendarDays(checkOut, checkIn)
  }, [form.checkInDate, form.checkOutDate, datesValid])

  const fullyBookedNights = useMemo(() => {
    if (!canSearchRooms) return []
    try {
      return getFullyBookedNightsInRange(safeReservations, form.checkInDate, form.checkOutDate, {
        excludeId,
      })
    } catch (error) {
      console.error('Dolu gece hesaplanamadı:', error)
      return []
    }
  }, [canSearchRooms, safeReservations, form.checkInDate, form.checkOutDate, excludeId])

  const hasFullyBookedNight = fullyBookedNights.length > 0

  const bookingPlan = useMemo(() => {
    if (!deferredCanSearch || isEditingVipReservation || hasFullyBookedNight) return null

    const bookableNames = roomOptions.filter((roomName) => isRoomBookable(roomName))
    const preferredRoom =
      isEditing && !isEditingVipReservation ? normalizeRoomName(initialValues?.roomName) : undefined
    try {
      return findBookingPlan(safeReservations, {
        checkInDate: deferredCheckIn,
        checkOutDate: deferredCheckOut,
        excludeId,
        roomNames: bookableNames,
        preferredRoom,
      })
    } catch (error) {
      console.error('Oda yerleştirme planı hesaplanamadı:', error)
      return null
    }
  }, [
    deferredCanSearch,
    isEditingVipReservation,
    isEditing,
    safeReservations,
    roomOptions,
    deferredCheckIn,
    deferredCheckOut,
    excludeId,
    hasFullyBookedNight,
    initialValues?.roomName,
  ])

  const roomAvailabilityList = useMemo(() => {
    if (!datesValid) return []

    const bookableNames = roomOptions.filter((roomName) => isRoomBookable(roomName))

    if (!canSearchRooms) {
      return bookableNames.map((roomName) => ({
        roomName,
        available: false,
        conflict: null,
        inactive: false,
      }))
    }

    try {
      const bookable = getRoomAvailabilityList(safeReservations, {
        checkInDate: form.checkInDate,
        checkOutDate: form.checkOutDate,
        excludeId,
        roomNames: bookableNames,
      }).map((room) => {
        if (
          bookingPlan?.targetRoom &&
          normalizeRoomName(room.roomName) === normalizeRoomName(bookingPlan.targetRoom)
        ) {
          return {
            ...room,
            available: true,
            conflict: null,
            viaShuffle: Boolean(bookingPlan.shuffled),
          }
        }
        return room
      })

      const inactive = roomOptions
        .filter((roomName) => !isRoomBookable(roomName))
        .map((roomName) => ({ roomName, available: false, conflict: null, inactive: true }))

      return [...bookable, ...inactive]
    } catch (error) {
      console.error('Oda müsaitliği hesaplanamadı:', error)
      return bookableNames.map((roomName) => ({
        roomName,
        available: false,
        conflict: null,
        inactive: false,
      }))
    }
  }, [
    safeReservations,
    roomOptions,
    form.checkInDate,
    form.checkOutDate,
    excludeId,
    datesValid,
    canSearchRooms,
    bookingPlan,
  ])

  const availableRooms = useMemo(
    () => roomAvailabilityList.filter((room) => room.available && isRoomBookable(room.roomName)),
    [roomAvailabilityList],
  )

  const bookableRoomCount = useMemo(
    () => roomAvailabilityList.filter((room) => isRoomBookable(room.roomName)).length,
    [roomAvailabilityList],
  )

  const autoPickableRooms = useMemo(
    () => availableRooms.filter((room) => !isVipRoom(room.roomName)),
    [availableRooms],
  )

  const allRoomsFull =
    canSearchRooms &&
    datesValid &&
    (hasFullyBookedNight ||
      (!bookingPlan?.targetRoom &&
        (isEditingVipReservation
          ? !roomAvailabilityList.some((room) => isVipRoom(room.roomName) && room.available)
          : bookableRoomCount > 0 && availableRooms.length === 0)))

  const resolvedRoomName = useMemo(() => {
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

    const preferredRoom = normalizeRoomName(form.roomName)
    if (
      preferredRoom &&
      availableRooms.some((room) => normalizeRoomName(room.roomName) === preferredRoom) &&
      !(isVipRoom(preferredRoom) && !vipManuallySelected)
    ) {
      return preferredRoom
    }

    if (isEditing && !isEditingVipReservation && !form.roomName && bookingPlan?.targetRoom) {
      return bookingPlan.targetRoom
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

    if (bookingPlan?.targetRoom) return bookingPlan.targetRoom

    const directStandard = pickFirstAvailableStandardRoom(
      availableRooms.filter((room) => !isVipRoom(room.roomName)).map((room) => room.roomName),
    )
    if (directStandard) return directStandard

    // V.I.P yalnızca elle seçilir — otomatik atanmaz.
    if (
      vipManuallySelected &&
      form.roomName &&
      isVipRoom(form.roomName) &&
      availableRooms.some((room) => room.roomName === form.roomName)
    ) {
      return form.roomName
    }

    return ''
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
    bookingPlan?.targetRoom,
  ])

  const selectedRoomConflict = useMemo(() => {
    if (!datesValid || !resolvedRoomName) return null
    if (
      bookingPlan?.targetRoom &&
      normalizeRoomName(resolvedRoomName) === normalizeRoomName(bookingPlan.targetRoom)
    ) {
      return null
    }
    return findConflictingReservation(safeReservations, {
      roomName: resolvedRoomName,
      checkInDate: form.checkInDate,
      checkOutDate: form.checkOutDate,
      excludeId,
    })
  }, [
    safeReservations,
    resolvedRoomName,
    form.checkInDate,
    form.checkOutDate,
    excludeId,
    datesValid,
    bookingPlan,
  ])

  const displayedRoomAvailabilityList = useMemo(() => {
    if (isEditingVipReservation) {
      return roomAvailabilityList.filter((room) => isVipRoom(room.roomName))
    }
    return roomAvailabilityList
  }, [roomAvailabilityList, isEditingVipReservation])

  const vipManuallySelectedRef = useRef(vipManuallySelected)
  vipManuallySelectedRef.current = vipManuallySelected

  const syncRoomAfterDateChange = useCallback(
    (checkInDate, checkOutDate, prevRoomName) => {
      const checkIn = parseISODateSafe(checkInDate)
      const checkOut = parseISODateSafe(checkOutDate)
      const valid = Boolean(checkIn && checkOut && checkOut > checkIn)

      if (relaxedEdit || !valid) {
        return { roomName: prevRoomName, vipManual: vipManuallySelectedRef.current }
      }

      const activeDateValidation = validateActiveReservationDates({
        checkInDate,
        checkOutDate,
        reservationStatus: form.reservationStatus,
        originalCheckInDate: initialValues?.checkInDate,
      })

      if (!activeDateValidation.valid) {
        lastAutoPickDatesRef.current = { checkIn: checkInDate, checkOut: checkOutDate }
        return { roomName: '', vipManual: false }
      }

      let fullNights = []
      try {
        fullNights = getFullyBookedNightsInRange(safeReservations, checkInDate, checkOutDate, {
          excludeId,
        })
      } catch (error) {
        console.error('Dolu gece kontrolü başarısız:', error)
      }

      if (fullNights.length > 0) {
        lastAutoPickDatesRef.current = { checkIn: checkInDate, checkOut: checkOutDate }
        return { roomName: '', vipManual: false }
      }

      if (isEditingVipReservation) {
        const vipRoom = normalizeRoomName(initialValues.roomName)
        lastAutoPickDatesRef.current = { checkIn: checkInDate, checkOut: checkOutDate }
        return { roomName: vipRoom, vipManual: true }
      }

      const bookableNames = roomOptions.filter((roomName) => isRoomBookable(roomName))
      const availability = getRoomAvailabilityList(safeReservations, {
        checkInDate,
        checkOutDate,
        excludeId,
        roomNames: bookableNames,
      })

      const directlyAvailable = availability.filter(
        (room) => room.available && isRoomBookable(room.roomName),
      )
      const directStandard = directlyAvailable.filter((room) => !isVipRoom(room.roomName))

      const wasVipManual = vipManuallySelectedRef.current
      const normalizedPrevRoom = normalizeRoomName(prevRoomName)
      const currentStillAvailable = directlyAvailable.some(
        (room) => normalizeRoomName(room.roomName) === normalizedPrevRoom,
      )

      lastAutoPickDatesRef.current = { checkIn: checkInDate, checkOut: checkOutDate }

      if (wasVipManual && normalizedPrevRoom && isVipRoom(normalizedPrevRoom) && currentStillAvailable) {
        return { roomName: normalizedPrevRoom, vipManual: true }
      }

      // Düzenlemede tarih değişse bile mevcut oda müsaitse koru.
      if (normalizedPrevRoom && currentStillAvailable && !isVipRoom(normalizedPrevRoom)) {
        return { roomName: normalizedPrevRoom, vipManual: false }
      }

      if (directStandard.length > 0) {
        return {
          roomName: pickFirstAvailableStandardRoom(directStandard.map((room) => room.roomName)),
          vipManual: false,
        }
      }

      // Taşıma planı render sırasında hesaplanır; burada ağır arama yapılmaz.
      return { roomName: '', vipManual: false }
    },
    [
      relaxedEdit,
      form.reservationStatus,
      initialValues?.checkInDate,
      initialValues?.roomName,
      isEditingVipReservation,
      safeReservations,
      excludeId,
      roomOptions,
    ],
  )

  const applyDateChange = useCallback(
    (partialOrFn) => {
      let nextVipManual = vipManuallySelectedRef.current

      setForm((prev) => {
        const partial = typeof partialOrFn === 'function' ? partialOrFn(prev) : partialOrFn
        const next = { ...prev, ...partial }
        if (next.checkOutDate && next.checkInDate && next.checkOutDate <= next.checkInDate) {
          next.checkOutDate = ''
        }

        const sync = syncRoomAfterDateChange(
          next.checkInDate,
          next.checkOutDate,
          prev.roomName,
        )
        nextVipManual = sync.vipManual
        return { ...next, roomName: sync.roomName }
      })

      setVipManuallySelected(nextVipManual)
    },
    [syncRoomAfterDateChange],
  )

  const getRoomStatusLabel = (roomName, available, inactive = false, viaShuffle = false) => {
    if (inactive || !isRoomBookable(roomName)) return 'Pasif · şu an kapalı'
    if (viaShuffle) return 'Müsait · taşıma ile'
    if (isVipRoom(roomName)) {
      return available ? 'Müsait · VIP boş' : 'Dolu · Bu tarihlerde VIP dolu'
    }
    return available ? 'Müsait' : 'Dolu'
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
    if (reservationsLoading) return 'Oda müsaitliği yükleniyor, lütfen bekleyin.'
    if (!datesValid) return 'Giriş ve çıkış tarihlerini seçin.'
    if (!relaxedEdit && !dateValidation.valid) return dateValidation.message
    if (!relaxedEdit && hasFullyBookedNight) {
      return `Seçilen tarihlerde tüm evler dolu gece var: ${fullyBookedNights.map(formatDateTR).join(', ')}`
    }
    if (!relaxedEdit && allRoomsFull) return 'Bu tarihlerde tüm odalar dolu. Başka tarih seçin.'
    if (!resolvedRoomName) {
      if (!relaxedEdit && availableRooms.some((room) => isVipRoom(room.roomName))) {
        return 'Standart odalar dolu. V.I.P müsaitse odalar bölümünden elle seçin.'
      }
      return 'Müsait bir oda seçin.'
    }
    if (!relaxedEdit && isVipRoom(resolvedRoomName) && !vipManuallySelected) {
      return 'V.I.P odasını odalar bölümünden elle seçin.'
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
    datesValid,
    relaxedEdit,
    dateValidation,
    allRoomsFull,
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
      nextErrors.checkOutDate = `Bu gece(ler)de tüm evler dolu: ${fullyBookedNights.map(formatDateTR).join(', ')}`
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

    await onSubmit({
      ...form,
      roomName: normalizeRoomName(resolvedRoomName),
      totalPrice: parseMoneyInput(form.totalPrice),
      deposit: parseMoneyInput(form.deposit),
      remainingPayment,
      pendingReassignments: bookingPlan?.reassignments ?? [],
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
            <p className='text-sm text-slate-600'>
              {formatDateTR(form.checkInDate)} → {formatDateTR(form.checkOutDate)} ·{' '}
              <span className='font-medium text-blue-950'>{nightCount} gece</span>
            </p>
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
              {allRoomsFull ? (
                <div
                  className='rounded-xl border-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm text-rose-800'
                  role='alert'
                >
                  <p className='font-semibold text-rose-700'>
                    {hasFullyBookedNight
                      ? 'Seçilen tarihlerde tüm evler dolu gece var. Rezervasyon yapılamaz.'
                      : isEditingVipReservation
                        ? 'Bu tarihlerde V.I.P dolu. Tarih değiştirin veya başka çözüm uygulayın.'
                        : 'Bu tarihlerde tüm odalar dolu. Lütfen başka tarih seçin.'}
                  </p>
                  {hasFullyBookedNight ? (
                    <p className='mt-1.5 text-xs leading-relaxed text-rose-700/90'>
                      Dolu geceler:{' '}
                      <strong>{fullyBookedNights.map(formatDateTR).join(', ')}</strong>
                      {' '}
                      (6/6 ev dolu — o gecelere yeni misafir sığmaz)
                    </p>
                  ) : !isEditingVipReservation ? (
                    <p className='mt-1.5 text-xs leading-relaxed text-rose-700/90'>
                      Standart odalar yeniden düzenlense bile uygun yerleşim bulunamadı. V.I.P
                      misafirler taşınmaz.
                    </p>
                  ) : null}
                </div>
              ) : bookingPlan?.shuffled &&
                Array.isArray(bookingPlan.reassignments) &&
                bookingPlan.reassignments.length > 0 &&
                bookingPlan.targetRoom ? (
                <div className='rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-950'>
                  <p className='font-semibold'>Otomatik oda düzenlemesi gerekli</p>
                  <p className='mt-1 text-xs leading-relaxed text-blue-900/90'>
                    Kayıt sırasında V.I.P hariç {bookingPlan.reassignments.length} misafir başka
                    standart odaya taşınacak (V.I.P&apos;ye taşınmaz);{' '}
                    {getRoomDisplayName(bookingPlan.targetRoom)} sizin için ayrılacak.
                  </p>
                  <ul className='mt-2 space-y-1 text-xs text-blue-900'>
                    {bookingPlan.reassignments?.map((move) => (
                      <li key={move.reservation?.id ?? `${move.fromRoom}-${move.toRoom}`}>
                        {move.reservation?.customerName ?? 'Misafir'}: {getRoomDisplayName(move.fromRoom)} →{' '}
                        {getRoomDisplayName(move.toRoom)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : isEditingVipReservation ? (
                <p className='text-xs text-amber-800'>
                  V.I.P rezervasyonunda oda değiştirilemez. Misafir bu tarihlerde V.I.P&apos;de kalır.
                </p>
              ) : autoPickableRooms.length > 0 && resolvedRoomName && !vipManuallySelected ? (
                <p className='text-xs text-emerald-700'>
                  Boş standart odalardan biri otomatik seçildi. V.I.P yalnızca elle seçilir.
                </p>
              ) : autoPickableRooms.length === 0 && availableRooms.some((r) => isVipRoom(r.roomName)) ? (
                <p className='text-xs text-amber-800'>
                  Standart odalar dolu. V.I.P boşsa yalnızca odalar bölümünden elle seçebilirsiniz;
                  otomatik taşınmaz.
                </p>
              ) : null}

              <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6'>
                {displayedRoomAvailabilityList.map(({ roomName, available, conflict, inactive, viaShuffle }) => {
                  const isSelected = isRoomSelected(roomName)
                  const vip = isVipRoom(roomName)
                  const isInactive = inactive || !isRoomBookable(roomName)
                  const canSelect =
                    available && !isInactive && !isEditingVipReservation
                  return (
                    <button
                      key={roomName}
                      type='button'
                      onClick={() => canSelect && selectRoom(roomName)}
                      disabled={!canSelect}
                      className={`rounded-xl border-2 p-3 text-left transition sm:p-4 ${
                        isInactive
                          ? 'cursor-not-allowed border-slate-200 bg-slate-100 opacity-70'
                          : isSelected
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
                          isInactive
                            ? 'text-slate-500'
                            : available
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                        }`}
                      >
                        {getRoomStatusLabel(roomName, available, isInactive, viaShuffle)}
                      </p>
                      {!isInactive && !available && conflict?.customerName ? (
                        <>
                          <p className='mt-1 truncate text-xs font-medium text-slate-600' title={conflict.customerName}>
                            {conflict.customerName}
                          </p>
                          <p className='mt-0.5 text-[10px] leading-snug text-slate-500'>
                            {formatDateTR(conflict.checkInDate)} – {formatDateTR(conflict.checkOutDate)}
                          </p>
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
