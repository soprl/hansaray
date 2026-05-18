import { addMonths, endOfMonth, format, isWithinInterval, startOfMonth, subMonths } from 'date-fns'
import { tr } from 'date-fns/locale'
import { parseISODateSafe } from './formatters'
import {
  getAllTimeReservationIncome,
  getEffectiveReservationStatus,
  getMonthlyReservationIncome,
  getOutstandingPayment,
  isRevenueEligibleReservation,
  RES_STATUS,
} from './reservationUtils'

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

export const getTransactionsForMonth = (transactions, referenceDate = new Date()) => {
  const monthStart = startOfMonth(referenceDate)
  const monthEnd = endOfMonth(referenceDate)

  return transactions.filter((transaction) => {
    const transactionDate = parseISODateSafe(transaction.date)
    return transactionDate && isWithinInterval(transactionDate, { start: monthStart, end: monthEnd })
  })
}

export const getPendingCollectionForMonth = (reservations, referenceDate = new Date()) => {
  const monthStart = startOfMonth(referenceDate)
  const monthEnd = endOfMonth(referenceDate)

  return reservations.reduce((total, reservation) => {
    if (getEffectiveReservationStatus(reservation) === RES_STATUS.CANCELLED) return total

    const checkInDate = parseISODateSafe(reservation.checkInDate)
    if (!checkInDate || !isWithinInterval(checkInDate, { start: monthStart, end: monthEnd })) return total

    return total + getOutstandingPayment(reservation)
  }, 0)
}

export const getFinanceMonthSummary = (reservations, transactions, referenceDate = new Date()) => {
  const lodgingIncome = getMonthlyReservationIncome(reservations, referenceDate)
  const { monthlyIncome: extraIncome, monthlyExpense } = getMonthlyTransactionTotals(transactions, referenceDate)
  const pendingCollection = getPendingCollectionForMonth(reservations, referenceDate)

  return {
    lodgingIncome,
    extraIncome,
    expense: monthlyExpense,
    net: lodgingIncome + extraIncome - monthlyExpense,
    pendingCollection,
  }
}

export const getReservationsForMonth = (reservations, referenceDate = new Date()) => {
  const monthStart = startOfMonth(referenceDate)
  const monthEnd = endOfMonth(referenceDate)

  return reservations
    .filter((reservation) => {
      if (!isRevenueEligibleReservation(reservation)) return false
      const checkInDate = parseISODateSafe(reservation.checkInDate)
      return checkInDate && isWithinInterval(checkInDate, { start: monthStart, end: monthEnd })
    })
    .sort((a, b) => a.checkInDate.localeCompare(b.checkInDate))
}

export const formatMonthLabel = (referenceDate = new Date()) =>
  format(startOfMonth(referenceDate), 'MMMM yyyy', { locale: tr })

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

export const shiftMonth = (referenceDate, delta) => startOfMonth(addMonths(referenceDate, delta))

export const getRecentMonthOptions = (count = 12, referenceDate = new Date()) =>
  Array.from({ length: count }).map((_, index) => {
    const monthDate = startOfMonth(subMonths(referenceDate, index))
    return {
      value: format(monthDate, 'yyyy-MM'),
      label: format(monthDate, 'MMMM yyyy', { locale: tr }),
      date: monthDate,
    }
  })

export const getMonthNavigationOptions = (
  selectedDate,
  monthsBack = 36,
  monthsForward = 12,
) => {
  const pivot = startOfMonth(new Date())
  const selected = startOfMonth(selectedDate)
  let rangeStart = shiftMonth(pivot, -monthsBack)
  let rangeEnd = shiftMonth(pivot, monthsForward)

  if (selected < rangeStart) rangeStart = selected
  if (selected > rangeEnd) rangeEnd = selected

  const options = []
  let cursor = rangeStart
  while (cursor <= rangeEnd) {
    options.push({
      value: format(cursor, 'yyyy-MM'),
      label: formatMonthLabel(cursor),
      date: cursor,
    })
    cursor = shiftMonth(cursor, 1)
  }

  return options.reverse()
}

export const getAllTimeFinanceNet = (reservations, transactions) =>
  getAllTimeReservationIncome(reservations) + getAllTimeTransactionNet(transactions)
