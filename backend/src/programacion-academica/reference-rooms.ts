/** Reference supplied by the user for the local FISI demo; no future availability is confirmed. */
export function createReferenceRooms() {
  const rooms: Array<{ id: string; name: string; capacity: number; kind: 'classroom' | 'laboratory'; pavilion: 'AP' | 'NP' }> = []
  for (const pavilion of ['AP', 'NP'] as const) {
    for (const [start, end] of [[101, 108], [201, pavilion === 'AP' ? 212 : 205]]) {
      for (let number = start!; number <= end!; number++) {
        const id = `${number}${pavilion}`
        rooms.push({ id, name: id, capacity: 45, kind: 'classroom', pavilion })
      }
    }
    for (let number = 1; number <= 8; number++) {
      const id = `LAB${String(number).padStart(2, '0')}${pavilion}`
      rooms.push({ id, name: id, capacity: 45, kind: 'laboratory', pavilion })
    }
  }
  return rooms
}
