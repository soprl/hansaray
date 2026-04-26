import { useEffect, useMemo, useState } from 'react'
import TransactionForm from '../components/TransactionForm'
import { useAuth } from '../context/useAuth'
import {
  addTransaction,
  deleteTransaction,
  getTransactions,
  updateTransaction,
} from '../services/transactionService'
import { getAllTimeTransactionNet, getMonthlyTransactionTotals } from '../utils/financeUtils'
import { formatCurrencyTRY, formatDateTR } from '../utils/formatters'

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
    let cancelled = false

    getTransactions()
      .then((data) => {
        if (!cancelled) {
          setTransactions(data)
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError('Gelir / gider verileri yüklenirken bir hata oluştu.')
        }
        console.error(fetchError)
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const allCategories = useMemo(
    () => [...new Set(transactions.map((transaction) => transaction.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')),
    [transactions],
  )

  const filteredTransactions = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase('tr')
    return transactions.filter((transaction) => {
      const searchMatch =
        !searchTerm ||
        transaction.title?.toLowerCase('tr').includes(searchTerm) ||
        transaction.note?.toLowerCase('tr').includes(searchTerm)
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

      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        <article className='card'>
          <p className='text-sm text-slate-500'>Bu Ay Toplam Gelir</p>
          <p className='mt-2 text-xl font-semibold text-emerald-600'>{formatCurrencyTRY(summary.monthlyIncome)}</p>
        </article>
        <article className='card'>
          <p className='text-sm text-slate-500'>Bu Ay Toplam Gider</p>
          <p className='mt-2 text-xl font-semibold text-rose-600'>{formatCurrencyTRY(summary.monthlyExpense)}</p>
        </article>
        <article className='card'>
          <p className='text-sm text-slate-500'>Bu Ay Net Kazanç</p>
          <p className='mt-2 text-xl font-semibold text-blue-950'>{formatCurrencyTRY(summary.monthlyNet)}</p>
        </article>
        <article className='card'>
          <p className='text-sm text-slate-500'>Tüm Zamanlar Net Kazanç</p>
          <p className='mt-2 text-xl font-semibold text-blue-950'>{formatCurrencyTRY(summary.allTimeNet)}</p>
        </article>
      </div>

      <div className='card space-y-4'>
        <div className='flex flex-col gap-3 md:flex-row'>
          <input
            className='input'
            placeholder='Başlık veya not ara...'
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
          />
          <select
            className='input'
            value={filters.type}
            onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value }))}
          >
            <option value='all'>Tüm Tipler</option>
            <option value='income'>Gelir</option>
            <option value='expense'>Gider</option>
          </select>
          <select
            className='input'
            value={filters.category}
            onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
          >
            <option value='all'>Tüm Kategoriler</option>
            {allCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {error ? <p className='text-sm text-rose-600'>{error}</p> : null}

        {loading ? (
          <p className='text-sm text-slate-500'>İşlemler yükleniyor...</p>
        ) : filteredTransactions.length === 0 ? (
          <p className='text-sm text-slate-500'>Filtreye uygun işlem bulunamadı.</p>
        ) : (
          <div className='grid gap-3'>
            {filteredTransactions.map((transaction) => (
              <article key={transaction.id} className='rounded-lg border border-slate-200 p-4'>
                <div className='flex flex-col justify-between gap-3 md:flex-row md:items-start'>
                  <div className='space-y-1'>
                    <p className='text-base font-semibold text-blue-950'>{transaction.title}</p>
                    <p className='text-sm text-slate-600'>
                      {transaction.type === 'income' ? 'Gelir' : 'Gider'} - {transaction.category}
                    </p>
                    <p className='text-sm text-slate-500'>{formatDateTR(transaction.date)}</p>
                    {transaction.note ? <p className='text-sm text-slate-500'>{transaction.note}</p> : null}
                  </div>
                  <p
                    className={`text-lg font-semibold ${
                      transaction.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {transaction.type === 'income' ? '+' : '-'}
                    {formatCurrencyTRY(transaction.amount)}
                  </p>
                </div>

                <div className='mt-3 flex gap-2'>
                  <button
                    type='button'
                    className='btn border border-slate-300 bg-white'
                    onClick={() => setEditingTransaction(transaction)}
                  >
                    Düzenle
                  </button>
                  <button
                    type='button'
                    className='btn-danger'
                    onClick={() => handleDelete(transaction.id)}
                  >
                    Sil
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default Finance
