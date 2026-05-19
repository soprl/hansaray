import { Outlet } from 'react-router-dom'
import MobileBottomNav from './MobileBottomNav'
import Navbar from './Navbar'
import Sidebar from './Sidebar'

function Layout() {
  return (
    <div className='min-h-screen lg:flex'>
      <Sidebar />
      <main className='flex-1 px-3 py-3 pb-[4.75rem] md:px-5 md:py-4 md:pb-6 lg:pb-6'>
        <Navbar />
        <Outlet />
      </main>
      <MobileBottomNav />
    </div>
  )
}

export default Layout
