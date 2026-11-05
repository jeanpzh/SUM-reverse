import { createHash } from 'node:crypto'
import type { AcademicCatalog, AcademicSavedDraft, AcademicScheduleSnapshot } from '../../../shared/programacion-academica-api.mjs'

const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
    : JSON.stringify(value) ?? 'undefined'

export function approvalFingerprint(draft: AcademicSavedDraft): string {
  return createHash('sha256').update(canonical({
    title: draft.title,
    configuration: draft.configuration,
    demandBase: draft.demandBase,
    proposal: draft.proposal,
    review: draft.review,
  })).digest('hex')
}

export function createScheduleSnapshot(catalog: AcademicCatalog, draft: AcademicSavedDraft): AcademicScheduleSnapshot {
  if (!draft.proposal || draft.proposal.status !== 'complete' || !draft.proposal.coverageComplete
    || !draft.proposal.sections.length || !draft.proposal.assignments.length) throw new TypeError('Se requiere un horario completo y no vacío')

  const usedIds = new Set(draft.proposal.sections.map((section) => section.courseId))
  const courses = [...usedIds].sort().map((courseId) => {
    const course = catalog.courses.find((item) => item.courseId === courseId)
    if (!course || !Number.isSafeInteger(course.cycle) || course.cycle! < 1 || course.cycle! > 10
      || !Number.isSafeInteger(course.credits) || course.credits! < 0 || course.credits! > 100) {
      throw new TypeError(`El curso ${courseId} no tiene ciclo y créditos válidos en el catálogo actual`)
    }
    return { courseId, name: course.name, cycle: course.cycle!, credits: course.credits! }
  })

  return {
    schoolId: draft.configuration.schoolId,
    academicPeriod: draft.configuration.academicPeriod,
    courses,
    sections: structuredClone(draft.proposal.sections),
    assignments: structuredClone(draft.proposal.assignments),
  }
}
