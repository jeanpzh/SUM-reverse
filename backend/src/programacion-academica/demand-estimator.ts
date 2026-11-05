import { ACADEMIC_REVISION, validateAcademicDemandEstimate, validateAcademicDemandRequest } from '../../../shared/programacion-academica-api.mjs'
import type { AcademicCatalog, AcademicDemandEstimate, AcademicDemandRequest, AcademicDemandSourceId } from '../../../shared/programacion-academica-api.mjs'
import { calculateRequiredSections } from './section-sizing.js'
import type { DemandLearner, DemandRecord, DemandSourceData } from './demand-fixtures.js'

const cutoffPeriod = '2026-1'
const messages: Record<string, string> = {
  UNKNOWN_PLAN: 'El plan académico no está confirmado para esta persona.',
  INVALID_MAPPING: 'El plan no tiene una correspondencia completa con el catálogo de estimación.',
  INVALID_RECORD: 'El registro académico sintético tiene datos inconsistentes.',
  COURSE_NOT_IN_PLAN: 'El curso no pertenece al plan conocido de esta persona.',
  COURSE_ALREADY_APPROVED: 'El curso ya figura aprobado al corte.',
  COURSE_RECOGNIZED: 'El curso figura reconocido por una equivalencia explícita.',
  UNKNOWN_HISTORY: 'El historial académico no está confirmado.',
  UNKNOWN_EQUIVALENCES: 'El estado de equivalencias no está confirmado.',
  PREREQUISITE_NOT_MET: 'No consta aprobado un prerrequisito requerido al corte.',
  PREREQUISITE_MAPPING_UNKNOWN: 'Un prerrequisito no tiene correspondencia válida en el plan.',
}

export type Outcome = { category: 'non-eligible' | 'insufficient'; code: string } | { category: 'eligible'; retake: boolean }
type UniquePopulation = { learners: DemandLearner[]; conflicted: Set<string>; recordCount: number }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function recordKey(learner: DemandLearner): string {
  return [learner.identity, learner.schoolId, learner.planId, '2027-I'].join('\u0000')
}

function normalizedSnapshot(learner: DemandLearner): string {
  if (validateProjection(learner)) {
    try {
      return `invalid:${JSON.stringify(learner)}`
    } catch {
      return 'invalid:unserializable'
    }
  }
  const courses = learner.courses.map((course) => ({
    ...course, prerequisiteIds: [...course.prerequisiteIds].sort(),
  })).sort((left, right) => left.courseCode.localeCompare(right.courseCode))
  const attempts = [...learner.attempts].sort((left, right) => left.courseCode.localeCompare(right.courseCode)
    || left.period.localeCompare(right.period) || left.result.localeCompare(right.result))
  return JSON.stringify({
    schoolId: learner.schoolId, planId: learner.planId, planKnown: learner.planKnown,
    historyKnown: learner.historyKnown, equivalencesKnown: learner.equivalencesKnown,
    courses, attempts, equivalentCourseCodes: [...learner.equivalentCourseCodes].sort(),
  })
}

function deduplicate(records: DemandRecord[]): UniquePopulation {
  const learners = new Map<string, DemandLearner>()
  const snapshots = new Map<string, string>()
  const conflicted = new Set<string>()
  for (const record of records) {
    if (!record.learner || typeof record.learner.identity !== 'string' || !record.learner.identity.trim()) {
      throw new TypeError('La proyección sintética no contiene identidad estable para deduplicar')
    }
    const key = recordKey(record.learner)
    const snapshot = normalizedSnapshot(record.learner)
    if (snapshots.has(key)) {
      if (snapshots.get(key) !== snapshot) conflicted.add(key)
      continue
    }
    snapshots.set(key, snapshot)
    learners.set(key, record.learner)
  }
  return { learners: [...learners.values()], conflicted, recordCount: records.length }
}

