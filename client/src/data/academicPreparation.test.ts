import test from 'node:test'
import assert from 'node:assert/strict'
import type { AcademicCatalog } from './academicScheduling.ts'
import {
  filterPreparationCourses,
  groupCoursesByCycle,
  calculatePreparationCounts,
  selectVisibleCourses,
  deselectVisibleCourses,
  validateBulkDemand,
  validateBulkCapacity,
  buildBulkChangePreview,
  applyBulkChanges,
} from './academicPreparation.ts'

const mockCourses: AcademicCatalog['courses'] = [
  {
    courseId: 'CS101',
    name: 'Introducción a la Programación',
    estimatedDemand: 40,
    targetCapacity: 40,
    cycle: 1,
    credits: 4,
    weeklySessions: [{ id: 'S1', type: 'teoria', durationMinutes: 120 }],
  },
  {
    courseId: 'CS102',
    name: 'Cálculo Aplicado I',
    estimatedDemand: 35,
    targetCapacity: 35,
    cycle: 1,
    credits: 4,
    weeklySessions: [{ id: 'S2', type: 'teoria', durationMinutes: 120 }],
  },
  {
    courseId: 'CS201',
    name: 'Estructuras de Datos Avanzadas',
    estimatedDemand: 30,
    targetCapacity: 30,
    cycle: 2,
    credits: 4,
    weeklySessions: [{ id: 'S3', type: 'teoria', durationMinutes: 120 }],
  },
  {
    courseId: 'CS202',
    name: 'Organización y Arquitectura',
    estimatedDemand: 25,
    targetCapacity: 25,
    cycle: 2,
    credits: 3,
    weeklySessions: [{ id: 'S4', type: 'teoria', durationMinutes: 120 }],
  },
  {
    courseId: 'CS999',
    name: 'Seminario Especial Electivo',
    estimatedDemand: 20,
    targetCapacity: 20,
    credits: 2,
    weeklySessions: [{ id: 'S5', type: 'teoria', durationMinutes: 60 }],
  },
]

test('filterPreparationCourses filters by search with and without accents', () => {
  // Search with accents matching unaccented or accented text
  const res1 = filterPreparationCourses(mockCourses, 'programación', 'all')
  assert.equal(res1.length, 1)
  assert.equal(res1[0].courseId, 'CS101')

  const res2 = filterPreparationCourses(mockCourses, 'programacion', 'all')
  assert.equal(res2.length, 1)
  assert.equal(res2[0].courseId, 'CS101')

  const res3 = filterPreparationCourses(mockCourses, 'CALCULO', 'all')
  assert.equal(res3.length, 1)
  assert.equal(res3[0].courseId, 'CS102')

  const res4 = filterPreparationCourses(mockCourses, 'CS20', 'all')
  assert.equal(res4.length, 2)
  assert.deepEqual(res4.map((c) => c.courseId), ['CS201', 'CS202'])
})

test('filterPreparationCourses filters by cycle and combines with search', () => {
  const cycle1 = filterPreparationCourses(mockCourses, '', '1')
  assert.equal(cycle1.length, 2)
  assert.deepEqual(cycle1.map((c) => c.courseId), ['CS101', 'CS102'])

  const cycle2 = filterPreparationCourses(mockCourses, '', '2')
  assert.equal(cycle2.length, 2)
  assert.deepEqual(cycle2.map((c) => c.courseId), ['CS201', 'CS202'])

  const unspec = filterPreparationCourses(mockCourses, '', 'unspecified')
  assert.equal(unspec.length, 1)
  assert.equal(unspec[0].courseId, 'CS999')

  const combined = filterPreparationCourses(mockCourses, 'estructuras', '2')
  assert.equal(combined.length, 1)
  assert.equal(combined[0].courseId, 'CS201')

  const noMatch = filterPreparationCourses(mockCourses, 'estructuras', '1')
  assert.equal(noMatch.length, 0)
})

test('groupCoursesByCycle groups courses ascending by cycle with unspecified group', () => {
  const groups = groupCoursesByCycle(mockCourses)
  assert.equal(groups.length, 3)
  assert.equal(groups[0].cycle, 1)
  assert.equal(groups[0].courses.length, 2)
  assert.equal(groups[1].cycle, 2)
  assert.equal(groups[1].courses.length, 2)
  assert.equal(groups[2].cycle, 'unspecified')
  assert.equal(groups[2].courses.length, 1)
})

test('calculatePreparationCounts reports distinct totals for catalog, included, and visible', () => {
  const counts = calculatePreparationCounts(56, ['CS101', 'CS201'], 12)
  assert.deepEqual(counts, {
    totalCatalog: 56,
    totalIncluded: 2,
    totalVisible: 12,
  })
})

