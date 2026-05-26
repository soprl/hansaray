import { useEffect, useMemo, useState } from 'react'
import { differenceInCalendarDays, format, isSameDay, startOfDay } from 'date-fns'
import { tr } from 'date-fns/locale'
import ReactCalendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import ReservationNote from './ReservationNote'
import { formatDateTR, parseISODateSafe } from '../utils/formatters'
import { getCalendarPaymentDisplay, getReservationDayTags } from '../utils/reservationUtils'

const dayKey = (date) => format(date, 'yyyy-MM-dd')

const DAY_FILTERS = [
  { id: 'all', label: 'Tümü' },
  { id: 'Giriş', label: 'Giriş' },
  { id: 'Çıkış', label: 'Çıkış' },
  { id: 'Konaklıyor', label: 'Konaklıyor' },
]

const tagClass = {
  Giriş: 'bg-sky-100 text-sky-800',
  Çıkış: 'bg-violet-100 text-violet-800',
  Konaklıyor: 'bg-emerald-100 text-emerald-800',
}

function getStayNights(reservation) {
  const checkIn = parseISODateSafe(reservation.checkInDate)
  const checkOut = parseISODateSafe(reservation.checkOutDate)
  if (!checkIn || !checkOut) return null
  const nights = differenceInCalendarDays(checkOut, checkIn)
  if (nights <= 0) return null
  return `${nights} gece`
}

function CalendarPaymentLabels({ reservation }) {
  const { primary, primaryTone, showUnpaid } = getCalendarPaymentDisplay(reservation)

  if (!primary && !showUnpaid) return null

  const primaryClass =
    primaryTone === 'paid' ? 'font-medium text-emerald-700' : 'font-medium text-amber-800'

  return (
    <div className='flex flex-col items-end gap-0.5 text-sm'>
      {primary ? <span className={primaryClass}>{primary}</span> : null}
      {showUnpaid ? <span className='font-semibold text-rose-600'>Ödenmedi</span> : null}
    </div>
  )
}

function CalendarRow({ reservation, referenceDate, expanded, onToggle, onSelect }) {
  const tags = getReservationDayTags(reservation, referenceDate)
  const nights = getStayNights(reservation)
  const Wrapper = onSelect ? 'button' : 'div'
  const wrapperProps = onSelect
    ? {
        type: 'button',
        onClick: onSelect,
        className:
          'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-blue-200 hover:bg-slate-50',
      }
    : {
        className: 'rounded-lg border border-slate-200 bg-white px-3 py-2.5',
      }

  return (
    <div className='space-y-0'>
      <Wrapper {...wrapperProps}>
        <div className='flex items-start justify-between gap-2'>
          <div className='min-w-0 flex-1'>
            <p className='truncate font-medium text-blue-950'>{reservation.customerName}</p>
            <p className='mt-0.5 text-sm text-slate-500'>
              {reservation.roomName || 'Oda yok'}
              {nights ? ` · ${nights}` : ''}
            </p>
          </div>
          <div className='flex shrink-0 flex-col items-end gap-1.5'>
            <div className='flex flex-wrap justify-end gap-1'>
              {tags.map((tag) => (
                <span
                  key={tag}
                  className={`rounded-md px-2 py-0.5 text-sm font-medium ${tagClass[tag]}`}
                >
                  {tag}
                </span>
              ))}
            </div>
            <CalendarPaymentLabels reservation={reservation} />
          </div>
        </div>
      </Wrapper>

      {!onSelect ? (
        <button
          type='button'
          onClick={onToggle}
          className='-mt-px w-full rounded-b-lg border border-t-0 border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100'
        >
          {expanded ? 'Detayı gizle' : 'Detay'}
        </button>
      ) : null}

      {!onSelect && expanded ? (
        <div className='rounded-b-lg border border-t-0 border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600'>
          <p>
            {formatDateTR(reservation.checkInDate)} – {formatDateTR(reservation.checkOutDate)}
          </p>
          {reservation.customerPhone ? <p className='mt-1'>{reservation.customerPhone}</p> : null}
          <ReservationNote note={reservation.note} className='mt-1' />
        </div>
      ) : null}
    </div>
  )
}