function validateProjection(learner: DemandLearner): string | null {
  if (!isPlainObject(learner) || typeof learner.identity !== 'string' || !learner.identity.trim()
    || typeof learner.schoolId !== 'string' || typeof learner.planId !== 'string'
    || typeof learner.planKnown !== 'boolean' || typeof learner.historyKnown !== 'boolean'
    || typeof learner.equivalencesKnown !== 'boolean' || !Array.isArray(learner.courses)
    || !Array.isArray(learner.attempts) || !Array.isArray(learner.equivalentCourseCodes)) return 'INVALID_RECORD'
  if (learner.courses.length === 0 || learner.courses.length > 200 || learner.attempts.length > 2000
    || learner.equivalentCourseCodes.length > 200) return 'INVALID_RECORD'
  const courseIds = new Set<string>()
  for (const course of learner.courses) {
    if (!isPlainObject(course) || typeof course.courseCode !== 'string' || !course.courseCode
      || typeof course.name !== 'string' || !Array.isArray(course.prerequisiteIds)
      || course.prerequisiteIds.some((id) => typeof id !== 'string' || !id)) return 'INVALID_RECORD'
    if (courseIds.has(course.courseCode)) return 'INVALID_RECORD'
    courseIds.add(course.courseCode)
  }
  const coursesById = new Map(learner.courses.map((course) => [course.courseCode, course]))
  for (const course of learner.courses) {
    if (course.prerequisiteIds.some((id) => !courseIds.has(id))) return 'INVALID_MAPPING'
  }
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (courseCode: string): boolean => {
    if (visiting.has(courseCode)) return false
    if (visited.has(courseCode)) return true
    visiting.add(courseCode)
    for (const prerequisiteId of coursesById.get(courseCode)!.prerequisiteIds) {
      if (!visit(prerequisiteId)) return false
    }
    visiting.delete(courseCode)
    visited.add(courseCode)
    return true
  }
  for (const courseCode of courseIds) {
    if (!visit(courseCode)) return 'INVALID_MAPPING'
  }
  const seenAttempts = new Set<string>()
  for (const attempt of learner.attempts) {
    if (!isPlainObject(attempt) || typeof attempt.courseCode !== 'string' || !attempt.courseCode
      || typeof attempt.period !== 'string' || !/^20\d{2}-[012]$/.test(attempt.period)
      || !courseIds.has(attempt.courseCode) || (attempt.result !== 'approved' && attempt.result !== 'failed')) return 'INVALID_RECORD'
    const key = `${attempt.courseCode}:${attempt.period}`
    if (seenAttempts.has(key)) return 'INVALID_RECORD'
    seenAttempts.add(key)
  }
  if (learner.equivalentCourseCodes.some((code) => typeof code !== 'string' || !courseIds.has(code))) return 'INVALID_MAPPING'
  return null
}

function isAtOrBeforeCutoff(period: string): boolean {
  return period <= cutoffPeriod
}

export function classify(learner: DemandLearner, courseId: string, conflicted: boolean): Outcome {
  if (conflicted) return { category: 'insufficient', code: 'INVALID_RECORD' }
  const validation = validateProjection(learner)
  if (validation) return { category: 'insufficient', code: validation }
  if (learner.schoolId !== 'SISTEMAS' || learner.planId !== 'SYN-SIS-PLAN' || !learner.planKnown) {
    return { category: 'insufficient', code: 'UNKNOWN_PLAN' }
  }

  const target = learner.courses.find((course) => course.courseCode === courseId)
  if (!target) return { category: 'non-eligible', code: 'COURSE_NOT_IN_PLAN' }
  const allCourseCodes = new Set(learner.courses.map((course) => course.courseCode))
  if (target.prerequisiteIds.some((id) => !allCourseCodes.has(id))) return { category: 'insufficient', code: 'INVALID_MAPPING' }

  const attempts = learner.attempts.filter((attempt) => isAtOrBeforeCutoff(attempt.period))
  const approved = new Set(attempts.filter((attempt) => attempt.result === 'approved').map((attempt) => attempt.courseCode))
  if (approved.has(courseId)) return { category: 'non-eligible', code: 'COURSE_ALREADY_APPROVED' }
  if (!learner.historyKnown) return { category: 'insufficient', code: 'UNKNOWN_HISTORY' }
  if (!learner.equivalencesKnown) return { category: 'insufficient', code: 'UNKNOWN_EQUIVALENCES' }
  const equivalent = new Set(learner.equivalentCourseCodes)
  if (equivalent.has(courseId)) return { category: 'non-eligible', code: 'COURSE_RECOGNIZED' }

  for (const prerequisiteId of target.prerequisiteIds) {
    if (approved.has(prerequisiteId) || equivalent.has(prerequisiteId)) continue
    return { category: 'non-eligible', code: 'PREREQUISITE_NOT_MET' }
  }
  return { category: 'eligible', retake: attempts.some((attempt) => attempt.courseCode === courseId && attempt.result === 'failed') }
}

