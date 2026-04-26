import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import ReactCalendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'

const dayKey = (date) => format(date, 'yyyy-MM-dd')

const shortLabel = (reservation) => {
  const source = reservation.roomName || reservation.customerName || ''
  return source.length > 8 ? `${source.slice(0, 8)}…` : source
}

function CalendarView({
  loading,
  error,
  selectedDate,
  onDateChange,
  occupiedDatesMap,
  selectedDayReservations,
}) {
  const tileClassName = ({ date, view }) => {
    if (view !== 'month') return ''
    return occupiedDatesMap.has(dayKey(date)) ? 'tile-occupied' : 'tile-empty'
  }

  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null
    const reservations = occupiedDatesMap.get(dayKey(date))
    if (!reservations?.length) return null

    if (reservations.length === 1) {
      return <span className='tile-chip'>{shortLabel(reservations[0])}</span>
    }

    return <span className='tile-chip'>+{reservations.length}</span>
  }

  return (
    <section className='space-y-4'>
      <div className='card overflow-x-auto'>
        <h2 className='mb-3 text-lg font-semibold text-blue-950'>Takvim</h2>

        {error ? <p className='mb-3 text-sm text-rose-600'>{error}</p> : null}

        {loading ? (
          <p className='text-sm text-slate-500'>Takvim yükleniyor...</p>
        ) : (
          <div className='calendar-shell'>
            <ReactCalendar
              locale='tr-TR'
              value={selectedDate}
              onChange={onDateChange}
              tileClassName={tileClassName}
              tileContent={tileContent}
            />
          </div>
        )}
      </div>

      <div className='card'>
        <h3 className='text-base font-semibold text-blue-950'>
          {format(selectedDate, 'dd MMMM yyyy', { locale: tr })} - Rezervasyonlar
        </h3>

        {loading ? null : selectedDayReservations.length === 0 ? (
          <p className='mt-2 text-sm text-slate-500'>Bu gün için rezervasyon yok.</p>
        ) : (
          <div className='mt-3 grid gap-3'>
            {selectedDayReservations.map((reservation) => (
              <article key={reservation.id} className='rounded-lg border border-slate-200 p-3'>
                <p className='font-medium text-blue-950'>{reservation.customerName}</p>
                <p className='text-sm text-slate-600'>Oda: {reservation.roomName || '-'}</p>
                <p className='text-sm text-slate-600'>
                  {format(parseISO(reservation.checkInDate), 'dd.MM.yyyy')} -{' '}
                  {format(parseISO(reservation.checkOutDate), 'dd.MM.yyyy')}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default CalendarView
