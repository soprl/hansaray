import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { tr } from 'date-fns/locale'
import TurkishCalendar from './TurkishCalendar'
import {
  CALENDAR_MAX_DATE,
  CALENDAR_MIN_DATE,
  clampCalendarDate,
} from '../config/calendarBounds'
import { formatCurrencyTRY, formatDateTR, parseISODateSafe } from '../utils/formatters'
import {
  getCalendarDayReservations,
  getRemainingStayLabel,
  getReservationDayTags,
  getReservationNightCount,
  isFullyPaidReservation,
} from '../utils/reservationUtils'
import { getRoomDisplayName } from '../config/rooms'
import { HOTEL_TIME_POLICY_LABEL } from '../config/hotelTime'
import { getOccupancyLevel, getOvernightStayStats, ROOM_COUNT } from '../utils/occupancyUtils'

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

/** O gece yatakta kalan misafir sayısı (giriş dahil, çıkış günü hariç) */
function formatOvernightGuestCount(count) {
  if (count <= 0) return null
  return count === 1 ? '1 kişi' : `${count} kişi`
}

function getWeekDayButtonClass({ selected, level }) {
  if (selected && level === 'full') return 'border-blue-800 bg-rose-100 ring-2 ring-blue-800'
  if (selected && level === 'high') return 'border-blue-800 bg-orange-100 ring-2 ring-blue-800'
  if (selected) return 'border-blue-800 bg-blue-50 ring-2 ring-blue-800'
  if (level === 'full') return 'border-rose-500 bg-rose-100 ring-2 ring-rose-400'
  if (level === 'high') return 'border-orange-500 bg-orange-100 ring-2 ring-orange-400'
  if (level === 'normal') return 'border-emerald-200 bg-emerald-50/80'
  return 'border-slate-200 bg-white hover:bg-slate-50'
}

function getGuestCountBadgeClass(level) {
  if (level === 'full') return 'bg-rose-700'
  if (level === 'high') return 'bg-orange-600'
  return 'bg-emerald-600'
}

