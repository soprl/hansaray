import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Sidebar from './Sidebar'

function Layout() {
  return (
    <div className='min-h-screen lg:flex'>
      <Sidebar />
      <main className='flex-1 p-4 md:p-6'>
        <Navbar />
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
