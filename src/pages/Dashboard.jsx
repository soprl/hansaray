import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ReservationNote from '../components/ReservationNote'
import StatCard from '../components/StatCard'
import { useAuth } from '../context/useAuth'
import { getReservations } from '../services/reservationService'
import { getFirestoreErrorMessage } from '../utils/firestoreAuth'
import { formatDateTR, formatCurrencyTRY } from '../utils/formatters'
import {
  DEFAULT_BUSINESS_TARGETS,
  getBusinessTargets,
  hasConfiguredTargets,
} from '../services/businessTargetsService'
import { getGoalProgress, getOccupancySnapshot, ROOM_COUNT } from '../utils/occupancyUtils'
import { getDashboardReservationMetrics, getReservationNightCount } from '../utils/reservationUtils'
import GoalProgress from '../components/GoalProgress'

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
          {reservations.map((reservation) => {
            const nights = getReservationNightCount(reservation)

            return (
            <li key={reservation.id} className='rounded-lg border border-slate-200 p-2.5'>
              <p className='text-sm font-medium text-blue-950'>{reservation.customerName}</p>
              <p className='text-xs text-slate-600'>
                {reservation.roomName}
                {showCheckInDate ? ` · Giriş ${formatDateTR(reservation.checkInDate)}` : null}
                {nights ? ` · ${nights} gece` : ''}
              </p>
              <p className='text-xs text-slate-600'>Tel: {reservation.customerPhone || '-'}</p>
              <ReservationNote note={reservation.note} className='mt-1 text-xs' />
              <span
                className={`mt-1 inline-block rounded px-2 py-0.5 text-[11px] font-medium ${
                  paymentBadgeClass[reservation.paymentStatus] ?? 'bg-slate-100 text-slate-700'
                }`}
              >
                {reservation.paymentStatus || '-'}
              </span>
            </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function Dashboard() {
  const { user } = useAuth()
  const [reservations, setReservations] = useState([])
  const [targets, setTargets] = useState(DEFAULT_BUSINESS_TARGETS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    let cancelled = false

    const fetchDashboardData = async () => {
      setLoading(true)
      setError('')

      try {
        const [data, targetsData] = await Promise.all([getReservations(), getBusinessTargets()])
        if (!cancelled) {
          setReservations(data)
          setTargets(targetsData)
        }
      } catch (fetchError) {
        if (cancelled) return
        setError(getFirestoreErrorMessage(fetchError, 'Dashboard verileri yüklenirken bir hata oluştu.'))
        console.error(fetchError)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchDashboardData()

    return () => {
      cancelled = true
    }
  }, [user])

  const metrics = useMemo(() => {
    try {
      return getDashboardReservationMetrics(reservations)
    } catch (metricsError) {
      console.error(metricsError)
      return getDashboardReservationMetrics([])
    }
  }, [reservations])
  const monthLabel = format(new Date(), 'MMMM yyyy', { locale: tr })
  const year = new Date().getFullYear()
  const targetsConfigured = hasConfiguredTargets(targets)

  const occupancy = useMemo(() => getOccupancySnapshot(reservations), [reservations])

  const monthlyRevenueGoal = useMemo(
    () => getGoalProgress(occupancy.monthLodgingIncome, targets.monthlyLodgingTarget),
    [occupancy.monthLodgingIncome, targets.monthlyLodgingTarget],
  )

  const yearlyRevenueGoal = useMemo(
    () => getGoalProgress(occupancy.yearLodgingIncome, targets.yearlyLodgingTarget),
    [occupancy.yearLodgingIncome, targets.yearlyLodgingTarget],
  )

  const monthlyOccupancyGoal = useMemo(
    () => getGoalProgress(occupancy.monthOccupancyPercent, targets.monthlyOccupancyTargetPercent),
    [occupancy.monthOccupancyPercent, targets.monthlyOccupancyTargetPercent],
  )

  const yearlyOccupancyGoal = useMemo(
    () => getGoalProgress(occupancy.yearOccupancyPercent, targets.yearlyOccupancyTargetPercent),
    [occupancy.yearOccupancyPercent, targets.yearlyOccupancyTargetPercent],
  )

  const todayOccupancyPercent = loading
    ? '...'
    : `${Math.round((metrics.todaysOccupancyCount / ROOM_COUNT) * 100)}%`

  return (
    <section className='space-y-4'>
      <h2 className='text-base font-semibold capitalize text-blue-950 sm:text-lg'>{monthLabel} özeti</h2>

      <article className='card space-y-4'>
        <div className='flex flex-wrap items-start justify-between gap-2'>
          <h3 className='text-base font-semibold text-blue-950'>{year} hedefi</h3>
          <Link to='/reports' className='text-sm font-medium text-blue-700 hover:underline'>
            Hedefleri düzenle →
          </Link>
        </div>

        {!loading && !targetsConfigured ? (
          <p className='text-sm text-slate-600'>
            Henüz hedef kaydı yok.{' '}
            <Link to='/reports' className='font-medium text-blue-700 hover:underline'>
              Raporlar
            </Link>{' '}
            sayfasından yıllık gelir ve doluluk hedeflerinizi kaydedin; burada “hedeften ne kadar uzaktayız”
            görünür.
          </p>
        ) : (
          <>
            <GoalProgress
              label={`${year} konaklama geliri (yıl başından bugüne)`}
              currentLabel={loading ? '...' : formatCurrencyTRY(occupancy.yearLodgingIncome)}
              targetLabel={formatCurrencyTRY(yearlyRevenueGoal.target)}
              percent={yearlyRevenueGoal.percent}
              hasTarget={yearlyRevenueGoal.hasTarget}
              achieved={yearlyRevenueGoal.achieved}
              remaining={yearlyRevenueGoal.remaining}
              kind='currency'
              compact
            />
            <GoalProgress
              label={`${year} doluluk (yıl başından bugüne)`}
              currentLabel={loading ? '...' : `%${occupancy.yearOccupancyPercent}`}
              targetLabel={`%${yearlyOccupancyGoal.target}`}
              percent={yearlyOccupancyGoal.percent}
              hasTarget={yearlyOccupancyGoal.hasTarget}
              achieved={yearlyOccupancyGoal.achieved}
              remaining={yearlyOccupancyGoal.remaining}
              kind='percent'
              compact
            />
            <div className='border-t border-slate-100 pt-3'>
              <p className='mb-2 text-xs font-medium uppercase tracking-wide text-slate-400'>Bu ay</p>
              <div className='grid gap-4 sm:grid-cols-2'>
                <GoalProgress
                  label='Gelir'
                  currentLabel={loading ? '...' : formatCurrencyTRY(occupancy.monthLodgingIncome)}
                  targetLabel={formatCurrencyTRY(monthlyRevenueGoal.target)}
                  percent={monthlyRevenueGoal.percent}
                  hasTarget={monthlyRevenueGoal.hasTarget}
                  achieved={monthlyRevenueGoal.achieved}
                  remaining={monthlyRevenueGoal.remaining}
                  kind='currency'
                  compact
                />
                <GoalProgress
                  label='Doluluk'
                  currentLabel={loading ? '...' : `%${occupancy.monthOccupancyPercent}`}
                  targetLabel={`%${monthlyOccupancyGoal.target}`}
                  percent={monthlyOccupancyGoal.percent}
                  hasTarget={monthlyOccupancyGoal.hasTarget}
                  achieved={monthlyOccupancyGoal.achieved}
                  remaining={monthlyOccupancyGoal.remaining}
                  kind='percent'
                  compact
                />
              </div>
            </div>
          </>
        )}
      </article>

      <div className='grid gap-3 sm:grid-cols-2'>
        <StatCard
          title='Bugün doluluk'
          value={loading ? '...' : todayOccupancyPercent}
          subtitle={loading ? null : `${metrics.todaysOccupancyCount} / ${ROOM_COUNT} oda`}
          tone='warning'
        />
        <StatCard
          title='Bu ay doluluk'
          value={loading ? '...' : `%${occupancy.monthOccupancyPercent}`}
          subtitle={
            loading
              ? null
              : `${occupancy.monthOccupiedNights} dolu gece · ${occupancy.monthEmptyNights} boş`
          }
          tone='default'
        />
      </div>

      <div className='grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3'>
        <StatCard
          title='Bu Ay Rezervasyon Geliri'
          value={loading ? '...' : formatCurrencyTRY(metrics.monthlyReservationIncome)}
          tone='success'
        />
        <StatCard title='Aktif Rezervasyon' value={loading ? '...' : metrics.activeCount} tone='default' />
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
      {!loading && !error && reservations.length === 0 ? (
        <p className='rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900'>
          Firestore&apos;da rezervasyon kaydı görünmüyor. Doğru Firebase projesine bağlı olduğunuzdan emin olun;
          sorun sürerse çıkış yapıp tekrar giriş yapın.
        </p>
      ) : null}

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
          title='Halihazırda konaklayanlar'
          reservations={metrics.todaysCurrentlyStaying}
          loading={loading}
          emptyText='Şu an konaklayan misafir yok.'
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
