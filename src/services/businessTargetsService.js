import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

const TARGETS_DOC_ID = 'default'

export const DEFAULT_BUSINESS_TARGETS = {
  monthlyLodgingTarget: 0,
  yearlyLodgingTarget: 0,
  monthlyOccupancyTargetPercent: 0,
  yearlyOccupancyTargetPercent: 0,
}

export function hasConfiguredTargets(targets) {
  if (!targets) return false
  return (
    Number(targets.monthlyLodgingTarget) > 0 ||
    Number(targets.yearlyLodgingTarget) > 0 ||
    Number(targets.monthlyOccupancyTargetPercent) > 0 ||
    Number(targets.yearlyOccupancyTargetPercent) > 0
  )
}

export async function getBusinessTargets() {
  try {
    const snapshot = await getDoc(doc(db, 'businessTargets', TARGETS_DOC_ID))

    if (!snapshot.exists()) {
      return { ...DEFAULT_BUSINESS_TARGETS }
    }

    return {
      ...DEFAULT_BUSINESS_TARGETS,
      ...snapshot.data(),
    }
  } catch (error) {
    if (error?.code === 'permission-denied') {
      console.warn('businessTargets okunamadı — Firestore kurallarına businessTargets ekleyin')
      return { ...DEFAULT_BUSINESS_TARGETS }
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
