import { useEffect, useMemo, useState } from 'react'
import { eachDayOfInterval, format, startOfDay } from 'date-fns'
import CalendarView from '../components/CalendarView'
import { clampCalendarDate } from '../config/calendarBounds'
import { useAuth } from '../context/useAuth'
import { getReservations, updateReservation } from '../services/reservationService'
import { parseISODateSafe } from '../utils/formatters'
import {
  filterReservationsByName,
  getCalendarDayReservations,
  getEffectiveReservationStatus,
  isCancelledReservation,
  isReservationCountedForOccupancyOnDate,
  PAYMENT_STATUS,
  RES_STATUS,
} from '../utils/reservationUtils'

const dayKey = (date) => format(date, 'yyyy-MM-dd')

const addReservationToMap = (map, date, reservation) => {
  if (!date) return
  const key = dayKey(date)
  const list = map.get(key) ?? []
  if (!list.some((item) => item.id === reservation.id)) {
    list.push(reservation)
    map.set(key, list)
  }
}

function Calendar() {
  const { user } = useAuth()
  const [reservations, setReservations] = useState([])
  const [selectedDate, setSelectedDate] = useState(() => clampCalendarDate(startOfDay(new Date())))

  const handleDateChange = (date) => {
    const next = Array.isArray(date) ? date[0] : date
    if (next instanceof Date && !Number.isNaN(next.getTime())) {
      setSelectedDate(clampCalendarDate(new Date(next.getTime())))
    }
  }
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payingReservationId, setPayingReservationId] = useState(null)

  useEffect(() => {
    if (!user) return

    const fetchReservations = async () => {
      setLoading(true)
      setError('')

      try {
        const data = await getReservations()
        setReservations(
          data.filter(
            (reservation) => getEffectiveReservationStatus(reservation) !== RES_STATUS.CANCELLED,
          ),
        )
      } catch (fetchError) {
        setError('Takvim verileri yüklenirken bir hata oluştu.')
        console.error(fetchError)
      } finally {
        setLoading(false)
      }
    }

    fetchReservations()
  }, [user])

  /** O gün dolu odalar — rezervasyon formu ile aynı çakışma kuralı */
  const overnightStaysMap = useMemo(() => {
    const map = new Map()
    const now = new Date()

    reservations.forEach((reservation) => {
      if (isCancelledReservation(reservation)) return

      const checkIn = parseISODateSafe(reservation.checkInDate)
      const checkOut = parseISODateSafe(reservation.checkOutDate)
      if (!checkIn || !checkOut || checkOut <= checkIn) return

      try {
        eachDayOfInterval({ start: checkIn, end: checkOut }).forEach((date) => {
          if (!isReservationCountedForOccupancyOnDate(reservation, date, now)) return
          addReservationToMap(map, date, reservation)
        })
      } catch {
        // Geçersiz tarih aralığı atlanır.
      }
    })

    return map
  }, [reservations])

  const selectedDayDetails = useMemo(
    () => getCalendarDayReservations(reservations, selectedDate),
    [reservations, selectedDate],
  )

  const selectedDayReservations = useMemo(
    () => selectedDayDetails.allForDay,
    [selectedDayDetails],
  )

  const searchResults = useMemo(
    () =>
      filterReservationsByName(reservations, searchQuery).sort((a, b) =>
        (a.customerName || '').localeCompare(b.customerName || '', 'tr'),
      ),
    [reservations, searchQuery],
  )

  const handleSearchResultSelect = (reservation) => {
    const checkIn = parseISODateSafe(reservation.checkInDate)
    if (checkIn) setSelectedDate(clampCalendarDate(checkIn))
    setSearchQuery('')
  }

  const handleMarkFullyPaid = async (reservation) => {
    const totalPrice = Number(reservation.totalPrice) || 0
    setPayingReservationId(reservation.id)
    setError('')

    try {
      await updateReservation(reservation.id, {
        ...reservation,
        paymentStatus: PAYMENT_STATUS.PAID,
        deposit: totalPrice,
      })
      setReservations((prev) =>
        prev.map((item) =>
          item.id === reservation.id
            ? {
                ...item,
                paymentStatus: PAYMENT_STATUS.PAID,
                deposit: totalPrice,
                remainingPayment: 0,
              }
            : item,
        ),
      )
    } catch (paymentError) {
      setError('Ödeme güncellenemedi.')
      console.error(paymentError)
    } finally {
      setPayingReservationId(null)
    }
  }

  return (
    <CalendarView
      loading={loading}
      error={error}
      reservations={reservations}
      selectedDate={selectedDate}
      onDateChange={handleDateChange}
      overnightStaysMap={overnightStaysMap}
      selectedDayReservations={selectedDayReservations}
      selectedDayDetails={selectedDayDetails}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      searchResults={searchResults}
      onSearchResultSelect={handleSearchResultSelect}
      onMarkFullyPaid={handleMarkFullyPaid}
      payingReservationId={payingReservationId}
    />
  )
}

export default Calendar
