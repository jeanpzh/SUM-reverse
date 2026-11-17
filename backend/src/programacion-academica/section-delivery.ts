import { getSectionComponentGroups } from '../../../shared/programacion-academica-api.mjs'
import type { GeneratorInput, RequiredSession } from './generator.types.js'
import type { AcademicAssignment, AcademicSchedule } from './schedule.types.js'

export type SectionDeliveryIssue = { sectionId: string, message: string }

/** Checks section-wide and group-wide rules while accepting only coherent partial prefixes. */
export function validateSectionDelivery(
  schedule: Pick<AcademicSchedule, 'sections' | 'assignments'>,
  requirements: RequiredSession[],
  input: Pick<GeneratorInput, 'courses'>,
): SectionDeliveryIssue[] {
  const modes = new Map(input.courses.map((course) => [course.courseId, course.deliveryMode ?? 'continuous']))
  const teacherModes = new Map(input.courses.map((course) => [course.courseId, course.teacherAssignmentMode ?? 'single-teacher-section']))
  const assignments = new Map(schedule.assignments.map((assignment) => [assignment.id, assignment]))
  const issues: SectionDeliveryIssue[] = []

  for (const section of schedule.sections) {
    const ordered = requirements.filter((item) => item.sectionId === section.id).sort((a, b) => a.order - b.order)
    if (!ordered.length) continue
    const mode = modes.get(section.courseId) ?? 'continuous'
    const teacherMode = teacherModes.get(section.courseId) ?? 'single-teacher-section'
    const groups = getSectionComponentGroups(ordered, teacherMode)

    for (const group of groups) {
      const assigned: Array<{ requirement: RequiredSession, assignment: AcademicAssignment }> = []
      for (const requirement of group) {
        const assignment = assignments.get(requirement.id)
        if (assignment) assigned.push({ requirement, assignment })
      }
      if (!assigned.length) continue
      const teachers = new Set(assigned.map(({ assignment }) => assignment.teacherId))
      if (teachers.size !== 1) {
        issues.push({
          sectionId: section.id,
          message: teacherMode === 'single-teacher-section'
            ? 'Todas las sesiones de la sección deben tener un único docente responsable'
            : 'Cada bloque agrupado de la sección debe tener un único docente asignado',
        })
        break
      }
      if (mode !== 'continuous' || group.length <= 1) continue

      const assignedIds = new Set(assigned.map(({ requirement }) => requirement.id))
      const orderedAssigned = group.filter((item) => assignedIds.has(item.id))
      if (orderedAssigned.length !== assignedIds.size
        || orderedAssigned.some((item, index) => item !== group[index])) {
        issues.push({ sectionId: section.id, message: 'Un bloque continuo parcial debe conservar el prefijo del orden declarado de componentes' })
        break
      }
      const intervals = orderedAssigned.map((item) => assignments.get(item.id)!.interval)
      if (intervals.some((interval, index) => index > 0
        && (interval.day !== intervals[0]!.day || interval.startMinute !== intervals[index - 1]!.endMinute))) {
        issues.push({ sectionId: section.id, message: 'Los componentes de la sección deben ser contiguos, en su orden declarado y el mismo día' })
        break
      }
    }
  }
  return issues
}
