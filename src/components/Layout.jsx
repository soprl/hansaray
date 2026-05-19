import { Outlet } from 'react-router-dom'
import MobileBottomNav from './MobileBottomNav'
import Navbar from './Navbar'
import Sidebar from './Sidebar'

function Layout() {
  return (
    <div className='min-h-screen lg:flex'>
      <Sidebar />
      <main className='flex-1 px-3 pb-[5.5rem] pt-[max(0.75rem,env(safe-area-inset-top))] md:px-5 md:pb-6 md:pt-4 lg:pb-6'>
        <Navbar />
        <Outlet />
      </main>
      <MobileBottomNav />
    </div>
  )
}

export default Layout
