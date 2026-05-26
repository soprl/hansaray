import { format } from 'date-fns'
import { useMemo, useState } from 'react'
import { EXPENSE_CATEGORIES, EXTRA_INCOME_CATEGORIES } from '../config/financeCategories'

const CATEGORY_MAP = {
  income: EXTRA_INCOME_CATEGORIES,
  expense: EXPENSE_CATEGORIES,
}

const TYPE_OPTIONS = [
  {
    id: 'income',
    label: 'Gelir',
    hint: 'Ek gelir',
    selected: 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200 text-emerald-900',
    unselected: 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/40',
  },
  {
    id: 'expense',
    label: 'Gider',
    hint: 'Harcama',
    selected: 'border-rose-500 bg-rose-50 ring-2 ring-rose-200 text-rose-900',
    unselected: 'border-slate-200 bg-white text-slate-700 hover:border-rose-300 hover:bg-rose-50/40',
  },
]

const buildDefaultForm = () => ({
  type: 'expense',
  title: '',
  amount: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  category: EXPENSE_CATEGORIES[0],
  note: '',
})

function TransactionForm({ initialValues, onSubmit, onCancel, submitting }) {
  const [form, setForm] = useState(() =>
    initialValues ? { ...buildDefaultForm(), ...initialValues } : buildDefaultForm(),
  )
  const [errors, setErrors] = useState({})

  const categoryOptions = useMemo(() => CATEGORY_MAP[form.type], [form.type])
  const isIncome = form.type === 'income'

  const setType = (type) => {
    setForm((prev) => ({
      ...prev,
      type,
      category: CATEGORY_MAP[type][0],
    }))
  }

  const setCategory = (category) => {
    setForm((prev) => ({ ...prev, category }))
  }

  const handleChange = (event) => {
    const { name, value } = event.target
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
      <h2 className='text-lg font-semibold text-blue-950'>
        {initialValues ? 'İşlem düzenle' : 'Gelir veya gider ekle'}
      </h2>
      {!initialValues ? (
        <p className='mt-1 text-sm text-slate-500'>
          Konaklama geliri rezervasyonlardan gelir; buraya ek gelir veya gider yazın.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className='mt-4 space-y-5'>
        <fieldset className='space-y-2'>
          <legend className='text-sm font-medium text-slate-700'>İşlem tipi</legend>
          <div className='grid grid-cols-2 gap-3'>
            {TYPE_OPTIONS.map((option) => {
              const selected = form.type === option.id
              return (
                <button
                  key={option.id}
                  type='button'
                  onClick={() => setType(option.id)}
                  className={`rounded-xl border-2 p-4 text-left transition ${selected ? option.selected : option.unselected}`}
                >
                  <p className='text-base font-bold'>{option.label}</p>
                  <p className='mt-0.5 text-xs opacity-80'>{option.hint}</p>
                </button>
              )
            })}
          </div>
        </fieldset>

        <fieldset className='space-y-2'>
          <legend className='text-sm font-medium text-slate-700'>Kategori</legend>
          <div className='flex flex-wrap gap-2'>
            {categoryOptions.map((option) => {
              const selected = form.category === option
              return (
                <button
                  key={option}
                  type='button'
                  onClick={() => setCategory(option)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    selected
                      ? isIncome
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-rose-500 bg-rose-50 text-rose-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {option}
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='sm:col-span-2'>
            <label className='mb-1 block text-sm font-medium text-slate-700'>Başlık</label>
            <input
              className='input'
              name='title'
              value={form.title}
              onChange={handleChange}
              placeholder='Örn. Elektrik faturası'
            />
            {errors.title ? <p className='mt-1 text-xs text-rose-600'>{errors.title}</p> : null}
          </div>

          <div>
            <label className='mb-1 block text-sm font-medium text-slate-700'>Tutar (₺)</label>
            <input
              className='input text-lg font-semibold'
              type='number'
              min='0.01'
              step='0.01'
              name='amount'
              value={form.amount}
              onChange={handleChange}
              placeholder='0'
            />
            {errors.amount ? <p className='mt-1 text-xs text-rose-600'>{errors.amount}</p> : null}
          </div>

          <div>
            <label className='mb-1 block text-sm font-medium text-slate-700'>Tarih</label>
            <input className='input' type='date' name='date' value={form.date} onChange={handleChange} />
            {errors.date ? <p className='mt-1 text-xs text-rose-600'>{errors.date}</p> : null}
          </div>

          <div className='sm:col-span-2'>
            <label className='mb-1 block text-sm font-medium text-slate-700'>
              Not <span className='font-normal text-slate-400'>(isteğe bağlı)</span>
            </label>
            <textarea
              className='input'
              name='note'
              value={form.note}
              onChange={handleChange}
              rows={2}
              placeholder='Kısa açıklama…'
            />
          </div>
        </div>

        <div className='flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4'>
          <button
            type='submit'
            className={`btn ${isIncome ? 'border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700' : 'btn-danger'}`}
            disabled={submitting}
          >
            {submitting ? 'Kaydediliyor...' : initialValues ? 'Güncelle' : 'Kaydet'}
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