function CalendarView({
  loading,
  error,
  selectedDate,
  onDateChange,
  occupiedDatesMap,
  selectedDayReservations,
  selectedDayDetails,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  onSearchResultSelect,
}) {
  const weekdayMap = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
  const [dayFilter, setDayFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const isSearching = searchQuery.trim().length > 0
  const today = startOfDay(new Date())

  const { checkIns, checkOuts } = selectedDayDetails

  useEffect(() => {
    setDayFilter('all')
    setExpandedId(null)
  }, [selectedDate])

  const filteredDayReservations = useMemo(() => {
    const tagOrder = { Giriş: 0, Çıkış: 1, Konaklıyor: 2 }
    const list =
      dayFilter === 'all'
        ? [...selectedDayReservations]
        : selectedDayReservations.filter((reservation) =>
            getReservationDayTags(reservation, selectedDate).includes(dayFilter),
          )

    return list.sort((a, b) => {
      const tagA = getReservationDayTags(a, selectedDate)[0]
      const tagB = getReservationDayTags(b, selectedDate)[0]
      const orderDiff = (tagOrder[tagA] ?? 3) - (tagOrder[tagB] ?? 3)
      if (orderDiff !== 0) return orderDiff
      return (a.customerName || '').localeCompare(b.customerName || '', 'tr')
    })
  }, [selectedDayReservations, selectedDate, dayFilter])

  const goToToday = () => onDateChange(today)

  const tileClassName = ({ date, view }) => {
    if (view !== 'month') return ''
    const classes = ['calendar-tile']
    if (occupiedDatesMap.has(dayKey(date))) classes.push('tile-has-events')
    if (isSameDay(date, today)) classes.push('tile-today')
    if (isSameDay(date, selectedDate)) classes.push('tile-selected')
    return classes.join(' ')
  }

  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null
    const count = occupiedDatesMap.get(dayKey(date))?.length ?? 0
    if (count === 0) return null
    return <span className='tile-count'>{count > 9 ? '9+' : count}</span>
  }

  return (
    <section className='space-y-4'>
      <div className='card overflow-x-auto'>
        <div className='mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <h2 className='text-lg font-semibold text-blue-950'>Takvim</h2>
          <div className='flex w-full flex-col gap-2 sm:max-w-md sm:flex-row'>
            <input
              id='calendar-search'
              type='search'
              className='input flex-1'
              placeholder='Misafir ara…'
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              disabled={loading}
              aria-label='Misafir ara'
            />
            <button
              type='button'
              className='shrink-0 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50'
              onClick={goToToday}
            >
              Bugüne git
            </button>
          </div>
        </div>

        {error ? <p className='mb-3 text-sm text-rose-600'>{error}</p> : null}

        {loading ? (
          <p className='text-sm text-slate-500'>Takvim yükleniyor...</p>
        ) : (
          <>
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

            <div className='mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700'>
              <span className='font-medium text-blue-950'>
                {format(selectedDate, 'd MMMM yyyy', { locale: tr })}
              </span>
              <span className='text-slate-300'>|</span>
              <span>{selectedDayReservations.length} rezervasyon</span>
              {checkIns.length > 0 ? <span>{checkIns.length} giriş</span> : null}
              {checkOuts.length > 0 ? <span>{checkOuts.length} çıkış</span> : null}
            </div>

            <div className='mt-2 flex flex-wrap gap-1.5'>
              {DAY_FILTERS.map((filter) => {
                const count =
                  filter.id === 'all'
                    ? selectedDayReservations.length
                    : selectedDayReservations.filter((r) =>
                        getReservationDayTags(r, selectedDate).includes(filter.id),
                      ).length

                return (
                  <button
                    key={filter.id}
                    type='button'
                    onClick={() => setDayFilter(filter.id)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      dayFilter === filter.id
                        ? 'bg-blue-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {filter.label} ({count})
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {isSearching ? (
        <div className='card'>
          <h3 className='text-sm font-semibold text-blue-950'>
            Arama sonuçları <span className='font-normal text-slate-400'>({searchResults.length})</span>
          </h3>
          {loading ? null : searchResults.length === 0 ? (
            <p className='mt-2 text-sm text-slate-500'>Eşleşen misafir bulunamadı.</p>
          ) : (
            <ul className='mt-2 space-y-2'>
              {searchResults.map((reservation) => (
                <li key={reservation.id}>
                  <CalendarRow
                    reservation={reservation}
                    referenceDate={selectedDate}
                    onSelect={() => onSearchResultSelect(reservation)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className='card'>
        <h3 className='text-sm font-semibold text-blue-950'>
          Günün listesi{' '}
          <span className='font-normal text-slate-400'>({filteredDayReservations.length})</span>
        </h3>

        {loading ? (
          <p className='mt-2 text-sm text-slate-500'>Yükleniyor...</p>
        ) : filteredDayReservations.length === 0 ? (
          <p className='mt-2 text-sm text-slate-500'>
            {dayFilter === 'all' ? 'Bu gün için rezervasyon yok.' : 'Bu filtrede kayıt yok.'}
          </p>
        ) : (
          <ul className='mt-2 space-y-2'>
            {filteredDayReservations.map((reservation) => (
              <li key={reservation.id}>
                <CalendarRow
                  reservation={reservation}
                  referenceDate={selectedDate}
                  expanded={expandedId === reservation.id}
                  onToggle={() =>
                    setExpandedId((current) => (current === reservation.id ? null : reservation.id))
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default CalendarView
