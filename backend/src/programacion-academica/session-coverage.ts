import { validateAcademicSchedule } from './schedule-validator.js'
import { compareIds, prepareGeneratorInput } from './generator-input.js'
import { checkScheduleSizes } from './generator-limits.js'
import { validateSectionDelivery } from './section-delivery.js'
import type { GeneratorInput, RequiredSession, SessionCoverage, CoverageIssue } from './generator.types.js'
import type { AcademicSchedule } from './schedule.types.js'

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).sort(compareIds).join(',')}]`
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>
    return `{${Object.keys(row).sort(compareIds).map((key) => `${JSON.stringify(key)}:${canonical(row[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'undefined'
}

export type CoverageAuthority = { check: (schedule: unknown) => SessionCoverage }

/** Captures a private validated snapshot. Never accepts a caller's shortened requirements list. */
export function createCoverageAuthority(originalInput: unknown): CoverageAuthority {
  let prepared: ReturnType<typeof prepareGeneratorInput>
  try { prepared = prepareGeneratorInput(originalInput) } catch (error) {
    if (!(error instanceof TypeError)) throw error
    return { check: () => ({ complete: false, missingSessionIds: [], issues: [
      { code: 'INVALID_SOURCE', sessionId: null, message: error.message },
    ] }) }
  }
  const { schedule: source, requirements, input } = prepared
  return { check: (schedule) => checkDerivedCoverage(schedule, requirements, source, input) }
}

/** The original input must come from the trusted owner of the scheduling request. */
export function checkSessionCoverage(schedule: unknown, originalInput: unknown): SessionCoverage {
  return createCoverageAuthority(originalInput).check(schedule)
}

function checkDerivedCoverage(schedule: unknown, requirements: RequiredSession[], source: AcademicSchedule, input: GeneratorInput): SessionCoverage {
  const issues: CoverageIssue[] = []
  const add = (code: CoverageIssue['code'], sessionId: string | null, message: string) => issues.push({ code, sessionId, message })
  try { checkScheduleSizes(schedule) } catch (error) {
    add('INVALID_SCHEDULE', null, error instanceof Error ? error.message : 'Horario demasiado grande')
    return { complete: false, missingSessionIds: [], issues }
  }
  const validation = validateAcademicSchedule(schedule)
  if (!validation.valid) {
    for (const issue of validation.issues) add('INVALID_SCHEDULE', null, `${issue.code}: ${issue.message}`)
    return { complete: false, missingSessionIds: [], issues }
  }
  const valid = schedule as AcademicSchedule
  for (const key of ['courses', 'sections', 'teachers', 'rooms', 'compatibleGroups'] as const) {
    if (canonical(valid[key]) !== canonical(source[key])) add('CATALOG_MISMATCH', null, `El catálogo ${key} no coincide con la entrada autorizada`)
  }
  // Always evaluate against original capacities, resources, availabilities and compatibility groups.
  const authoritativeValidation = validateAcademicSchedule({ ...source, assignments: valid.assignments })
  for (const issue of authoritativeValidation.issues) add('INVALID_SCHEDULE', null, `${issue.code}: ${issue.message}`)
  for (const issue of validateSectionDelivery(valid, requirements, input)) {
    add('SECTION_DELIVERY_POLICY', issue.sectionId, issue.message)
  }
  const sessions = new Map(valid.assignments.map((item) => [item.id, item]))
  const sections = new Map(valid.sections.map((item) => [item.id, item]))
  const expected = new Set(requirements.map((item) => item.id))
  const missingSessionIds: string[] = []
  for (const requirement of requirements) {
    const assignment = sessions.get(requirement.id)
    if (!assignment) {
      missingSessionIds.push(requirement.id)
      add('MISSING_SESSION', requirement.id, 'Falta programar esta sesión semanal')
    } else {
      if (assignment.sectionId !== requirement.sectionId) add('SECTION_MISMATCH', requirement.id, 'La sesión pertenece a otra sección')
      if (sections.get(assignment.sectionId)?.courseId !== requirement.courseId) add('COURSE_MISMATCH', requirement.id, 'La sesión pertenece a otro curso')
      if (assignment.interval.endMinute - assignment.interval.startMinute !== requirement.durationMinutes) add('DURATION_MISMATCH', requirement.id, 'La duración programada no coincide con la requerida')
    }
  }
  for (const assignment of valid.assignments) if (!expected.has(assignment.id)) add('UNEXPECTED_SESSION', assignment.id, 'Sesión no declarada en los requisitos')
  return { complete: issues.length === 0, missingSessionIds, issues }
}
