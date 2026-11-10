import { describe, it, expect } from 'vitest'
import { PROTOTYPE_TEACHER_PROFILES } from '../../../shared/prototype-teacher-profiles.mjs'

describe('prototype teacher profiles (synthetic, local-only)', () => {
  it('covers every reference teacher code exactly once', () => {
    const ids = PROTOTYPE_TEACHER_PROFILES.map((p) => p.id)
    expect(ids).toHaveLength(91)
    expect(new Set(ids).size).toBe(91)
    expect(ids[0]).toBe('REF-TEACHER-001')
    expect(ids.at(-1)).toBe('REF-TEACHER-091')
    expect(ids.every((id) => /^REF-TEACHER-\d{3}$/.test(id))).toBe(true)
  })
  it('uses only regimes and dedications the normative corpus recognizes', () => {
    expect(PROTOTYPE_TEACHER_PROFILES.every((p) => ['ordinario', 'contratado'].includes(p.regime))).toBe(true)
    expect(PROTOTYPE_TEACHER_PROFILES.every((p) => p.regime !== 'contratado' || p.dedication === 'TP')).toBe(true)
    expect(PROTOTYPE_TEACHER_PROFILES.every((p) => p.regime !== 'ordinario' || p.dedication !== 'TP')).toBe(true)
  })
})
