import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { getRoomNameVariants, normalizeRoomName } from '../config/rooms'
import { normalizeFirestoreDate } from '../utils/formatters'
import {
  ensureAuthReady,
  getFirestoreErrorMessage,
  isPermissionDenied,
  refreshAuthToken,
} from '../utils/firestoreAuth'
import {
  blocksRoomAvailability,
  hasReservationDateConflict,
  PAYMENT_STATUS,
} from '../utils/reservationUtils'

const reservationsRef = collection(db, 'reservations')

const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

const normalizeReservationPayload = (data) => {
  const totalPrice = toNumber(data.totalPrice)
  const isPaid = data.paymentStatus === PAYMENT_STATUS.PAID
  const deposit = isPaid ? totalPrice : toNumber(data.deposit)

  return {
    customerName: data.customerName?.trim() ?? '',
    customerPhone: data.customerPhone?.trim() ?? '',
    roomName: normalizeRoomName(data.roomName),
    checkInDate: data.checkInDate,
    checkOutDate: data.checkOutDate,
    totalPrice,
    deposit,
    remainingPayment: isPaid ? 0 : Math.max(totalPrice - deposit, 0),
    paymentStatus: data.paymentStatus,
    reservationStatus: data.reservationStatus,
    note: data.note?.trim() ?? '',
    createdBy: data.createdBy ?? '',
  }
}

const checkReservationConflict = async ({ roomName, checkInDate, checkOutDate, excludeId }) => {
  const variants = getRoomNameVariants(roomName)
  const roomQuery = query(reservationsRef, where('roomName', 'in', variants))
  const snapshot = await getDocs(roomQuery)

  return snapshot.docs.some((document) => {
    if (document.id === excludeId) return false

    const data = document.data()
    if (!blocksRoomAvailability(data)) return false

    return hasReservationDateConflict(
      { checkInDate, checkOutDate },
      {
        checkInDate: data.checkInDate,
        checkOutDate: data.checkOutDate,
      },
    )
  })
}

const mapReservationDoc = (document) => {
  const data = document.data()

  return {
    id: document.id,
    ...data,
    checkInDate: normalizeFirestoreDate(data.checkInDate),
    checkOutDate: normalizeFirestoreDate(data.checkOutDate),
  }
}

const fetchAllReservations = async () => {
  const snapshot = await getDocs(reservationsRef)
  return snapshot.docs
    .map(mapReservationDoc)
    .sort((a, b) => (a.checkInDate || '').localeCompare(b.checkInDate || ''))
}

const loadReservationsWithRetry = async () => {
  await ensureAuthReady()

  try {
    return await fetchAllReservations()
  } catch (error) {
    if (!isPermissionDenied(error)) {
      throw error
    }

    const refreshed = await refreshAuthToken()
    if (!refreshed) {
      throw error
    }

    return fetchAllReservations()
  }
}

export async function getReservations() {
  try {
    return await loadReservationsWithRetry()
  } catch (error) {
    const wrapped = new Error(getFirestoreErrorMessage(error))
    wrapped.code = error?.code
    wrapped.cause = error
    console.error('getReservations failed', {
      code: error?.code,
      message: error?.message,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    })
    throw wrapped
  }
}

export async function getReservationById(id) {
  const reservationDoc = await getDoc(doc(db, 'reservations', id))

  if (!reservationDoc.exists()) return null

  return {
    id: reservationDoc.id,
    ...reservationDoc.data(),
  }
}

export async function addReservation(data) {
  const payload = normalizeReservationPayload(data)

  const hasConflict = await checkReservationConflict(payload)
  if (hasConflict && payload.reservationStatus !== 'İptal') {
    throw new Error('CONFLICT')
  }

  const created = await addDoc(reservationsRef, {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return created.id
}

export async function updateReservation(id, data) {
  const payload = normalizeReservationPayload(data)

  const hasConflict = await checkReservationConflict({ ...payload, excludeId: id })
  if (hasConflict && payload.reservationStatus !== 'İptal') {
    throw new Error('CONFLICT')
  }

  await updateDoc(doc(db, 'reservations', id), {
    ...payload,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteReservation(id) {
  await deleteDoc(doc(db, 'reservations', id))
}
