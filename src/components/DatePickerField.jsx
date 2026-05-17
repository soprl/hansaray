import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { useEffect, useRef, useState } from 'react'
import { FiCalendar } from 'react-icons/fi'
import ReactCalendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import { formatDateTR } from '../utils/formatters'

const weekdayMap = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']

function DatePickerField({ label, value, onChange, minDate, disabled, error, placeholder = 'Tarih seçin' }) {
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

  const calendarValue = value ? parseISO(value) : null
  const minValue = minDate ? parseISO(minDate) : undefined

  const handleSelect = (date) => {
    onChange(format(date, 'yyyy-MM-dd'))
    setOpen(false)
  }

  return (
    <div ref={containerRef} className='relative'>
      <label className='mb-1 block text-sm font-medium'>{label}</label>
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
        <FiCalendar className='text-slate-400' aria-hidden />
      </button>

      {open && !disabled ? (
        <div className='date-picker-popover absolute left-0 top-full z-20 mt-1'>
          <ReactCalendar
            locale='tr-TR'
            value={calendarValue}
            onChange={handleSelect}
            minDate={minValue}
            formatMonthYear={(_, date) => format(date, 'MMMM yyyy', { locale: tr })}
            formatShortWeekday={(_, date) => weekdayMap[date.getDay()]}
          />
        </div>
      ) : null}

      {error ? <p className='mt-1 text-xs text-rose-600'>{error}</p> : null}
    </div>
  )
}

export default DatePickerField
