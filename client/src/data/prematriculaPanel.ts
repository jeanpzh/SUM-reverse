import type {
  MatriculaRegularCourseDocument,
  MatriculaRegularId,
} from '../../../shared/matricula-regular.mjs'

export type PreEnrollmentStatusVariant = 'enabled' | 'disabled' | 'pending'

export function formatPreEnrollmentStatus(enabled: boolean | null): {
  label: string
  variant: PreEnrollmentStatusVariant
} {
  if (enabled === true) {
    return { label: 'Habilitada', variant: 'enabled' }
  }
  if (enabled === false) {
    return { label: 'No habilitada', variant: 'disabled' }
  }
  return { label: 'Desconocida (gap)', variant: 'pending' }
}

export function formatPreEnrollmentRows(courses: readonly MatriculaRegularCourseDocument[]): string[][] {
  return courses.map((course) => [
    course.courseId,
    course.name,
    String(course.credits),
    course.planId,
  ])
}

export function buildPreEnrollmentCsvData(
  courses: readonly MatriculaRegularCourseDocument[],
  actorId: MatriculaRegularId,
): { name: string; headers: string[]; rows: string[][] } {
  return {
    name: `prematricula_${actorId}`,
    headers: ['Código de Asignatura', 'Nombre de Asignatura', 'Créditos', 'Plan de Estudios'],
    rows: formatPreEnrollmentRows(courses),
  }
}
