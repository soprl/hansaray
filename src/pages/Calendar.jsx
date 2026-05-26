import { useEffect, useMemo, useState } from 'react'
import { eachDayOfInterval, format, subDays } from 'date-fns'
import CalendarView from '../components/CalendarView'
import { useAuth } from '../context/useAuth'
import { getReservations } from '../services/reservationService'
import { parseISODateSafe } from '../utils/formatters'
import {
  filterReservationsByName,
  getEffectiveReservationStatus,
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
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  const occupiedDatesMap = useMemo(() => {
    const map = new Map()

    reservations.forEach((reservation) => {
      const checkIn = parseISODateSafe(reservation.checkInDate)
      const checkOut = parseISODateSafe(reservation.checkOutDate)
      if (!checkIn || !checkOut || checkOut <= checkIn) return

      addReservationToMap(map, checkIn, reservation)
      addReservationToMap(map, checkOut, reservation)

      try {
        const rangeDays = eachDayOfInterval({
          start: checkIn,
          end: subDays(checkOut, 1),
        })

        rangeDays.forEach((date) => addReservationToMap(map, date, reservation))
      } catch {
        // Geçersiz tarih aralığı atlanır.
      }
    })

    return map
  }, [reservations])

  const selectedDayReservations = useMemo(
    () => occupiedDatesMap.get(dayKey(selectedDate)) ?? [],
    [occupiedDatesMap, selectedDate],
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
    if (checkIn) setSelectedDate(checkIn)
    setSearchQuery('')
  }

  return (
    <CalendarView
      loading={loading}
      error={error}
      selectedDate={selectedDate}
      onDateChange={setSelectedDate}
      occupiedDatesMap={occupiedDatesMap}
      selectedDayReservations={selectedDayReservations}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      searchResults={searchResults}
      onSearchResultSelect={handleSearchResultSelect}
    />
  )
}

export default Calendar
