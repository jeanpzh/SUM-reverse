import { describe, expect, it } from 'vitest'
import { createReferenceRooms } from '../src/programacion-academica/reference-rooms.js'

describe('user-provided local FISI reference environments', () => {
  it('contains exactly the 49 requested environments with capacity 45 and no asserted availability', () => {
    const rooms = createReferenceRooms()
    expect(rooms).toHaveLength(49)
    expect(new Set(rooms.map((room) => room.id)).size).toBe(49)
    expect(rooms.filter((room) => room.pavilion === 'AP')).toHaveLength(28)
    expect(rooms.filter((room) => room.pavilion === 'NP')).toHaveLength(21)
    expect(rooms.filter((room) => room.kind === 'laboratory')).toHaveLength(16)
    expect(rooms.every((room) => room.capacity === 45 && !('availability' in room))).toBe(true)
    const expected = new Set<string>()
    for (const pavilion of ['AP', 'NP']) {
      for (let n = 101; n <= 108; n++) expected.add(`${n}${pavilion}`)
      for (let n = 201; n <= (pavilion === 'AP' ? 212 : 205); n++) expected.add(`${n}${pavilion}`)
      for (let n = 1; n <= 8; n++) expected.add(`LAB${String(n).padStart(2, '0')}${pavilion}`)
    }
    expect(new Set(rooms.map((room) => room.id))).toEqual(expected)
    rooms[0].capacity = 1
    expect(createReferenceRooms()[0].capacity).toBe(45)
  })
})
