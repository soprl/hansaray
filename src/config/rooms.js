export const VIP_ROOM = 'V.I.P'
/** Firestore'da sabit kalacak oda kimliği; görünen adı ROOM_DISPLAY_NAMES ile değiştirilebilir */
export const ODA_6_ROOM = 'ODA/6'

export const ROOMS = ['C/1', 'C/2', 'D/1', 'D/2', VIP_ROOM, ODA_6_ROOM]

/** Rezervasyona kapalı odalar — oda eklemek için ODA_6_ROOM vb. buraya yazın */
export const INACTIVE_ROOMS = new Set()

/** Görünen oda adları — yalnızca arayüzde kullanılır; veritabanı roomName alanı sabit kalır */
export const ROOM_DISPLAY_NAMES = {
  [ODA_6_ROOM]: 'Oda 6',
}

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
  VİP: VIP_ROOM,
  Vip: VIP_ROOM,
  vip: VIP_ROOM,
  'V.I.P': VIP_ROOM,
  'v.i.p': VIP_ROOM,
  'V.İ.P': VIP_ROOM,
  ODA6: ODA_6_ROOM,
  'ODA/6': ODA_6_ROOM,
  'oda/6': ODA_6_ROOM,
}

export const getRoomDisplayName = (roomName) => {
  const canonical = normalizeRoomName(roomName)
  return ROOM_DISPLAY_NAMES[canonical] ?? canonical
}

export const isVipRoom = (roomName) => {
  if (!roomName?.trim()) return false
  if (normalizeRoomName(roomName) === VIP_ROOM) return true
  const compact = roomName
    .trim()
    .toLocaleUpperCase('tr-TR')
    .replace(/[.\s/_-]/g, '')
  return compact === 'VIP' || compact === 'VİP'
}

export const canonicalRoomName = (roomName) => (isVipRoom(roomName) ? VIP_ROOM : normalizeRoomName(roomName))

export const normalizeRoomName = (name) => {
  const trimmed = name?.trim() ?? ''
  return ROOM_ALIASES[trimmed] ?? trimmed
}

export const isRoomBookable = (roomName) => !INACTIVE_ROOMS.has(normalizeRoomName(roomName))

/** Doluluk / tam dolu eşiği için aktif oda sayısı */
export const ACTIVE_ROOMS = ROOMS.filter((roomId) => isRoomBookable(roomId))
export const ACTIVE_ROOM_COUNT = ACTIVE_ROOMS.length

export const getRoomOptions = (reservations = []) => {
  const extras = new Set()

  reservations.forEach((reservation) => {
    const normalized = canonicalRoomName(reservation.roomName)
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

/** VIP hariç, sırayla ilk müsait standart oda (taşıma / otomatik atama) */
export const pickFirstAvailableStandardRoom = (availableRoomNames = []) => {
  const available = new Set(availableRoomNames.map((name) => normalizeRoomName(name)))
  return ACTIVE_ROOMS.find((room) => !isVipRoom(room) && available.has(room)) ?? null
}