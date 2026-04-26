import { useMemo, useState } from 'react'

const CATEGORY_MAP = {
  income: ['Rezervasyon', 'Ekstra Hizmet', 'Diğer'],
  expense: ['Temizlik', 'Personel', 'Bakım', 'Fatura', 'Malzeme', 'Diğer'],
}

const DEFAULT_FORM = {
  type: 'income',
  title: '',
  amount: '',
  date: '',
  category: 'Rezervasyon',
  note: '',
}

function TransactionForm({ initialValues, onSubmit, onCancel, submitting }) {
  const [form, setForm] = useState(() => (initialValues ? { ...DEFAULT_FORM, ...initialValues } : DEFAULT_FORM))
  const [errors, setErrors] = useState({})

  const categoryOptions = useMemo(() => CATEGORY_MAP[form.type], [form.type])

  const handleChange = (event) => {
    const { name, value } = event.target
    if (name === 'type') {
      setForm((prev) => ({
        ...prev,
        type: value,
        category: CATEGORY_MAP[value][0],
      }))
      return
    }

    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const validate = () => {
    const nextErrors = {}
    const amount = Number(form.amount)

    if (!form.title.trim()) nextErrors.title = 'Başlık zorunludur.'
    if (!form.date) nextErrors.date = 'Tarih seçilmelidir.'
    if (!Number.isFinite(amount) || amount <= 0) nextErrors.amount = 'Tutar 0’dan büyük olmalıdır.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validate()) return

    await onSubmit({
      ...form,
      amount: Number(form.amount),
    })
  }

  return (
    <section className='card'>
      <h2 className='text-lg font-semibold text-blue-950'>{initialValues ? 'İşlem Düzenle' : 'Gelir / Gider Ekle'}</h2>

      <form onSubmit={handleSubmit} className='mt-4 grid gap-4 md:grid-cols-2'>
        <div>
          <label className='mb-1 block text-sm font-medium'>İşlem Tipi</label>
          <select className='input' name='type' value={form.type} onChange={handleChange}>
            <option value='income'>Gelir</option>
            <option value='expense'>Gider</option>
          </select>
        </div>

        <div>
          <label className='mb-1 block text-sm font-medium'>Kategori</label>
          <select className='input' name='category' value={form.category} onChange={handleChange}>
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className='mb-1 block text-sm font-medium'>Başlık</label>
          <input className='input' name='title' value={form.title} onChange={handleChange} />
          {errors.title ? <p className='mt-1 text-xs text-rose-600'>{errors.title}</p> : null}
        </div>

        <div>
          <label className='mb-1 block text-sm font-medium'>Tutar (TL)</label>
          <input
            className='input'
            type='number'
            min='0.01'
            step='0.01'
            name='amount'
            value={form.amount}
            onChange={handleChange}
          />
          {errors.amount ? <p className='mt-1 text-xs text-rose-600'>{errors.amount}</p> : null}
        </div>

        <div>
          <label className='mb-1 block text-sm font-medium'>Tarih</label>
          <input className='input' type='date' name='date' value={form.date} onChange={handleChange} />
          {errors.date ? <p className='mt-1 text-xs text-rose-600'>{errors.date}</p> : null}
        </div>

        <div className='md:col-span-2'>
          <label className='mb-1 block text-sm font-medium'>Not</label>
          <textarea className='input' name='note' value={form.note} onChange={handleChange} rows={3} />
        </div>

        <div className='flex items-center gap-2 md:col-span-2'>
          <button type='submit' className='btn-success' disabled={submitting}>
            {submitting ? 'Kaydediliyor...' : initialValues ? 'Güncelle' : 'Ekle'}
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

export default TransactionForm
