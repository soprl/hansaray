import { NavLink } from 'react-router-dom'
import { FiBarChart2, FiBell, FiCalendar, FiDollarSign, FiHome, FiLogOut, FiUsers } from 'react-icons/fi'
import AppLogo from './AppLogo'
import { useAuth } from '../context/useAuth'
import { isNativeApp } from '../utils/nativePush'

const baseNavItems = [
  { to: '/', label: 'Ana Sayfa', icon: FiHome },
  { to: '/takvim', label: 'Takvim', icon: FiCalendar },
  { to: '/rezervasyonlar', label: 'Rezervasyonlar', icon: FiUsers },
  { to: '/gelir-gider', label: 'Gelir / Gider', icon: FiDollarSign },
  { to: '/raporlar', label: 'Raporlar', icon: FiBarChart2 },
]

const nativeNavItem = { to: '/bildirimler', label: 'Bildirimler', icon: FiBell }

function Sidebar() {
  const { logout } = useAuth()
  const navItems = isNativeApp() ? [...baseNavItems, nativeNavItem] : baseNavItems

  return (
    <aside className='hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-blue-950 p-4 text-slate-100 lg:flex'>
      <div className='mb-6'>
        <AppLogo className='h-11 w-11' showText textClassName='text-lg font-semibold text-white' />
      </div>
      <nav className='flex flex-col gap-1'>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                isActive ? 'bg-emerald-600 text-white' : 'bg-blue-900 hover:bg-blue-800'
              }`
            }
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>

      <button
        type='button'
        onClick={logout}
        className='mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium hover:bg-rose-500'
      >
        <FiLogOut />
        Çıkış
      </button>
    </aside>
  )
}

export default Sidebar
