import assert from 'node:assert/strict'
import test from 'node:test'
import { computeWeekDayLayout } from './planningWeekLayout.ts'

test('planningWeekLayout: handles empty items', () => {
  const result = computeWeekDayLayout([])
  assert.equal(result.size, 0)
})

test('planningWeekLayout: single item gets full width lane 0', () => {
  const result = computeWeekDayLayout([
    { id: 'block-1', startMinute: 480, endMinute: 600 },
  ])
  assert.equal(result.size, 1)
  const l1 = result.get('block-1')!
  assert.equal(l1.lane, 0)
  assert.equal(l1.totalLanes, 1)
  assert.equal(l1.leftPercent, 0)
  assert.equal(l1.widthPercent, 100)
})

test('planningWeekLayout: non-overlapping items each get full width lane 0', () => {
  const result = computeWeekDayLayout([
    { id: 'block-1', startMinute: 480, endMinute: 600 }, // 08:00 - 10:00
    { id: 'block-2', startMinute: 600, endMinute: 720 }, // 10:00 - 12:00
  ])
  assert.equal(result.size, 2)
  const l1 = result.get('block-1')!
  const l2 = result.get('block-2')!
  assert.equal(l1.lane, 0)
  assert.equal(l1.totalLanes, 1)
  assert.equal(l1.widthPercent, 100)

  assert.equal(l2.lane, 0)
  assert.equal(l2.totalLanes, 1)
  assert.equal(l2.widthPercent, 100)
})

test('planningWeekLayout: two concurrent blocks get distinct lanes 0 and 1 of 2 (WV-1)', () => {
  const result = computeWeekDayLayout([
    { id: 'algoritmos-01', startMinute: 480, endMinute: 600 }, // 08:00 - 10:00
    { id: 'bases-01', startMinute: 480, endMinute: 600 },      // 08:00 - 10:00
  ])
  assert.equal(result.size, 2)
  const l1 = result.get('algoritmos-01')!
  const l2 = result.get('bases-01')!

  assert.equal(l1.totalLanes, 2)
  assert.equal(l2.totalLanes, 2)
  assert.equal(l1.widthPercent, 50)
  assert.equal(l2.widthPercent, 50)
  assert.notEqual(l1.lane, l2.lane)
  assert.notEqual(l1.leftPercent, l2.leftPercent)
})

test('planningWeekLayout: three concurrent blocks get distinct lanes of 3 (three-way overlap)', () => {
  const result = computeWeekDayLayout([
    { id: 'b1', startMinute: 480, endMinute: 600 }, // 08:00 - 10:00
    { id: 'b2', startMinute: 510, endMinute: 630 }, // 08:30 - 10:30
    { id: 'b3', startMinute: 540, endMinute: 660 }, // 09:00 - 11:00
  ])
  assert.equal(result.size, 3)
  const l1 = result.get('b1')!
  const l2 = result.get('b2')!
  const l3 = result.get('b3')!

  assert.equal(l1.totalLanes, 3)
  assert.equal(l2.totalLanes, 3)
  assert.equal(l3.totalLanes, 3)

  const lanes = new Set([l1.lane, l2.lane, l3.lane])
  assert.equal(lanes.size, 3)
  assert.ok(lanes.has(0) && lanes.has(1) && lanes.has(2))
})

test('planningWeekLayout: partial overlap chain reuses free lanes without collision', () => {
  // A: 08:00 - 10:00 (Lane 0)
  // B: 09:00 - 11:00 (Lane 1, overlaps A)
  // C: 10:00 - 12:00 (Lane 0, overlaps B, but A ended at 10:00)
  const result = computeWeekDayLayout([
    { id: 'A', startMinute: 480, endMinute: 600 },
    { id: 'B', startMinute: 540, endMinute: 660 },
    { id: 'C', startMinute: 600, endMinute: 720 },
  ])
  assert.equal(result.size, 3)
  const la = result.get('A')!
  const lb = result.get('B')!
  const lc = result.get('C')!

  assert.equal(la.lane, 0)
  assert.equal(lb.lane, 1)
  assert.equal(lc.lane, 0)
  assert.equal(la.totalLanes, 2)
  assert.equal(lb.totalLanes, 2)
  assert.equal(lc.totalLanes, 2)
})

test('planningWeekLayout: deterministic irrespective of input order', () => {
  const items1 = [
    { id: 'A', startMinute: 480, endMinute: 600 },
    { id: 'B', startMinute: 480, endMinute: 600 },
    { id: 'C', startMinute: 540, endMinute: 660 },
  ]
  const items2 = [
    { id: 'C', startMinute: 540, endMinute: 660 },
    { id: 'B', startMinute: 480, endMinute: 600 },
    { id: 'A', startMinute: 480, endMinute: 600 },
  ]
  const res1 = computeWeekDayLayout(items1)
  const res2 = computeWeekDayLayout(items2)

  assert.deepEqual(res1.get('A'), res2.get('A'))
  assert.deepEqual(res1.get('B'), res2.get('B'))
  assert.deepEqual(res1.get('C'), res2.get('C'))
})

test('planningWeekLayout: proposed preview block coexists with current placement in distinct lanes', () => {
  // During adjustment, proposed preview might share the same day/time as current placement
  const items = [
    { id: 'current-block', startMinute: 480, endMinute: 600 },
    { id: '__proposed_preview__', startMinute: 480, endMinute: 600 },
  ]
  const result = computeWeekDayLayout(items)
  assert.equal(result.size, 2)
  const current = result.get('current-block')!
  const proposed = result.get('__proposed_preview__')!

  assert.equal(current.totalLanes, 2)
  assert.equal(proposed.totalLanes, 2)
  assert.notEqual(current.lane, proposed.lane)
  assert.notEqual(current.leftPercent, proposed.leftPercent)
})
