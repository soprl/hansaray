import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { useEffect, useMemo, useState } from 'react'
import ReservationNote from '../components/ReservationNote'
import StatCard from '../components/StatCard'
import { getReservations } from '../services/reservationService'
import { formatDateTR, formatCurrencyTRY } from '../utils/formatters'
import { getDashboardReservationMetrics } from '../utils/reservationUtils'

const paymentBadgeClass = {
  Ödenmedi: 'bg-rose-100 text-rose-700',
  'Kapora Alındı': 'bg-amber-100 text-amber-700',
  'Tamamı Ödendi': 'bg-emerald-100 text-emerald-700',
}

function ReservationDayList({ title, reservations, loading, emptyText, showCheckInDate = false }) {
  return (
    <section className='card'>
      <h2 className='text-base font-semibold text-blue-950 sm:text-lg'>
        {title}{' '}
        {!loading ? <span className='font-normal text-slate-400'>({reservations.length})</span> : null}
      </h2>
      {loading ? (
        <p className='mt-2 text-sm text-slate-500'>Yükleniyor...</p>
      ) : reservations.length === 0 ? (
        <p className='mt-2 text-sm text-slate-500'>{emptyText}</p>
      ) : (
        <ul className='mt-3 space-y-2'>
          {reservations.map((reservation) => (
            <li key={reservation.id} className='rounded-lg border border-slate-200 p-2.5'>
              <p className='text-sm font-medium text-blue-950'>{reservation.customerName}</p>
              <p className='text-xs text-slate-600'>
                {reservation.roomName}
                {showCheckInDate ? ` · Giriş ${formatDateTR(reservation.checkInDate)}` : null}
              </p>
              <ReservationNote note={reservation.note} className='mt-1 text-xs' />
              <span
                className={`mt-1 inline-block rounded px-2 py-0.5 text-[11px] font-medium ${
                  paymentBadgeClass[reservation.paymentStatus] ?? 'bg-slate-100 text-slate-700'
                }`}
              >
                {reservation.paymentStatus || '-'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Dashboard() {
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true)
      setError('')

      try {
        const data = await getReservations()
        setReservations(data)
      } catch (fetchError) {
        setError('Dashboard verileri yüklenirken bir hata oluştu.')
        console.error(fetchError)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  const metrics = useMemo(() => getDashboardReservationMetrics(reservations), [reservations])
  const monthLabel = format(new Date(), 'MMMM yyyy', { locale: tr })

  return (
    <section className='space-y-4'>
      <h2 className='text-base font-semibold capitalize text-blue-950 sm:text-lg'>{monthLabel} özeti</h2>
      <div className='grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4'>
        <StatCard title='Bugünkü Doluluk' value={loading ? '...' : `${metrics.todaysOccupancyCount}`} tone='warning' />
        <StatCard
          title='Bu Ay Rezervasyon Geliri'
          value={loading ? '...' : formatCurrencyTRY(metrics.monthlyReservationIncome)}
          tone='success'
        />
        <StatCard title='Aktif Rezervasyon' value={loading ? '...' : metrics.activeCount} tone='default' />
        <StatCard title='İptal Rezervasyon' value={loading ? '...' : metrics.cancelledCount} tone='danger' />
      </div>
      <div className='grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3'>
        <StatCard
          title='Toplam Bekleyen Ödeme'
          value={loading ? '...' : formatCurrencyTRY(metrics.totalPendingPayment)}
          tone='warning'
        />
        <StatCard
          title='Bu Ay Alınan Kapora'
          value={loading ? '...' : formatCurrencyTRY(metrics.monthlyDeposit)}
          tone='success'
        />
        <StatCard title='Bu Ay Tam Ödenen Rez.' value={loading ? '...' : metrics.monthlyFullyPaidCount} tone='default' />
      </div>

      {error ? <p className='text-sm text-rose-600'>{error}</p> : null}

      <div className='space-y-3 sm:space-y-4'>
        <ReservationDayList
          title='Bugün giriş yapacaklar'
          reservations={metrics.todaysCheckIns}
          loading={loading}
          emptyText='Bugün giriş yapan misafir yok.'
        />
        <ReservationDayList
          title='Bugün çıkış yapacaklar'
          reservations={metrics.todaysCheckOuts}
          loading={loading}
          emptyText='Bugün çıkış yapan misafir yok.'
        />
        <ReservationDayList
          title='Yaklaşan rezervasyonlar'
          reservations={metrics.upcomingReservations}
          loading={loading}
          emptyText='Yaklaşan rezervasyon yok.'
          showCheckInDate
        />
      </div>
    </section>
  )
}

export default Dashboard
