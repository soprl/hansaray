import { format } from 'date-fns'
import { useEffect, useRef, useState } from 'react'
import { FiCalendar } from 'react-icons/fi'
import { formatDateTR, parseISODateSafe } from '../utils/formatters'
import TurkishCalendar from './TurkishCalendar'

function DatePickerField({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  disabled,
  error,
  placeholder = 'Tarih seçin',
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const handleClickOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const calendarValue = parseISODateSafe(value)
  const minValue = parseISODateSafe(minDate) ?? undefined
  const maxValue = parseISODateSafe(maxDate) ?? undefined

  const handleSelect = (date) => {
    onChange(format(date, 'yyyy-MM-dd'))
    setOpen(false)
  }

  return (
    <div ref={containerRef} className='relative'>
      {label ? <label className='mb-1 block text-sm font-medium text-slate-700'>{label}</label> : null}
      <button
        type='button'
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`input flex w-full items-center justify-between text-left ${
          disabled ? 'cursor-not-allowed bg-slate-100 text-slate-400' : ''
        } ${error ? 'border-rose-400' : ''}`}
      >
        <span className={value ? 'text-slate-900' : 'text-slate-400'}>
          {value ? formatDateTR(value, 'dd MMMM yyyy') : placeholder}
        </span>
        <FiCalendar className='shrink-0 text-slate-400' aria-hidden />
      </button>

      {open && !disabled ? (
        <div className='date-picker-popover absolute left-0 right-0 top-full z-30 mt-1 sm:right-auto sm:w-auto'>
          <TurkishCalendar
            value={calendarValue}
            onChange={handleSelect}
            minDate={minValue}
            maxDate={maxValue}
          />
        </div>
      ) : null}

      {error ? <p className='mt-1 text-xs text-rose-600'>{error}</p> : null}
    </div>
  )
}

export default DatePickerField
