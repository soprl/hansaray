import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import ReactCalendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'

export const TURKISH_WEEKDAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']

function TurkishCalendar({
  value,
  onChange,
  minDate,
  maxDate,
  activeStartDate,
  onActiveStartDateChange,
  tileClassName,
  tileContent,
  className,
  minDetail = 'year',
  maxDetail = 'month',
  showNeighboringMonth = true,
}) {
  return (
    <ReactCalendar
      locale='tr-TR'
      value={value}
      onChange={onChange}
      minDate={minDate}
      maxDate={maxDate}
      activeStartDate={activeStartDate}
      onActiveStartDateChange={onActiveStartDateChange}
      minDetail={minDetail}
      maxDetail={maxDetail}
      showNeighboringMonth={showNeighboringMonth}
      formatMonthYear={(_, date) => format(date, 'MMMM yyyy', { locale: tr })}
      formatShortWeekday={(_, date) => TURKISH_WEEKDAYS[date.getDay()]}
      tileClassName={tileClassName}
      tileContent={tileContent}
      className={className}
    />
  )
}

export default TurkishCalendar
