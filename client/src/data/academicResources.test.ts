import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { AcademicProposal, AcademicRoomResource, AcademicTeacherResource } from '../../../shared/programacion-academica-api.mjs'
import {
  applyBulkIncorporateRooms,
  applyBulkIncorporateTeachers,
  applyBulkRemoveRooms,
  applyBulkRemoveTeachers,
  buildBulkIncorporateRoomPreview,
  buildBulkIncorporateTeacherPreview,
  buildBulkRemovePreview,
  buildUnifiedRooms,
  buildUnifiedTeachers,
  calculateAssignedTeacherMinutes,
  calculateRoomCounts,
  calculateTeacherCounts,
  filterUnifiedRooms,
  filterUnifiedTeachers,
  formatAvailabilitySummary,
} from './academicResources.ts'
import { PLANNING_LIMITS } from './academicScheduling.ts'

describe('academicResources pure helpers', () => {
  const sampleRefTeachers = [
    { id: 'DOC-1', name: 'Ana Torres', courseIds: ['CS101', 'CS102'] },
    { id: 'DOC-2', name: 'Carlos Ramos', courseIds: ['CS201'] },
    { id: 'DOC-3', name: 'Elena Vega', courseIds: ['CS301'] },
  ]

  const sampleRefRooms = [
    { id: 'AULA-101', name: 'Aula 101', capacity: 40, kind: 'classroom' as const, pavilion: 'AP' as const },
    { id: 'LAB-201', name: 'Laboratorio Redes', capacity: 30, kind: 'laboratory' as const, pavilion: 'NP' as const },
  ]

  describe('buildUnifiedTeachers', () => {
    it('unifies catalog references and included teachers without duplication', () => {
      const included: AcademicTeacherResource[] = [
        {
          id: 'DOC-1',
          name: 'Ana Torres',
          courseIds: ['CS101'],
          maxWeeklyMinutes: 600,
          availability: [{ day: 1, startMinute: 480, endMinute: 720 }],
        },
        {
          id: 'LOCAL-1',
          name: 'Docente Local',
          courseIds: [],
          maxWeeklyMinutes: 480,
          availability: [],
        },
      ]
      const mapping = { 'DOC-1': 'DOC-1' }

      const unified = buildUnifiedTeachers(sampleRefTeachers, included, mapping)
      assert.equal(unified.length, 4) // DOC-1 (included ref), LOCAL-1 (included local), DOC-2 (not included ref), DOC-3 (not included ref)

      const doc1 = unified.find((u) => u.id === 'DOC-1')
      assert.ok(doc1)
      assert.equal(doc1.isIncluded, true)
      assert.equal(doc1.isReference, true)
      assert.equal(doc1.isLocal, false)
      assert.equal(doc1.maxWeeklyMinutes, 600)

      const local1 = unified.find((u) => u.id === 'LOCAL-1')
      assert.ok(local1)
      assert.equal(local1.isIncluded, true)
      assert.equal(local1.isReference, false)
      assert.equal(local1.isLocal, true)

      const doc2 = unified.find((u) => u.id === 'DOC-2')
      assert.ok(doc2)
      assert.equal(doc2.isIncluded, false)
      assert.equal(doc2.isReference, true)
      assert.equal(doc2.maxWeeklyMinutes, null)
      assert.equal(doc2.availability, null)
    })

    it('retains correspondence when an incorporated teacher has an edited ID', () => {
      const included: AcademicTeacherResource[] = [
        {
          id: 'DOC-1-CUSTOM',
          name: 'Ana Torres Modificada',
          courseIds: ['CS101'],
          maxWeeklyMinutes: 720,
          availability: [],
        },
      ]
      const mapping = { 'DOC-1-CUSTOM': 'DOC-1' }

      const unified = buildUnifiedTeachers(sampleRefTeachers, included, mapping)
      assert.equal(unified.length, 3) // DOC-1-CUSTOM (mapped to DOC-1), DOC-2, DOC-3 (DOC-1 is not duplicated!)

      const custom = unified.find((u) => u.id === 'DOC-1-CUSTOM')
      assert.ok(custom)
      assert.equal(custom.referenceId, 'DOC-1')
      assert.equal(custom.isIncluded, true)
      assert.equal(custom.isReference, true)

      assert.equal(unified.some((u) => u.id === 'DOC-1'), false)
    })
  })

  describe('buildUnifiedRooms', () => {
    it('unifies catalog rooms with included rooms', () => {
      const included: AcademicRoomResource[] = [
        {
          id: 'LAB-201',
          name: 'Laboratorio Redes',
          capacity: 35,
          kind: 'laboratory',
          availability: [{ day: 1, startMinute: 480, endMinute: 960 }],
        },
      ]
      const mapping = { 'LAB-201': 'LAB-201' }

      const unified = buildUnifiedRooms(sampleRefRooms, included, mapping)
      assert.equal(unified.length, 2)

      const lab = unified.find((r) => r.id === 'LAB-201')
      assert.ok(lab)
      assert.equal(lab.isIncluded, true)
      assert.equal(lab.capacity, 35)

      const aula = unified.find((r) => r.id === 'AULA-101')
      assert.ok(aula)
      assert.equal(aula.isIncluded, false)
      assert.equal(aula.isReference, true)
      assert.equal(aula.capacity, 40)
    })
  })

  describe('filterUnifiedTeachers & filterUnifiedRooms', () => {
    const unifiedTeachers = buildUnifiedTeachers(sampleRefTeachers, [
      { id: 'DOC-1', name: 'Ana Torres', courseIds: [], maxWeeklyMinutes: 600, availability: [] },
    ], { 'DOC-1': 'DOC-1' })

    it('filters by code and name case-insensitively', () => {
      const byName = filterUnifiedTeachers(unifiedTeachers, 'ana', 'all')
      assert.equal(byName.length, 1)
      assert.equal(byName[0].id, 'DOC-1')

      const byCode = filterUnifiedTeachers(unifiedTeachers, 'doc-2', 'all')
      assert.equal(byCode.length, 1)
      assert.equal(byCode[0].id, 'DOC-2')
    })

    it('filters by inclusion status', () => {
      const onlyIncluded = filterUnifiedTeachers(unifiedTeachers, '', 'included')
      assert.equal(onlyIncluded.length, 1)
      assert.equal(onlyIncluded[0].id, 'DOC-1')

      const onlyReferences = filterUnifiedTeachers(unifiedTeachers, '', 'reference')
      assert.equal(onlyReferences.length, 2)
      assert.deepEqual(onlyReferences.map((t) => t.id).sort(), ['DOC-2', 'DOC-3'])
    })

    it('filters rooms by kind and query', () => {
      const unifiedRooms = buildUnifiedRooms(sampleRefRooms, [], {})
      const labs = filterUnifiedRooms(unifiedRooms, '', 'laboratory', 'all')
      assert.equal(labs.length, 1)
      assert.equal(labs[0].id, 'LAB-201')

      const classrooms = filterUnifiedRooms(unifiedRooms, '', 'classroom', 'all')
      assert.equal(classrooms.length, 1)
      assert.equal(classrooms[0].id, 'AULA-101')
    })
  })

  describe('calculateCounts', () => {
    it('computes unequivocal teacher and room counters', () => {
      const tCounts = calculateTeacherCounts(10, 4, 3)
      assert.equal(tCounts.references, 10)
      assert.equal(tCounts.included, 4)
      assert.equal(tCounts.visible, 3)

      const rCounts = calculateRoomCounts(5, 2, 2)
      assert.equal(rCounts.references, 5)
      assert.equal(rCounts.included, 2)
      assert.equal(rCounts.visible, 2)
    })
  })

  describe('formatAvailabilitySummary', () => {
    it('formats standard week and custom intervals', () => {
      const standard = [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 480, endMinute: 1320 }))
      assert.equal(formatAvailabilitySummary(standard), 'Lun–Vie · 08:00–22:00')

      assert.equal(formatAvailabilitySummary(null), 'Sin configurar')
      assert.equal(formatAvailabilitySummary([]), 'Sin disponibilidad')

      const custom = [{ day: 1, startMinute: 480, endMinute: 720 }]
      assert.equal(formatAvailabilitySummary(custom), 'Lun (1 bloque)')
    })
  })

  describe('calculateAssignedTeacherMinutes', () => {
    it('returns minutes assigned from a proposal, or null if absent', () => {
      assert.equal(calculateAssignedTeacherMinutes(null, 'DOC-1'), null)

      const fakeProposal: AcademicProposal = {
        proposalId: 'PROP-1',
        createdAt: '',
        expiresAt: '',
        status: 'complete',
        sections: [],
        assignments: [
          { sessionId: 'S1', sectionId: 'SEC1', courseId: 'CS101', courseName: 'CS', teacherId: 'DOC-1', teacherName: 'Ana', roomId: 'A1', roomName: 'Aula 1', day: 1, startMinute: 480, endMinute: 600 },
          { sessionId: 'S2', sectionId: 'SEC2', courseId: 'CS102', courseName: 'CS2', teacherId: 'DOC-1', teacherName: 'Ana', roomId: 'A1', roomName: 'Aula 1', day: 2, startMinute: 480, endMinute: 660 },
          { sessionId: 'S3', sectionId: 'SEC3', courseId: 'CS103', courseName: 'CS3', teacherId: 'DOC-2', teacherName: 'Carlos', roomId: 'A1', roomName: 'Aula 1', day: 3, startMinute: 480, endMinute: 600 },
        ],
        pending: [],
        diagnostics: [],
        coverageComplete: true,
        counts: { sections: 3, requiredSessions: 3, scheduledSessions: 3 },
        stats: { exploredCandidates: 1, candidateVisits: 1, backtracks: 0, limitReason: null },
      }

      assert.equal(calculateAssignedTeacherMinutes(fakeProposal, 'DOC-1'), 300) // (600-480) + (660-480) = 120 + 180 = 300
      assert.equal(calculateAssignedTeacherMinutes(fakeProposal, 'DOC-2'), 120)
      assert.equal(calculateAssignedTeacherMinutes(fakeProposal, 'DOC-UNKNOWN'), 0)
    })
  })

  describe('bulk actions and previews', () => {
    const unifiedTeachers = buildUnifiedTeachers(sampleRefTeachers, [
      { id: 'DOC-1', name: 'Ana Torres', courseIds: ['CS101'], maxWeeklyMinutes: 600, availability: [] },
    ], { 'DOC-1': 'DOC-1' })

    it('builds bulk incorporate preview distinguishing new vs already included', () => {
      const preview = buildBulkIncorporateTeacherPreview(['DOC-1', 'DOC-2'], unifiedTeachers, 1)
      assert.equal(preview.counts.totalSelected, 2)
      assert.equal(preview.counts.toIncorporate, 1)
      assert.equal(preview.counts.alreadyIncluded, 1)
      assert.equal(preview.canConfirm, true)

      const doc1Item = preview.items.find((i) => i.id === 'DOC-1')
      assert.ok(doc1Item)
      assert.equal(doc1Item.action, 'no-effect-already-included')

      const doc2Item = preview.items.find((i) => i.id === 'DOC-2')
      assert.ok(doc2Item)
      assert.equal(doc2Item.action, 'incorporate')
      assert.ok(doc2Item.syntheticValues)
      assert.equal(doc2Item.syntheticValues.maxWeeklyMinutes, 600)
    })

    it('enforces PLANNING_LIMITS.teachers (128) in preview', () => {
      // Simulate currently at 127
      const preview = buildBulkIncorporateTeacherPreview(['DOC-2', 'DOC-3'], unifiedTeachers, PLANNING_LIMITS.teachers - 1)
      assert.equal(preview.counts.totalSelected, 2)
      assert.equal(preview.counts.toIncorporate, 1)
      assert.equal(preview.counts.excludedByLimit, 1)

      const doc2 = preview.items.find((i) => i.id === 'DOC-2')
      assert.equal(doc2?.action, 'incorporate')

      const doc3 = preview.items.find((i) => i.id === 'DOC-3')
      assert.equal(doc3?.action, 'excluded-limit')
    })

    it('applies bulk incorporate for teachers cleanly in one transition', () => {
      const initial: AcademicTeacherResource[] = [
        { id: 'DOC-1', name: 'Ana Torres', courseIds: ['CS101'], maxWeeklyMinutes: 600, availability: [] },
      ]
      const { teachers, referenceMapping } = applyBulkIncorporateTeachers(
        ['DOC-1', 'DOC-2'],
        initial,
        sampleRefTeachers,
        { 'DOC-1': 'DOC-1' },
      )

      assert.equal(teachers.length, 2) // DOC-1 was already there, DOC-2 incorporated
      assert.equal(teachers[1].id, 'DOC-2')
      assert.equal(teachers[1].maxWeeklyMinutes, 600)
      assert.equal(referenceMapping['DOC-2'], 'DOC-2')

      const removePreview = buildBulkRemovePreview(['DOC-2'], unifiedTeachers)
      assert.equal(removePreview.counts.totalSelected, 1)

      const { teachers: remaining, referenceMapping: remainingMapping } = applyBulkRemoveTeachers(
        ['DOC-2'],
        teachers,
        referenceMapping,
      )
      assert.equal(remaining.length, 1)
      assert.equal(remaining[0].id, 'DOC-1')
      assert.equal(remainingMapping['DOC-2'], undefined)
    })

    it('builds bulk incorporate room preview and applies incorporation', () => {
      const unifiedRooms = buildUnifiedRooms(sampleRefRooms, [], {})
      const preview = buildBulkIncorporateRoomPreview(['AULA-101'], unifiedRooms, 0)
      assert.equal(preview.counts.totalSelected, 1)
      assert.equal(preview.counts.toIncorporate, 1)
      assert.equal(preview.canConfirm, true)

      const { rooms, referenceMapping } = applyBulkIncorporateRooms(
        ['AULA-101'],
        [],
        sampleRefRooms,
        {},
      )
      assert.equal(rooms.length, 1)
      assert.equal(rooms[0].id, 'AULA-101')
      assert.equal(referenceMapping['AULA-101'], 'AULA-101')

      const removePreview = buildBulkRemovePreview(['AULA-101'], unifiedRooms)
      assert.equal(removePreview.counts.totalSelected, 1)

      const { rooms: emptyRooms } = applyBulkRemoveRooms(['AULA-101'], rooms, referenceMapping)
      assert.equal(emptyRooms.length, 0)
    })
  })
})
