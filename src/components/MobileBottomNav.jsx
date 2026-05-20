import { NavLink } from 'react-router-dom'
import { FiBarChart2, FiBell, FiCalendar, FiDollarSign, FiHome, FiPlus } from 'react-icons/fi'
import { isNativeApp } from '../utils/nativePush'

/** false yap → sadece + ikonlu eski görünüm */
const SHOW_RESERVATION_FAB_LABEL = true

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

        <div className={`shrink-0 ${SHOW_RESERVATION_FAB_LABEL ? 'w-[5.5rem]' : 'w-16'}`} aria-hidden />

        <div className='flex flex-1 justify-evenly'>
          {rightItems.map((item) => (
            <NavItem key={item.to} {...item} activeClass={activeNavClass} inactiveClass={inactiveNavClass} />
          ))}
        </div>

        <NavLink
          to='/rezervasyonlar'
          aria-label={SHOW_RESERVATION_FAB_LABEL ? 'Rezervasyon gir' : 'Rezervasyonlar'}
          className={({ isActive }) => {
            const ringClass = native ? 'ring-4 ring-brand-cream' : 'ring-4 ring-white'
            const activeFab = native
              ? 'bg-brand-gold-dark text-white'
              : 'bg-emerald-600 text-white'
            const idleFab = native ? 'bg-brand-gold text-brand-ink' : 'bg-emerald-500 text-white'
            const fabColors = isActive ? activeFab : idleFab

            if (!SHOW_RESERVATION_FAB_LABEL) {
              return `absolute left-1/2 top-0 flex h-[3.35rem] w-[3.35rem] -translate-x-1/2 -translate-y-[42%] items-center justify-center rounded-full shadow-lg transition active:scale-95 ${fabColors} ${ringClass}`
            }

            return `absolute left-1/2 top-0 flex min-w-[4.5rem] -translate-x-1/2 -translate-y-[52%] flex-col items-center justify-center gap-0.5 rounded-full px-2.5 pb-2 pt-2 shadow-lg transition active:scale-95 ${ringClass} ${fabColors}`
          }}
        >
          {SHOW_RESERVATION_FAB_LABEL ? (
            <>
              <span className='max-w-[5.5rem] text-center text-[9px] font-bold leading-tight'>
                Rezervasyon Gir
              </span>
              <FiPlus className='h-6 w-6 shrink-0 stroke-[2.5]' aria-hidden />
            </>
          ) : (
            <FiPlus className='h-7 w-7 stroke-[2.5]' aria-hidden />
          )}
        </NavLink>
      </div>
    </nav>
  )
}

export default MobileBottomNav
