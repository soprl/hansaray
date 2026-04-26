import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'

function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      await signInWithEmailAndPassword(auth, form.email, form.password)
      navigate('/')
    } catch (authError) {
      setError('Giriş başarısız. E-posta veya şifreyi kontrol edin.')
      console.error(authError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-slate-100 p-4'>
      <div className='w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'>
        <h1 className='text-2xl font-semibold text-blue-950'>Otel Yönetim Girişi</h1>
        <p className='mt-2 text-sm text-slate-500'>Paneli kullanmak için giriş yapın.</p>

        <form onSubmit={handleSubmit} className='mt-6 space-y-4'>
          <div>
            <label className='mb-1 block text-sm font-medium text-slate-700'>E-posta</label>
            <input
              type='email'
              name='email'
              value={form.email}
              onChange={handleChange}
              className='input'
              placeholder='ornek@otel.com'
              required
            />
          </div>

          <div>
            <label className='mb-1 block text-sm font-medium text-slate-700'>Şifre</label>
            <input
              type='password'
              name='password'
              value={form.password}
              onChange={handleChange}
              className='input'
              placeholder='******'
              required
            />
          </div>

          {error ? <p className='text-sm text-rose-600'>{error}</p> : null}

          <button type='submit' className='btn-primary w-full' disabled={loading}>
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
