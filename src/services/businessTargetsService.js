import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { ROOMS } from '../config/rooms'
import { db } from '../firebase'

const TARGETS_DOC_ID = 'default'

export function createEmptyUnitTargets() {
  return Object.fromEntries(
    ROOMS.map((roomId) => [
      roomId,
      { yearlyLodgingTarget: 0, yearlyOccupancyTargetPercent: 0 },
    ]),
  )
}

export function normalizeUnitTargets(raw) {
  const empty = createEmptyUnitTargets()
  if (!raw || typeof raw !== 'object') return empty

  return ROOMS.reduce((acc, roomId) => {
    const unit = raw[roomId] ?? {}
    acc[roomId] = {
      yearlyLodgingTarget: Number(unit.yearlyLodgingTarget) || 0,
      yearlyOccupancyTargetPercent: Number(unit.yearlyOccupancyTargetPercent) || 0,
    }
    return acc
  }, {})
}

export const DEFAULT_BUSINESS_TARGETS = {
  monthlyLodgingTarget: 0,
  yearlyLodgingTarget: 0,
  monthlyOccupancyTargetPercent: 0,
  yearlyOccupancyTargetPercent: 0,
  unitTargets: createEmptyUnitTargets(),
}

export function hasConfiguredUnitTargets(unitTargets) {
  return Object.values(normalizeUnitTargets(unitTargets)).some(
    (unit) => Number(unit.yearlyLodgingTarget) > 0 || Number(unit.yearlyOccupancyTargetPercent) > 0,
  )
}

export function hasConfiguredTargets(targets) {
  if (!targets) return false
  return (
    Number(targets.monthlyLodgingTarget) > 0 ||
    Number(targets.yearlyLodgingTarget) > 0 ||
    Number(targets.monthlyOccupancyTargetPercent) > 0 ||
    Number(targets.yearlyOccupancyTargetPercent) > 0 ||
    hasConfiguredUnitTargets(targets.unitTargets)
  )
}

export async function getBusinessTargets() {
  try {
    const snapshot = await getDoc(doc(db, 'businessTargets', TARGETS_DOC_ID))

    if (!snapshot.exists()) {
      return { ...DEFAULT_BUSINESS_TARGETS, unitTargets: createEmptyUnitTargets() }
    }

    const data = snapshot.data()
    return {
      ...DEFAULT_BUSINESS_TARGETS,
      ...data,
      unitTargets: normalizeUnitTargets(data.unitTargets),
    }
  } catch (error) {
    if (error?.code === 'permission-denied') {
      console.warn('businessTargets okunamadı — Firestore kurallarına businessTargets ekleyin')
      return { ...DEFAULT_BUSINESS_TARGETS, unitTargets: createEmptyUnitTargets() }
    }
    throw error
  }
}

export async function saveBusinessTargets(targets) {
  try {
    await setDoc(
      doc(db, 'businessTargets', TARGETS_DOC_ID),
      {
        monthlyLodgingTarget: Number(targets.monthlyLodgingTarget) || 0,
        yearlyLodgingTarget: Number(targets.yearlyLodgingTarget) || 0,
        monthlyOccupancyTargetPercent: Number(targets.monthlyOccupancyTargetPercent) || 0,
        yearlyOccupancyTargetPercent: Number(targets.yearlyOccupancyTargetPercent) || 0,
        unitTargets: normalizeUnitTargets(targets.unitTargets),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  } catch (error) {
    if (error?.code === 'permission-denied') {
      const permissionError = new Error(
        'Firestore izni yok. Console’da businessTargets kuralını Publish edin.',
      )
      permissionError.code = 'permission-denied'
      throw permissionError
    }
    throw error
  }
}
