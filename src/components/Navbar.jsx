import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { useAuth } from '../context/useAuth'

function Navbar() {
  const { user } = useAuth()

  return (
    <header className='mb-4 flex flex-col justify-between gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center'>
      <div>
        <h1 className='text-xl font-semibold text-blue-950'>Rezervasyon Takip</h1>
        <p className='text-sm text-slate-500'>{format(new Date(), 'dd MMMM yyyy, EEEE', { locale: tr })}</p>
      </div>
      <p className='text-sm text-slate-600'>{user?.email}</p>
    </header>
  )
}

export default Navbar
