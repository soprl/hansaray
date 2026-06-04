import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

function ProtectedRoute({ children }) {
  const { isAuthenticated, authLoading } = useAuth()

  if (authLoading) {
    return (
      <div className='flex min-h-[40vh] items-center justify-center'>
        <p className='text-sm text-slate-500'>Yükleniyor…</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to='/login' replace />
  }

  return children
}

export default ProtectedRoute