test('selectVisibleCourses adds visible courses and preserves selections from other filters', () => {
  const initialSelected = ['CS201'] // selected from Cycle 2
  const visibleCourseIds = ['CS101', 'CS102'] // currently visible in Cycle 1

  const next = selectVisibleCourses(initialSelected, visibleCourseIds, 96)
  assert.equal(next.length, 3)
  assert.ok(next.includes('CS201'), 'CS201 from cycle 2 is preserved')
  assert.ok(next.includes('CS101'), 'CS101 was added')
  assert.ok(next.includes('CS102'), 'CS102 was added')

  // Respects limit
  const limited = selectVisibleCourses(initialSelected, visibleCourseIds, 2)
  assert.equal(limited.length, 2)
  assert.ok(limited.includes('CS201'))
})

test('deselectVisibleCourses removes only visible courses and preserves other filters', () => {
  const currentSelected = ['CS101', 'CS102', 'CS201']
  const visibleInCycle1 = ['CS101', 'CS102']

  const next = deselectVisibleCourses(currentSelected, visibleInCycle1)
  assert.deepEqual(next, ['CS201'])
})

test('validateBulkDemand validates integer >= 0', () => {
  assert.equal(validateBulkDemand('0').valid, true)
  assert.equal(validateBulkDemand('50').valid, true)
  assert.equal(validateBulkDemand('50').numericValue, 50)
  assert.equal(validateBulkDemand('-5').valid, false)
  assert.equal(validateBulkDemand('3.14').valid, false)
  assert.equal(validateBulkDemand('abc').valid, false)
  assert.equal(validateBulkDemand('').valid, false)
})

test('validateBulkCapacity validates integer >= 1', () => {
  assert.equal(validateBulkCapacity('1').valid, true)
  assert.equal(validateBulkCapacity('45').valid, true)
  assert.equal(validateBulkCapacity('45').numericValue, 45)
  assert.equal(validateBulkCapacity('0').valid, false)
  assert.equal(validateBulkCapacity('-10').valid, false)
  assert.equal(validateBulkCapacity('45.5').valid, false)
  assert.equal(validateBulkCapacity('').valid, false)
})

test('buildBulkChangePreview and applyBulkChanges handle valid and invalid scenarios', () => {
  const selectedIds = ['CS101', 'CS201']
  const currentDemands = { CS101: '30', CS201: '40', CS102: '15' }
  const currentCapacities = { CS101: '25', CS201: '35', CS102: '20' }

  // 1. Valid preview
  const validPreview = buildBulkChangePreview(
    mockCourses,
    selectedIds,
    currentDemands,
    currentCapacities,
    {
      applyDemand: true,
      targetDemand: '60',
      applyCapacity: true,
      targetCapacity: '30',
    }
  )

  assert.equal(validPreview.scopeCount, 2)
  assert.equal(validPreview.validCount, 2)
  assert.equal(validPreview.excludedCount, 0)
  assert.equal(validPreview.items[0].courseId, 'CS101')
  assert.equal(validPreview.items[0].previousDemand, '30')
  assert.equal(validPreview.items[0].newDemand, '60')
  assert.equal(validPreview.items[0].previousCapacity, '25')
  assert.equal(validPreview.items[0].newCapacity, '30')

  // Apply valid changes
  const applied = applyBulkChanges(validPreview, currentDemands, currentCapacities)
  assert.equal(applied.affectedCount, 2)
  assert.equal(applied.nextDemands.CS101, '60')
  assert.equal(applied.nextDemands.CS201, '60')
  assert.equal(applied.nextDemands.CS102, '15', 'Unselected course CS102 remains untouched')
  assert.equal(applied.nextCapacities.CS101, '30')
  assert.equal(applied.nextCapacities.CS201, '30')
  assert.equal(applied.nextCapacities.CS102, '20', 'Unselected course CS102 remains untouched')

  // 2. Invalid preview (capacity = 0)
  const invalidPreview = buildBulkChangePreview(
    mockCourses,
    selectedIds,
    currentDemands,
    currentCapacities,
    {
      applyDemand: true,
      targetDemand: '40',
      applyCapacity: true,
      targetCapacity: '0', // Invalid: capacity must be >= 1
    }
  )

  assert.equal(invalidPreview.scopeCount, 2)
  assert.equal(invalidPreview.validCount, 0)
  assert.equal(invalidPreview.excludedCount, 2)
  assert.ok(invalidPreview.items[0].exclusionReason?.includes('entero positivo'))
  assert.equal(invalidPreview.items[0].valid, false)

  // Applying invalid preview changes nothing
  const unapplied = applyBulkChanges(invalidPreview, currentDemands, currentCapacities)
  assert.equal(unapplied.affectedCount, 0)
  assert.deepEqual(unapplied.nextDemands, currentDemands)
  assert.deepEqual(unapplied.nextCapacities, currentCapacities)
})
