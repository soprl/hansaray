import { formatCurrencyTRY } from '../utils/formatters'

function gapLine({ achieved, remaining, kind }) {
  if (achieved) return 'Hedefe ulaştınız'
  if (kind === 'percent') return `Hedeften %${Math.round(remaining)} uzaktayız`
  return `Hedeften ${formatCurrencyTRY(remaining)} uzaktayız`
}

function GoalProgress({
  label,
  currentLabel,
  targetLabel,
  percent,
  hasTarget,
  hint,
  progress,
  achieved: achievedProp = false,
  remaining: remainingProp = 0,
  kind = 'currency',
}) {
  const achieved = progress?.achieved ?? achievedProp
  const remaining = progress?.remaining ?? remainingProp

  return (
    <article className='card'>
      <div className='flex items-start justify-between gap-2'>
        <p className='text-sm text-slate-500'>{label}</p>
        {hasTarget ? (
          <span className='shrink-0 text-sm font-semibold text-blue-950'>%{percent}</span>
        ) : null}
      </div>
      <p className='mt-1 text-lg font-semibold text-blue-950 sm:text-xl'>{currentLabel}</p>
      {hasTarget ? (
        <>
          <p className='mt-0.5 text-xs text-slate-500'>Hedef: {targetLabel}</p>
          <p className={`mt-0.5 text-xs ${achieved ? 'text-emerald-700' : 'text-amber-800'}`}>
            {gapLine({ achieved, remaining, kind })}
          </p>
          <div className='mt-2 h-2 overflow-hidden rounded-full bg-slate-100'>
            <div
              className={`h-full rounded-full transition-all ${achieved ? 'bg-emerald-600' : 'bg-emerald-500'}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </>
      ) : (
        <p className='mt-1 text-xs text-slate-400'>{hint ?? 'Raporlar sayfasından hedef girebilirsiniz.'}</p>
      )}
    </article>
  )
}

export default GoalProgress
