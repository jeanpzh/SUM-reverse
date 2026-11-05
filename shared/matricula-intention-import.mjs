import { validateActorId, validateChoice } from './matricula-regular.mjs'

const issueCodes = new Set([
  'SCOPE_MISMATCH', 'PUBLICATION_UNAVAILABLE', 'COURSE_UNAVAILABLE', 'SECTION_UNMAPPED',
  'AMBIGUOUS_MAPPING', 'SCHEDULE_CHANGED', 'SECTION_FULL', 'ACADEMIC_PENDING',
])

function exact(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join(',') !== [...fields].sort().join(',')) {
    throw new TypeError('Campos de traslado inválidos')
  }
}

const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)
const nonempty = value => typeof value === 'string' && value.trim().length > 0
const version = value => Number.isSafeInteger(value) && value >= 1

export function validateE3IntentionImport(value) {
  exact(value, ['runId', 'actorId', 'profileRevision', 'intention', 'selection', 'issues'])
  validateActorId(value.actorId)
  if (!uuid(value.runId) || !nonempty(value.profileRevision) || !Array.isArray(value.selection) || !Array.isArray(value.issues)) {
    throw new TypeError('Contexto de traslado inválido')
  }
  if (value.intention !== null) {
    const record = value.intention
    exact(record, ['version', 'publicationId', 'publicationVersion', 'academicPeriod'])
    if (!version(record.version) || !uuid(record.publicationId) || !version(record.publicationVersion) || !nonempty(record.academicPeriod)) {
      throw new TypeError('Referencia de intención inválida')
    }
  } else if (value.selection.length || value.issues.length) {
    throw new TypeError('Traslado sin intención')
  }
  const selected = new Set()
  for (const choice of value.selection) {
    validateChoice(choice)
    if (selected.has(choice.courseId)) throw new TypeError('Asignatura duplicada en traslado')
    selected.add(choice.courseId)
  }
  for (const issue of value.issues) {
    exact(issue, ['courseId', 'sectionId', 'code'])
    if (!nonempty(issue.courseId) || !nonempty(issue.sectionId) || !issueCodes.has(issue.code)) {
      throw new TypeError('Diagnóstico de traslado inválido')
    }
  }
}