function groupedReasons(counts: Map<string, number>, category: 'non-eligible' | 'insufficient') {
  return [...counts].sort(([left], [right]) => left.localeCompare(right)).map(([code, count]) => ({
    category, code, message: messages[code]!, count,
  }))
}

export function estimateAcademicDemand(catalog: AcademicCatalog, sources: Map<AcademicDemandSourceId, DemandSourceData>, value: unknown): AcademicDemandEstimate {
  let request: AcademicDemandRequest
  try {
    validateAcademicDemandRequest(value)
    request = value
  } catch (error) {
    throw new TypeError(error instanceof Error ? error.message : 'Solicitud de demanda inválida')
  }
  if (request.revision !== ACADEMIC_REVISION) throw Object.assign(new Error('La revisión de catálogo ya no está vigente'), { status: 409 })
  const courseIds = new Set(catalog.courses.map((course) => course.courseId))
  if (request.courses.some((course) => !courseIds.has(course.courseId))) throw new TypeError('La solicitud incluye cursos desconocidos')
  const source = sources.get(request.sourceId)
  if (!source) throw new TypeError('Fuente sintética desconocida')
  if (source.records.length > 1000 || source.metadata.populationSize > 1000
    || source.records.some((record) => !record || !record.learner || typeof record.recordId !== 'string')) {
    throw new TypeError('La proyección sintética de demanda excede sus límites o está mal formada')
  }
  const population = deduplicate(source.records)
  if (population.learners.length !== source.metadata.populationSize
    || source.records.length !== source.metadata.recordCount
    || source.metadata.duplicateRecords !== source.records.length - population.learners.length) {
    throw new TypeError('La población sintética de demanda no coincide con su procedencia declarada')
  }

  const rows = request.courses.map(({ courseId, targetCapacity }) => {
    let eligible = 0
    let retakeEligible = 0
    let nonEligible = 0
    let insufficient = 0
    const nonEligibleReasons = new Map<string, number>()
    const insufficientReasons = new Map<string, number>()
    for (const learner of population.learners) {
      const key = recordKey(learner)
      const outcome = classify(learner, courseId, population.conflicted.has(key))
      if (outcome.category === 'eligible') {
        eligible++
        if (outcome.retake) retakeEligible++
      } else if (outcome.category === 'non-eligible') {
        nonEligible++
        nonEligibleReasons.set(outcome.code, (nonEligibleReasons.get(outcome.code) ?? 0) + 1)
      } else {
        insufficient++
        insufficientReasons.set(outcome.code, (insufficientReasons.get(outcome.code) ?? 0) + 1)
      }
    }
    const sectionEstimate = calculateRequiredSections({ courseId, estimatedDemand: eligible, targetCapacity })
    return {
      courseId, eligible, retakeEligible, nonEligible, insufficient, baseDemand: eligible,
      targetCapacity, suggestedSections: sectionEstimate.requiredSections,
      reasons: [...groupedReasons(nonEligibleReasons, 'non-eligible'), ...groupedReasons(insufficientReasons, 'insufficient')],
    }
  })
  const result: AcademicDemandEstimate = { revision: ACADEMIC_REVISION, source: structuredClone(source.metadata), rows }
  validateAcademicDemandEstimate(result)
  return result
}
