import type { AcademicCatalog } from './academicScheduling.ts'
import type {
  AcademicInterval,
  AcademicProposal,
  AcademicRoomResource,
  AcademicTeacherResource,
} from '../../../shared/programacion-academica-api.mjs'
import { PLANNING_LIMITS } from './academicScheduling.ts'

export type UnifiedTeacherResource = {
  id: string
  name: string
  isIncluded: boolean
  isReference: boolean
  isLocal: boolean
  referenceId: string | null
  courseIds: string[]
  maxWeeklyMinutes: number | null
  availability: AcademicInterval[] | null
  preferences?: AcademicInterval[]
  sectionLimits?: Array<{ courseId: string; maxSections: number }>
  facultyId?: string
  category?: 'principal' | 'asociado' | 'auxiliar'
  qualificationSource?: 'synthetic'
}

export type UnifiedRoomResource = {
  id: string
  name: string
  isIncluded: boolean
  isReference: boolean
  isLocal: boolean
  referenceId: string | null
  kind: 'classroom' | 'laboratory'
  capacity: number
  pavilion: 'AP' | 'NP' | null
  availability: AcademicInterval[] | null
}

export type BulkItemAction =
  | 'incorporate'
  | 'no-effect-already-included'
  | 'excluded-limit'
  | 'remove'
  | 'no-effect-not-included'

export type BulkTeacherPreviewItem = {
  id: string
  name: string
  action: 'incorporate' | 'no-effect-already-included' | 'excluded-limit'
  reason?: string
  syntheticValues?: {
    maxWeeklyMinutes: number
    availabilitySummary: string
    courseCount: number
    courseIds: string[]
  }
}

export type BulkRoomPreviewItem = {
  id: string
  name: string
  action: 'incorporate' | 'no-effect-already-included' | 'excluded-limit'
  reason?: string
  syntheticValues?: {
    capacity: number
    kind: 'classroom' | 'laboratory'
    availabilitySummary: string
  }
}

export type BulkRemovePreviewItem = {
  id: string
  name: string
  action: 'remove' | 'no-effect-not-included'
  reason?: string
}

export type BulkTeacherIncorporatePreview = {
  items: BulkTeacherPreviewItem[]
  counts: {
    totalSelected: number
    toIncorporate: number
    alreadyIncluded: number
    excludedByLimit: number
  }
  canConfirm: boolean
  limitError: string | null
}

export type BulkRoomIncorporatePreview = {
  items: BulkRoomPreviewItem[]
  counts: {
    totalSelected: number
    toIncorporate: number
    alreadyIncluded: number
    excludedByLimit: number
  }
  canConfirm: boolean
  limitError: string | null
}

export type BulkRemovePreview = {
  items: BulkRemovePreviewItem[]
  counts: {
    totalSelected: number
    toRemove: number
    notIncluded: number
  }
  canConfirm: boolean
}

const DEFAULT_WEEKLY_INTERVALS: AcademicInterval[] = [1, 2, 3, 4, 5].map((day) => ({
  day,
  startMinute: 480,
  endMinute: 1320,
}))

export function formatAvailabilitySummary(intervals: AcademicInterval[] | null | undefined): string {
  if (!intervals) return 'Sin configurar'
  if (intervals.length === 0) return 'Sin disponibilidad'

  const isStandardWeek =
    intervals.length === 5 &&
    intervals.every((interval, idx) => interval.day === idx + 1 && interval.startMinute === 480 && interval.endMinute === 1320)
  if (isStandardWeek) return 'Lun–Vie · 08:00–22:00'

  const daysMap = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const uniqueDays = [...new Set(intervals.map((i) => i.day))].sort((a, b) => a - b)
  const dayLabels = uniqueDays.map((d) => daysMap[d - 1] ?? `D${d}`)

  return `${dayLabels.join(', ')} (${intervals.length} ${intervals.length === 1 ? 'bloque' : 'bloques'})`
}