function CalendarGuestCard({
  reservation,
  referenceDate,
  onSelect,
  onMarkFullyPaid,
  payingReservationId,
}) {
  const tags = getReservationDayTags(reservation, referenceDate)
  const totalNights = getReservationNightCount(reservation)
  const remainingLabel = getRemainingStayLabel(reservation, referenceDate)
  const totalPrice = Number(reservation.totalPrice) || 0
  const deposit = Number(reservation.deposit) || 0
  const isPaid = isFullyPaidReservation(reservation)
  const outstanding = isPaid ? 0 : Math.max(totalPrice - deposit, 0)
  const canMarkPaid = Boolean(onMarkFullyPaid) && !isPaid && totalPrice > 0
  const marking = payingReservationId === reservation.id
  const note = reservation.note?.trim()
  const phone = reservation.customerPhone?.trim()

  const cardClassName =
    'w-full rounded-lg border border-slate-200 bg-white p-2.5 text-left shadow-sm'

  const inner = (
    <div className='flex items-start justify-between gap-3'>
      <div className='min-w-0 flex-1'>
        <p className='break-words font-semibold leading-snug text-blue-950'>
          {reservation.customerName || 'İsimsiz'}
        </p>
        <p className='mt-0.5 text-sm text-slate-700'>
          {getRoomDisplayName(reservation.roomName) || 'Oda?'}
          {totalNights ? ` · ${totalNights} gece konaklama` : ''}
          {remainingLabel ? ` · ${remainingLabel}` : ''}
        </p>
        <p className='mt-1 text-xs text-slate-500'>
          {formatDateTR(reservation.checkInDate)} → {formatDateTR(reservation.checkOutDate)}
        </p>
        {phone ? <p className='mt-1 text-sm text-slate-800'>{phone}</p> : null}
        {note ? <p className='mt-0.5 break-words text-xs text-amber-900'>Not: {note}</p> : null}
      </div>

      <div className='flex shrink-0 flex-col items-end gap-1 text-right'>
        <div className='flex flex-wrap justify-end gap-0.5'>
          {tags.map((tag) => (
            <span
              key={tag}
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight ${tagClass[tag]}`}
            >
              {tag}
            </span>
          ))}
        </div>
        <p className='text-sm font-semibold text-blue-950'>{formatCurrencyTRY(totalPrice)}</p>
        <p className='text-xs text-amber-800'>Kapora: {formatCurrencyTRY(deposit)}</p>
        {isPaid ? (
          <p className='text-xs font-medium text-emerald-700'>Tamamı ödendi</p>
        ) : (
          <>
            <p className='text-xs font-semibold text-rose-600'>Kalan: {formatCurrencyTRY(outstanding)}</p>
            {canMarkPaid ? (
              <button
                type='button'
                disabled={marking}
                onClick={(event) => {
                  event.stopPropagation()
                  onMarkFullyPaid(reservation)
                }}
                className='mt-0.5 rounded-md border border-emerald-600 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60'
              >
                {marking ? 'Kaydediliyor…' : 'Tamamı ödendi'}
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  )

  if (onSelect) {
    return (
      <button type='button' onClick={onSelect} className={`${cardClassName} transition hover:border-blue-300`}>
        {inner}
      </button>
    )
  }

  return <div className={cardClassName}>{inner}</div>
}

function DaySection({ title, tone, reservations, referenceDate, onMarkFullyPaid, payingReservationId }) {
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
            <CalendarGuestCard
              reservation={reservation}
              referenceDate={referenceDate}
              onMarkFullyPaid={onMarkFullyPaid}
              payingReservationId={payingReservationId}
            />
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
  onMarkFullyPaid,
  payingReservationId,
}) {
  const [dayFilter, setDayFilter] = useState('all')
  const [viewMode, setViewMode] = useState('week')
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(selectedDate))
  const weekTodayButtonRef = useRef(null)
  const isSearching = searchQuery.trim().length > 0

  const getToday = () => clampCalendarDate(startOfDay(new Date()))

  const { checkIns, checkOuts, stayingOnly, stays } = selectedDayDetails

  const weekRange = useMemo(() => {
    const start = startOfWeek(selectedDate, { locale: tr, weekStartsOn: 1 })
    const end = endOfWeek(selectedDate, { locale: tr, weekStartsOn: 1 })
    return { start, end, days: eachDayOfInterval({ start, end }) }
  }, [selectedDate])

  const getDayStayStats = (date) =>
    getOvernightStayStats(overnightStaysMap.get(dayKey(date)) ?? [])

  const weekDaysActivity = useMemo(
    () =>
      weekRange.days.map((day) => ({
        date: day,
        details: getCalendarDayReservations(reservations, day),
        stayStats: getOvernightStayStats(overnightStaysMap.get(dayKey(day)) ?? []),
      })),
    [weekRange.days, reservations, overnightStaysMap],
  )

  useEffect(() => {
    setDayFilter('all')
  }, [selectedDate, viewMode])

  useEffect(() => {
    setVisibleMonth(startOfMonth(selectedDate))
  }, [selectedDate])

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

  const selectedDayStayStats = useMemo(() => getOvernightStayStats(stays), [stays])

  const uniqueRoomsToday = selectedDayStayStats.occupiedRoomCount

  const goToToday = () => {
    const now = getToday()
    onDateChange(now)
    requestAnimationFrame(() => {
      weekTodayButtonRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    })
  }

  const tileClassName = ({ date, view }) => {
    if (view !== 'month') return ''
    const classes = ['calendar-tile']
    const dayStats = getDayStayStats(date)
    const { guestCount } = dayStats
    const level = getOccupancyLevel(dayStats)
    if (guestCount > 0) classes.push('tile-has-events')
    if (level === 'full') classes.push('tile-full')
    if (level === 'high') classes.push('tile-high')
    if (isSameDay(date, getToday())) classes.push('tile-today')
    if (isSameDay(date, selectedDate)) classes.push('tile-selected')
    return classes.join(' ')
  }

  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null
    const { guestCount } = getDayStayStats(date)
    const label = formatOvernightGuestCount(guestCount)
    if (!label) return null

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
              {viewMode === 'week'
                ? 'Haftayı seçin, güne tıklayın — o günün konukları altta görünür.'
                : 'Güne tıklayın — konuklar ve giriş/çıkışlar altta listelenir.'}
              <span className='mt-1 block text-xs text-slate-400'>{HOTEL_TIME_POLICY_LABEL}</span>
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
                activeStartDate={visibleMonth}
                onActiveStartDateChange={({ activeStartDate }) => {
                  if (activeStartDate instanceof Date && !Number.isNaN(activeStartDate.getTime())) {
                    setVisibleMonth(activeStartDate)
                  }
                }}
                tileClassName={tileClassName}
                tileContent={tileContent}
              />
            </div>

            <div className='mt-3 flex flex-wrap gap-3 text-xs text-slate-600'>
              <span className='flex items-center gap-1.5'>
                <span className='inline-block h-3 w-3 rounded bg-emerald-100 ring-1 ring-emerald-400' />
                En az 1 kişi konaklıyor
              </span>
              <span className='flex items-center gap-1.5'>
                <span className='inline-block h-3 w-3 rounded bg-orange-100 ring-1 ring-orange-500' />
                {ROOM_COUNT - 1} oda dolu = turuncu
              </span>
              <span className='flex items-center gap-1.5'>
                <span className='inline-block h-3 w-3 rounded bg-rose-100 ring-1 ring-rose-500' />
                {ROOM_COUNT} oda dolu = kırmızı
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
              {weekDaysActivity.map(({ date, details, stayStats }) => {
                const selected = isSameDay(date, selectedDate)
                const isToday = isSameDay(date, getToday())
                const { guestCount } = stayStats
                const level = getOccupancyLevel(stayStats)
                return (
                  <button
                    key={dayKey(date)}
                    ref={isToday ? weekTodayButtonRef : undefined}
                    type='button'
                    onClick={() => onDateChange(clampCalendarDate(date))}
                    className={`flex min-h-[4.5rem] flex-col items-center rounded-lg border p-1.5 text-center transition sm:p-2 ${getWeekDayButtonClass({ selected, level })}`}
                  >
                    <span className='text-[10px] font-medium uppercase text-slate-500 sm:text-xs'>
                      {format(date, 'EEE', { locale: tr })}
                    </span>
                    <span className='text-base font-bold text-blue-950 sm:text-lg'>
                      {format(date, 'd')}
                    </span>
                    {guestCount > 0 ? (
                      <span
                        className={`mt-0.5 rounded px-1 py-0.5 text-[9px] font-bold text-white sm:text-[10px] ${getGuestCountBadgeClass(level)}`}
                      >
                        {formatOvernightGuestCount(guestCount)}
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
                    onMarkFullyPaid={onMarkFullyPaid}
                    payingReservationId={payingReservationId}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {!isSearching ? (
      <div className='card space-y-4'>
        <div>
          <h3 className='text-base font-semibold capitalize text-blue-950'>{selectedLabel}</h3>
          {loading ? null : (
            <p className='mt-1 text-sm text-slate-600'>
              <strong className='text-blue-950'>{selectedDayReservations.length} kayıt</strong>
              {selectedDayReservations.length > 0 ? (
                <>
                  {' '}
                  · <strong>{selectedDayStayStats.guestCount} kişi o gece konaklıyor</strong>
                  {selectedDayStayStats.isAllRoomsFull
                    ? ' · tüm evler dolu'
                    : selectedDayStayStats.isNearlyFull
                      ? ` · ${ROOM_COUNT - 1} ev dolu`
                      : ''}
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
                selectedDayStayStats.isAllRoomsFull
                  ? 'bg-rose-100 ring-2 ring-rose-400'
                  : selectedDayStayStats.isNearlyFull
                    ? 'bg-orange-100 ring-2 ring-orange-400'
                    : 'bg-emerald-50'
              }`}
            >
              <p
                className={`text-2xl font-bold ${
                  selectedDayStayStats.isAllRoomsFull
                    ? 'text-rose-800'
                    : selectedDayStayStats.isNearlyFull
                      ? 'text-orange-900'
                      : 'text-emerald-900'
                }`}
              >
                {selectedDayStayStats.guestCount}
              </p>
              <p className='text-xs text-slate-600'>O gece konaklayan</p>
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
              onMarkFullyPaid={onMarkFullyPaid}
              payingReservationId={payingReservationId}
            />
            <DaySection
              title='Çıkış yapacaklar'
              tone='violet'
              reservations={checkOuts}
              referenceDate={selectedDate}
              onMarkFullyPaid={onMarkFullyPaid}
              payingReservationId={payingReservationId}
            />
            <DaySection
              title='O gece konaklayanlar'
              tone='emerald'
              reservations={stayingOnly}
              referenceDate={selectedDate}
              onMarkFullyPaid={onMarkFullyPaid}
              payingReservationId={payingReservationId}
            />
            {checkIns.length === 0 && checkOuts.length === 0 && stayingOnly.length === 0 ? (
              <ul className='space-y-2'>
                {filteredDayReservations.map((reservation) => (
                  <li key={reservation.id}>
                    <CalendarGuestCard
                      reservation={reservation}
                      referenceDate={selectedDate}
                      onMarkFullyPaid={onMarkFullyPaid}
                      payingReservationId={payingReservationId}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <ul className='space-y-2'>
            {filteredDayReservations.map((reservation) => (
              <li key={reservation.id}>
                <CalendarGuestCard
                  reservation={reservation}
                  referenceDate={selectedDate}
                  onMarkFullyPaid={onMarkFullyPaid}
                  payingReservationId={payingReservationId}
                />
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
