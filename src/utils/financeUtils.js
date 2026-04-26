import { addMonths, endOfMonth, format, isWithinInterval, startOfMonth } from 'date-fns'
import { tr } from 'date-fns/locale'
import { parseISODateSafe } from './formatters'

export const getMonthlyTransactionTotals = (transactions, referenceDate = new Date()) => {
  const monthStart = startOfMonth(referenceDate)
  const monthEnd = endOfMonth(referenceDate)

  let monthlyIncome = 0
  let monthlyExpense = 0

  transactions.forEach((transaction) => {
    const transactionDate = parseISODateSafe(transaction.date)
    if (!transactionDate || !isWithinInterval(transactionDate, { start: monthStart, end: monthEnd })) return

    const amount = Number(transaction.amount) || 0
    if (transaction.type === 'income') monthlyIncome += amount
    if (transaction.type === 'expense') monthlyExpense += amount
  })

  return {
    monthlyIncome,
    monthlyExpense,
    monthlyNet: monthlyIncome - monthlyExpense,
  }
}

export const getAllTimeTransactionNet = (transactions) => {
  let income = 0
  let expense = 0

  transactions.forEach((transaction) => {
    const amount = Number(transaction.amount) || 0
    if (transaction.type === 'income') income += amount
    if (transaction.type === 'expense') expense += amount
  })

  return income - expense
}

export const getMonthlyTransactionSeries = (transactions, months = 6, referenceDate = new Date()) => {
  const pivotMonth = startOfMonth(referenceDate)

  return Array.from({ length: months }).map((_, index) => {
    const monthDate = addMonths(pivotMonth, index - (months - 1))
    const monthStart = startOfMonth(monthDate)
    const monthEnd = endOfMonth(monthDate)

    let income = 0
    let expense = 0

    transactions.forEach((transaction) => {
      const transactionDate = parseISODateSafe(transaction.date)
      if (!transactionDate || !isWithinInterval(transactionDate, { start: monthStart, end: monthEnd })) return

      const amount = Number(transaction.amount) || 0
      if (transaction.type === 'income') income += amount
      if (transaction.type === 'expense') expense += amount
    })

    return {
      month: format(monthDate, 'MMM yy', { locale: tr }),
      income,
      expense,
    }
  })
}