export function buildUnifiedTeachers(
  catalogReferences: AcademicCatalog['referenceTeachers'] | undefined,
  includedTeachers: AcademicTeacherResource[],
  referenceMapping: Record<string, string>,
): UnifiedTeacherResource[] {
  const result: UnifiedTeacherResource[] = []
  const catalogList = catalogReferences ?? []
  const matchedRefIds = new Set<string>()

  // 1. Process all included teachers in the draft
  for (const included of includedTeachers) {
    const mappedRefId = referenceMapping[included.id]
    const directRef = catalogList.find((ref) => ref.id === included.id)
    const ref = mappedRefId ? catalogList.find((r) => r.id === mappedRefId) : directRef
    const referenceId = ref?.id ?? mappedRefId ?? null

    if (referenceId) {
      matchedRefIds.add(referenceId)
      result.push({
        id: included.id,
        name: included.name,
        isIncluded: true,
        isReference: true,
        isLocal: false,
        referenceId,
        courseIds: included.courseIds,
        maxWeeklyMinutes: included.maxWeeklyMinutes,
        availability: included.availability,
        preferences: included.preferences,
        sectionLimits: included.sectionLimits,
        facultyId: included.facultyId,
        category: included.category,
        qualificationSource: included.qualificationSource,
      })
    } else {
      result.push({
        id: included.id,
        name: included.name,
        isIncluded: true,
        isReference: false,
        isLocal: true,
        referenceId: null,
        courseIds: included.courseIds,
        maxWeeklyMinutes: included.maxWeeklyMinutes,
        availability: included.availability,
        preferences: included.preferences,
        sectionLimits: included.sectionLimits,
        facultyId: included.facultyId,
        category: included.category,
        qualificationSource: included.qualificationSource,
      })
    }
  }

  // 2. Add reference teachers not yet included
  for (const ref of catalogList) {
    if (matchedRefIds.has(ref.id)) continue
    // Also check if any included teacher already uses ref.id directly
    if (includedTeachers.some((t) => t.id === ref.id)) continue

    result.push({
      id: ref.id,
      name: ref.name,
      isIncluded: false,
      isReference: true,
      isLocal: false,
      referenceId: ref.id,
      courseIds: ref.courseIds ?? [],
      maxWeeklyMinutes: null,
      availability: null,
      preferences: undefined,
      sectionLimits: undefined,
    })
  }

  return result
}

export function buildUnifiedRooms(
  catalogReferences: AcademicCatalog['referenceRooms'] | undefined,
  includedRooms: AcademicRoomResource[],
  referenceMapping: Record<string, string>,
): UnifiedRoomResource[] {
  const result: UnifiedRoomResource[] = []
  const catalogList = catalogReferences ?? []
  const matchedRefIds = new Set<string>()

  // 1. Process all included rooms in the draft
  for (const included of includedRooms) {
    const mappedRefId = referenceMapping[included.id]
    const directRef = catalogList.find((ref) => ref.id === included.id)
    const ref = mappedRefId ? catalogList.find((r) => r.id === mappedRefId) : directRef
    const referenceId = ref?.id ?? mappedRefId ?? null

    if (referenceId) {
      matchedRefIds.add(referenceId)
      result.push({
        id: included.id,
        name: included.name,
        isIncluded: true,
        isReference: true,
        isLocal: false,
        referenceId,
        kind: included.kind ?? ref?.kind ?? 'classroom',
        capacity: included.capacity,
        pavilion: ref?.pavilion ?? null,
        availability: included.availability,
      })
    } else {
      result.push({
        id: included.id,
        name: included.name,
        isIncluded: true,
        isReference: false,
        isLocal: true,
        referenceId: null,
        kind: included.kind ?? 'classroom',
        capacity: included.capacity,
        pavilion: null,
        availability: included.availability,
      })
    }
  }

  // 2. Add reference rooms not yet included
  for (const ref of catalogList) {
    if (matchedRefIds.has(ref.id)) continue
    if (includedRooms.some((r) => r.id === ref.id)) continue

    result.push({
      id: ref.id,
      name: ref.name,
      isIncluded: false,
      isReference: true,
      isLocal: false,
      referenceId: ref.id,
      kind: ref.kind,
      capacity: ref.capacity,
      pavilion: ref.pavilion,
      availability: null,
    })
  }

  return result
}

