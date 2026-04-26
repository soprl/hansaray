import { NavLink } from 'react-router-dom'
import { FiBarChart2, FiCalendar, FiDollarSign, FiHome, FiLogOut, FiUsers } from 'react-icons/fi'
import { useAuth } from '../context/useAuth'

const navItems = [
  { to: '/', label: 'Ana Sayfa', icon: FiHome },
  { to: '/takvim', label: 'Takvim', icon: FiCalendar },
  { to: '/rezervasyonlar', label: 'Rezervasyonlar', icon: FiUsers },
  { to: '/gelir-gider', label: 'Gelir / Gider', icon: FiDollarSign },
  { to: '/raporlar', label: 'Raporlar', icon: FiBarChart2 },
]

function Sidebar() {
  const { logout } = useAuth()

  return (
    <aside className='w-full border-b border-slate-200 bg-blue-950 p-4 text-slate-100 lg:w-64 lg:border-b-0 lg:border-r'>
      <p className='mb-6 text-lg font-semibold'>Otel Paneli</p>
      <nav className='flex flex-wrap gap-2 lg:flex-col'>
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
