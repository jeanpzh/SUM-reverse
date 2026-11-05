import { compareIds, prepareGeneratorInput } from './generator-input.js'
import { intervalsOverlap, validateAcademicSchedule } from './schedule-validator.js'
import { createCoverageAuthority } from './session-coverage.js'
import { validateSectionDelivery } from './section-delivery.js'
import { GENERATOR_LIMITS } from './generator-limits.js'
import { preferenceRank } from './teacher-preferences.js'
import type { GeneratorExecutionOptions, GeneratorInput, GeneratorResult, RequiredSession } from './generator.types.js'
import type { AcademicAssignment, TimeInterval } from './schedule.types.js'
import { THESIS_COURSE_IDS } from '../../../shared/academic-planning-policy.mjs'

type SearchUnit = { requirements: RequiredSession[], mode: 'continuous' | 'split' }

/** Deterministic finite-domain DFS. No enrollment mutation, persistence or quality optimization. */
export function generateAcademicSchedule(value: unknown, options: GeneratorExecutionOptions = {}): GeneratorResult {
  const now = options.now ?? (() => performance.now())
  const maxElapsedMs = options.maxElapsedMs ?? GENERATOR_LIMITS.defaultElapsedMs
  const maxCandidateVisits = options.maxCandidateVisits ?? GENERATOR_LIMITS.candidateVisits
  if (typeof now !== 'function' || !Number.isFinite(maxElapsedMs) || maxElapsedMs < 0 || maxElapsedMs > GENERATOR_LIMITS.maxElapsedMs) {
    throw new TypeError('Opciones de ejecución inválidas: maxElapsedMs debe estar entre 0 y 5000')
  }
  if (!Number.isSafeInteger(maxCandidateVisits) || maxCandidateVisits < 0 || maxCandidateVisits > GENERATOR_LIMITS.candidateVisits) {
    throw new TypeError('maxCandidateVisits debe ser un entero entre 0 y 200000')
  }
  const started = now()
  if (!Number.isFinite(started)) throw new TypeError('El reloj debe devolver milisegundos finitos y monotónicos')
  let prepared: ReturnType<typeof prepareGeneratorInput>
  try { prepared = prepareGeneratorInput(value) } catch (error) {
    if (!(error instanceof TypeError)) throw error
    return { status: 'invalid-input', schedule: null, requirements: [], coverage: null,
      exploredCandidates: 0, backtracks: 0, candidateVisits: 0, limitReason: null, rejectionCounts: {}, diagnostics: [
        { code: 'INVALID_INPUT', message: error.message, sessionIds: [] },
      ] }
  }
  const { input, schedule, requirements } = prepared
  const units = makeUnits(input, requirements)
  let exploredCandidates = 0
  let backtracks = 0
  let limitReason: GeneratorResult['limitReason'] = null
  let candidateVisits = 0
  let lastTime = started
  const authority = createCoverageAuthority(input)
  let best: AcademicAssignment[] = []
  const rejectionCounts: GeneratorResult['rejectionCounts'] = {}

  function checkpoint(): boolean {
    const time = now()
    if (!Number.isFinite(time) || time < lastTime) throw new TypeError('El reloj debe devolver milisegundos finitos y monotónicos')
    lastTime = time
    if (time - started >= maxElapsedMs) limitReason = 'time'
    else if (candidateVisits >= maxCandidateVisits) limitReason = 'work'
    return limitReason === null
  }

  function* candidates(unit: SearchUnit): Generator<AcademicAssignment[]> {
    const { requirements: componentRequirements, mode } = unit
    const first = componentRequirements[0]!
    const blockDuration = componentRequirements.reduce((total, item) => total + item.durationMinutes, 0)
    const assignedTeacher = schedule.assignments.find((item) => item.sectionId === first.sectionId)?.teacherId

    const eligibleTeachers = input.teachers.filter((teacher) => (!assignedTeacher || teacher.id === assignedTeacher)
      && isEligibleForCourse(teacher, first.courseId, input))
    const hasPreferenceWindows = input.allocationPolicy !== 'first-feasible'
      && eligibleTeachers.some((teacher) => teacher.courseIds.includes(first.courseId) && teacher.preferences?.length)
    const rankOrder = input.planningPolicy ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : hasPreferenceWindows ? [0, 1, 2] : [1]
    const duration = mode === 'continuous' ? blockDuration : first.durationMinutes
    for (const targetRank of rankOrder) {
      let teachers = input.teachers.filter((teacher) => (!assignedTeacher || teacher.id === assignedTeacher)
        && isEligibleForCourse(teacher, first.courseId, input))
      if (input.allocationPolicy === 'balanced') {
        teachers = teachers.slice().sort((left, right) => {
          const load = (id: string) => schedule.assignments.filter((item) => item.teacherId === id)
          const leftRows = load(left.id), rightRows = load(right.id)
          const leftSections = new Set(leftRows.map((item) => item.sectionId)).size
          const rightSections = new Set(rightRows.map((item) => item.sectionId)).size
          return leftSections - rightSections
            || leftRows.reduce((sum, item) => sum + item.interval.endMinute - item.interval.startMinute, 0)
              - rightRows.reduce((sum, item) => sum + item.interval.endMinute - item.interval.startMinute, 0)
            || compareIds(left.id, right.id)
        })
      }
      for (const teacher of teachers) {
        if (!teacher.courseIds.includes(first.courseId)) {
          rejectionCounts.TEACHER_NOT_QUALIFIED = (rejectionCounts.TEACHER_NOT_QUALIFIED ?? 0) + 1
          continue
        }
        const teacherRows = schedule.assignments.filter((item) => item.teacherId === teacher.id)
        const assignedMinutes = teacherRows.reduce((sum, item) => sum + item.interval.endMinute - item.interval.startMinute, 0)
        if (assignedMinutes + blockDuration > teacher.maxWeeklyMinutes) {
          rejectionCounts.TEACHER_LOAD_EXCEEDED = (rejectionCounts.TEACHER_LOAD_EXCEEDED ?? 0) + 1
          continue
        }
        const existingSectionIds = new Set(teacherRows.map((item) => item.sectionId))
        const existingCourseSectionIds = new Set(teacherRows
          .filter((item) => schedule.sections.find((section) => section.id === item.sectionId)?.courseId === first.courseId)
          .map((item) => item.sectionId))
        const sectionLimit = teacher.sectionLimits?.find((item) => item.courseId === first.courseId)?.maxSections
        if (!existingSectionIds.has(first.sectionId) && sectionLimit !== undefined && existingCourseSectionIds.size >= sectionLimit) {
          rejectionCounts.TEACHER_SECTION_LIMIT = (rejectionCounts.TEACHER_SECTION_LIMIT ?? 0) + 1
          continue
        }
        const slots = input.windows.flatMap((window) => {
          const values: Array<{ window: TimeInterval, start: number, rank: number }> = []
          for (let start = window.startMinute; start + duration <= window.endMinute; start += input.startStepMinutes) {
            const rank = planningTimeRank(first, start, window.day, input, duration)
            if (rank !== null) values.push({ window, start, rank })
          }
          return values
        }).sort((left, right) => left.rank - right.rank || left.window.day - right.window.day || left.start - right.start)
        for (const { window, start } of slots) {
          if (!checkpoint()) return
          candidateVisits++
          const componentIntervals: TimeInterval[] = []
          let minute = start
          for (const requirement of componentRequirements) {
            componentIntervals.push({ day: window.day, startMinute: minute, endMinute: minute + requirement.durationMinutes })
            minute += requirement.durationMinutes
          }
          const partial = componentRequirements.map((requirement, index): AcademicAssignment => ({
            id: requirement.id, sectionId: requirement.sectionId, teacherId: teacher.id, roomId: '', interval: componentIntervals[index]!,
            ...(requirement.type ? { sessionType: requirement.type } : {}),
          }))

          const preference = input.allocationPolicy === 'first-feasible' ? 1 : preferenceRank(teacher.preferences, componentIntervals)
          const rank = input.planningPolicy ? slotsRank(first, componentIntervals[0]!, input) * 3 + preference : preference
          if (rank !== targetRank) continue
          // Avoid room-product exploration for blocks that already violate teacher rules.
          if (componentIntervals.some((interval) => !availabilityCovers(teacher.availability, interval.day, interval.startMinute, interval.endMinute))) continue
          const conflictingTeacherAssignments = teacherRows.filter((item) => componentIntervals.some((interval) => intervalsOverlap(item.interval, interval)))
          if (conflictingTeacherAssignments.length) {
            rejectionCounts.TEACHER_CONFLICT = (rejectionCounts.TEACHER_CONFLICT ?? 0) + conflictingTeacherAssignments.length
            const conflictingSectionAssignments = schedule.assignments.filter((item) => item.sectionId === first.sectionId
              && componentIntervals.some((interval) => intervalsOverlap(item.interval, interval)))
            rejectionCounts.SECTION_CONFLICT = (rejectionCounts.SECTION_CONFLICT ?? 0) + conflictingSectionAssignments.length
            const conflictingRoomAssignments = schedule.assignments.filter((item) => componentIntervals.some((interval) => intervalsOverlap(item.interval, interval))
              && input.rooms.some((room) => room.id === item.roomId))
            rejectionCounts.ROOM_CONFLICT = (rejectionCounts.ROOM_CONFLICT ?? 0) + conflictingRoomAssignments.length
            continue
          }
          function* selectRooms(index: number): Generator<AcademicAssignment[]> {
            if (index === partial.length) {
              const candidate = partial.map((assignment) => ({ ...assignment }))
              const validation = validateAcademicSchedule({ ...schedule, assignments: [...schedule.assignments, ...candidate] }, { planningPolicy: Boolean(input.planningPolicy) })
              if (validation.valid && validateSectionDelivery({ ...schedule, assignments: [...schedule.assignments, ...candidate] }, requirements, input).length === 0) yield candidate
              else for (const issue of validation.issues) rejectionCounts[issue.code] = (rejectionCounts[issue.code] ?? 0) + 1
              return
            }
            for (const room of input.rooms) {
              if (!checkpoint()) return
              candidateVisits++
              if (input.planningPolicy && partial[index]!.sessionType === 'L' && room.kind !== 'laboratory') {
                rejectionCounts.ROOM_KIND_MISMATCH = (rejectionCounts.ROOM_KIND_MISMATCH ?? 0) + 1
                continue
              }
              partial[index]!.roomId = room.id
              // Capacity, room availability and synchronous conflicts prune this branch before
              // the remaining room product is explored.
              const validation = validateAcademicSchedule({ ...schedule, assignments: [...schedule.assignments, ...partial.slice(0, index + 1)] }, { planningPolicy: Boolean(input.planningPolicy) })
              if (validation.valid) yield* selectRooms(index + 1)
              else for (const issue of validation.issues) rejectionCounts[issue.code] = (rejectionCounts[issue.code] ?? 0) + 1
              if (limitReason) return
            }
          }
          yield* selectRooms(0)
          if (limitReason) return
        }
      }
    }
  }

  function search(index: number): boolean {
    if (index === units.length) return true
    const unit = units[index]!
    for (const candidate of candidates(unit)) {
      if (exploredCandidates >= input.maxExplorations) { limitReason = 'explorations'; return false }
      exploredCandidates++
      schedule.assignments.push(...candidate)
      if (schedule.assignments.length > best.length) best = structuredClone(schedule.assignments)
      if (search(index + 1)) return true
      backtracks++
      schedule.assignments.splice(-candidate.length, candidate.length)
      if (limitReason) return false
    }
    return false
  }

  const found = search(0)
  if (!found) schedule.assignments = best
  const coverage = authority.check(schedule)
  if (found && !coverage.complete) throw new Error('Invariante interna: la búsqueda terminó sin cobertura válida')
  const status = found ? 'complete' : limitReason ? 'search-limit' : 'impossible'
  const diagnostic = getDiagnostic(status, limitReason, input, requirements, rejectionCounts, coverage.missingSessionIds)
  return { status, schedule, requirements, coverage, exploredCandidates, backtracks, candidateVisits, limitReason, rejectionCounts,
    diagnostics: [diagnostic] }
}

