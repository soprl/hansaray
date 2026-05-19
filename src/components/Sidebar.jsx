import { NavLink } from 'react-router-dom'
import { FiBarChart2, FiBell, FiCalendar, FiDollarSign, FiHome, FiLogOut, FiUsers } from 'react-icons/fi'
import { useAuth } from '../context/useAuth'

const navItems = [
  { to: '/', label: 'Ana Sayfa', icon: FiHome },
  { to: '/takvim', label: 'Takvim', icon: FiCalendar },
  { to: '/rezervasyonlar', label: 'Rezervasyonlar', icon: FiUsers },
  { to: '/gelir-gider', label: 'Gelir / Gider', icon: FiDollarSign },
  { to: '/raporlar', label: 'Raporlar', icon: FiBarChart2 },
  { to: '/bildirimler', label: 'Bildirimler', icon: FiBell },
]

function Sidebar() {
  const { logout } = useAuth()

  return (
    <aside className='hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-blue-950 p-4 text-slate-100 lg:flex'>
      <p className='mb-6 text-base font-semibold'>Otel Paneli</p>
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
