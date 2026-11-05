import { calculateRequiredSections } from './section-sizing.js'
import { intervalsOverlap, validateAcademicSchedule } from './schedule-validator.js'
import type { AllocationPolicy, DeliveryMode, GeneratorInput, RequiredSession } from './generator.types.js'
import type { AcademicSchedule } from './schedule.types.js'
import { GENERATOR_LIMITS, checkScheduleSizes } from './generator-limits.js'

export const compareIds = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0

function fail(path: string, message: string): never { throw new TypeError(`${path}: ${message}`) }
export function exactRecord(value: unknown, keys: string[], path: string, optionalKeys: string[] = []): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(path, 'se esperaba un objeto plano')
  const row = value as Record<string, unknown>
  if (keys.some((key) => !Object.hasOwn(row, key)) || Object.keys(row).some((key) => !keys.includes(key) && !optionalKeys.includes(key))) fail(path, 'campos ausentes o no permitidos')
  return row
}
export function requireInteger(value: unknown, min: number, max: number, path: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) fail(path, `entero entre ${min} y ${max} requerido`)
}
export function requireId(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || !value || value.trim() !== value || value.length > GENERATOR_LIMITS.inputIdLength) fail(path, 'identificador de 1–80 caracteres sin espacios en extremos requerido')
}
function array(value: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max || Array.from(value).some((item) => item === undefined)) fail(path, `lista densa de hasta ${max} elementos requerida`)
  return value
}
function deliveryMode(value: unknown, path: string): DeliveryMode {
  if (value === undefined) return 'continuous'
  if (value !== 'continuous' && value !== 'split') fail(path, 'debe ser continuous o split')
  return value
}
function sessionType(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !value.trim() || value.length > 80) fail(path, 'tipo textual no vacío de hasta 80 caracteres requerido')
  return value
}