function makeUnits(input: GeneratorInput, requirements: RequiredSession[]): SearchUnit[] {
  const modes = new Map(input.courses.map((course) => [course.courseId, course.deliveryMode ?? 'continuous']))
  const sections = new Map<string, RequiredSession[]>()
  for (const requirement of requirements) {
    const sectionRequirements = sections.get(requirement.sectionId) ?? []
    sectionRequirements.push(requirement)
    sections.set(requirement.sectionId, sectionRequirements)
  }
  const units: SearchUnit[] = []
  for (const sectionRequirements of sections.values()) {
    sectionRequirements.sort((a, b) => a.order - b.order)
    const mode = modes.get(sectionRequirements[0]!.courseId) ?? 'continuous'
    if (mode === 'continuous') units.push({ requirements: sectionRequirements, mode })
    else for (const requirement of sectionRequirements) units.push({ requirements: [requirement], mode })
  }
  return units
}

function getDiagnostic(
  status: GeneratorResult['status'],
  limitReason: GeneratorResult['limitReason'],
  input: GeneratorInput,
  requirements: RequiredSession[],
  rejections: GeneratorResult['rejectionCounts'],
  missingSessionIds: string[],
) {
  if (status === 'complete') return { code: 'COMPLETE', message: 'Todas las sesiones requeridas están programadas y validadas', sessionIds: [] }
  if (status === 'search-limit') {
    const messages = {
      time: 'Se alcanzó el límite temporal cooperativo; no se ha demostrado imposibilidad',
      work: 'Se alcanzó el presupuesto de trabajo del generador; no se ha demostrado imposibilidad',
      explorations: 'Se alcanzó el límite de exploración; no se ha demostrado imposibilidad',
    }
    return { code: 'SEARCH_LIMIT', message: messages[limitReason!], sessionIds: missingSessionIds }
  }
  const proof = proveNecessaryConstraint(input, requirements)
  if (proof) return { ...proof, sessionIds: missingSessionIds }
  const labels: Partial<Record<keyof NonNullable<GeneratorResult['rejectionCounts']>, string>> = {
    RESOURCE_NOT_FOUND: 'referencias de recursos', TEACHER_CONFLICT: 'cruces de docente', ROOM_CONFLICT: 'cruces de ambiente',
    SECTION_CONFLICT: 'cruces de sección', COURSE_GROUP_CONFLICT: 'cruces de grupo compatible', ROOM_CAPACITY: 'capacidad de ambiente',
    COHORT_CONFLICT: 'cruces de cohorte', ROOM_KIND_MISMATCH: 'tipo de ambiente',
    TEACHER_UNAVAILABLE: 'disponibilidad docente', ROOM_UNAVAILABLE: 'disponibilidad de ambiente',
    TEACHER_NOT_QUALIFIED: 'habilitación docente', TEACHER_LOAD_EXCEEDED: 'carga docente', INVALID_INPUT: 'forma de asignación',
  }
  const observed = Object.entries(rejections).filter((entry) => entry[1] && labels[entry[0] as keyof typeof labels])
    .sort((a, b) => b[1]! - a[1]!).map(([code, count]) => `${labels[code as keyof typeof labels]} (${count})`)
  const observation = observed.length ? ` Durante la búsqueda se observaron ${observed.join(', ')}; esto no establece una causa única.` : ''
  return { code: 'FINITE_DOMAIN_EXHAUSTED',
    message: `Se agotó el dominio finito de aulas, docentes y franjas de esta cuadrícula sin completar la programación.${observation}`,
    sessionIds: missingSessionIds }
}

