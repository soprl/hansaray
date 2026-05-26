import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { ensureAuthReady, isPermissionDenied, refreshAuthToken } from '../utils/firestoreAuth'

const transactionsRef = collection(db, 'transactions')

const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

const normalizeTransaction = (data) => ({
  type: data.type,
  title: data.title?.trim() ?? '',
  amount: toNumber(data.amount),
  date: data.date,
  category: data.category,
  note: data.note?.trim() ?? '',
  createdBy: data.createdBy ?? '',
})

const fetchAllTransactions = async () => {
  const snapshot = await getDocs(transactionsRef)
  return snapshot.docs
    .map((document) => ({
      id: document.id,
      ...document.data(),
    }))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
}

export async function getTransactions() {
  await ensureAuthReady()

  try {
    return await fetchAllTransactions()
  } catch (error) {
    if (!isPermissionDenied(error)) {
      throw error
    }

    const refreshed = await refreshAuthToken()
    if (!refreshed) {
      throw error
    }

    return fetchAllTransactions()
  }
}

export async function addTransaction(data) {
  const payload = normalizeTransaction(data)
  const created = await addDoc(transactionsRef, {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return created.id
}

export async function updateTransaction(id, data) {
  const payload = normalizeTransaction(data)

  await updateDoc(doc(db, 'transactions', id), {
    ...payload,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteTransaction(id) {
  await deleteDoc(doc(db, 'transactions', id))
}
