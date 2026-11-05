import type { GeneratorInput, RequiredSession } from './generator.types.js'
import type { AcademicAssignment, AcademicSchedule } from './schedule.types.js'

export type SectionDeliveryIssue = { sectionId: string, message: string }

/** Checks section-wide rules while accepting only coherent partial prefixes. */
export function validateSectionDelivery(
  schedule: Pick<AcademicSchedule, 'sections' | 'assignments'>,
  requirements: RequiredSession[],
  input: Pick<GeneratorInput, 'courses'>,
): SectionDeliveryIssue[] {
  const modes = new Map(input.courses.map((course) => [course.courseId, course.deliveryMode ?? 'continuous']))
  const assignments = new Map(schedule.assignments.map((assignment) => [assignment.id, assignment]))
  const issues: SectionDeliveryIssue[] = []

  for (const section of schedule.sections) {
    const assigned: Array<{ requirement: RequiredSession, assignment: AcademicAssignment }> = []
    for (const requirement of requirements) {
      if (requirement.sectionId !== section.id) continue
      const assignment = assignments.get(requirement.id)
      if (assignment) assigned.push({ requirement, assignment })
    }
    if (!assigned.length) continue
    const teachers = new Set(assigned.map(({ assignment }) => assignment.teacherId))
    if (teachers.size !== 1) {
      issues.push({ sectionId: section.id, message: 'Todas las sesiones de la sección deben tener un único docente responsable' })
      continue
    }
    if (modes.get(section.courseId) !== 'continuous') continue

    const ordered = requirements.filter((item) => item.sectionId === section.id).sort((a, b) => a.order - b.order)
    const assignedIds = new Set(assigned.map(({ requirement }) => requirement.id))
    const orderedAssigned = ordered.filter((item) => assignedIds.has(item.id))
    if (orderedAssigned.length !== assignedIds.size
      || orderedAssigned.some((item, index) => item !== ordered[index])) {
      issues.push({ sectionId: section.id, message: 'Un bloque continuo parcial debe conservar el prefijo del orden declarado de componentes' })
      continue
    }
    const intervals = orderedAssigned.map((item) => assignments.get(item.id)!.interval)
    if (intervals.some((interval, index) => index > 0
      && (interval.day !== intervals[0]!.day || interval.startMinute !== intervals[index - 1]!.endMinute))) {
      issues.push({ sectionId: section.id, message: 'Los componentes de la sección deben ser contiguos, en su orden declarado y el mismo día' })
    }
  }
  return issues
}
