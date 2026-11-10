import type { AcademicCatalog } from './academicScheduling.ts'
import { normalizeAcademicSearch, PLANNING_LIMITS } from './academicScheduling.ts'

export interface BulkCoursePreviewItem {
  courseId: string
  courseName: string
  previousDemand: string
  newDemand?: string
  previousCapacity: string
  newCapacity?: string
  valid: boolean
  exclusionReason?: string
}

export interface BulkChangePreview {
  scopeCount: number
  validCount: number
  excludedCount: number
  items: BulkCoursePreviewItem[]
  applyDemand: boolean
  applyCapacity: boolean
}

export function filterPreparationCourses(
  courses: AcademicCatalog['courses'],
  query: string,
  cycleFilter: string
): AcademicCatalog['courses'] {
  const normalizedQuery = normalizeAcademicSearch(query)
  return courses.filter((course) => {
    if (cycleFilter !== 'all') {
      const courseCycle = course.cycle !== undefined ? String(course.cycle) : 'unspecified'
      if (courseCycle !== cycleFilter) return false
    }
    if (!normalizedQuery) return true
    const haystack = normalizeAcademicSearch(`${course.courseId} ${course.name}`)
    return haystack.includes(normalizedQuery)
  })
}

export interface CourseCycleGroup {
  cycle: number | 'unspecified'
  label: string
  courses: AcademicCatalog['courses']
}

export function groupCoursesByCycle(courses: AcademicCatalog['courses']): CourseCycleGroup[] {
  const groupsMap = new Map<number | 'unspecified', AcademicCatalog['courses']>()

  for (const course of courses) {
    const cycleKey: number | 'unspecified' = course.cycle !== undefined ? course.cycle : 'unspecified'
    const existing = groupsMap.get(cycleKey)
    if (existing) {
      existing.push(course)
    } else {
      groupsMap.set(cycleKey, [course])
    }
  }

  const numericCycles = Array.from(groupsMap.keys())
    .filter((k): k is number => typeof k === 'number')
    .sort((a, b) => a - b)

  const result: CourseCycleGroup[] = numericCycles.map((cycle) => ({
    cycle,
    label: `Ciclo ${cycle}`,
    courses: groupsMap.get(cycle) ?? [],
  }))

  if (groupsMap.has('unspecified')) {
    result.push({
      cycle: 'unspecified',
      label: 'Sin ciclo especificado',
      courses: groupsMap.get('unspecified') ?? [],
    })
  }

  return result
}

export function calculatePreparationCounts(
  totalCatalog: number,
  selectedCourseIds: string[],
  visibleCoursesCount: number
): { totalCatalog: number; totalIncluded: number; totalVisible: number } {
  return {
    totalCatalog,
    totalIncluded: selectedCourseIds.length,
    totalVisible: visibleCoursesCount,
  }
}

export function selectVisibleCourses(
  currentSelected: string[],
  visibleCourseIds: string[],
  limit: number = PLANNING_LIMITS.courses
): string[] {
  const set = new Set(currentSelected)
  for (const id of visibleCourseIds) {
    if (set.size >= limit) break
    set.add(id)
  }
  return Array.from(set)
}

export function deselectVisibleCourses(
  currentSelected: string[],
  visibleCourseIds: string[]
): string[] {
  const visibleSet = new Set(visibleCourseIds)
  return currentSelected.filter((id) => !visibleSet.has(id))
}

export function validateBulkDemand(value: string | number | undefined): {
  valid: boolean
  numericValue?: number
  error?: string
} {
  if (value === undefined || value === null) {
    return { valid: false, error: 'Demanda requerida' }
  }
  const str = String(value).trim()
  if (str === '') {
    return { valid: false, error: 'Demanda requerida' }
  }
  const num = Number(str)
  if (!Number.isSafeInteger(num) || num < 0) {
    return { valid: false, error: 'Demanda debe ser un entero mayor o igual a 0' }
  }
  return { valid: true, numericValue: num }
}

export function validateBulkCapacity(value: string | number | undefined): {
  valid: boolean
  numericValue?: number
  error?: string
} {
  if (value === undefined || value === null) {
    return { valid: false, error: 'Capacidad requerida' }
  }
  const str = String(value).trim()
  if (str === '') {
    return { valid: false, error: 'Capacidad requerida' }
  }
  const num = Number(str)
  if (!Number.isSafeInteger(num) || num < 1) {
    return { valid: false, error: 'Capacidad debe ser un entero positivo (mínimo 1)' }
  }
  return { valid: true, numericValue: num }
}

export function buildBulkChangePreview(
  courses: AcademicCatalog['courses'],
  selectedCourseIds: string[],
  currentDemands: Record<string, string>,
  currentCapacities: Record<string, string>,
  options: {
    targetDemand?: string
    targetCapacity?: string
    applyDemand?: boolean
    applyCapacity?: boolean
  }
): BulkChangePreview {
  const applyDemand = Boolean(options.applyDemand)
  const applyCapacity = Boolean(options.applyCapacity)

  const selectedCourses = courses.filter((c) => selectedCourseIds.includes(c.courseId))
  const demandCheck = applyDemand ? validateBulkDemand(options.targetDemand) : { valid: true }
  const capacityCheck = applyCapacity ? validateBulkCapacity(options.targetCapacity) : { valid: true }

  let validCount = 0
  let excludedCount = 0

  const items: BulkCoursePreviewItem[] = selectedCourses.map((course) => {
    const prevDemand = currentDemands[course.courseId] ?? ''
    const prevCap = currentCapacities[course.courseId] ?? ''

    const reasons: string[] = []
    if (applyDemand && !demandCheck.valid && demandCheck.error) {
      reasons.push(demandCheck.error)
    }
    if (applyCapacity && !capacityCheck.valid && capacityCheck.error) {
      reasons.push(capacityCheck.error)
    }

    if (!applyDemand && !applyCapacity) {
      reasons.push('No se seleccionó ningún campo para modificar')
    }

    const isValid = reasons.length === 0
    if (isValid) {
      validCount += 1
    } else {
      excludedCount += 1
    }

    return {
      courseId: course.courseId,
      courseName: course.name,
      previousDemand: prevDemand,
      newDemand: applyDemand && demandCheck.valid ? String(demandCheck.numericValue) : undefined,
      previousCapacity: prevCap,
      newCapacity: applyCapacity && capacityCheck.valid ? String(capacityCheck.numericValue) : undefined,
      valid: isValid,
      exclusionReason: reasons.length > 0 ? reasons.join(' · ') : undefined,
    }
  })

  return {
    scopeCount: selectedCourses.length,
    validCount,
    excludedCount,
    items,
    applyDemand,
    applyCapacity,
  }
}

export function applyBulkChanges(
  preview: BulkChangePreview,
  currentDemands: Record<string, string>,
  currentCapacities: Record<string, string>
): {
  nextDemands: Record<string, string>
  nextCapacities: Record<string, string>
  affectedCount: number
} {
  const nextDemands = { ...currentDemands }
  const nextCapacities = { ...currentCapacities }
  let affectedCount = 0

  for (const item of preview.items) {
    if (!item.valid) continue
    affectedCount += 1
    if (preview.applyDemand && item.newDemand !== undefined) {
      nextDemands[item.courseId] = item.newDemand
    }
    if (preview.applyCapacity && item.newCapacity !== undefined) {
      nextCapacities[item.courseId] = item.newCapacity
    }
  }

  return {
    nextDemands,
    nextCapacities,
    affectedCount,
  }
}
