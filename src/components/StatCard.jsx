function StatCard({ title, value, tone = 'default', subtitle }) {
  const toneMap = {
    default: 'border-slate-200',
    success: 'border-emerald-300',
    warning: 'border-amber-300',
    danger: 'border-rose-300',
  }

  return (
    <article className={`card border-l-4 ${toneMap[tone]}`}>
      <p className='text-sm text-slate-500'>{title}</p>
      <p className='mt-2 text-2xl font-semibold text-blue-950'>{value}</p>
      {subtitle ? <p className='mt-1 text-xs text-slate-500'>{subtitle}</p> : null}
    </article>
  )
}

export default StatCard
