import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'

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

export async function getTransactions() {
  const transactionsQuery = query(transactionsRef, orderBy('date', 'desc'))
  const snapshot = await getDocs(transactionsQuery)

  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }))
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
