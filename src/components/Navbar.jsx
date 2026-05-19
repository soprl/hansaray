import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { useAuth } from '../context/useAuth'

function Navbar() {
  const { user } = useAuth()

  return (
    <header className='mb-3 flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm lg:mb-4 lg:rounded-xl lg:p-4'>
      <div className='min-w-0'>
        <h1 className='truncate text-base font-semibold text-blue-950 sm:text-xl'>Otel Paneli</h1>
        <p className='truncate text-xs text-slate-500 sm:text-sm'>
          {format(new Date(), 'd MMM yyyy', { locale: tr })}
        </p>
      </div>
      <p className='hidden max-w-[40%] truncate text-xs text-slate-600 sm:block sm:text-sm'>{user?.email}</p>
    </header>
  )
}

export default Navbar
