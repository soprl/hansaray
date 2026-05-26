import { useEffect, useMemo, useState } from 'react'
import TransactionForm from '../components/TransactionForm'
import { useAuth } from '../context/useAuth'
import { EXPENSE_CATEGORIES, EXTRA_INCOME_CATEGORIES } from '../config/financeCategories'
import {
  addTransaction,
  deleteTransaction,
  getTransactions,
  updateTransaction,
} from '../services/transactionService'
import { getAllTimeTransactionNet, getMonthlyTransactionTotals } from '../utils/financeUtils'
import { formatCurrencyTRY, formatDateTR } from '../utils/formatters'

const TYPE_FILTER_OPTIONS = [
  { id: 'all', label: 'Tümü' },
  { id: 'income', label: 'Gelir' },
  { id: 'expense', label: 'Gider' },
]

function Finance() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [filters, setFilters] = useState({
    search: '',
    type: 'all',
    category: 'all',
  })

  const loadTransactions = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getTransactions()
      setTransactions(data)
    } catch (fetchError) {
      setError('Gelir / gider verileri yüklenirken bir hata oluştu.')
      console.error(fetchError)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    loadTransactions()
  }, [user])

  const allCategories = useMemo(
    () =>
      [...new Set(transactions.map((transaction) => transaction.category).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'tr'),
      ),
    [transactions],
  )

  const filteredTransactions = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase('tr')
    return transactions.filter((transaction) => {
      const searchMatch =
        !searchTerm ||
        transaction.title?.toLowerCase('tr').includes(searchTerm) ||
        transaction.note?.toLowerCase('tr').includes(searchTerm) ||
        transaction.category?.toLowerCase('tr').includes(searchTerm)
      const typeMatch = filters.type === 'all' || transaction.type === filters.type
      const categoryMatch = filters.category === 'all' || transaction.category === filters.category
      return searchMatch && typeMatch && categoryMatch
    })
  }, [transactions, filters])

  const summary = useMemo(() => {
    const { monthlyIncome, monthlyExpense, monthlyNet } = getMonthlyTransactionTotals(transactions)
    return {
      monthlyIncome,
      monthlyExpense,
      monthlyNet,
      allTimeNet: getAllTimeTransactionNet(transactions),
    }
  }, [transactions])

  const handleSubmitTransaction = async (formData) => {
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        ...formData,
        createdBy: user?.email ?? 'unknown',
      }

      if (editingTransaction?.id) {
        await updateTransaction(editingTransaction.id, payload)
      } else {
        await addTransaction(payload)
      }

      setEditingTransaction(null)
      await loadTransactions()
    } catch (submitError) {
      setError('İşlem kaydedilemedi. Lütfen tekrar deneyin.')
      console.error(submitError)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    const confirmed = window.confirm('Bu işlem silinsin mi?')
    if (!confirmed) return

    setError('')
    try {
      await deleteTransaction(id)
      if (editingTransaction?.id === id) setEditingTransaction(null)
      await loadTransactions()
    } catch (deleteError) {
      setError('İşlem silinirken bir hata oluştu.')
      console.error(deleteError)
    }
  }

  return (
    <section className='space-y-4'>
      <TransactionForm
        key={editingTransaction?.id ?? 'new'}
        initialValues={editingTransaction}
        onSubmit={handleSubmitTransaction}
        onCancel={() => setEditingTransaction(null)}
        submitting={submitting}
      />

      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <article className='card border-emerald-100 bg-emerald-50/30'>
          <p className='text-sm text-slate-600'>Bu ay gelir</p>
          <p className='mt-1 text-xl font-semibold text-emerald-700'>
            {loading ? '...' : formatCurrencyTRY(summary.monthlyIncome)}
          </p>
        </article>
        <article className='card border-rose-100 bg-rose-50/30'>
          <p className='text-sm text-slate-600'>Bu ay gider</p>
          <p className='mt-1 text-xl font-semibold text-rose-700'>
            {loading ? '...' : formatCurrencyTRY(summary.monthlyExpense)}
          </p>
        </article>
        <article className='card'>
          <p className='text-sm text-slate-600'>Bu ay net</p>
          <p className='mt-1 text-xl font-semibold text-blue-950'>
            {loading ? '...' : formatCurrencyTRY(summary.monthlyNet)}
          </p>
        </article>
        <article className='card'>
          <p className='text-sm text-slate-600'>Tüm zamanlar net</p>
          <p className='mt-1 text-xl font-semibold text-blue-950'>
            {loading ? '...' : formatCurrencyTRY(summary.allTimeNet)}
          </p>
        </article>
      </div>

      <div className='card space-y-4'>
        <h2 className='text-base font-semibold text-blue-950'>Kayıtlar</h2>

        <input
          className='input'
          placeholder='Başlık, kategori veya not ara…'
          value={filters.search}
          onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
        />

        <div className='space-y-2'>
          <p className='text-xs font-medium uppercase tracking-wide text-slate-500'>Tip</p>
          <div className='flex flex-wrap gap-2'>
            {TYPE_FILTER_OPTIONS.map((option) => (
              <button
                key={option.id}
                type='button'
                onClick={() => setFilters((prev) => ({ ...prev, type: option.id }))}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  filters.type === option.id
                    ? 'border-blue-800 bg-blue-900 text-white'
                    : option.id === 'income'
                      ? 'border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50'
                      : option.id === 'expense'
                        ? 'border-rose-200 bg-white text-rose-800 hover:bg-rose-50'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {allCategories.length > 0 ? (
          <div className='space-y-2'>
            <p className='text-xs font-medium uppercase tracking-wide text-slate-500'>Kategori</p>
            <div className='flex flex-wrap gap-2'>
              <button
                type='button'
                onClick={() => setFilters((prev) => ({ ...prev, category: 'all' }))}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  filters.category === 'all'
                    ? 'border-slate-700 bg-slate-800 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Tümü
              </button>
              {allCategories.map((category) => (
                <button
                  key={category}
                  type='button'
                  onClick={() => setFilters((prev) => ({ ...prev, category }))}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    filters.category === category
                      ? 'border-slate-700 bg-slate-800 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <p className='text-sm text-rose-600'>{error}</p> : null}

        {loading ? (
          <p className='text-sm text-slate-500'>İşlemler yükleniyor...</p>
        ) : filteredTransactions.length === 0 ? (
          <p className='text-sm text-slate-500'>Kayıt bulunamadı.</p>
        ) : (
          <ul className='space-y-2'>
            {filteredTransactions.map((transaction) => {
              const isIncome = transaction.type === 'income'

              return (
                <li
                  key={transaction.id}
                  className={`rounded-xl border-2 p-3 ${
                    isIncome ? 'border-emerald-100 bg-emerald-50/20' : 'border-rose-100 bg-rose-50/20'
                  }`}
                >
                  <div className='flex items-start justify-between gap-3'>
                    <div className='min-w-0 flex-1'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                            isIncome ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isIncome ? 'Gelir' : 'Gider'}
                        </span>
                        <span className='rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700'>
                          {transaction.category}
                        </span>
                      </div>
                      <p className='mt-1.5 font-medium text-blue-950'>{transaction.title}</p>
                      <p className='text-sm text-slate-500'>{formatDateTR(transaction.date)}</p>
                      {transaction.note ? (
                        <p className='mt-1 text-sm text-slate-600'>{transaction.note}</p>
                      ) : null}
                    </div>
                    <p
                      className={`shrink-0 text-lg font-bold ${isIncome ? 'text-emerald-700' : 'text-rose-700'}`}
                    >
                      {isIncome ? '+' : '−'}
                      {formatCurrencyTRY(transaction.amount)}
                    </p>
                  </div>

                  <div className='mt-3 flex gap-2 border-t border-slate-200/80 pt-3'>
                    <button
                      type='button'
                      className='rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50'
                      onClick={() => setEditingTransaction(transaction)}
                    >
                      Düzenle
                    </button>
                    <button
                      type='button'
                      className='rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50'
                      onClick={() => handleDelete(transaction.id)}
                    >
                      Sil
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <p className='text-xs text-slate-400'>
          Kategoriler: gider — {EXPENSE_CATEGORIES.join(', ')} · gelir — {EXTRA_INCOME_CATEGORIES.join(', ')}
        </p>
      </div>
    </section>
  )
}

export default Finance