export function filterUnifiedTeachers(
  teachers: UnifiedTeacherResource[],
  query: string,
  inclusionFilter: 'all' | 'included' | 'reference',
): UnifiedTeacherResource[] {
  const cleanQuery = query.trim().toLocaleLowerCase('es')
  return teachers.filter((teacher) => {
    if (inclusionFilter === 'included' && !teacher.isIncluded) return false
    if (inclusionFilter === 'reference' && teacher.isIncluded) return false

    if (!cleanQuery) return true
    const haystack = `${teacher.id} ${teacher.name}`.toLocaleLowerCase('es')
    return haystack.includes(cleanQuery)
  })
}

export function filterUnifiedRooms(
  rooms: UnifiedRoomResource[],
  query: string,
  kindFilter: 'all' | 'classroom' | 'laboratory',
  inclusionFilter: 'all' | 'included' | 'reference',
): UnifiedRoomResource[] {
  const cleanQuery = query.trim().toLocaleLowerCase('es')
  return rooms.filter((room) => {
    if (kindFilter !== 'all' && room.kind !== kindFilter) return false
    if (inclusionFilter === 'included' && !room.isIncluded) return false
    if (inclusionFilter === 'reference' && room.isIncluded) return false

    if (!cleanQuery) return true
    const haystack = `${room.id} ${room.name} ${room.pavilion ?? ''}`.toLocaleLowerCase('es')
    return haystack.includes(cleanQuery)
  })
}

export function calculateTeacherCounts(
  catalogReferenceCount: number,
  includedCount: number,
  visibleCount: number,
) {
  return {
    references: catalogReferenceCount,
    included: includedCount,
    visible: visibleCount,
  }
}

export function calculateRoomCounts(
  catalogReferenceCount: number,
  includedCount: number,
  visibleCount: number,
) {
  return {
    references: catalogReferenceCount,
    included: includedCount,
    visible: visibleCount,
  }
}

export function calculateAssignedTeacherMinutes(
  proposal: AcademicProposal | null | undefined,
  teacherId: string,
): number | null {
  if (!proposal || !Array.isArray(proposal.assignments)) return null
  const teacherAssignments = proposal.assignments.filter((a) => a.teacherId === teacherId)
  if (teacherAssignments.length === 0) return 0
  return teacherAssignments.reduce((acc, a) => acc + (a.endMinute - a.startMinute), 0)
}

export function buildBulkIncorporateTeacherPreview(
  selectedIds: string[],
  unifiedTeachers: UnifiedTeacherResource[],
  currentIncludedCount: number,
): BulkTeacherIncorporatePreview {
  const selectedMap = new Map(unifiedTeachers.map((t) => [t.id, t]))
  const items: BulkTeacherPreviewItem[] = []
  let toIncorporateCount = 0
  let alreadyIncludedCount = 0
  let excludedByLimitCount = 0

  for (const id of selectedIds) {
    const teacher = selectedMap.get(id)
    if (!teacher) continue

    if (teacher.isIncluded) {
      alreadyIncludedCount += 1
      items.push({
        id: teacher.id,
        name: teacher.name,
        action: 'no-effect-already-included',
        reason: 'Sin efecto · El docente ya está incorporado en el borrador.',
      })
    } else {
      if (currentIncludedCount + toIncorporateCount >= PLANNING_LIMITS.teachers) {
        excludedByLimitCount += 1
        items.push({
          id: teacher.id,
          name: teacher.name,
          action: 'excluded-limit',
          reason: `Excluido por límite · Se alcanzó el tope de ${PLANNING_LIMITS.teachers} docentes.`,
        })
      } else {
        toIncorporateCount += 1
        items.push({
          id: teacher.id,
          name: teacher.name,
          action: 'incorporate',
          syntheticValues: {
            maxWeeklyMinutes: 600,
            availabilitySummary: 'Lun–Vie · 08:00–22:00 (sintética)',
            courseCount: teacher.courseIds.length,
            courseIds: [...teacher.courseIds],
          },
        })
      }
    }
  }

  const limitError =
    currentIncludedCount + toIncorporateCount > PLANNING_LIMITS.teachers
      ? `Se excedería el límite máximo permitido de ${PLANNING_LIMITS.teachers} docentes.`
      : null

  return {
    items,
    counts: {
      totalSelected: selectedIds.length,
      toIncorporate: toIncorporateCount,
      alreadyIncluded: alreadyIncludedCount,
      excludedByLimit: excludedByLimitCount,
    },
    canConfirm: toIncorporateCount > 0 && limitError === null,
    limitError,
  }
}

