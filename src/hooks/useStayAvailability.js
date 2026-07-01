import { useEffect, useState } from 'react'
import { isRoomBookable } from '../config/rooms'
import { findBookingPlan } from '../utils/roomAssignmentUtils'
import { evaluateStayBooking } from '../utils/stayBooking'

const IDLE = { status: 'idle', stayBooking: null, bookingPlan: null, error: null }

/**
 * Müsaitlik hesabını render dışında yapar — hata formu çökertmez.
 */
export function useStayAvailability({
  enabled,
  reservations,
  checkInDate,
  checkOutDate,
  excludeId,
  roomNames,
  isEditingVipReservation,
  preferredRoom,
}) {
  const [state, setState] = useState(IDLE)

  useEffect(() => {
    if (!enabled) {
      setState(IDLE)
      return undefined
    }

    let cancelled = false
    setState((prev) => ({ ...prev, status: 'pending', error: null }))

    const run = () => {
      if (cancelled) return

      try {
        const bookableNames = (roomNames ?? []).filter((roomName) => isRoomBookable(roomName))

        const base = evaluateStayBooking(reservations, {
          checkInDate,
          checkOutDate,
          excludeId,
          roomNames: bookableNames,
          isEditingVipReservation,
        })

        let plan = null
        if (!isEditingVipReservation && !base.hasFullyBookedNight) {
          try {
            plan = findBookingPlan(reservations, {
              checkInDate,
              checkOutDate,
              excludeId,
              roomNames: bookableNames,
              preferredRoom,
            })
          } catch (planError) {
            console.error('Oda yerleştirme planı hesaplanamadı:', planError)
          }
        }

        const stayBooking = evaluateStayBooking(reservations, {
          checkInDate,
          checkOutDate,
          excludeId,
          roomNames: bookableNames,
          bookingPlan: plan,
          isEditingVipReservation,
        })

        if (!cancelled) {
          setState({ status: 'ready', stayBooking, bookingPlan: plan, error: null })
        }
      } catch (error) {
        console.error('Konaklama müsaitliği hesaplanamadı:', error)
        if (!cancelled) {
          setState({ status: 'error', stayBooking: null, bookingPlan: null, error })
        }
      }
    }

    const timer = window.setTimeout(run, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    enabled,
    reservations,
    checkInDate,
    checkOutDate,
    excludeId,
    roomNames,
    isEditingVipReservation,
    preferredRoom,
  ])

  return state
}
