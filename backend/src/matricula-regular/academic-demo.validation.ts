import type { ActorProfile, SyntheticAcademicRecord } from './profile.types.js'

const periods = ['2025-1', '2025-2', '2026-1'] as const

export class SyntheticAcademicRecordError extends Error {
  readonly field: string

  constructor(field: string) {
    super(`Ledger académico sintético inválido en ${field}`)
    this.name = 'SyntheticAcademicRecordError'
    this.field = field
  }
}

function invalid(field: string): never {
  throw new SyntheticAcademicRecordError(field)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAcademicPeriod(value: unknown): value is typeof periods[number] {
  return typeof value === 'string' && periods.some((period) => period === value)
}

function courseNumber(courseId: string): number {
  return Number(courseId.slice(-2))
}

export function validateSyntheticAcademicRecord(
  actor: ActorProfile,
  value: unknown,
): asserts value is SyntheticAcademicRecord {
  if (!isObject(value)) invalid('academic')
  if (value.seedRevision !== 'PS-SEED-1') invalid('academic.seedRevision')
  if (!Array.isArray(value.catalog) || value.catalog.length === 0) invalid('academic.catalog')
  if (!Array.isArray(value.attempts)) invalid('academic.attempts')

  const expectedPrefix = actor.actorId.startsWith('SYN-SIS-') ? 'SIS'
    : actor.actorId.startsWith('SYN-SOFT-') ? 'SOFT' : null
  const suffix = actor.actorId.endsWith('-A') ? 'A' : actor.actorId.endsWith('-B') ? 'B' : null
  if (expectedPrefix === null || suffix === null) invalid('actor.actorId')

  const courses = new Map<string, SyntheticAcademicRecord['catalog'][number]>()
  for (const [index, rawCourse] of value.catalog.entries()) {
    const path = `academic.catalog.${index}`
    if (!isObject(rawCourse)) invalid(path)
    const courseId = rawCourse.courseId
    if (typeof courseId !== 'string' || !new RegExp(`^SYN-${expectedPrefix}-C\\d{2}$`).test(courseId)) {
      invalid(`${path}.courseId`)
    }
    if (courses.has(courseId)) invalid(`${path}.courseId`)
    if (rawCourse.planId !== actor.scope.planId) invalid(`${path}.planId`)
    if (typeof rawCourse.name !== 'string' || rawCourse.name.trim() === '') invalid(`${path}.name`)
    if (typeof rawCourse.credits !== 'number' || !Number.isFinite(rawCourse.credits) || rawCourse.credits <= 0) {
      invalid(`${path}.credits`)
    }
    if (!Array.isArray(rawCourse.prerequisiteIds)
      || !rawCourse.prerequisiteIds.every((id) => typeof id === 'string')) invalid(`${path}.prerequisiteIds`)
    if (typeof rawCourse.cycle !== 'number' || !Number.isInteger(rawCourse.cycle) || rawCourse.cycle < 1 || rawCourse.cycle > 14) {
      invalid(`${path}.cycle`)
    }
    if (rawCourse.courseType !== 'mandatory' && rawCourse.courseType !== 'elective') invalid(`${path}.courseType`)
    courses.set(courseId, rawCourse as unknown as SyntheticAcademicRecord['catalog'][number])
  }

  for (const [index, course] of [...courses.values()].entries()) {
    for (const prerequisiteId of course.prerequisiteIds) {
      if (!courses.has(prerequisiteId)) invalid(`academic.catalog.${index}.prerequisiteIds`)
      if (prerequisiteId === course.courseId) invalid(`academic.catalog.${index}.prerequisiteIds`)
    }
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (courseId: string): void => {
    if (visiting.has(courseId)) invalid('academic.catalog.prerequisiteIds')
    if (visited.has(courseId)) return
    visiting.add(courseId)
    for (const prerequisiteId of courses.get(courseId)!.prerequisiteIds) visit(prerequisiteId)
    visiting.delete(courseId)
    visited.add(courseId)
  }
  for (const courseId of courses.keys()) visit(courseId)

  const actaPattern = new RegExp(`^SYN-ACTA-${expectedPrefix}-${suffix}-(0[1-9])$`)
  const seenCoursePeriod = new Set<string>()
  const seenRecordIds = new Set<string>()
  let previousOrder = -1
  for (const [index, rawAttempt] of value.attempts.entries()) {
    const path = `academic.attempts.${index}`
    if (!isObject(rawAttempt)) invalid(path)
    if (typeof rawAttempt.courseId !== 'string' || !courses.has(rawAttempt.courseId)) invalid(`${path}.courseId`)
    if (!isAcademicPeriod(rawAttempt.period)) invalid(`${path}.period`)
    if (rawAttempt.sectionNumber !== 1 && rawAttempt.sectionNumber !== 2) invalid(`${path}.sectionNumber`)
    if (typeof rawAttempt.grade !== 'number' || !Number.isFinite(rawAttempt.grade) || rawAttempt.grade < 0 || rawAttempt.grade > 20) {
      invalid(`${path}.grade`)
    }
    if (rawAttempt.result !== 'approved' && rawAttempt.result !== 'failed') invalid(`${path}.result`)
    if (typeof rawAttempt.recordId !== 'string' || !actaPattern.test(rawAttempt.recordId)) invalid(`${path}.recordId`)
    const pair = `${rawAttempt.courseId}:${rawAttempt.period}`
    if (seenCoursePeriod.has(pair)) invalid(`${path}.courseId`)
    if (seenRecordIds.has(rawAttempt.recordId)) invalid(`${path}.recordId`)
    seenCoursePeriod.add(pair)
    seenRecordIds.add(rawAttempt.recordId)

    const periodIndex = periods.indexOf(rawAttempt.period)
    const currentPeriodIndex = periods.indexOf(actor.scope.period as typeof periods[number])
    if (currentPeriodIndex >= 0 && periodIndex >= currentPeriodIndex) invalid(`${path}.period`)
    const order = periodIndex * 100 + courseNumber(rawAttempt.courseId)
    if (order < previousOrder) invalid(`${path}`)
    previousOrder = order
  }
}