export function buildBulkIncorporateRoomPreview(
  selectedIds: string[],
  unifiedRooms: UnifiedRoomResource[],
  currentIncludedCount: number,
): BulkRoomIncorporatePreview {
  const selectedMap = new Map(unifiedRooms.map((r) => [r.id, r]))
  const items: BulkRoomPreviewItem[] = []
  let toIncorporateCount = 0
  let alreadyIncludedCount = 0
  let excludedByLimitCount = 0

  for (const id of selectedIds) {
    const room = selectedMap.get(id)
    if (!room) continue

    if (room.isIncluded) {
      alreadyIncludedCount += 1
      items.push({
        id: room.id,
        name: room.name,
        action: 'no-effect-already-included',
        reason: 'Sin efecto · El ambiente ya está incorporado en el borrador.',
      })
    } else {
      if (currentIncludedCount + toIncorporateCount >= PLANNING_LIMITS.rooms) {
        excludedByLimitCount += 1
        items.push({
          id: room.id,
          name: room.name,
          action: 'excluded-limit',
          reason: `Excluido por límite · Se alcanzó el tope de ${PLANNING_LIMITS.rooms} ambientes.`,
        })
      } else {
        toIncorporateCount += 1
        items.push({
          id: room.id,
          name: room.name,
          action: 'incorporate',
          syntheticValues: {
            capacity: room.capacity || 45,
            kind: room.kind,
            availabilitySummary: 'Lun–Vie · 08:00–22:00 (sintética)',
          },
        })
      }
    }
  }

  const limitError =
    currentIncludedCount + toIncorporateCount > PLANNING_LIMITS.rooms
      ? `Se excedería el límite máximo permitido de ${PLANNING_LIMITS.rooms} ambientes.`
      : null

  return {
    items,
    counts: {
      totalSelected: selectedIds.length,
      toIncorporate: toIncorporateCount,
      alreadyIncluded: alreadyIncludedCount,
      excludedByLimit: excludedByLimitCount,
    },
    canConfirm: toIncorporateCount > 0 && limitError === null,
    limitError,
  }
}

export function buildBulkRemovePreview(
  selectedIds: string[],
  unifiedItems: Array<{ id: string; name: string; isIncluded: boolean }>,
): BulkRemovePreview {
  const itemMap = new Map(unifiedItems.map((item) => [item.id, item]))
  const items: BulkRemovePreviewItem[] = []
  let toRemoveCount = 0
  let notIncludedCount = 0

  for (const id of selectedIds) {
    const item = itemMap.get(id)
    if (!item) continue

    if (item.isIncluded) {
      toRemoveCount += 1
      items.push({
        id: item.id,
        name: item.name,
        action: 'remove',
      })
    } else {
      notIncludedCount += 1
      items.push({
        id: item.id,
        name: item.name,
        action: 'no-effect-not-included',
        reason: 'Sin efecto · El recurso no está incorporado en el borrador.',
      })
    }
  }

  return {
    items,
    counts: {
      totalSelected: selectedIds.length,
      toRemove: toRemoveCount,
      notIncluded: notIncludedCount,
    },
    canConfirm: toRemoveCount > 0,
  }
}

