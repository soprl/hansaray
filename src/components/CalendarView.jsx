import { useEffect, useMemo, useState } from 'react'
import {
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  startOfDay,
  startOfWeek,
} from 'date-fns'
import { tr } from 'date-fns/locale'
import ReservationNote from './ReservationNote'
import TurkishCalendar from './TurkishCalendar'
import {
  CALENDAR_MAX_DATE,
  CALENDAR_MIN_DATE,
  clampCalendarDate,
} from '../config/calendarBounds'
import { formatCurrencyTRY, formatDateTR, parseISODateSafe } from '../utils/formatters'
import {
  getCalendarDayReservations,
  getCalendarPaymentDisplay,
  getRemainingStayLabel,
  getReservationDayTags,
  getReservationNightCount,
} from '../utils/reservationUtils'
import { ROOM_COUNT } from '../utils/occupancyUtils'

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

function CalendarGuestCard({ reservation, referenceDate, onSelect }) {
  const tags = getReservationDayTags(reservation, referenceDate)
  const totalNights = getReservationNightCount(reservation)
  const remainingLabel = getRemainingStayLabel(reservation, referenceDate)
  const Wrapper = onSelect ? 'button' : 'div'
  const wrapperProps = onSelect
    ? {
        type: 'button',
        onClick: onSelect,
        className:
          'w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md',
      }
    : {
        className: 'rounded-xl border border-slate-200 bg-white p-3 shadow-sm',
      }

  return (
    <Wrapper {...wrapperProps}>
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0 flex-1'>
          <p className='text-base font-semibold text-blue-950'>{reservation.customerName || 'İsimsiz'}</p>
          <p className='mt-1 text-sm font-medium text-slate-700'>
            {reservation.roomName || 'Oda belirtilmemiş'}
          </p>
          <p className='mt-2 text-sm text-slate-600'>
            {formatDateTR(reservation.checkInDate)} → {formatDateTR(reservation.checkOutDate)}
          </p>
          <div className='mt-2 flex flex-wrap gap-2 text-sm'>
            {totalNights ? (
              <span className='rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-900'>
                Toplam {totalNights} gece
              </span>
            ) : null}
            {remainingLabel ? (
              <span className='rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-900'>
                {remainingLabel}
              </span>
            ) : null}
          </div>
          <p className='mt-1 text-sm text-slate-500'>Tel: {reservation.customerPhone || '—'}</p>
          <ReservationNote note={reservation.note} className='mt-2 text-xs' />
        </div>
        <div className='flex shrink-0 flex-col items-end gap-2'>
          <div className='flex flex-wrap justify-end gap-1'>
            {tags.map((tag) => (
              <span
                key={tag}
                className={`rounded-md px-2 py-0.5 text-xs font-semibold ${tagClass[tag]}`}
              >
                {tag}
              </span>
            ))}
          </div>
          <CalendarPaymentLabels reservation={reservation} />
          <p className='text-sm font-medium text-slate-700'>{formatCurrencyTRY(reservation.totalPrice)}</p>
        </div>
      </div>
    </Wrapper>
  )
}

