import { useEffect, useMemo, useState } from 'react'
import { eachDayOfInterval, format, isWithinInterval, parseISO, subDays } from 'date-fns'
import CalendarView from '../components/CalendarView'
import { getReservations } from '../services/reservationService'

const dayKey = (date) => format(date, 'yyyy-MM-dd')

const isReservationActiveOnDay = (reservation, date) => {
  try {
    const checkIn = parseISO(reservation.checkInDate)
    const checkOut = parseISO(reservation.checkOutDate)
    if (checkOut <= checkIn) return false

    return isWithinInterval(date, {
      start: checkIn,
      end: subDays(checkOut, 1),
    })
  } catch {
    return false
  }
}

function Calendar() {
  const [reservations, setReservations] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchReservations = async () => {
      setLoading(true)
      setError('')

      try {
        const data = await getReservations()
        setReservations(data.filter((reservation) => reservation.reservationStatus !== 'İptal'))
      } catch (fetchError) {
        setError('Takvim verileri yüklenirken bir hata oluştu.')
        console.error(fetchError)
      } finally {
        setLoading(false)
      }
    }

    fetchReservations()
  }, [])

  const occupiedDatesMap = useMemo(() => {
    const map = new Map()

    reservations.forEach((reservation) => {
      try {
        const checkIn = parseISO(reservation.checkInDate)
        const checkOut = parseISO(reservation.checkOutDate)
        if (checkOut <= checkIn) return

        const rangeDays = eachDayOfInterval({
          start: checkIn,
          end: subDays(checkOut, 1),
        })

        rangeDays.forEach((date) => {
          const key = dayKey(date)
          const list = map.get(key) ?? []
          list.push(reservation)
          map.set(key, list)
        })
      } catch {
        // Geçersiz tarihli kayıtlar takvim hesaplamasına dahil edilmez.
      }
    })

    return map
  }, [reservations])

  const selectedDayReservations = useMemo(
    () => reservations.filter((reservation) => isReservationActiveOnDay(reservation, selectedDate)),
    [reservations, selectedDate],
  )

  return (
    <CalendarView
      loading={loading}
      error={error}
      selectedDate={selectedDate}
      onDateChange={setSelectedDate}
      occupiedDatesMap={occupiedDatesMap}
      selectedDayReservations={selectedDayReservations}
    />
  )
}

export default Calendar
