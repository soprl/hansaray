import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { CLIENT_VERSION } from '../utils/clientStorageReset'

function Navbar() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const isHome = pathname === '/'

  return (
    <header className='mb-3 flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm lg:mb-4 lg:rounded-xl lg:p-4'>
      <div className='min-w-0'>
        <h1 className='truncate text-base font-semibold text-blue-950 sm:text-xl'>Otel Paneli</h1>
        <p className='truncate text-xs text-slate-500 sm:text-sm'>
          {format(new Date(), 'd MMM yyyy', { locale: tr })}
        </p>
      </div>
      <div className='flex shrink-0 flex-col items-end gap-0.5 text-right'>
        {isHome ? (
          <span className='font-mono text-[10px] text-slate-400 sm:text-xs' title='Uygulama sürümü'>
            {CLIENT_VERSION}
          </span>
        ) : null}
        {user?.email ? (
          <p className='hidden max-w-[12rem] truncate text-xs text-slate-600 sm:block sm:max-w-[40%] sm:text-sm'>
            {user.email}
          </p>
        ) : null}
      </div>
    </header>
  )
}

export default Navbar