function DaySection({ title, tone, reservations, referenceDate }) {
  if (reservations.length === 0) return null

  const toneClass = {
    sky: 'border-sky-200 bg-sky-50/80',
    violet: 'border-violet-200 bg-violet-50/80',
    emerald: 'border-emerald-200 bg-emerald-50/80',
  }[tone]

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <h4 className='mb-2 text-sm font-semibold text-blue-950'>
        {title} <span className='font-normal text-slate-500'>({reservations.length})</span>
      </h4>
      <ul className='space-y-2'>
        {reservations.map((reservation) => (
          <li key={reservation.id}>
            <CalendarGuestCard reservation={reservation} referenceDate={referenceDate} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function CalendarView({
  loading,
  error,
  reservations,
  selectedDate,
  onDateChange,
  overnightStaysMap,
  selectedDayReservations,
  selectedDayDetails,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  onSearchResultSelect,
}) {
  const [dayFilter, setDayFilter] = useState('all')
  const [viewMode, setViewMode] = useState('month')
  const isSearching = searchQuery.trim().length > 0
  const today = clampCalendarDate(startOfDay(new Date()))

  const { checkIns, checkOuts, stayingOnly, stays } = selectedDayDetails

  const weekRange = useMemo(() => {
    const start = startOfWeek(selectedDate, { locale: tr, weekStartsOn: 1 })
    const end = endOfWeek(selectedDate, { locale: tr, weekStartsOn: 1 })
    return { start, end, days: eachDayOfInterval({ start, end }) }
  }, [selectedDate])

  const weekDaysActivity = useMemo(
    () =>
      weekRange.days.map((day) => ({
        date: day,
        details: getCalendarDayReservations(reservations, day),
        nightCount: overnightStaysMap.get(dayKey(day))?.length ?? 0,
      })),
    [weekRange.days, reservations, overnightStaysMap],
  )

  const weekReservationCount = useMemo(() => {
    const seen = new Set()
    weekDaysActivity.forEach(({ details }) => {
      details.allForDay.forEach((reservation) => seen.add(reservation.id))
    })
    return seen.size
  }, [weekDaysActivity])

  useEffect(() => {
    setDayFilter('all')
  }, [selectedDate, viewMode])

  const shiftWeek = (delta) => {
    onDateChange(clampCalendarDate(addWeeks(selectedDate, delta)))
  }

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

  const uniqueRoomsToday = useMemo(() => {
    const rooms = new Set(
      stays.map((reservation) => (reservation.roomName || '').trim()).filter(Boolean),
    )
    return rooms.size
  }, [stays])

  const goToToday = () => {
    onDateChange(today)
  }

  const tileClassName = ({ date, view }) => {
    if (view !== 'month') return ''
    const classes = ['calendar-tile']
    const nightCount = overnightStaysMap.get(dayKey(date))?.length ?? 0
    if (nightCount > 0) classes.push('tile-has-events')
    if (nightCount >= ROOM_COUNT) classes.push('tile-full')
    if (isSameDay(date, today)) classes.push('tile-today')
    if (isSameDay(date, selectedDate)) classes.push('tile-selected')
    return classes.join(' ')
  }

  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null
    const nightCount = overnightStaysMap.get(dayKey(date))?.length ?? 0
    if (nightCount === 0) return null

    const label = nightCount === 1 ? '1 gece' : `${nightCount} gece`
    return (
      <div className='tile-day-summary' aria-hidden>
        <span className='tile-guest-label'>{label}</span>
      </div>
    )
  }

  const selectedLabel = format(selectedDate, 'd MMMM yyyy, EEEE', { locale: tr })

  return (
    <section className='space-y-4'>
      <div className='card overflow-x-auto'>
        <div className='mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h2 className='text-lg font-semibold text-blue-950'>Takvim</h2>
            <p className='mt-0.5 text-sm text-slate-500'>
              Güne tıklayın — o günkü konuklar, gece sayısı ve giriş/çıkışlar altta listelenir.
            </p>
          </div>
          <div className='flex w-full flex-col gap-2 sm:max-w-lg'>
            <div className='flex rounded-lg border border-slate-200 bg-slate-50 p-0.5'>
              <button
                type='button'
                onClick={() => setViewMode('month')}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                  viewMode === 'month' ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-600'
                }`}
              >
                Aylık
              </button>
              <button
                type='button'
                onClick={() => setViewMode('week')}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                  viewMode === 'week' ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-600'
                }`}
              >
                Haftalık gör
              </button>
            </div>
            <div className='flex flex-col gap-2 sm:flex-row'>
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
        </div>

        {error ? <p className='mb-3 text-sm text-rose-600'>{error}</p> : null}

        {loading ? (
          <p className='text-sm text-slate-500'>Takvim yükleniyor...</p>
        ) : viewMode === 'month' ? (
          <>
            <p className='mb-2 text-xs text-slate-500'>2026 – 2030</p>
            <div className='calendar-shell'>
              <TurkishCalendar
                value={selectedDate}
                onChange={onDateChange}
                minDate={CALENDAR_MIN_DATE}
                maxDate={CALENDAR_MAX_DATE}
                tileClassName={tileClassName}
                tileContent={tileContent}
              />
            </div>

            <div className='mt-3 flex flex-wrap gap-3 text-xs text-slate-600'>
              <span className='flex items-center gap-1.5'>
                <span className='inline-block h-3 w-3 rounded bg-emerald-100 ring-1 ring-emerald-400' />
                Gece konaklama var
              </span>
              <span className='flex items-center gap-1.5'>
                <span className='inline-block h-3 w-3 rounded bg-rose-100 ring-1 ring-rose-500' />
                {ROOM_COUNT} gece konaklayan = dolu (kırmızı)
              </span>
              <span className='flex items-center gap-1.5'>
                <span className='inline-block h-3 w-3 rounded ring-2 ring-blue-800' />
                Seçili gün
              </span>
            </div>
          </>
        ) : (
          <div className='space-y-3'>
            <div className='flex items-center justify-between gap-2'>
              <button
                type='button'
                className='btn border border-slate-300 bg-white px-3 text-sm'
                onClick={() => shiftWeek(-1)}
                disabled={weekRange.start <= CALENDAR_MIN_DATE}
              >
                ← Önceki
              </button>
              <p className='text-center text-sm font-semibold text-blue-950'>
                {format(weekRange.start, 'd MMM', { locale: tr })} –{' '}
                {format(weekRange.end, 'd MMM yyyy', { locale: tr })}
              </p>
              <button
                type='button'
                className='btn border border-slate-300 bg-white px-3 text-sm'
                onClick={() => shiftWeek(1)}
                disabled={weekRange.end >= CALENDAR_MAX_DATE}
              >
                Sonraki →
              </button>
            </div>

            <div className='grid grid-cols-7 gap-1 sm:gap-2'>
              {weekDaysActivity.map(({ date, details, nightCount }) => {
                const selected = isSameDay(date, selectedDate)
                const full = nightCount >= ROOM_COUNT
                return (
                  <button
                    key={dayKey(date)}
                    type='button'
                    onClick={() => onDateChange(clampCalendarDate(date))}
                    className={`flex min-h-[4.5rem] flex-col items-center rounded-lg border p-1.5 text-center transition sm:p-2 ${
                      selected
                        ? 'border-blue-800 bg-blue-50 ring-2 ring-blue-800'
                        : full
                          ? 'border-rose-300 bg-rose-50'
                          : nightCount > 0
                            ? 'border-emerald-200 bg-emerald-50/80'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className='text-[10px] font-medium uppercase text-slate-500 sm:text-xs'>
                      {format(date, 'EEE', { locale: tr })}
                    </span>
                    <span className='text-base font-bold text-blue-950 sm:text-lg'>
                      {format(date, 'd')}
                    </span>
                    {nightCount > 0 ? (
                      <span
                        className={`mt-0.5 rounded px-1 py-0.5 text-[9px] font-bold text-white sm:text-[10px] ${
                          full ? 'bg-rose-600' : 'bg-emerald-600'
                        }`}
                      >
                        {nightCount} gece
                      </span>
                    ) : (
                      <span className='mt-0.5 text-[10px] text-slate-400'>—</span>
                    )}
                    {details.allForDay.length > 0 ? (
                      <span className='mt-0.5 hidden text-[10px] text-slate-600 sm:block'>
                        {details.allForDay.length} kayıt
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>

            <p className='text-sm text-slate-600'>
              Bu hafta <strong>{weekReservationCount} rezervasyon</strong> (giriş, çıkış ve konaklama
              dahil). Aşağıda gün gün listelenir.
            </p>
          </div>
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
            <ul className='mt-3 space-y-2'>
              {searchResults.map((reservation) => (
                <li key={reservation.id}>
                  <CalendarGuestCard
                    reservation={reservation}
                    referenceDate={parseISODateSafe(reservation.checkInDate) || selectedDate}
                    onSelect={() => onSearchResultSelect(reservation)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {viewMode === 'week' && !isSearching ? (
        <div className='card space-y-4'>
          <h3 className='text-base font-semibold text-blue-950'>
            Haftalık liste{' '}
            <span className='font-normal text-slate-500'>
              ({format(weekRange.start, 'd MMM', { locale: tr })} –{' '}
              {format(weekRange.end, 'd MMM', { locale: tr })})
            </span>
          </h3>

          {loading ? (
            <p className='text-sm text-slate-500'>Yükleniyor...</p>
          ) : weekReservationCount === 0 ? (
            <p className='text-sm text-slate-500'>Bu hafta için rezervasyon yok.</p>
          ) : (
            <div className='space-y-4'>
              {weekDaysActivity.map(({ date, details }) => {
                if (details.allForDay.length === 0) return null

                const dayStays = details.stays.length
                return (
                  <div key={dayKey(date)} className='rounded-xl border border-slate-200 bg-slate-50/50 p-3'>
                    <div className='mb-2 flex flex-wrap items-baseline justify-between gap-2'>
                      <h4 className='font-semibold capitalize text-blue-950'>
                        {format(date, 'd MMMM yyyy, EEEE', { locale: tr })}
                      </h4>
                      <p className='text-xs text-slate-600'>
                        {details.allForDay.length} kayıt · {dayStays} gece konaklayan
                        {dayStays >= ROOM_COUNT ? ' · dolu' : ''}
                      </p>
                    </div>
                    <ul className='space-y-2'>
                      {details.allForDay.map((reservation) => (
                        <li key={`${dayKey(date)}-${reservation.id}`}>
                          <CalendarGuestCard reservation={reservation} referenceDate={date} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : null}

      {viewMode === 'month' && !isSearching ? (
      <div className='card space-y-4'>
        <div>
          <h3 className='text-base font-semibold capitalize text-blue-950'>{selectedLabel}</h3>
          {loading ? null : (
            <p className='mt-1 text-sm text-slate-600'>
              <strong className='text-blue-950'>{selectedDayReservations.length} kayıt</strong>
              {selectedDayReservations.length > 0 ? (
                <>
                  {' '}
                  · <strong>{stays.length} gece konaklayan</strong>
                  {stays.length >= ROOM_COUNT ? ' · tüm evler dolu' : ''}
                  {' '}
                  · {checkIns.length} giriş · {checkOuts.length} çıkış
                  {uniqueRoomsToday > 0 ? ` · ${uniqueRoomsToday} oda/ev` : ''}
                </>
              ) : (
                ' — bu gün için kayıt yok.'
              )}
            </p>
          )}
        </div>

        {!loading && selectedDayReservations.length > 0 ? (
          <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
            <div className='rounded-lg bg-slate-100 px-3 py-2 text-center'>
              <p className='text-2xl font-bold text-blue-950'>{selectedDayReservations.length}</p>
              <p className='text-xs text-slate-600'>Toplam</p>
            </div>
            <div className='rounded-lg bg-sky-50 px-3 py-2 text-center'>
              <p className='text-2xl font-bold text-sky-900'>{checkIns.length}</p>
              <p className='text-xs text-slate-600'>Giriş</p>
            </div>
            <div className='rounded-lg bg-violet-50 px-3 py-2 text-center'>
              <p className='text-2xl font-bold text-violet-900'>{checkOuts.length}</p>
              <p className='text-xs text-slate-600'>Çıkış</p>
            </div>
            <div
              className={`rounded-lg px-3 py-2 text-center ${
                stays.length >= ROOM_COUNT ? 'bg-rose-50 ring-1 ring-rose-300' : 'bg-emerald-50'
              }`}
            >
              <p
                className={`text-2xl font-bold ${
                  stays.length >= ROOM_COUNT ? 'text-rose-700' : 'text-emerald-900'
                }`}
              >
                {stays.length}
              </p>
              <p className='text-xs text-slate-600'>Gece konaklayan</p>
            </div>
          </div>
        ) : null}

        {!loading && selectedDayReservations.length > 0 ? (
          <div className='flex flex-wrap gap-1.5'>
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
        ) : null}

        {loading ? (
          <p className='text-sm text-slate-500'>Yükleniyor...</p>
        ) : selectedDayReservations.length === 0 ? (
          <p className='text-sm text-slate-500'>Bu gün için rezervasyon yok. Takvimden başka bir gün seçin.</p>
        ) : dayFilter === 'all' ? (
          <div className='space-y-3'>
            <DaySection
              title='Giriş yapacaklar'
              tone='sky'
              reservations={checkIns}
              referenceDate={selectedDate}
            />
            <DaySection
              title='Çıkış yapacaklar'
              tone='violet'
              reservations={checkOuts}
              referenceDate={selectedDate}
            />
            <DaySection
              title='Konaklayanlar (gece)'
              tone='emerald'
              reservations={stayingOnly}
              referenceDate={selectedDate}
            />
            {checkIns.length === 0 && checkOuts.length === 0 && stayingOnly.length === 0 ? (
              <ul className='space-y-2'>
                {filteredDayReservations.map((reservation) => (
                  <li key={reservation.id}>
                    <CalendarGuestCard reservation={reservation} referenceDate={selectedDate} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <ul className='space-y-2'>
            {filteredDayReservations.map((reservation) => (
              <li key={reservation.id}>
                <CalendarGuestCard reservation={reservation} referenceDate={selectedDate} />
              </li>
            ))}
          </ul>
        )}
      </div>
      ) : null}
    </section>
  )
}

export default CalendarView
