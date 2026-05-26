import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import ReactCalendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import { getEffectiveReservationStatus } from '../utils/reservationUtils'
import ReservationNote from './ReservationNote'
import { formatDateTR } from '../utils/formatters'

const dayKey = (date) => format(date, 'yyyy-MM-dd')

const shortLabel = (reservation) => {
  const source = reservation.roomName || reservation.customerName || ''
  return source.length > 8 ? `${source.slice(0, 8)}…` : source
}

const paymentBadgeClass = {
  Ödenmedi: 'bg-rose-100 text-rose-700',
  'Kapora Alındı': 'bg-amber-100 text-amber-700',
  'Tamamı Ödendi': 'bg-emerald-100 text-emerald-700',
}

function CalendarReservationCard({ reservation, referenceDate, onSelect }) {
  const statusBadgeClass = {
    Aktif: 'bg-emerald-100 text-emerald-700',
    Tamamlandı: 'bg-slate-200 text-slate-700',
    İptal: 'bg-rose-100 text-rose-700',
  }

  const content = (
    <>
      <p className='font-medium text-blue-950'>{reservation.customerName}</p>
      <p className='text-sm text-slate-600'>Oda: {reservation.roomName || '-'}</p>
      <p className='text-sm text-slate-600'>
        {formatDateTR(reservation.checkInDate)} - {formatDateTR(reservation.checkOutDate)}
      </p>
      <ReservationNote note={reservation.note} className='mt-1' />
      <div className='mt-1 flex flex-wrap gap-2'>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            statusBadgeClass[getEffectiveReservationStatus(reservation, referenceDate)] ??
            'bg-slate-100 text-slate-700'
          }`}
        >
          {getEffectiveReservationStatus(reservation, referenceDate)}
        </span>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            paymentBadgeClass[reservation.paymentStatus] ?? 'bg-slate-100 text-slate-700'
          }`}
        >
          {reservation.paymentStatus || '-'}
        </span>
      </div>
    </>
  )

  if (onSelect) {
    return (
      <button
        type='button'
        onClick={() => onSelect(reservation)}
        className='w-full rounded-lg border border-slate-200 p-3 text-left transition hover:border-blue-200 hover:bg-slate-50'
      >
        {content}
      </button>
    )
  }

  return <article className='rounded-lg border border-slate-200 p-3'>{content}</article>
}

function CalendarView({
  loading,
  error,
  selectedDate,
  onDateChange,
  occupiedDatesMap,
  selectedDayReservations,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  onSearchResultSelect,
}) {
  const weekdayMap = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
  const isSearching = searchQuery.trim().length > 0

  const tileClassName = ({ date, view }) => {
    if (view !== 'month') return ''
    return occupiedDatesMap.has(dayKey(date)) ? 'tile-occupied' : 'tile-empty'
  }

  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null
    const dayReservations = occupiedDatesMap.get(dayKey(date))
    if (!dayReservations?.length) return null

    if (dayReservations.length === 1) {
      return <span className='tile-chip'>{shortLabel(dayReservations[0])}</span>
    }

    return <span className='tile-chip'>+{dayReservations.length}</span>
  }

  return (
    <section className='space-y-4'>
      <div className='card overflow-x-auto'>
        <div className='mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
          <h2 className='text-lg font-semibold text-blue-950'>Takvim</h2>
          <div className='w-full sm:max-w-xs'>
            <label htmlFor='calendar-search' className='mb-1 block text-sm font-medium text-slate-700'>
              Misafir ara
            </label>
            <input
              id='calendar-search'
              type='search'
              className='input'
              placeholder='İsim yazın...'
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        {error ? <p className='mb-3 text-sm text-rose-600'>{error}</p> : null}

        {loading ? (
          <p className='text-sm text-slate-500'>Takvim yükleniyor...</p>
        ) : (
          <div className='calendar-shell'>
            <ReactCalendar
              locale='tr-TR'
              value={selectedDate}
              onChange={onDateChange}
              formatMonthYear={(_, date) => format(date, 'MMMM yyyy', { locale: tr })}
              formatShortWeekday={(_, date) => weekdayMap[date.getDay()]}
              tileClassName={tileClassName}
              tileContent={tileContent}
            />
          </div>
        )}
      </div>

      {isSearching ? (
        <div className='card'>
          <h3 className='text-base font-semibold text-blue-950'>
            Arama sonuçları{' '}
            <span className='font-normal text-slate-400'>({searchResults.length})</span>
          </h3>
          {loading ? null : searchResults.length === 0 ? (
            <p className='mt-2 text-sm text-slate-500'>Eşleşen misafir bulunamadı.</p>
          ) : (
            <div className='mt-3 grid gap-3'>
              {searchResults.map((reservation) => (
                <CalendarReservationCard
                  key={reservation.id}
                  reservation={reservation}
                  referenceDate={selectedDate}
                  onSelect={onSearchResultSelect}
                />
              ))}
            </div>
          )}
          <p className='mt-3 text-xs text-slate-500'>
            Sonuca tıklayınca takvim o rezervasyonun giriş gününe gider.
          </p>
        </div>
      ) : (
        <div className='card'>
          <h3 className='text-base font-semibold text-blue-950'>
            {format(selectedDate, 'dd MMMM yyyy', { locale: tr })} — Rezervasyonlar{' '}
            <span className='font-normal text-slate-400'>({selectedDayReservations.length})</span>
          </h3>

          {loading ? null : selectedDayReservations.length === 0 ? (
            <p className='mt-2 text-sm text-slate-500'>Bu gün için rezervasyon yok.</p>
          ) : (
            <div className='mt-3 grid gap-3'>
              {selectedDayReservations.map((reservation) => (
                <CalendarReservationCard
                  key={reservation.id}
                  reservation={reservation}
                  referenceDate={selectedDate}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default CalendarView
