import { NavLink } from 'react-router-dom'
import { FiBarChart2, FiBell, FiCalendar, FiDollarSign, FiHome, FiPlus } from 'react-icons/fi'
import { isNativeApp } from '../utils/nativePush'

const leftItems = [
  { to: '/', label: 'Ana', icon: FiHome, end: true },
  { to: '/takvim', label: 'Takvim', icon: FiCalendar },
]

const webRightItems = [
  { to: '/gelir-gider', label: 'Gider', icon: FiDollarSign },
  { to: '/raporlar', label: 'Rapor', icon: FiBarChart2 },
]

const nativeRightItems = [
  { to: '/bildirimler', label: 'Bildirim', icon: FiBell },
  { to: '/gelir-gider', label: 'Gider', icon: FiDollarSign },
]

function NavItem({ to, label, icon: Icon, end, activeClass, inactiveClass }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex min-w-[3.25rem] flex-col items-center gap-0.5 py-1 text-[11px] font-medium transition ${
          isActive ? activeClass : inactiveClass
        }`
      }
    >
      <Icon className='h-5 w-5 shrink-0' aria-hidden />
      <span>{label}</span>
    </NavLink>
  )
}

function MobileBottomNav() {
  const native = isNativeApp()
  const rightItems = native ? nativeRightItems : webRightItems
  const activeNavClass = native ? 'text-brand-gold-dark' : 'text-emerald-600'
  const inactiveNavClass = native ? 'text-stone-500' : 'text-slate-500'

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur lg:hidden ${
        native ? 'border-amber-200/80 bg-brand-cream/95' : 'border-slate-200 bg-white/95'
      }`}
      style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom))' }}
      aria-label='Ana menü'
    >
      <div className='relative flex h-[3.75rem] items-end justify-between px-1 pt-1'>
        <div className='flex flex-1 justify-evenly'>
          {leftItems.map((item) => (
            <NavItem key={item.to} {...item} activeClass={activeNavClass} inactiveClass={inactiveNavClass} />
          ))}
        </div>

        <div className='w-16 shrink-0' aria-hidden />

        <div className='flex flex-1 justify-evenly'>
          {rightItems.map((item) => (
            <NavItem key={item.to} {...item} activeClass={activeNavClass} inactiveClass={inactiveNavClass} />
          ))}
        </div>

        <NavLink
          to='/rezervasyonlar'
          aria-label='Rezervasyonlar'
          className={({ isActive }) =>
            `absolute left-1/2 top-0 flex h-[3.35rem] w-[3.35rem] -translate-x-1/2 -translate-y-[42%] items-center justify-center rounded-full shadow-lg transition active:scale-95 ${
              native
                ? isActive
                  ? 'bg-brand-gold-dark text-white ring-4 ring-brand-cream'
                  : 'bg-brand-gold text-brand-ink ring-4 ring-brand-cream'
                : isActive
                  ? 'bg-emerald-600 text-white ring-4 ring-white'
                  : 'bg-emerald-500 text-white ring-4 ring-white'
            }`
          }
        >
          <FiPlus className='h-7 w-7 stroke-[2.5]' aria-hidden />
        </NavLink>
      </div>
    </nav>
  )
}

export default MobileBottomNav
