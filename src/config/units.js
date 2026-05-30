import { ROOMS } from './rooms'
import { SEASON_LENGTH_DAYS } from './season'

/** Her fiziksel oda = bir ev; sezonda en fazla SEASON_LENGTH_DAYS gece */
export const EV_UNITS = ROOMS.map((roomId, index) => ({
  roomId,
  evNumber: index + 1,
  evLabel: `Ev ${index + 1}`,
  shortLabel: `Ev ${index + 1}`,
  caption: `${roomId}`,
}))

export const EV_COUNT = EV_UNITS.length

export function getEvUnit(roomId) {
  return EV_UNITS.find((unit) => unit.roomId === roomId)
}

export function formatEvSeasonCapacity() {
  return `${EV_COUNT} ev × ${SEASON_LENGTH_DAYS} gün = ${EV_COUNT * SEASON_LENGTH_DAYS} gece/yıl`
}
