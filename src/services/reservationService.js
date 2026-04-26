import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'

const reservationsRef = collection(db, 'reservations')

const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

const hasDateConflict = (incoming, existing) =>
  incoming.checkInDate < existing.checkOutDate && incoming.checkOutDate > existing.checkInDate

const normalizeReservationPayload = (data) => {
  const totalPrice = toNumber(data.totalPrice)
  const deposit = toNumber(data.deposit)

  return {
    customerName: data.customerName?.trim() ?? '',
    customerPhone: data.customerPhone?.trim() ?? '',
    roomName: data.roomName?.trim() ?? '',
    checkInDate: data.checkInDate,
    checkOutDate: data.checkOutDate,
    totalPrice,
    deposit,
    remainingPayment: totalPrice - deposit,
    paymentStatus: data.paymentStatus,
    reservationStatus: data.reservationStatus,
    note: data.note?.trim() ?? '',
    createdBy: data.createdBy ?? '',
  }
}

const checkReservationConflict = async ({ roomName, checkInDate, checkOutDate, excludeId }) => {
  const roomQuery = query(reservationsRef, where('roomName', '==', roomName))
  const snapshot = await getDocs(roomQuery)

  return snapshot.docs.some((document) => {
    if (document.id === excludeId) return false

    const data = document.data()
    if (data.reservationStatus === 'İptal') return false

    return hasDateConflict(
      { checkInDate, checkOutDate },
      {
        checkInDate: data.checkInDate,
        checkOutDate: data.checkOutDate,
      },
    )
  })
}

export async function getReservations() {
  const reservationsQuery = query(reservationsRef, orderBy('checkInDate', 'asc'))
  const snapshot = await getDocs(reservationsQuery)

  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }))
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
