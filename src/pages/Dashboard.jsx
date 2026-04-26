import { useEffect, useMemo, useState } from 'react'
import StatCard from '../components/StatCard'
import { getReservations } from '../services/reservationService'
import { formatDateTR, formatCurrencyTRY } from '../utils/formatters'
import { getDashboardReservationMetrics } from '../utils/reservationUtils'

const paymentBadgeClass = {
  Ödenmedi: 'bg-rose-100 text-rose-700',
  'Kapora Alındı': 'bg-amber-100 text-amber-700',
  'Tamamı Ödendi': 'bg-emerald-100 text-emerald-700',
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

  const metrics = useMemo(() => {
    return getDashboardReservationMetrics(reservations)
  }, [reservations])

  return (
    <section className='space-y-4'>
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        <StatCard title='Bugünkü Doluluk' value={loading ? '...' : `${metrics.todaysOccupancyCount}`} tone='warning' />
        <StatCard
          title='Bu Ay Rezervasyon Geliri'
          value={loading ? '...' : formatCurrencyTRY(metrics.monthlyReservationIncome)}
          tone='success'
        />
        <StatCard title='Aktif Rezervasyon' value={loading ? '...' : metrics.activeCount} tone='default' />
        <StatCard title='İptal Rezervasyon' value={loading ? '...' : metrics.cancelledCount} tone='danger' />
      </div>
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
        <StatCard
          title='Toplam Bekleyen Ödeme'
          value={loading ? '...' : formatCurrencyTRY(metrics.totalPendingPayment)}
          tone='warning'
        />
        <StatCard title='Bu Ay Alınan Kapora' value={loading ? '...' : formatCurrencyTRY(metrics.monthlyDeposit)} tone='success' />
        <StatCard title='Bu Ay Tam Ödenen Rez.' value={loading ? '...' : metrics.monthlyFullyPaidCount} tone='default' />
      </div>

      {error ? <p className='text-sm text-rose-600'>{error}</p> : null}

      <div className='grid gap-4 lg:grid-cols-3'>
        <div className='card'>
          <h2 className='text-lg font-semibold text-blue-950'>Yaklaşan Rezervasyonlar</h2>
          {loading ? (
            <p className='mt-2 text-sm text-slate-500'>Yükleniyor...</p>
          ) : metrics.upcomingReservations.length === 0 ? (
            <p className='mt-2 text-sm text-slate-500'>Yaklaşan rezervasyon yok.</p>
          ) : (
            <ul className='mt-3 space-y-2'>
              {metrics.upcomingReservations.map((reservation) => (
                <li key={reservation.id} className='rounded-lg border border-slate-200 p-2'>
                  <p className='text-sm font-medium text-blue-950'>{reservation.customerName}</p>
                  <p className='text-xs text-slate-600'>
                    {reservation.roomName} - {formatDateTR(reservation.checkInDate)}
                  </p>
                  <span className={`mt-1 inline-block rounded px-2 py-0.5 text-[11px] font-medium ${paymentBadgeClass[reservation.paymentStatus] ?? 'bg-slate-100 text-slate-700'}`}>
                    {reservation.paymentStatus || '-'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className='card'>
          <h2 className='text-lg font-semibold text-blue-950'>Bugün Giriş Yapacaklar</h2>
          {loading ? (
            <p className='mt-2 text-sm text-slate-500'>Yükleniyor...</p>
          ) : metrics.todaysCheckIns.length === 0 ? (
            <p className='mt-2 text-sm text-slate-500'>Bugün giriş kaydı yok.</p>
          ) : (
            <ul className='mt-3 space-y-2'>
              {metrics.todaysCheckIns.map((reservation) => (
                <li key={reservation.id} className='rounded-lg border border-slate-200 p-2'>
                  <p className='text-sm font-medium text-blue-950'>{reservation.customerName}</p>
                  <p className='text-xs text-slate-600'>{reservation.roomName}</p>
                  <span className={`mt-1 inline-block rounded px-2 py-0.5 text-[11px] font-medium ${paymentBadgeClass[reservation.paymentStatus] ?? 'bg-slate-100 text-slate-700'}`}>
                    {reservation.paymentStatus || '-'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className='card'>
          <h2 className='text-lg font-semibold text-blue-950'>Bugün Çıkış Yapacaklar</h2>
          {loading ? (
            <p className='mt-2 text-sm text-slate-500'>Yükleniyor...</p>
          ) : metrics.todaysCheckOuts.length === 0 ? (
            <p className='mt-2 text-sm text-slate-500'>Bugün çıkış kaydı yok.</p>
          ) : (
            <ul className='mt-3 space-y-2'>
              {metrics.todaysCheckOuts.map((reservation) => (
                <li key={reservation.id} className='rounded-lg border border-slate-200 p-2'>
                  <p className='text-sm font-medium text-blue-950'>{reservation.customerName}</p>
                  <p className='text-xs text-slate-600'>{reservation.roomName}</p>
                  <span className={`mt-1 inline-block rounded px-2 py-0.5 text-[11px] font-medium ${paymentBadgeClass[reservation.paymentStatus] ?? 'bg-slate-100 text-slate-700'}`}>
                    {reservation.paymentStatus || '-'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

export default Dashboard
