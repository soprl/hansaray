function ReservationNote({ note, className = '' }) {
  const trimmed = note?.trim()
  if (!trimmed) return null

  return (
    <p className={`text-sm text-slate-600 ${className}`.trim()}>
      <span className='font-medium text-slate-700'>Not:</span> {trimmed}
    </p>
  )
}

export default ReservationNote
