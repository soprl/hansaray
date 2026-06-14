import { format, parse, startOfMonth } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { getReservations, updateReservation } from '../services/reservationService'
import { getTransactions } from '../services/transactionService'
import {
  formatMonthLabel,
  getAllTimeFinanceNet,
  getFinanceMonthSummary,
  getMonthNavigationOptions,
  getReservationsForMonth,
  getTransactionsForMonth,
  shiftMonth,
} from '../utils/financeUtils'
import MoneyInput from '../components/MoneyInput'
import ReservationNote from '../components/ReservationNote'
import { getFirestoreErrorMessage } from '../utils/firestoreAuth'
import { formatCurrencyTRY, formatDateTR } from '../utils/formatters'
import { parseMoneyInput } from '../utils/moneyInput'
import {
  createEmptyUnitTargets,
  DEFAULT_BUSINESS_TARGETS,
  getBusinessTargets,
  hasConfiguredTargets,
  hasConfiguredUnitTargets,
  normalizeUnitTargets,
  saveBusinessTargets,
} from '../services/businessTargetsService'
import FinancialDashboardOverview from '../components/FinancialDashboardOverview'
import GoalProgress from '../components/GoalProgress'
import SensitivePinGate from '../components/SensitivePinGate'
import UnitEvCard from '../components/UnitEvCard'
import { EV_COUNT, EV_UNITS, formatEvSeasonCapacity } from '../config/units'
import { getRoomDisplayName } from '../config/rooms'
import { getGoalProgress, getOccupancySnapshot } from '../utils/occupancyUtils'
import { attachUnitGoals, getUnitOccupancySnapshots } from '../utils/unitOccupancyUtils'
import {
  getMonthlyReservationBreakdown,
  getOutstandingPayment,
  isFullyPaidReservation,
  PAYMENT_STATUS,
} from '../utils/reservationUtils'

