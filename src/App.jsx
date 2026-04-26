import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Reservations = lazy(() => import('./pages/Reservations'))
const Finance = lazy(() => import('./pages/Finance'))
const Reports = lazy(() => import('./pages/Reports'))

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<div className='min-h-screen p-6 text-sm text-slate-600'>Sayfa yükleniyor...</div>}>
          <Routes>
            <Route path='/login' element={<Login />} />

            <Route
              path='/'
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path='takvim' element={<Calendar />} />
              <Route path='rezervasyonlar' element={<Reservations />} />
              <Route path='gelir-gider' element={<Finance />} />
              <Route path='raporlar' element={<Reports />} />
            </Route>

            <Route path='*' element={<Navigate to='/' replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
