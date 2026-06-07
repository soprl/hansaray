import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { useMemo } from 'react'
import StatCard from './StatCard'
import GoalProgress from './GoalProgress'
import UnitEvCard from './UnitEvCard'
import { formatEvSeasonCapacity } from '../config/units'
import { SEASON_LENGTH_DAYS } from '../config/season'
import { formatCurrencyTRY } from '../utils/formatters'
import { getGoalProgress, getOccupancySnapshot, ROOM_COUNT } from '../utils/occupancyUtils'
import { attachUnitGoals, getUnitOccupancySnapshots } from '../utils/unitOccupancyUtils'
import { getDashboardReservationMetrics } from '../utils/reservationUtils'

function FinancialDashboardOverview({ reservations, targets, loading }) {
  const monthLabel = format(new Date(), 'MMMM yyyy', { locale: tr })

  const metrics = useMemo(() => {
    try {
      return getDashboardReservationMetrics(reservations)
    } catch {
      return getDashboardReservationMetrics([])
    }
  }, [reservations])

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

  const unitSnapshots = useMemo(() => {
    const snapshots = getUnitOccupancySnapshots(reservations)
    return attachUnitGoals(snapshots, targets.unitTargets)
  }, [reservations, targets.unitTargets])

  const todayOccupancyPercent = loading
    ? '...'
    : `${Math.round((metrics.todaysOccupancyCount / ROOM_COUNT) * 100)}%`

  return (
    <div className='space-y-4 border-b border-slate-200 pb-6'>
      <h2 className='text-base font-semibold capitalize text-blue-950 sm:text-lg'>{monthLabel} finansal özet</h2>

      <div>
        <h3 className='mb-2 text-sm font-medium text-slate-600'>Doluluk ve hedefler</h3>
        <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
          <StatCard
            title='Bugün doluluk'
            value={loading ? '...' : todayOccupancyPercent}
            subtitle={loading ? null : `${metrics.todaysOccupancyCount} / ${ROOM_COUNT} ev`}
            tone='warning'
          />
          <StatCard
            title='Bu ay doluluk'
            value={loading ? '...' : `%${occupancy.monthOccupancyPercent}`}
            subtitle={
              loading
                ? null
                : occupancy.monthInSeason
                  ? `${occupancy.monthOccupiedNights} dolu · ${occupancy.monthEmptyNights} boş (sezon)`
                  : 'Sezon dışı ay'
            }
            tone='default'
          />
          <GoalProgress
            label='Bu ay gelir hedefi'
            currentLabel={loading ? '...' : formatCurrencyTRY(occupancy.monthLodgingIncome)}
            targetLabel={formatCurrencyTRY(monthlyRevenueGoal.target)}
            percent={monthlyRevenueGoal.percent}
            hasTarget={monthlyRevenueGoal.hasTarget}
            progress={monthlyRevenueGoal}
            kind='currency'
          />
          <GoalProgress
            label='Bu ay doluluk hedefi'
            currentLabel={loading ? '...' : `%${occupancy.monthOccupancyPercent}`}
            targetLabel={`%${monthlyOccupancyGoal.target}`}
            percent={monthlyOccupancyGoal.percent}
            hasTarget={monthlyOccupancyGoal.hasTarget}
            progress={monthlyOccupancyGoal}
            kind='percent'
          />
        </div>
        <div className='mt-3 grid gap-3 sm:grid-cols-2'>
          <GoalProgress
            label='Sezon gelir hedefi (tüm rezervasyonlar)'
            currentLabel={loading ? '...' : formatCurrencyTRY(occupancy.yearLodgingIncome)}
            targetLabel={formatCurrencyTRY(yearlyRevenueGoal.target)}
            percent={yearlyRevenueGoal.percent}
            hasTarget={yearlyRevenueGoal.hasTarget}
            progress={yearlyRevenueGoal}
            kind='currency'
          />
          <GoalProgress
            label={`Yıllık doluluk (sezon ${SEASON_LENGTH_DAYS} gün)`}
            currentLabel={loading ? '...' : `%${occupancy.yearOccupancyPercent}`}
            targetLabel={`%${yearlyOccupancyGoal.target}`}
            percent={yearlyOccupancyGoal.percent}
            hasTarget={yearlyOccupancyGoal.hasTarget}
            progress={yearlyOccupancyGoal}
            kind='percent'
          />
        </div>
      </div>

      <div>
        <h3 className='mb-1 text-sm font-medium text-slate-600'>Evler · yıllık sezon</h3>
        <p className='mb-2 text-xs text-slate-500'>{formatEvSeasonCapacity()}</p>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'>
          {loading
            ? Array.from({ length: ROOM_COUNT }, (_, index) => (
                <article key={index} className='card'>
                  <p className='text-sm text-slate-500'>Yükleniyor...</p>
                </article>
              ))
            : unitSnapshots.map((unit) => <UnitEvCard key={unit.roomId} unit={unit} compact />)}
        </div>
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
    </div>
  )
}

export default FinancialDashboardOverview
