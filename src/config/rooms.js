export const ROOMS = ['C/1', 'C/2', 'D/1', 'D/2']

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
}

export const normalizeRoomName = (name) => {
  const trimmed = name?.trim() ?? ''
  return ROOM_ALIASES[trimmed] ?? trimmed
}

export const getRoomNameVariants = (canonicalName) => {
  const canonical = normalizeRoomName(canonicalName)
  const variants = new Set([canonical])

  Object.entries(ROOM_ALIASES).forEach(([alias, target]) => {
    if (target === canonical) variants.add(alias)
  })

  return [...variants]
}