function proveNecessaryConstraint(input: GeneratorInput, requirements: RequiredSession[]) {
  const courseIds = new Set(requirements.map((item) => item.courseId))
  for (const courseId of courseIds) {
    const courseRequirements = requirements.filter((item) => item.courseId === courseId)
    const teacherPool = input.teachers.filter((teacher) => teacher.courseIds.includes(courseId) && isEligibleForCourse(teacher, courseId, input))
    if (!teacherPool.length) return { code: 'NO_QUALIFIED_TEACHER', message: `No hay docente habilitado para el curso ${courseId}` }
    const requiredCourseMinutes = courseRequirements.reduce((sum, item) => sum + item.durationMinutes, 0)
    const totalQualifiedLoad = teacherPool.reduce((sum, teacher) => sum + teacher.maxWeeklyMinutes, 0)
    if (totalQualifiedLoad < requiredCourseMinutes) return {
      code: 'INSUFFICIENT_COURSE_TEACHER_LOAD',
      message: `La carga total máxima de docentes habilitados para ${courseId} es ${totalQualifiedLoad} minutos; se requieren ${requiredCourseMinutes}`,
    }
    const requiredSections = new Set(courseRequirements.map((item) => item.sectionId)).size
    const limits = teacherPool.map((teacher) => teacher.sectionLimits?.find((item) => item.courseId === courseId)?.maxSections)
    if (limits.every((limit) => limit !== undefined) && limits.reduce((sum, limit) => sum + (limit ?? 0), 0) < requiredSections) return {
      code: 'INSUFFICIENT_TEACHER_SECTION_CAP',
      message: `Los límites explícitos de docentes habilitados para ${courseId} permiten menos de ${requiredSections} secciones`,
    }
    const sectionLoad = courseRequirements.filter((item) => item.sectionId === courseRequirements[0]!.sectionId)
      .reduce((sum, item) => sum + item.durationMinutes, 0)
    if (teacherPool.every((teacher) => teacher.maxWeeklyMinutes < sectionLoad)) {
      return { code: 'INSUFFICIENT_TEACHER_LOAD', message: `La carga máxima de cada docente habilitado es menor que los ${sectionLoad} minutos requeridos por sección` }
    }
    const mode = input.courses.find((item) => item.courseId === courseId)?.deliveryMode ?? 'continuous'
    if (mode === 'continuous') {
      const duration = sectionLoad
      const hasTeacherWindow = teacherPool.some((teacher) => input.windows.some((window) => {
        for (let start = window.startMinute; start + duration <= window.endMinute; start += input.startStepMinutes) {
          if (availabilityCovers(teacher.availability, window.day, start, start + duration)) return true
        }
        return false
      }))
      if (!hasTeacherWindow) return { code: 'NO_CONTINUOUS_TEACHER_WINDOW', message: `No existe una franja docente continua de ${duration} minutos dentro de las ventanas declaradas` }
    }
  }
  if (!input.rooms.length) return { code: 'NO_ROOM_SELECTED', message: 'No hay ambientes seleccionados para programar las secciones' }
  const largestCapacity = Math.max(...input.courses.filter((course) => requirements.some((item) => item.courseId === course.courseId))
    .map((course) => course.targetCapacity))
  if (input.rooms.every((room) => room.capacity < largestCapacity)) {
    return { code: 'ROOM_CAPACITY', message: `Ningún ambiente seleccionado alcanza las ${largestCapacity} plazas requeridas` }
  }
  return null
}

