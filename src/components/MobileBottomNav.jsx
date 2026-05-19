import { NavLink } from 'react-router-dom'
import { FiBarChart2, FiBell, FiCalendar, FiDollarSign, FiHome, FiUsers } from 'react-icons/fi'
import { isNativeApp } from '../utils/nativePush'

const navItems = [
  { to: '/', label: 'Ana', icon: FiHome, end: true },
  { to: '/takvim', label: 'Takvim', icon: FiCalendar },
  { to: '/rezervasyonlar', label: 'Rezerv.', icon: FiUsers },
  { to: '/gelir-gider', label: 'Gider', icon: FiDollarSign },
  { to: '/raporlar', label: 'Rapor', icon: FiBarChart2 },
  { to: '/bildirimler', label: 'Bildir.', icon: FiBell },
]

function MobileBottomNav() {
  const native = isNativeApp()
  const activeNavClass = native ? 'text-brand-gold-dark' : 'text-emerald-600'
  const inactiveNavClass = native ? 'text-stone-400' : 'text-slate-500'

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur lg:hidden ${
        native ? 'border-amber-200/80 bg-brand-cream/95' : 'border-slate-200 bg-white/95'
      }`}
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      aria-label='Ana menü'
    >
      <div className='grid grid-cols-6'>
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium transition ${
                isActive ? activeNavClass : inactiveNavClass
              }`
            }
          >
            <Icon className='h-5 w-5 shrink-0' aria-hidden />
            <span className='truncate'>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export default MobileBottomNav
