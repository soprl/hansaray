import { useEffect, useRef, useState } from 'react'
import { isRoomBookable } from '../config/rooms'
import { evaluateStayBooking } from '../utils/stayBooking'

const DEBOUNCE_MS = 180

const IDLE = { status: 'idle', stayBooking: null, error: null }
const WAITING_RESERVATIONS = {
  status: 'waiting_reservations',
  stayBooking: null,
  error: null,
}

/**
 * Müsaitlik hesabını render dışında, gecikmeli yapar — hata formu çökertmez.
 * Oda taşıması yok; yalnızca aralığın tamamında boş odalar.
 */
export function useStayAvailability({
  enabled,
  reservationsReady,
  reservations,
  checkInDate,
  checkOutDate,
  excludeId,
  roomNames,
  isEditingVipReservation,
}) {
  const [state, setState] = useState(IDLE)
  const generationRef = useRef(0)

  useEffect(() => {
    if (!enabled) {
      setState(IDLE)
      return undefined
    }

    if (!reservationsReady) {
      setState(WAITING_RESERVATIONS)
      return undefined
    }

    const generation = generationRef.current + 1
    generationRef.current = generation

    setState((prev) => ({ ...prev, status: 'pending', error: null }))

    const timer = window.setTimeout(() => {
      if (generation !== generationRef.current) return

      try {
        const bookableNames = (roomNames ?? []).filter((roomName) => isRoomBookable(roomName))

        const stayBooking = evaluateStayBooking(reservations, {
          checkInDate,
          checkOutDate,
          excludeId,
          roomNames: bookableNames,
          isEditingVipReservation,
        })

        if (generation !== generationRef.current) return

        setState({ status: 'ready', stayBooking, error: null })
      } catch (error) {
        console.error('Konaklama müsaitliği hesaplanamadı:', error)
        if (generation !== generationRef.current) return
        setState({ status: 'error', stayBooking: null, error })
      }
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    enabled,
    reservationsReady,
    reservations,
    checkInDate,
    checkOutDate,
    excludeId,
    roomNames,
    isEditingVipReservation,
  ])

  return state
}
