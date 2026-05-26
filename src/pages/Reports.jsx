import { format, parse, startOfMonth } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { getReservations } from '../services/reservationService'
import { getTransactions } from '../services/transactionService'
import {
  formatMonthLabel,
  getAllTimeFinanceNet,
  getFinanceMonthSummary,
  getMonthNavigationOptions,
  getReservationsForMonth,
  getTransactionsForMonth,
  shiftMonth,
} from '../utils/financeUtils'
import ReservationNote from '../components/ReservationNote'
import { formatCurrencyTRY, formatDateTR } from '../utils/formatters'
import { getMonthlyReservationBreakdown, getOutstandingPayment, isFullyPaidReservation } from '../utils/reservationUtils'

function Reports() {
  const { user } = useAuth()
  const [reservations, setReservations] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()))

  useEffect(() => {
    if (!user) return

    let cancelled = false

    Promise.all([getReservations(), getTransactions()])
      .then(([reservationData, transactionData]) => {
        if (!cancelled) {
          setReservations(reservationData)
          setTransactions(transactionData)
        }
      })
      .catch((fetchError) => {
        if (!cancelled) setError('Rapor verileri yüklenirken bir hata oluştu.')
        console.error(fetchError)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user])

  const monthKey = format(monthDate, 'yyyy-MM')

  const monthOptions = useMemo(() => getMonthNavigationOptions(monthDate), [monthDate])

  const reservationBreakdown = useMemo(
    () => getMonthlyReservationBreakdown(reservations, monthDate),
    [reservations, monthDate],
  )

  const allTimeNet = useMemo(
    () => getAllTimeFinanceNet(reservations, transactions),
    [reservations, transactions],
  )

  const summary = useMemo(
    () => getFinanceMonthSummary(reservations, transactions, monthDate),
    [reservations, transactions, monthDate],
  )

  const lodgingReservations = useMemo(
    () => getReservationsForMonth(reservations, monthDate),
    [reservations, monthDate],
  )

  const monthTransactions = useMemo(
    () =>
      getTransactionsForMonth(transactions, monthDate).sort((a, b) =>
        (b.date || '').localeCompare(a.date || ''),
      ),
    [transactions, monthDate],
  )

  const expenses = useMemo(
    () => monthTransactions.filter((t) => t.type === 'expense'),
    [monthTransactions],
  )

  const extraIncomes = useMemo(
    () => monthTransactions.filter((t) => t.type === 'income'),
    [monthTransactions],
  )

  const handleMonthSelect = (event) => {
    const parsed = parse(`${event.target.value}-01`, 'yyyy-MM-dd', new Date())
    if (!Number.isNaN(parsed.getTime())) {
      setMonthDate(startOfMonth(parsed))
    }
  }

  const monthLabel = formatMonthLabel(monthDate)

  return (
    <section className='space-y-4'>
      <div className='card'>
        <div className='flex items-center justify-center gap-2'>
          <button
            type='button'
            className='btn border border-slate-300 bg-white px-3'
            onClick={() => setMonthDate((d) => shiftMonth(d, -1))}
            aria-label='Önceki ay'
          >
            ←
          </button>
          <select
            className='input max-w-[220px] text-center font-medium capitalize'
            value={monthKey}
            onChange={handleMonthSelect}
          >
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type='button'
            className='btn border border-slate-300 bg-white px-3'
            onClick={() => setMonthDate((d) => shiftMonth(d, 1))}
            aria-label='Sonraki ay'
          >
            →
          </button>
        </div>
      </div>

      <p className='text-center text-sm capitalize text-slate-500'>{monthLabel} raporu</p>

      <section>
        <h2 className='mb-2 text-sm font-medium text-slate-600'>Bu ay rezervasyonlar (giriş tarihine göre)</h2>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          <article className='card'>
            <p className='text-sm text-slate-500'>Toplam</p>
            <p className='mt-1 text-2xl font-semibold text-blue-950'>
              {loading ? '...' : reservationBreakdown.total}
            </p>
          </article>
          <article className='card'>
            <p className='text-sm text-slate-500'>Tamamlandı</p>
            <p className='mt-1 text-2xl font-semibold text-indigo-600'>
              {loading ? '...' : reservationBreakdown.completed}
            </p>
          </article>
          <article className='card'>
            <p className='text-sm text-slate-500'>Tamamlanmadı</p>
            <p className='mt-1 text-2xl font-semibold text-emerald-600'>
              {loading ? '...' : reservationBreakdown.ongoing}
            </p>
            <p className='mt-1 text-xs text-slate-400'>Devam eden veya girişi geçmiş aktif</p>
          </article>
          <article className='card'>
            <p className='text-sm text-slate-500'>Gelecek</p>
            <p className='mt-1 text-2xl font-semibold text-sky-600'>
              {loading ? '...' : reservationBreakdown.upcoming}
            </p>
            <p className='mt-1 text-xs text-slate-400'>Giriş tarihi henüz gelmedi</p>
          </article>
        </div>
        {!loading && reservationBreakdown.cancelled > 0 ? (
          <p className='mt-2 text-xs text-slate-500'>İptal: {reservationBreakdown.cancelled}</p>
        ) : null}
      </section>

      <section>
        <h2 className='mb-2 text-sm font-medium text-slate-600'>Finansal özet</h2>
        <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
          <article className='card'>
            <p className='text-sm text-slate-500'>Konaklama geliri</p>
            <p className='mt-1 text-xl font-semibold text-emerald-600'>
              {loading ? '...' : formatCurrencyTRY(summary.lodgingIncome)}
            </p>
            <p className='mt-1 text-xs text-slate-400'>Rezervasyonlardan</p>
          </article>
          <article className='card'>
            <p className='text-sm text-slate-500'>Gider</p>
            <p className='mt-1 text-xl font-semibold text-rose-600'>
              {loading ? '...' : formatCurrencyTRY(summary.expense)}
            </p>
          </article>
          <article className='card'>
            <p className='text-sm text-slate-500'>Net kazanç (bu ay)</p>
            <p className='mt-1 text-xl font-semibold text-blue-950'>
              {loading ? '...' : formatCurrencyTRY(summary.net)}
            </p>
            <p className='mt-1 text-xs text-slate-400'>
              Ek gelir {loading ? '...' : formatCurrencyTRY(summary.extraIncome)} dahil
            </p>
          </article>
          <article className='card'>
            <p className='text-sm text-slate-500'>Bekleyen tahsilat</p>
            <p className='mt-1 text-xl font-semibold text-amber-600'>
              {loading ? '...' : formatCurrencyTRY(summary.pendingCollection)}
            </p>
            <p className='mt-1 text-xs text-slate-400'>Bu ay giriş yapan misafirler</p>
          </article>
          <article className='card border-blue-200 bg-blue-50/50'>
            <p className='text-sm text-slate-500'>Toplam net kazanç</p>
            <p className='mt-1 text-xl font-semibold text-blue-950'>
              {loading ? '...' : formatCurrencyTRY(allTimeNet)}
            </p>
            <p className='mt-1 text-xs text-slate-400'>Tüm zamanlar (rezervasyon + manuel)</p>
          </article>
        </div>
      </section>

      {error ? <p className='text-sm text-rose-600'>{error}</p> : null}

      {loading ? (
        <p className='text-sm text-slate-500'>Yükleniyor...</p>
      ) : (
        <div className='space-y-4'>
          <ReportSection title='Konaklama gelirleri' count={lodgingReservations.length} emptyText='Bu ay konaklama geliri yok.'>
            {lodgingReservations.map((reservation) => (
              <article key={reservation.id} className='rounded-lg border border-slate-200 p-4'>
                <div className='flex flex-col justify-between gap-2 sm:flex-row sm:items-start'>
                  <div>
                    <p className='font-semibold text-blue-950'>{reservation.customerName}</p>
                    <p className='text-sm text-slate-600'>
                      {reservation.roomName} · Giriş {formatDateTR(reservation.checkInDate)}
                    </p>
                    <ReservationNote note={reservation.note} className='mt-1' />
                  </div>
                  <div className='text-right'>
                    <p className='font-semibold text-emerald-600'>{formatCurrencyTRY(reservation.totalPrice)}</p>
                    {isFullyPaidReservation(reservation) ? (
                      <p className='text-sm text-slate-500'>Tamamı ödendi</p>
                    ) : (
                      <p className='text-sm text-amber-600'>
                        Kalan {formatCurrencyTRY(getOutstandingPayment(reservation))}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </ReportSection>

          <ReportSection title='Giderler' count={expenses.length} emptyText='Bu ay gider kaydı yok.'>
            {expenses.map((transaction) => (
              <TransactionLine key={transaction.id} transaction={transaction} />
            ))}
          </ReportSection>

          <ReportSection title='Ek gelirler' count={extraIncomes.length} emptyText='Bu ay ek gelir kaydı yok.'>
            {extraIncomes.map((transaction) => (
              <TransactionLine key={transaction.id} transaction={transaction} />
            ))}
          </ReportSection>
        </div>
      )}
    </section>
  )
}

function ReportSection({ title, count, emptyText, children }) {
  return (
    <section className='card'>
      <h2 className='text-base font-semibold text-blue-950'>
        {title} <span className='font-normal text-slate-400'>({count})</span>
      </h2>
      {count === 0 ? (
        <p className='mt-3 text-sm text-slate-500'>{emptyText}</p>
      ) : (
        <div className='mt-3 grid gap-2'>{children}</div>
      )}
    </section>
  )
}

function TransactionLine({ transaction }) {
  const isIncome = transaction.type === 'income'

  return (
    <article className='rounded-lg border border-slate-200 p-4'>
      <div className='flex flex-col justify-between gap-2 sm:flex-row sm:items-start'>
        <div>
          <p className='font-semibold text-blue-950'>{transaction.title}</p>
          <p className='text-sm text-slate-600'>{transaction.category}</p>
          <p className='text-sm text-slate-500'>{formatDateTR(transaction.date)}</p>
          {transaction.note ? <p className='text-sm text-slate-500'>{transaction.note}</p> : null}
        </div>
        <p className={`font-semibold ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
          {isIncome ? '+' : '-'}
          {formatCurrencyTRY(transaction.amount)}
        </p>
      </div>
    </article>
  )
}

export default Reports