function availabilityCovers(availability: TimeInterval[], day: number, start: number, end: number): boolean {
  let coveredUntil = start
  for (const interval of availability.filter((item) => item.day === day).sort((a, b) => a.startMinute - b.startMinute)) {
    if (interval.endMinute <= coveredUntil) continue
    if (interval.startMinute > coveredUntil) return false
    coveredUntil = interval.endMinute
    if (coveredUntil >= end) return true
  }
  return false
}

function isEligibleForCourse(teacher: GeneratorInput['teachers'][number], courseId: string, input: GeneratorInput): boolean {
  if (!THESIS_COURSE_IDS.includes(courseId)) return true
  if (!input.planningPolicy) return true
  return teacher.facultyId === 'FISI' && teacher.qualificationSource === 'synthetic' && teacher.courseIds.includes(courseId)
}

function planningTimeRank(requirement: RequiredSession, start: number, day: number, input: GeneratorInput, duration = 1): number | null {
  const policy = input.planningPolicy
  if (!policy) return 0
  const course = input.courses.find((item) => item.courseId === requirement.courseId)
  const senior = (course?.cycle ?? 0) >= 7
  if (day === 7) return null
  if (day === 6) return policy.allowSaturday && start >= 8 * 60 && start + duration <= 13 * 60 ? (senior ? 2 : 1) : null
  if (day < 1 || day > 5 || start + duration > 22 * 60) return null
  if (senior) {
    if (start >= 18 * 60 && start < 22 * 60) return 0
    if (policy.allowAfternoon && start >= 14 * 60 && start < 22 * 60) return 1
    return null
  }
  return start >= 8 * 60 && start < 22 * 60 ? 0 : null
}

function slotsRank(requirement: RequiredSession, interval: TimeInterval, input: GeneratorInput): number {
  return planningTimeRank(requirement, interval.startMinute, interval.day, input) ?? Number.MAX_SAFE_INTEGER
}