function Reports() {
  const { user } = useAuth()
  const [reservations, setReservations] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()))
  const [payingReservationId, setPayingReservationId] = useState(null)
  const [lodgingSearch, setLodgingSearch] = useState('')
  const [targets, setTargets] = useState(DEFAULT_BUSINESS_TARGETS)
  const [targetsDraft, setTargetsDraft] = useState(DEFAULT_BUSINESS_TARGETS)
  const [savingTargets, setSavingTargets] = useState(false)
  const [targetsMessage, setTargetsMessage] = useState('')
  const [editingTargets, setEditingTargets] = useState(false)

  useEffect(() => {
    if (!user) return

    let cancelled = false

    Promise.all([getReservations(), getTransactions(), getBusinessTargets()])
      .then(([reservationData, transactionData, targetsData]) => {
        if (!cancelled) {
          setReservations(reservationData)
          setTransactions(transactionData)
          setTargets(targetsData)
          setTargetsDraft(targetsData)
          setEditingTargets(!hasConfiguredTargets(targetsData))
        }
      })
      .catch((fetchError) => {
        if (!cancelled) setError('Rapor verileri yüklenirken bir hata oluştu.')
        console.error(fetchError)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user])

  const monthKey = format(monthDate, 'yyyy-MM')

  useEffect(() => {
    setLodgingSearch('')
  }, [monthKey])

  const monthOptions = useMemo(() => getMonthNavigationOptions(monthDate), [monthDate])

  const reservationBreakdown = useMemo(
    () => getMonthlyReservationBreakdown(reservations, monthDate),
    [reservations, monthDate],
  )

  const allTimeNet = useMemo(
    () => getAllTimeFinanceNet(reservations, transactions),
    [reservations, transactions],
  )

  const summary = useMemo(
    () => getFinanceMonthSummary(reservations, transactions, monthDate),
    [reservations, transactions, monthDate],
  )

  const lodgingReservations = useMemo(() => {
    const list = getReservationsForMonth(reservations, monthDate)
    return [...list].sort((a, b) => {
      const aPaid = isFullyPaidReservation(a)
      const bPaid = isFullyPaidReservation(b)
      if (aPaid !== bPaid) return aPaid ? 1 : -1
      return (a.checkInDate || '').localeCompare(b.checkInDate || '')
    })
  }, [reservations, monthDate])

  const displayedLodgingReservations = useMemo(() => {
    const term = lodgingSearch.trim().toLocaleLowerCase('tr')
    if (!term) return lodgingReservations

    return lodgingReservations.filter(
      (reservation) =>
        reservation.customerName?.toLocaleLowerCase('tr').includes(term) ||
        reservation.customerPhone?.toLocaleLowerCase('tr').includes(term),
    )
  }, [lodgingReservations, lodgingSearch])

  const monthTransactions = useMemo(
    () =>
      getTransactionsForMonth(transactions, monthDate).sort((a, b) =>
        (b.date || '').localeCompare(a.date || ''),
      ),
    [transactions, monthDate],
  )

  const expenses = useMemo(
    () => monthTransactions.filter((t) => t.type === 'expense'),
    [monthTransactions],
  )

  const extraIncomes = useMemo(
    () => monthTransactions.filter((t) => t.type === 'income'),
    [monthTransactions],
  )

  const handleMonthSelect = (event) => {
    const parsed = parse(`${event.target.value}-01`, 'yyyy-MM-dd', new Date())
    if (!Number.isNaN(parsed.getTime())) {
      setMonthDate(startOfMonth(parsed))
    }
  }

  const handleMarkFullyPaid = async (reservation) => {
    const totalPrice = Number(reservation.totalPrice) || 0

    setPayingReservationId(reservation.id)
    setError('')

    try {
      await updateReservation(reservation.id, {
        ...reservation,
        paymentStatus: PAYMENT_STATUS.PAID,
        deposit: totalPrice,
      })

      setReservations((prev) =>
        prev.map((item) =>
          item.id === reservation.id
            ? {
                ...item,
                paymentStatus: PAYMENT_STATUS.PAID,
                deposit: totalPrice,
                remainingPayment: 0,
              }
            : item,
        ),
      )
    } catch (paymentError) {
      setError('Ödeme durumu güncellenirken bir hata oluştu.')
      console.error(paymentError)
    } finally {
      setPayingReservationId(null)
    }
  }

  const monthLabel = formatMonthLabel(monthDate)

  const occupancy = useMemo(() => getOccupancySnapshot(reservations, monthDate), [reservations, monthDate])

  const monthlyRevenueGoal = useMemo(
    () => getGoalProgress(summary.lodgingIncome, targets.monthlyLodgingTarget),
    [summary.lodgingIncome, targets.monthlyLodgingTarget],
  )

  const monthlyOccupancyGoal = useMemo(
    () => getGoalProgress(occupancy.monthOccupancyPercent, targets.monthlyOccupancyTargetPercent),
    [occupancy.monthOccupancyPercent, targets.monthlyOccupancyTargetPercent],
  )

  const yearlyRevenueGoal = useMemo(
    () => getGoalProgress(occupancy.yearLodgingIncome, targets.yearlyLodgingTarget),
    [occupancy.yearLodgingIncome, targets.yearlyLodgingTarget],
  )

  const yearlyOccupancyGoal = useMemo(
    () => getGoalProgress(occupancy.yearOccupancyPercent, targets.yearlyOccupancyTargetPercent),
    [occupancy.yearOccupancyPercent, targets.yearlyOccupancyTargetPercent],
  )

  const unitSnapshots = useMemo(() => {
    const snapshots = getUnitOccupancySnapshots(reservations, monthDate)
    return attachUnitGoals(snapshots, targets.unitTargets)
  }, [reservations, monthDate, targets.unitTargets])

  const handleTargetChange = (event) => {
    const { name, value } = event.target
    setTargetsDraft((prev) => ({ ...prev, [name]: value }))
  }

  const handleTargetMoneyChange = (name, value) => {
    setTargetsDraft((prev) => ({ ...prev, [name]: value }))
  }

  const handleUnitTargetMoneyChange = (roomId, value) => {
    setTargetsDraft((prev) => {
      const unitTargets = normalizeUnitTargets(prev.unitTargets)
      unitTargets[roomId] = { ...unitTargets[roomId], yearlyLodgingTarget: value }
      return { ...prev, unitTargets }
    })
  }

  const handleUnitTargetPercentChange = (roomId, value) => {
    setTargetsDraft((prev) => {
      const unitTargets = normalizeUnitTargets(prev.unitTargets)
      unitTargets[roomId] = { ...unitTargets[roomId], yearlyOccupancyTargetPercent: value }
      return { ...prev, unitTargets }
    })
  }

  const distributeYearlyLodgingToUnits = () => {
    const total = parseMoneyInput(targetsDraft.yearlyLodgingTarget)
    if (total <= 0) return
    const perEv = Math.round(total / EV_COUNT)
    setTargetsDraft((prev) => {
      const unitTargets = createEmptyUnitTargets()
      EV_UNITS.forEach(({ roomId }) => {
        unitTargets[roomId] = {
          ...normalizeUnitTargets(prev.unitTargets)[roomId],
          yearlyLodgingTarget: perEv,
        }
      })
      return { ...prev, unitTargets }
    })
  }

  const openTargetEditor = () => {
    setTargetsDraft(targets)
    setTargetsMessage('')
    setEditingTargets(true)
  }

  const cancelTargetEditor = () => {
    setTargetsDraft(targets)
    setTargetsMessage('')
    setEditingTargets(!hasConfiguredTargets(targets))
  }

  const targetsSummary = useMemo(() => {
    if (!hasConfiguredTargets(targets)) return null
    const parts = []
    if (Number(targets.monthlyLodgingTarget) > 0) {
      parts.push(`Aylık gelir ${formatCurrencyTRY(targets.monthlyLodgingTarget)}`)
    }
    if (Number(targets.yearlyLodgingTarget) > 0) {
      parts.push(`Sezon gelir hedefi ${formatCurrencyTRY(targets.yearlyLodgingTarget)}`)
    }
    if (Number(targets.monthlyOccupancyTargetPercent) > 0) {
      parts.push(`Aylık doluluk %${targets.monthlyOccupancyTargetPercent}`)
    }
    if (Number(targets.yearlyOccupancyTargetPercent) > 0) {
      parts.push(`Yıllık doluluk %${targets.yearlyOccupancyTargetPercent}`)
    }
    if (hasConfiguredUnitTargets(targets.unitTargets)) {
      parts.push('5 ev yıllık hedefi')
    }
    return parts.join(' · ')
  }, [targets])

  const handleSaveTargets = async (event) => {
    event.preventDefault()
    setSavingTargets(true)
    setTargetsMessage('')
    try {
      const payload = {
        monthlyLodgingTarget: parseMoneyInput(targetsDraft.monthlyLodgingTarget),
        yearlyLodgingTarget: parseMoneyInput(targetsDraft.yearlyLodgingTarget),
        monthlyOccupancyTargetPercent: Number(targetsDraft.monthlyOccupancyTargetPercent) || 0,
        yearlyOccupancyTargetPercent: Number(targetsDraft.yearlyOccupancyTargetPercent) || 0,
        unitTargets: EV_UNITS.reduce((acc, { roomId }) => {
          const unit = normalizeUnitTargets(targetsDraft.unitTargets)[roomId]
          acc[roomId] = {
            yearlyLodgingTarget: parseMoneyInput(unit.yearlyLodgingTarget),
            yearlyOccupancyTargetPercent: Number(unit.yearlyOccupancyTargetPercent) || 0,
          }
          return acc
        }, {}),
      }
      await saveBusinessTargets(payload)
      setTargets(payload)
      setTargetsDraft({ ...payload, unitTargets: normalizeUnitTargets(payload.unitTargets) })
      setEditingTargets(false)
      setTargetsMessage('Hedefler kaydedildi.')
    } catch (saveError) {
      setTargetsMessage(getFirestoreErrorMessage(saveError, 'Hedefler kaydedilemedi.'))
      console.error(saveError)
    } finally {
      setSavingTargets(false)
    }
  }

  return (
    <SensitivePinGate
      title='Raporlar'
      description='Finansal raporlar için PIN girin.'
    >
    <section className='space-y-4'>
      <FinancialDashboardOverview reservations={reservations} targets={targets} loading={loading} />

      <h2 className='text-base font-semibold text-blue-950 sm:text-lg'>Aylık raporlar</h2>

      <div className='card'>
        <div className='flex items-center justify-center gap-2'>
          <button
            type='button'
            className='btn border border-slate-300 bg-white px-3'
            onClick={() => setMonthDate((d) => shiftMonth(d, -1))}
            aria-label='Önceki ay'
          >
            ←
          </button>
          <select
            className='input max-w-[220px] text-center font-medium capitalize'
            value={monthKey}
            onChange={handleMonthSelect}
          >
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type='button'
            className='btn border border-slate-300 bg-white px-3'
            onClick={() => setMonthDate((d) => shiftMonth(d, 1))}
            aria-label='Sonraki ay'
          >
            →
          </button>
        </div>
      </div>

      <p className='text-center text-sm capitalize text-slate-500'>{monthLabel} raporu</p>

      <section className='card space-y-3'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <h2 className='text-base font-semibold text-blue-950'>Hedefler</h2>
            {!editingTargets && targetsSummary ? (
              <p className='mt-1 text-xs text-slate-500'>{targetsSummary}</p>
            ) : null}
            {editingTargets ? (
              <p className='mt-1 text-xs text-slate-500'>
                {formatEvSeasonCapacity()} · genel ve ev hedefleri
              </p>
            ) : null}
          </div>
          {!editingTargets ? (
            <button
              type='button'
              className='btn shrink-0 border border-slate-300 bg-white text-sm'
              onClick={openTargetEditor}
            >
              Hedefleri düzenle
            </button>
          ) : null}
        </div>

        {editingTargets ? (
          <form onSubmit={handleSaveTargets} className='grid gap-3 sm:grid-cols-2'>
            <label className='text-sm'>
              <span className='mb-1 block text-slate-600'>Aylık konaklama geliri hedefi (₺)</span>
              <MoneyInput
                name='monthlyLodgingTarget'
                value={targetsDraft.monthlyLodgingTarget}
                onChange={handleTargetMoneyChange}
                placeholder='620.000'
              />
            </label>
            <label className='text-sm'>
              <span className='mb-1 block text-slate-600'>Yıllık konaklama geliri hedefi (₺)</span>
              <MoneyInput
                name='yearlyLodgingTarget'
                value={targetsDraft.yearlyLodgingTarget}
                onChange={handleTargetMoneyChange}
                placeholder='3.500.000'
              />
            </label>
            <label className='text-sm'>
              <span className='mb-1 block text-slate-600'>Aylık doluluk hedefi (%)</span>
              <input
                type='number'
                name='monthlyOccupancyTargetPercent'
                min='0'
                max='100'
                className='input'
                value={targetsDraft.monthlyOccupancyTargetPercent || ''}
                onChange={handleTargetChange}
              />
            </label>
            <label className='text-sm'>
              <span className='mb-1 block text-slate-600'>Yıllık doluluk hedefi (%)</span>
              <input
                type='number'
                name='yearlyOccupancyTargetPercent'
                min='0'
                max='100'
                className='input'
                value={targetsDraft.yearlyOccupancyTargetPercent || ''}
                onChange={handleTargetChange}
              />
            </label>
            <div className='sm:col-span-2'>
              <p className='mb-2 text-sm font-medium text-slate-700'>Ev başına yıllık hedef ({EV_COUNT} ev × 180 gün)</p>
              <button
                type='button'
                className='mb-3 text-sm font-medium text-blue-700 hover:underline'
                onClick={distributeYearlyLodgingToUnits}
              >
                Genel yıllık geliri 5 eve eşit böl
              </button>
              <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                {EV_UNITS.map((unit) => {
                  const unitDraft = normalizeUnitTargets(targetsDraft.unitTargets)[unit.roomId]
                  return (
                    <div key={unit.roomId} className='rounded-lg border border-slate-200 p-3'>
                      <p className='mb-2 text-sm font-medium text-blue-950'>
                        {unit.evLabel}{' '}
                        <span className='font-normal text-slate-400'>({unit.caption})</span>
                      </p>
                      <label className='mb-2 block text-sm'>
                        <span className='mb-1 block text-slate-600'>Yıllık gelir (₺)</span>
                        <MoneyInput
                          name={`unit-${unit.roomId}-revenue`}
                          value={unitDraft.yearlyLodgingTarget}
                          onChange={(_name, value) => handleUnitTargetMoneyChange(unit.roomId, value)}
                          placeholder='700.000'
                        />
                      </label>
                      <label className='block text-sm'>
                        <span className='mb-1 block text-slate-600'>Yıllık doluluk (%)</span>
                        <input
                          type='number'
                          min='0'
                          max='100'
                          className='input'
                          value={unitDraft.yearlyOccupancyTargetPercent || ''}
                          onChange={(event) =>
                            handleUnitTargetPercentChange(unit.roomId, event.target.value)
                          }
                        />
                      </label>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className='flex flex-wrap items-center gap-2 sm:col-span-2'>
              <button type='submit' className='btn-success' disabled={savingTargets}>
                {savingTargets ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
              {hasConfiguredTargets(targets) ? (
                <button type='button' className='btn border border-slate-300 bg-white' onClick={cancelTargetEditor}>
                  Vazgeç
                </button>
              ) : null}
              {targetsMessage ? (
                <p className={`text-sm ${targetsMessage.includes('kaydedildi') ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {targetsMessage}
                </p>
              ) : null}
            </div>
          </form>
        ) : null}
      </section>

      <section>
        <h2 className='mb-2 text-sm font-medium text-slate-600'>
          Doluluk (seçili ay · sezon içi günler)
        </h2>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          <article className='card'>
            <p className='text-sm text-slate-500'>Doluluk oranı</p>
            <p className='mt-1 text-2xl font-semibold text-blue-950'>
              {loading ? '...' : `%${occupancy.monthOccupancyPercent}`}
            </p>
            <p className='mt-1 text-xs text-slate-400'>
              {loading
                ? null
                : occupancy.monthInSeason
                  ? `${occupancy.monthOccupiedNights} dolu · ${occupancy.monthEmptyNights} boş gece (${occupancy.monthAvailableNights} kapasite, ${occupancy.seasonDaysInMonth} sezon günü)`
                  : 'Sezon dışı ay'}
            </p>
          </article>
          <article className='card'>
            <p className='text-sm text-slate-500'>Ortalama gece fiyatı</p>
            <p className='mt-1 text-2xl font-semibold text-indigo-600'>
              {loading ? '...' : formatCurrencyTRY(occupancy.monthAverageDailyRate)}
            </p>
            <p className='mt-1 text-xs text-slate-400'>Konaklama geliri ÷ dolu gece</p>
          </article>
          <GoalProgress
            label='Gelir hedefi (bu ay)'
            currentLabel={loading ? '...' : formatCurrencyTRY(summary.lodgingIncome)}
            targetLabel={formatCurrencyTRY(monthlyRevenueGoal.target)}
            percent={monthlyRevenueGoal.percent}
            hasTarget={monthlyRevenueGoal.hasTarget}
            progress={monthlyRevenueGoal}
            kind='currency'
          />
          <GoalProgress
            label='Doluluk hedefi (bu ay)'
            currentLabel={loading ? '...' : `%${occupancy.monthOccupancyPercent}`}
            targetLabel={`%${monthlyOccupancyGoal.target}`}
            percent={monthlyOccupancyGoal.percent}
            hasTarget={monthlyOccupancyGoal.hasTarget}
            progress={monthlyOccupancyGoal}
            kind='percent'
          />
        </div>
        <p className='mt-3 text-xs text-slate-400'>
          Sezon geliri: sezon içinde girişi olan tüm rezervasyonların toplam ücreti (gelecek rezervasyonlar dahil).
        </p>
        <div className='mt-2 grid gap-3 sm:grid-cols-2'>
          <GoalProgress
            label='Sezon gelir hedefi'
            currentLabel={loading ? '...' : formatCurrencyTRY(occupancy.yearLodgingIncome)}
            targetLabel={formatCurrencyTRY(yearlyRevenueGoal.target)}
            percent={yearlyRevenueGoal.percent}
            hasTarget={yearlyRevenueGoal.hasTarget}
            progress={yearlyRevenueGoal}
            kind='currency'
          />
          <GoalProgress
            label='Yıllık doluluk hedefi (sezon)'
            currentLabel={loading ? '...' : `%${occupancy.yearOccupancyPercent}`}
            targetLabel={`%${yearlyOccupancyGoal.target}`}
            percent={yearlyOccupancyGoal.percent}
            hasTarget={yearlyOccupancyGoal.hasTarget}
            progress={yearlyOccupancyGoal}
            kind='percent'
          />
        </div>
      </section>

      <section>
        <h2 className='mb-1 text-sm font-medium text-slate-600'>Evler · yıllık (sezon)</h2>
        <p className='mb-2 text-xs text-slate-400'>{formatEvSeasonCapacity()}</p>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'>
          {loading
            ? EV_UNITS.map((unit) => (
                <article key={unit.roomId} className='card'>
                  <p className='text-sm text-slate-500'>Yükleniyor...</p>
                </article>
              ))
            : unitSnapshots.map((unit) => <UnitEvCard key={unit.roomId} unit={unit} />)}
        </div>
      </section>

      <section>
        <h2 className='mb-2 text-sm font-medium text-slate-600'>Bu ay rezervasyonlar (giriş tarihine göre)</h2>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          <article className='card'>
            <p className='text-sm text-slate-500'>Toplam</p>
            <p className='mt-1 text-2xl font-semibold text-blue-950'>
              {loading ? '...' : reservationBreakdown.total}
            </p>
          </article>
          <article className='card'>
            <p className='text-sm text-slate-500'>Tamamlandı</p>
            <p className='mt-1 text-2xl font-semibold text-indigo-600'>
              {loading ? '...' : reservationBreakdown.completed}
            </p>
          </article>
          <article className='card'>
            <p className='text-sm text-slate-500'>Tamamlanmadı</p>
            <p className='mt-1 text-2xl font-semibold text-emerald-600'>
              {loading ? '...' : reservationBreakdown.ongoing}
            </p>
            <p className='mt-1 text-xs text-slate-400'>Devam eden veya girişi geçmiş aktif</p>
          </article>
          <article className='card'>
            <p className='text-sm text-slate-500'>Gelecek</p>
            <p className='mt-1 text-2xl font-semibold text-sky-600'>
              {loading ? '...' : reservationBreakdown.upcoming}
            </p>
            <p className='mt-1 text-xs text-slate-400'>Giriş tarihi henüz gelmedi</p>
          </article>
        </div>
        {!loading && reservationBreakdown.cancelled > 0 ? (
          <p className='mt-2 text-xs text-slate-500'>İptal: {reservationBreakdown.cancelled}</p>
        ) : null}
      </section>

      <section>
        <h2 className='mb-2 text-sm font-medium text-slate-600'>Finansal özet</h2>
        <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
          <article className='card'>
            <p className='text-sm text-slate-500'>Konaklama geliri</p>
            <p className='mt-1 text-xl font-semibold text-emerald-600'>
              {loading ? '...' : formatCurrencyTRY(summary.lodgingIncome)}
            </p>
            <p className='mt-1 text-xs text-slate-400'>Rezervasyonlardan</p>
          </article>
          <article className='card'>
            <p className='text-sm text-slate-500'>Gider</p>
            <p className='mt-1 text-xl font-semibold text-rose-600'>
              {loading ? '...' : formatCurrencyTRY(summary.expense)}
            </p>
          </article>
          <article className='card'>
            <p className='text-sm text-slate-500'>Net kazanç (bu ay)</p>
            <p className='mt-1 text-xl font-semibold text-blue-950'>
              {loading ? '...' : formatCurrencyTRY(summary.net)}
            </p>
            <p className='mt-1 text-xs text-slate-400'>
              Ek gelir {loading ? '...' : formatCurrencyTRY(summary.extraIncome)} dahil
            </p>
          </article>
          <article className='card'>
            <p className='text-sm text-slate-500'>Bekleyen tahsilat</p>
            <p className='mt-1 text-xl font-semibold text-amber-600'>
              {loading ? '...' : formatCurrencyTRY(summary.pendingCollection)}
            </p>
            <p className='mt-1 text-xs text-slate-400'>Bu ay giriş yapan misafirler</p>
          </article>
          <article className='card border-blue-200 bg-blue-50/50'>
            <p className='text-sm text-slate-500'>Toplam net kazanç</p>
            <p className='mt-1 text-xl font-semibold text-blue-950'>
              {loading ? '...' : formatCurrencyTRY(allTimeNet)}
            </p>
            <p className='mt-1 text-xs text-slate-400'>Tüm zamanlar (rezervasyon + manuel)</p>
          </article>
        </div>
      </section>

      {error ? <p className='text-sm text-rose-600'>{error}</p> : null}

      {loading ? (
        <p className='text-sm text-slate-500'>Yükleniyor...</p>
      ) : (
        <div className='space-y-4'>
          <ReportSection
            title='Konaklama gelirleri'
            count={displayedLodgingReservations.length}
            emptyText={
              lodgingSearch.trim() ? 'Arama sonucu bulunamadı.' : 'Bu ay konaklama geliri yok.'
            }
            header={
              <input
                type='search'
                className='input mt-3'
                placeholder='Misafir adı veya telefon ara...'
                value={lodgingSearch}
                onChange={(event) => setLodgingSearch(event.target.value)}
              />
            }
          >
            {displayedLodgingReservations.map((reservation) => (
              <article key={reservation.id} className='rounded-lg border border-slate-200 p-4'>
                <div className='flex flex-col justify-between gap-2 sm:flex-row sm:items-start'>
                  <div>
                    <p className='font-semibold text-blue-950'>{reservation.customerName}</p>
                    <p className='text-sm text-slate-600'>
                      {getRoomDisplayName(reservation.roomName)} · Giriş {formatDateTR(reservation.checkInDate)}
                    </p>
                    <p className='text-sm text-slate-600'>Tel: {reservation.customerPhone || '-'}</p>
                    <ReservationNote note={reservation.note} className='mt-1' />
                  </div>
                  <div className='flex flex-col items-end gap-2 text-right'>
                    <p className='font-semibold text-emerald-600'>{formatCurrencyTRY(reservation.totalPrice)}</p>
                    {isFullyPaidReservation(reservation) ? (
                      <p className='text-sm font-medium text-emerald-700'>Tamamı ödendi</p>
                    ) : (
                      <>
                        <p className='text-sm font-medium text-amber-600'>
                          Kalan {formatCurrencyTRY(getOutstandingPayment(reservation))}
                        </p>
                        <button
                          type='button'
                          className='btn border border-emerald-600 bg-emerald-50 text-sm text-emerald-800 hover:bg-emerald-100'
                          onClick={() => handleMarkFullyPaid(reservation)}
                          disabled={payingReservationId === reservation.id}
                        >
                          {payingReservationId === reservation.id ? 'Kaydediliyor...' : 'Tamamı Ödendi'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </ReportSection>

          <ReportSection title='Giderler' count={expenses.length} emptyText='Bu ay gider kaydı yok.'>
            {expenses.map((transaction) => (
              <TransactionLine key={transaction.id} transaction={transaction} />
            ))}
          </ReportSection>

          <ReportSection title='Ek gelirler' count={extraIncomes.length} emptyText='Bu ay ek gelir kaydı yok.'>
            {extraIncomes.map((transaction) => (
              <TransactionLine key={transaction.id} transaction={transaction} />
            ))}
          </ReportSection>
        </div>
      )}
    </section>
    </SensitivePinGate>
  )
}

function ReportSection({ title, count, emptyText, header, children }) {
  return (
    <section className='card'>
      <h2 className='text-base font-semibold text-blue-950'>
        {title} <span className='font-normal text-slate-400'>({count})</span>
      </h2>
      {header}
      {count === 0 ? (
        <p className='mt-3 text-sm text-slate-500'>{emptyText}</p>
      ) : (
        <div className='mt-3 grid gap-2'>{children}</div>
      )}
    </section>
  )
}

function TransactionLine({ transaction }) {
  const isIncome = transaction.type === 'income'

  return (
    <article className='rounded-lg border border-slate-200 p-4'>
      <div className='flex flex-col justify-between gap-2 sm:flex-row sm:items-start'>
        <div>
          <p className='font-semibold text-blue-950'>{transaction.title}</p>
          <p className='text-sm text-slate-600'>{transaction.category}</p>
          <p className='text-sm text-slate-500'>{formatDateTR(transaction.date)}</p>
          {transaction.note ? <p className='text-sm text-slate-500'>{transaction.note}</p> : null}
        </div>
        <p className={`font-semibold ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
          {isIncome ? '+' : '-'}
          {formatCurrencyTRY(transaction.amount)}
        </p>
      </div>
    </article>
  )
}

export default Reports
