import { format, parseISO, startOfMonth } from 'date-fns'
import { tr } from 'date-fns/locale'
import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getReservations } from '../services/reservationService'
import { getTransactions } from '../services/transactionService'
import {
  getAllTimeTransactionNet,
  getMonthlyTransactionSeries,
  getMonthlyTransactionTotals,
} from '../utils/financeUtils'
import { formatCurrencyTRY } from '../utils/formatters'
import {
  getAllTimeReservationIncome,
  getEffectiveReservationStatus,
  getMonthlyReservationIncome,
  getMonthlyReservationIncomeSeries,
  getPaymentStatusCounts,
  getReservationStatusCounts,
  getTopUsedRooms,
  RES_STATUS,
} from '../utils/reservationUtils'

const STATUS_COLORS = ['#10b981', '#1d4ed8', '#ef4444']

function Reports() {
  const [reservations, setReservations] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))

  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true)
      setError('')
      try {
        const [reservationData, transactionData] = await Promise.all([getReservations(), getTransactions()])
        setReservations(reservationData)
        setTransactions(transactionData)
      } catch (fetchError) {
        setError('Rapor verileri yüklenirken bir hata oluştu.')
        console.error(fetchError)
      } finally {
        setLoading(false)
      }
    }

    fetchReportData()
  }, [])

  const reportData = useMemo(() => {
    const referenceDate = parseISO(`${selectedMonth}-01`)
    const reservationCounts = getReservationStatusCounts(reservations)
    const monthlyReservationIncome = getMonthlyReservationIncome(reservations, referenceDate)
    const { monthlyIncome: monthlyManualIncome, monthlyExpense } = getMonthlyTransactionTotals(
      transactions,
      referenceDate,
    )
    const monthlyTotalIncome = monthlyReservationIncome + monthlyManualIncome
    const monthlyNet = monthlyTotalIncome - monthlyExpense
    const allTimeNet = getAllTimeReservationIncome(reservations) + getAllTimeTransactionNet(transactions)

    const roomUsage = getTopUsedRooms(reservations)
    const topRoom = roomUsage[0]?.roomName ?? '-'

    const statusPieData = [
      { name: 'Aktif', value: reservationCounts.active },
      { name: 'Tamamlandı', value: reservationCounts.completed },
      { name: 'İptal', value: reservationCounts.cancelled },
    ]
    const paymentSummary = getPaymentStatusCounts(reservations, referenceDate)

    const reservationSeries = getMonthlyReservationIncomeSeries(reservations, 6, referenceDate)
    const transactionSeries = getMonthlyTransactionSeries(transactions, 6, referenceDate)
    const monthlyBarData = reservationSeries.map((item, index) => ({
      month: format(item.monthDate || startOfMonth(referenceDate), 'MMM yy', { locale: tr }),
      gelir: item.reservationIncome + (transactionSeries[index]?.income ?? 0),
      gider: transactionSeries[index]?.expense ?? 0,
    }))

    const monthlyReservationCount = reservations.filter((reservation) => {
      const status = getEffectiveReservationStatus(reservation, referenceDate)
      if (status === RES_STATUS.CANCELLED) return false
      const checkInDate = reservation.checkInDate ? parseISO(reservation.checkInDate) : null
      if (!checkInDate || Number.isNaN(checkInDate.getTime())) return false
      return format(checkInDate, 'yyyy-MM') === selectedMonth
    }).length

    return {
      reservationCounts,
      monthlyReservationIncome,
      monthlyManualIncome,
      monthlyTotalIncome,
      monthlyExpense,
      monthlyNet,
      allTimeNet,
      topRoom,
      roomUsage,
      statusPieData,
      paymentSummary,
      monthlyBarData,
      monthlyReservationCount,
      selectedMonthLabel: format(referenceDate, 'MMMM yyyy', { locale: tr }),
      selectedMonthChartData: [{ ay: format(referenceDate, 'MMMM yyyy', { locale: tr }), gelir: monthlyTotalIncome, gider: monthlyExpense }],
    }
  }, [reservations, transactions, selectedMonth])

  return (
    <section className='space-y-4'>
      <div className='card'>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <h2 className='text-lg font-semibold text-blue-950'>Raporlar - {reportData.selectedMonthLabel}</h2>
          <div>
            <label className='mb-1 block text-xs font-medium text-slate-600'>Ay / Yıl Seç</label>
            <input
              type='month'
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className='input'
            />
          </div>
        </div>
      </div>

      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        <article className='card'>
          <p className='text-sm text-slate-500'>Toplam Rezervasyon</p>
          <p className='mt-2 text-2xl font-semibold text-blue-950'>{loading ? '...' : reportData.reservationCounts.total}</p>
        </article>
        <article className='card'>
          <p className='text-sm text-slate-500'>Aktif Rezervasyon</p>
          <p className='mt-2 text-2xl font-semibold text-emerald-600'>{loading ? '...' : reportData.reservationCounts.active}</p>
        </article>
        <article className='card'>
          <p className='text-sm text-slate-500'>Tamamlanan Rezervasyon</p>
          <p className='mt-2 text-2xl font-semibold text-indigo-600'>
            {loading ? '...' : reportData.reservationCounts.completed}
          </p>
        </article>
        <article className='card'>
          <p className='text-sm text-slate-500'>İptal Rezervasyon</p>
          <p className='mt-2 text-2xl font-semibold text-rose-600'>{loading ? '...' : reportData.reservationCounts.cancelled}</p>
        </article>
      </div>

      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        <article className='card'>
          <p className='text-sm text-slate-500'>Seçili Ay Rezervasyon Sayısı</p>
          <p className='mt-2 text-xl font-semibold text-blue-950'>
            {loading ? '...' : reportData.monthlyReservationCount}
          </p>
        </article>
        <article className='card'>
          <p className='text-sm text-slate-500'>Rezervasyon Geliri</p>
          <p className='mt-2 text-xl font-semibold text-blue-950'>
            {loading ? '...' : formatCurrencyTRY(reportData.monthlyReservationIncome)}
          </p>
        </article>
        <article className='card'>
          <p className='text-sm text-slate-500'>Manuel Gelir</p>
          <p className='mt-2 text-xl font-semibold text-emerald-600'>
            {loading ? '...' : formatCurrencyTRY(reportData.monthlyManualIncome)}
          </p>
        </article>
        <article className='card'>
          <p className='text-sm text-slate-500'>Toplam Gelir</p>
          <p className='mt-2 text-xl font-semibold text-emerald-600'>
            {loading ? '...' : formatCurrencyTRY(reportData.monthlyTotalIncome)}
          </p>
        </article>
      </div>

      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
        <article className='card'>
          <p className='text-sm text-slate-500'>Toplam Gider</p>
          <p className='mt-2 text-xl font-semibold text-rose-600'>
            {loading ? '...' : formatCurrencyTRY(reportData.monthlyExpense)}
          </p>
        </article>
        <article className='card'>
          <p className='text-sm text-slate-500'>Net Kazanç</p>
          <p className='mt-2 text-2xl font-semibold text-blue-950'>
            {loading ? '...' : formatCurrencyTRY(reportData.monthlyNet)}
          </p>
        </article>
        <article className='card'>
          <p className='text-sm text-slate-500'>Tüm Zamanlar Net Kazanç</p>
          <p className='mt-2 text-2xl font-semibold text-blue-950'>
            {loading ? '...' : formatCurrencyTRY(reportData.allTimeNet)}
          </p>
        </article>
      </div>

      <article className='card'>
        <p className='text-sm text-slate-500'>En Çok Kullanılan Oda / Bungalov</p>
        <p className='mt-2 text-2xl font-semibold text-blue-950'>{loading ? '...' : reportData.topRoom}</p>
      </article>
      <div className='grid gap-4 sm:grid-cols-3'>
        <article className='card'>
          <p className='text-sm text-slate-500'>Ödenmedi</p>
          <p className='mt-2 text-2xl font-semibold text-rose-600'>{loading ? '...' : reportData.paymentSummary.unpaid}</p>
        </article>
        <article className='card'>
          <p className='text-sm text-slate-500'>Kapora Alındı</p>
          <p className='mt-2 text-2xl font-semibold text-amber-600'>{loading ? '...' : reportData.paymentSummary.deposit}</p>
        </article>
        <article className='card'>
          <p className='text-sm text-slate-500'>Tamamı Ödendi</p>
          <p className='mt-2 text-2xl font-semibold text-emerald-600'>{loading ? '...' : reportData.paymentSummary.paid}</p>
        </article>
      </div>

      {error ? <p className='text-sm text-rose-600'>{error}</p> : null}

      {loading ? (
        <div className='card'>
          <p className='text-sm text-slate-500'>Rapor grafikleri yükleniyor...</p>
        </div>
      ) : reservations.length === 0 && transactions.length === 0 ? (
        <div className='card'>
          <p className='text-sm text-slate-500'>Rapor oluşturmak için henüz veri bulunmuyor.</p>
        </div>
      ) : (
        <div className='grid gap-4 lg:grid-cols-2'>
          <div className='card'>
            <h3 className='text-base font-semibold text-blue-950'>Seçili Ay Gelir / Gider</h3>
            <div className='mt-4 h-72 w-full'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart data={reportData.selectedMonthChartData}>
                  <XAxis dataKey='ay' />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrencyTRY(value)} />
                  <Legend />
                  <Bar dataKey='gelir' fill='#10b981' name='Gelir' radius={[6, 6, 0, 0]} />
                  <Bar dataKey='gider' fill='#ef4444' name='Gider' radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className='card'>
            <h3 className='text-base font-semibold text-blue-950'>Rezervasyon Durum Dağılımı</h3>
            <div className='mt-4 h-72 w-full'>
              <ResponsiveContainer width='100%' height='100%'>
                <PieChart>
                  <Pie data={reportData.statusPieData} dataKey='value' nameKey='name' outerRadius={90} label>
                    {reportData.statusPieData.map((entry, index) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className='card lg:col-span-2'>
            <h3 className='text-base font-semibold text-blue-950'>Son 6 Ay Gelir / Gider</h3>
            <div className='mt-4 h-72 w-full'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart data={reportData.monthlyBarData}>
                  <XAxis dataKey='month' />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrencyTRY(value)} />
                  <Legend />
                  <Bar dataKey='gelir' fill='#10b981' name='Gelir' radius={[6, 6, 0, 0]} />
                  <Bar dataKey='gider' fill='#ef4444' name='Gider' radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className='card lg:col-span-2'>
            <h3 className='text-base font-semibold text-blue-950'>En Çok Kullanılan Odalar</h3>
            {reportData.roomUsage.length === 0 ? (
              <p className='mt-2 text-sm text-slate-500'>Henüz oda kullanım verisi yok.</p>
            ) : (
              <div className='mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
                {reportData.roomUsage.slice(0, 6).map((room) => (
                  <article key={room.roomName} className='rounded-lg border border-slate-200 p-3'>
                    <p className='text-sm font-medium text-blue-950'>{room.roomName}</p>
                    <p className='text-xs text-slate-500'>{room.count} rezervasyon</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

export default Reports
