import { useMemo, useState } from 'react'
import { formatDateTR } from '../utils/formatters'

const DEFAULT_FORM = {
  customerName: '',
  customerPhone: '',
  roomName: '',
  checkInDate: '',
  checkOutDate: '',
  totalPrice: '',
  deposit: '',
  paymentStatus: 'Ödenmedi',
  reservationStatus: 'Aktif',
  note: '',
}

function ReservationForm({ initialValues, onSubmit, onCancel, submitting }) {
  const [form, setForm] = useState(() => (initialValues ? { ...DEFAULT_FORM, ...initialValues } : DEFAULT_FORM))
  const [errors, setErrors] = useState({})

  const remainingPayment = useMemo(() => {
    const totalPrice = Number(form.totalPrice) || 0
    const deposit = Number(form.deposit) || 0
    return totalPrice - deposit
  }, [form.totalPrice, form.deposit])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const validate = () => {
    const nextErrors = {}
    const totalPrice = Number(form.totalPrice)
    const deposit = Number(form.deposit)

    if (!form.customerName.trim()) nextErrors.customerName = 'Müşteri adı zorunludur.'
    if (!form.customerPhone.trim()) nextErrors.customerPhone = 'Telefon zorunludur.'
    if (!form.roomName.trim()) nextErrors.roomName = 'Oda adı zorunludur.'
    if (!form.checkInDate) nextErrors.checkInDate = 'Giriş tarihi zorunludur.'
    if (!form.checkOutDate) nextErrors.checkOutDate = 'Çıkış tarihi zorunludur.'

    if (!Number.isFinite(totalPrice) || totalPrice < 0) {
      nextErrors.totalPrice = 'Toplam ücret 0 veya daha büyük olmalıdır.'
    }

    if (!Number.isFinite(deposit) || deposit < 0) {
      nextErrors.deposit = 'Kapora 0 veya daha büyük olmalıdır.'
    }

    if (Number.isFinite(totalPrice) && Number.isFinite(deposit) && deposit > totalPrice) {
      nextErrors.deposit = 'Kapora toplam ücretten büyük olamaz.'
    }

    if (form.checkInDate && form.checkOutDate && form.checkOutDate <= form.checkInDate) {
      nextErrors.checkOutDate = 'Çıkış tarihi giriş tarihinden sonra olmalıdır.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validate()) return

    await onSubmit({
      ...form,
      totalPrice: Number(form.totalPrice) || 0,
      deposit: Number(form.deposit) || 0,
      remainingPayment,
    })
  }

  return (
    <section className='card'>
      <h2 className='text-lg font-semibold text-blue-950'>
        {initialValues ? 'Rezervasyon Düzenle' : 'Yeni Rezervasyon'}
      </h2>

      <form onSubmit={handleSubmit} className='mt-4 grid gap-4 md:grid-cols-2'>
        <div>
          <label className='mb-1 block text-sm font-medium'>Müşteri Adı</label>
          <input name='customerName' value={form.customerName} onChange={handleChange} className='input' />
          {errors.customerName ? <p className='mt-1 text-xs text-rose-600'>{errors.customerName}</p> : null}
        </div>

        <div>
          <label className='mb-1 block text-sm font-medium'>Telefon</label>
          <input name='customerPhone' value={form.customerPhone} onChange={handleChange} className='input' />
          {errors.customerPhone ? <p className='mt-1 text-xs text-rose-600'>{errors.customerPhone}</p> : null}
        </div>

        <div>
          <label className='mb-1 block text-sm font-medium'>Oda Adı</label>
          <input name='roomName' value={form.roomName} onChange={handleChange} className='input' />
          {errors.roomName ? <p className='mt-1 text-xs text-rose-600'>{errors.roomName}</p> : null}
        </div>

        <div>
          <label className='mb-1 block text-sm font-medium'>Ödeme Durumu</label>
          <select name='paymentStatus' value={form.paymentStatus} onChange={handleChange} className='input'>
            <option>Ödenmedi</option>
            <option>Kapora Alındı</option>
            <option>Tamamı Ödendi</option>
          </select>
        </div>

        <div>
          <label className='mb-1 block text-sm font-medium'>Giriş Tarihi</label>
          <input
            type='date'
            name='checkInDate'
            value={form.checkInDate}
            onChange={handleChange}
            className='input'
          />
          {form.checkInDate ? (
            <p className='mt-1 text-xs text-slate-500'>Seçilen tarih: {formatDateTR(form.checkInDate, 'dd MMMM yyyy')}</p>
          ) : null}
          {errors.checkInDate ? <p className='mt-1 text-xs text-rose-600'>{errors.checkInDate}</p> : null}
        </div>

        <div>
          <label className='mb-1 block text-sm font-medium'>Çıkış Tarihi</label>
          <input
            type='date'
            name='checkOutDate'
            value={form.checkOutDate}
            onChange={handleChange}
            className='input'
          />
          {form.checkOutDate ? (
            <p className='mt-1 text-xs text-slate-500'>Seçilen tarih: {formatDateTR(form.checkOutDate, 'dd MMMM yyyy')}</p>
          ) : null}
          {errors.checkOutDate ? <p className='mt-1 text-xs text-rose-600'>{errors.checkOutDate}</p> : null}
        </div>

        <div>
          <label className='mb-1 block text-sm font-medium'>Toplam Ücret (TL)</label>
          <input
            type='number'
            min='0'
            step='0.01'
            name='totalPrice'
            value={form.totalPrice}
            onChange={handleChange}
            className='input'
          />
          {errors.totalPrice ? <p className='mt-1 text-xs text-rose-600'>{errors.totalPrice}</p> : null}
        </div>

        <div>
          <label className='mb-1 block text-sm font-medium'>Kapora (TL)</label>
          <input
            type='number'
            min='0'
            step='0.01'
            name='deposit'
            value={form.deposit}
            onChange={handleChange}
            className='input'
          />
          {errors.deposit ? <p className='mt-1 text-xs text-rose-600'>{errors.deposit}</p> : null}
        </div>

        <div>
          <label className='mb-1 block text-sm font-medium'>Kalan Ödeme (Otomatik)</label>
          <input value={Number.isFinite(remainingPayment) ? remainingPayment : 0} readOnly className='input bg-slate-100' />
        </div>

        <div>
          <label className='mb-1 block text-sm font-medium'>Rezervasyon Durumu</label>
          <select
            name='reservationStatus'
            value={form.reservationStatus}
            onChange={handleChange}
            className='input'
          >
            <option>Aktif</option>
            <option>Tamamlandı</option>
            <option>İptal</option>
          </select>
        </div>

        <div className='md:col-span-2'>
          <label className='mb-1 block text-sm font-medium'>Not</label>
          <textarea name='note' value={form.note} onChange={handleChange} rows={3} className='input' />
        </div>

        <div className='flex items-center gap-2 md:col-span-2'>
          <button type='submit' className='btn-success' disabled={submitting}>
            {submitting ? 'Kaydediliyor...' : initialValues ? 'Güncelle' : 'Rezervasyon Ekle'}
          </button>
          {initialValues ? (
            <button type='button' className='btn border border-slate-300 bg-white' onClick={onCancel}>
              İptal
            </button>
          ) : null}
        </div>
      </form>
    </section>
  )
}

export default ReservationForm
