export const VIP_ROOM = 'V.I.P'

export const ROOMS = ['C/1', 'C/2', 'D/1', 'D/2', VIP_ROOM]

const ROOM_ALIASES = {
  C: 'C/1',
  C1: 'C/1',
  'C/1': 'C/1',
  C2: 'C/2',
  'C/2': 'C/2',
  D: 'D/1',
  D1: 'D/1',
  'D/1': 'D/1',
  D2: 'D/2',
  'D/2': 'D/2',
  VIP: VIP_ROOM,
  'V.I.P': VIP_ROOM,
  'v.i.p': VIP_ROOM,
}

export const isVipRoom = (roomName) => normalizeRoomName(roomName) === VIP_ROOM

export const normalizeRoomName = (name) => {
  const trimmed = name?.trim() ?? ''
  return ROOM_ALIASES[trimmed] ?? trimmed
}

export const getRoomOptions = (reservations = []) => {
  const extras = new Set()

  reservations.forEach((reservation) => {
    const normalized = normalizeRoomName(reservation.roomName)
    if (normalized && !ROOMS.includes(normalized)) {
      extras.add(normalized)
    }
  })

  return [...ROOMS, ...[...extras].sort((a, b) => a.localeCompare(b, 'tr'))]
}

export const getRoomNameVariants = (canonicalName) => {
  const canonical = normalizeRoomName(canonicalName)
  const variants = new Set([canonical])

  Object.entries(ROOM_ALIASES).forEach(([alias, target]) => {
    if (target === canonical) variants.add(alias)
  })

  return [...variants]
}