export function applyBulkIncorporateTeachers(
  selectedIds: string[],
  currentIncluded: AcademicTeacherResource[],
  catalogReferences: AcademicCatalog['referenceTeachers'] | undefined,
  referenceMapping: Record<string, string>,
): {
  teachers: AcademicTeacherResource[]
  referenceMapping: Record<string, string>
} {
  const resultTeachers = [...currentIncluded.map((t) => ({ ...t, courseIds: [...t.courseIds], availability: t.availability.map((i) => ({ ...i })) }))]
  const newMapping = { ...referenceMapping }
  const catalogList = catalogReferences ?? []

  for (const id of selectedIds) {
    if (resultTeachers.length >= PLANNING_LIMITS.teachers) break

    // Check if already incorporated directly or via mapping
    const alreadyIncluded = resultTeachers.some(
      (t) => t.id === id || newMapping[t.id] === id,
    )
    if (alreadyIncluded) continue

    const ref = catalogList.find((r) => r.id === id)
    if (!ref) continue

    const newTeacher: AcademicTeacherResource = {
      id: ref.id,
      name: ref.name,
      courseIds: [...(ref.courseIds ?? [])],
      maxWeeklyMinutes: 600,
      availability: DEFAULT_WEEKLY_INTERVALS.map((i) => ({ ...i })),
    }

    resultTeachers.push(newTeacher)
    newMapping[newTeacher.id] = ref.id
  }

  return {
    teachers: resultTeachers,
    referenceMapping: newMapping,
  }
}

export function applyBulkIncorporateRooms(
  selectedIds: string[],
  currentIncluded: AcademicRoomResource[],
  catalogReferences: AcademicCatalog['referenceRooms'] | undefined,
  referenceMapping: Record<string, string>,
): {
  rooms: AcademicRoomResource[]
  referenceMapping: Record<string, string>
} {
  const resultRooms = [...currentIncluded.map((r) => ({ ...r, availability: r.availability.map((i) => ({ ...i })) }))]
  const newMapping = { ...referenceMapping }
  const catalogList = catalogReferences ?? []

  for (const id of selectedIds) {
    if (resultRooms.length >= PLANNING_LIMITS.rooms) break

    const alreadyIncluded = resultRooms.some(
      (r) => r.id === id || newMapping[r.id] === id,
    )
    if (alreadyIncluded) continue

    const ref = catalogList.find((r) => r.id === id)
    if (!ref) continue

    const newRoom: AcademicRoomResource = {
      id: ref.id,
      name: ref.name,
      kind: ref.kind,
      capacity: ref.capacity ?? 45,
      availability: DEFAULT_WEEKLY_INTERVALS.map((i) => ({ ...i })),
    }

    resultRooms.push(newRoom)
    newMapping[newRoom.id] = ref.id
  }

  return {
    rooms: resultRooms,
    referenceMapping: newMapping,
  }
}

export function applyBulkRemoveTeachers(
  selectedIds: string[],
  currentIncluded: AcademicTeacherResource[],
  referenceMapping: Record<string, string>,
): {
  teachers: AcademicTeacherResource[]
  referenceMapping: Record<string, string>
} {
  const selectedSet = new Set(selectedIds)
  const remaining = currentIncluded.filter((t) => !selectedSet.has(t.id))
  const newMapping: Record<string, string> = {}
  for (const teacher of remaining) {
    if (referenceMapping[teacher.id]) {
      newMapping[teacher.id] = referenceMapping[teacher.id]
    }
  }

  return {
    teachers: remaining,
    referenceMapping: newMapping,
  }
}

export function applyBulkRemoveRooms(
  selectedIds: string[],
  currentIncluded: AcademicRoomResource[],
  referenceMapping: Record<string, string>,
): {
  rooms: AcademicRoomResource[]
  referenceMapping: Record<string, string>
} {
  const selectedSet = new Set(selectedIds)
  const remaining = currentIncluded.filter((r) => !selectedSet.has(r.id))
  const newMapping: Record<string, string> = {}
  for (const room of remaining) {
    if (referenceMapping[room.id]) {
      newMapping[room.id] = referenceMapping[room.id]
    }
  }

  return {
    rooms: remaining,
    referenceMapping: newMapping,
  }
}
