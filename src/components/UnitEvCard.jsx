import { SEASON_LENGTH_DAYS } from '../config/season'
import { formatCurrencyTRY } from '../utils/formatters'
import GoalProgress from './GoalProgress'

function UnitEvCard({ unit, compact = false }) {
  const { evLabel, caption, yearRevenueGoal, yearOccupancyGoal } = unit

  if (compact) {
    return (
      <article className='card'>
        <p className='text-sm font-medium text-blue-950'>
          {evLabel} <span className='font-normal text-slate-400'>({caption})</span>
        </p>
        <p className='mt-0.5 text-xs text-slate-500'>{SEASON_LENGTH_DAYS} gün/ev</p>
        <p className='mt-2 text-lg font-semibold text-blue-950'>%{unit.yearOccupancyPercent}</p>
        <p className='text-xs text-slate-500'>
          {unit.yearOccupiedNights} / {unit.yearAvailableNights || '—'} sezon gecesi
        </p>
        <p className='mt-1 text-sm font-semibold text-indigo-700'>
          {formatCurrencyTRY(unit.yearLodgingIncome)}
        </p>
      </article>
    )
  }

  return (
    <article className='card space-y-3'>
      <div>
        <p className='text-sm font-medium text-blue-950'>
          {evLabel} <span className='font-normal text-slate-400'>({caption})</span>
        </p>
        <p className='mt-0.5 text-xs text-slate-500'>
          Sezon · en fazla {SEASON_LENGTH_DAYS} gece · {unit.yearOccupiedNights}/
          {unit.yearAvailableNights || 0} dolu (yıl)
        </p>
      </div>

      {yearOccupancyGoal?.hasTarget ? (
        <GoalProgress
          label='Yıllık doluluk hedefi'
          currentLabel={`%${unit.yearOccupancyPercent}`}
          targetLabel={`%${yearOccupancyGoal.target}`}
          percent={yearOccupancyGoal.percent}
          hasTarget
          progress={yearOccupancyGoal}
          kind='percent'
        />
      ) : (
        <div>
          <p className='text-xs text-slate-500'>Yıllık doluluk (sezon)</p>
          <p className='text-xl font-semibold text-blue-950'>%{unit.yearOccupancyPercent}</p>
        </div>
      )}

      {yearRevenueGoal?.hasTarget ? (
        <GoalProgress
          label='Yıllık gelir hedefi'
          currentLabel={formatCurrencyTRY(unit.yearLodgingIncome)}
          targetLabel={formatCurrencyTRY(yearRevenueGoal.target)}
          percent={yearRevenueGoal.percent}
          hasTarget
          progress={yearRevenueGoal}
          kind='currency'
        />
      ) : (
        <div>
          <p className='text-xs text-slate-500'>Yıllık gelir</p>
          <p className='text-xl font-semibold text-indigo-700'>
            {formatCurrencyTRY(unit.yearLodgingIncome)}
          </p>
        </div>
      )}
    </article>
  )
}

export default UnitEvCard