/** Validate and expand without allocating unbounded section/session arrays. */
export function prepareGeneratorInput(value: unknown): { input: GeneratorInput; schedule: AcademicSchedule; requirements: RequiredSession[] } {
  const row = exactRecord(value, ['courses', 'teachers', 'rooms', 'compatibleGroups', 'windows', 'startStepMinutes', 'maxExplorations'], 'generator', ['allocationPolicy'])
  if (row.allocationPolicy !== undefined && !['preferences', 'balanced', 'first-feasible'].includes(row.allocationPolicy as string)) fail('allocationPolicy', 'debe ser preferences, balanced o first-feasible')
  requireInteger(row.startStepMinutes, 1, 1440, 'startStepMinutes')
  requireInteger(row.maxExplorations, 0, 100000, 'maxExplorations')
  const courses = array(row.courses, 'courses', 32)
  array(row.teachers, 'teachers', 32)
  array(row.rooms, 'rooms', 32)
  array(row.compatibleGroups, 'compatibleGroups', 32)
  const windows = array(row.windows, 'windows', 32)
  checkScheduleSizes(row)
  for (const key of ['teachers', 'rooms', 'compatibleGroups']) {
    array(row[key], key, 32).forEach((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) fail(`${key}[${index}]`, 'recurso inválido')
      const resource = item as Record<string, unknown>
      requireId(resource.id, `${key}[${index}].id`)
      if (key !== 'rooms') array(resource.courseIds, `${key}[${index}].courseIds`, 32).forEach((id, n) => requireId(id, `${key}[${index}].courseIds[${n}]`))
    })
  }
  windows.forEach((window, index) => {
    try { intervalsOverlap(window, window) } catch { fail(`windows[${index}]`, 'intervalo inválido') }
  })
  const sections: AcademicSchedule['sections'] = []
  const sectionNumbers = new Map<string, number>()
  const courseModes = new Map<string, DeliveryMode>()
  const requirements: RequiredSession[] = []
  courses.forEach((value, index) => {
    const path = `courses[${index}]`
    const course = exactRecord(value, ['courseId', 'estimatedDemand', 'targetCapacity', 'weeklySessions'], path, ['deliveryMode'])
    const mode = deliveryMode(course.deliveryMode, `${path}.deliveryMode`)
    requireId(course.courseId, `${path}.courseId`)
    let count: number
    try {
      count = calculateRequiredSections({ courseId: course.courseId, estimatedDemand: course.estimatedDemand, targetCapacity: course.targetCapacity }).requiredSections
    } catch (error) { fail(path, error instanceof Error ? error.message : 'demanda inválida') }
    const weekly = array(course.weeklySessions, `${path}.weeklySessions`, 128)
    if (!weekly.length) fail(`${path}.weeklySessions`, 'declarar al menos una sesión semanal')
    const seen = new Set<string>()
    weekly.forEach((session, sessionIndex) => {
      const sessionPath = `${path}.weeklySessions[${sessionIndex}]`
      const item = exactRecord(session, ['id', 'durationMinutes'], sessionPath, ['type'])
      requireId(item.id, `${sessionPath}.id`)
      requireInteger(item.durationMinutes, 1, 1440, `${sessionPath}.durationMinutes`)
      sessionType(item.type, `${sessionPath}.type`)
      if (seen.has(item.id)) fail(`${sessionPath}.id`, 'sesión semanal repetida')
      seen.add(item.id)
    })
    if (sections.length + count > 128 || requirements.length + count * weekly.length > 128) fail(path, 'el prototipo admite hasta 128 secciones y sesiones requeridas')
    const courseId = course.courseId as string
    courseModes.set(courseId, mode)
    for (let number = 1; number <= count; number++) {
      const sectionId = `section:${JSON.stringify([courseId, number])}`
      sectionNumbers.set(sectionId, number)
      sections.push({ id: sectionId, courseId, capacity: course.targetCapacity as number })
      for (const [order, value] of weekly.entries()) {
        const session = value as { id: string, durationMinutes: number, type?: string }
        requirements.push({ id: `session:${JSON.stringify([sectionId, session.id])}`, sectionId, courseId,
          durationMinutes: session.durationMinutes, type: session.type, order })
      }
    }
  })
  // Catalog validity and references are owned by the stage-2 validator.
  const schedule = { courses: courses.map((value) => (value as Record<string, unknown>).courseId),
    teachers: row.teachers, rooms: row.rooms, compatibleGroups: row.compatibleGroups, sections, assignments: [] }
  const validation = validateAcademicSchedule(schedule)
  if (!validation.valid) fail('catalogs', validation.issues.map((issue) => `${issue.field ?? issue.resourceId ?? issue.code}: ${issue.message}`).join('; '))
  const input = structuredClone(row) as unknown as GeneratorInput
  input.courses.forEach((course) => { course.deliveryMode = courseModes.get(course.courseId) ?? 'continuous' })
  input.courses.sort((a, b) => compareIds(a.courseId, b.courseId))
  input.teachers.sort((a, b) => compareIds(a.id, b.id))
  input.allocationPolicy = row.allocationPolicy as AllocationPolicy | undefined ?? 'preferences'
  input.rooms.sort((a, b) => compareIds(a.id, b.id))
  input.compatibleGroups.sort((a, b) => compareIds(a.id, b.id))
  input.windows.sort((a, b) => a.day - b.day || a.startMinute - b.startMinute || a.endMinute - b.endMinute)
  sections.sort((a, b) => compareIds(a.courseId, b.courseId) || sectionNumbers.get(a.id)! - sectionNumbers.get(b.id)!)
  const sectionOrder = new Map(sections.map((section, index) => [section.id, index]))
  requirements.sort((a, b) => sectionOrder.get(a.sectionId)! - sectionOrder.get(b.sectionId)! || a.order - b.order)
  return { input, schedule: structuredClone({ ...schedule, teachers: input.teachers, rooms: input.rooms, compatibleGroups: input.compatibleGroups }) as AcademicSchedule, requirements }
}
