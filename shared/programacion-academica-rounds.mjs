// PA-ROUNDS-1 shared module (F-R.1): round profile, closed objection kinds, their deterministic
// operations and the DTO/record validators. Contract: docs/reverse-engineering/contracts/local-api/planning-rounds.md.
// Every FISI value below is a pending faculty decision or a local design decision, never an official rule.
import { isPlanningPeriod } from './academic-planning-policy.mjs'
import { validateAcademicReviewDecision } from './programacion-academica-api.mjs'

export const ROUNDS_REVISION = 'PA-ROUNDS-1'
export const ROUND_PROFILE_REVISION = 'PA-ROUNDS-PROFILE-1'
export const ROUND_RECORD_LIMIT = 200
export const ROUND_OBJECTION_KINDS = Object.freeze(['franja-no-disponible', 'exceso-de-carga', 'aula-inadecuada', 'otra'])
export const ROUND_OBJECTION_STATUSES = Object.freeze(['proposed', 'confirmed', 'rejected', 'applied', 'recorded', 'superseded'])

const kindKeys = Object.freeze({
  'franja-no-disponible': ['intervals'],
  'exceso-de-carga': ['limit'],
  'aula-inadecuada': ['roomIds'],
  otra: [],
})
const sourceOrigins = ['evidence', 'local-decision']
const sourceClasses = ['normative', 'observed', 'testimony', 'inferred', null]
const sourceStatuses = ['documented', 'reported', 'unverified', 'local-only']
const regenerationStatuses = ['complete', 'impossible', 'search-limit', 'invalid-input']

function deepFreeze(value) {
  if (value && typeof value === 'object') Object.values(value).forEach(deepFreeze)
  return Object.freeze(value)
}

// Synthetic registry. maxRounds and the deadline mode are pending with the faculty (PROP-13.5).
const PROFILES = deepFreeze([{
  revision: ROUND_PROFILE_REVISION,
  profileId: 'SYN-SIS-2027-I-ROUNDS-1',
  scope: { facultyId: 'FISI', schoolId: 'SISTEMAS', academicPeriod: '2027-I' },
  maxRounds: { value: 3, sourceIds: ['PROP-4.2.4', 'PROP-13.5'] },
  deadline: { mode: 'school-entered', required: false, sourceIds: ['L-ROUNDS-1', 'PROP-13.5'] },
  sources: [
    { id: 'PROP-4.2.4', origin: 'local-decision', class: null, reference: 'Propuesta de programación académica y matrícula en tres etapas v1.0, §4.2.4: máximo de tres rondas (requisito de diseño; valor FISI pendiente)', date: '2026-10-29', status: 'local-only' },
    { id: 'PROP-13.5', origin: 'local-decision', class: null, reference: 'Propuesta v1.0, §13.5: los plazos y el máximo de rondas docentes son un parámetro de la facultad (pregunta abierta, sin respuesta)', date: '2026-10-29', status: 'unverified' },
    { id: 'L-ROUNDS-1', origin: 'local-decision', class: null, reference: 'planning-rounds.md L-ROUNDS-1: el plazo es una fecha opcional ingresada por la escuela, sin temporizador ni efecto automático', date: '2026-11-07', status: 'local-only' },
  ],
}])

function object(value, keys, path, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${path}: objeto requerido`)
  if (keys.some((key) => !Object.hasOwn(value, key)) || Object.keys(value).some((key) => !keys.includes(key) && !optional.includes(key))) throw new TypeError(`${path}: campos inválidos`)
  return value
}
function text(value, path, max = 200) {
  if (typeof value !== 'string' || !value.length || value.length > max || value.trim() !== value) throw new TypeError(`${path}: texto inválido`)
}
function integer(value, path, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new TypeError(`${path}: entero inválido`)
}
function list(value, path, minimum, maximum) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum || value.some((item) => item === undefined)) throw new TypeError(`${path}: lista inválida`)
  return value
}
function uniqueTexts(value, path, minimum, maximum) {
  list(value, path, minimum, maximum).forEach((item) => text(item, path))
  if (new Set(value).size !== value.length) throw new TypeError(`${path}: valores repetidos`)
}
function interval(value) {
  object(value, ['day', 'startMinute', 'endMinute'], 'interval')
  integer(value.day, 'day', 1, 7)
  integer(value.startMinute, 'startMinute', 0, 1439)
  integer(value.endMinute, 'endMinute', value.startMinute + 1, 1440)
}
function moment(value, path) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new TypeError(`${path}: fecha inválida`)
}
function fingerprint(value, path) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new TypeError(`${path}: huella inválida`)
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

// ---------- §3 round profile ----------

function validateSource(value) {
  object(value, ['id', 'origin', 'class', 'reference', 'date', 'status'], 'source')
  text(value.id, 'source.id', 80)
  text(value.reference, 'source.reference', 1000)
  if (!sourceOrigins.includes(value.origin) || !sourceClasses.includes(value.class) || !sourceStatuses.includes(value.status)
    || typeof value.date !== 'string' || !isRoundDeadlineDate(value.date)) throw new TypeError('Fuente de perfil inválida')
}
function validateSourceIds(ids, known, path) {
  uniqueTexts(ids, path, 1, 16)
  if (ids.some((id) => !known.has(id))) throw new TypeError(`${path}: fuente desconocida`)
}

export function validateAcademicRoundProfile(value) {
  object(value, ['revision', 'profileId', 'scope', 'maxRounds', 'deadline', 'sources'], 'roundProfile')
  if (value.revision !== ROUND_PROFILE_REVISION) throw new TypeError('Revisión de perfil de rondas incompatible')
  text(value.profileId, 'profileId', 80)
  object(value.scope, ['facultyId', 'schoolId', 'academicPeriod'], 'roundProfile.scope')
  if (value.scope.facultyId !== 'FISI' || value.scope.schoolId !== 'SISTEMAS' || !isPlanningPeriod(value.scope.academicPeriod)) throw new TypeError('Alcance de perfil de rondas inválido')
  list(value.sources, 'sources', 1, 32).forEach(validateSource)
  const known = new Set(value.sources.map((source) => source.id))
  if (known.size !== value.sources.length) throw new TypeError('Fuentes de perfil repetidas')
  object(value.maxRounds, ['value', 'sourceIds'], 'maxRounds')
  integer(value.maxRounds.value, 'maxRounds.value', 1, 10)
  validateSourceIds(value.maxRounds.sourceIds, known, 'maxRounds.sourceIds')
  object(value.deadline, ['mode', 'required', 'sourceIds'], 'deadline')
  if (value.deadline.mode !== 'school-entered' || typeof value.deadline.required !== 'boolean') throw new TypeError('Modo de plazo inválido')
  validateSourceIds(value.deadline.sourceIds, known, 'deadline.sourceIds')
}

// Returns a copy so callers cannot mutate the registry. A scope with no profile is an explicit gap (null), never a fallback.
export function resolvePlanningRoundProfile(scope) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) return null
  const found = PROFILES.find((profile) => profile.scope.facultyId === 'FISI'
    && profile.scope.schoolId === scope.schoolId && profile.scope.academicPeriod === scope.academicPeriod)
  return found ? structuredClone(found) : null
}

// ---------- §6.2 deadline ----------

export function isRoundDeadlineDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
// America/Lima has no daylight saving time: UTC−05:00 all year.
export function limaCalendarDate(at) {
  const time = at instanceof Date ? at.getTime() : Date.parse(at)
  if (!Number.isFinite(time)) throw new TypeError('Instante inválido')
  return new Date(time - 5 * 3600 * 1000).toISOString().slice(0, 10)
}
// The deadline is not before the submission's Lima date and at most 366 days after it (422 DEADLINE_OUT_OF_RANGE otherwise).
export function isRoundDeadlineInRange(deadline, submittedAt) {
  if (!isRoundDeadlineDate(deadline)) return false
  const days = (Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${limaCalendarDate(submittedAt)}T00:00:00Z`)) / 86400000
  return days >= 0 && days <= 366
}

export function validateAcademicRoundSubmission(value) {
  object(value, ['expectedVersion'], 'roundSubmission', ['deadline'])
  integer(value.expectedVersion, 'expectedVersion', 1)
  if (Object.hasOwn(value, 'deadline') && !isRoundDeadlineDate(value.deadline)) throw new TypeError('Plazo inválido: se requiere una fecha YYYY-MM-DD')
}

// ---------- §6.3 objection input ----------

export function validateAcademicRoundObjectionInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !ROUND_OBJECTION_KINDS.includes(value.kind)) throw new TypeError('Tipo de objeción inválido')
  object(value, ['kind', 'sectionIds', ...kindKeys[value.kind]], 'objection')
  uniqueTexts(value.sectionIds, 'sectionIds', 1, 32)
  if (value.kind === 'franja-no-disponible') list(value.intervals, 'intervals', 1, 8).forEach(interval)
  if (value.kind === 'aula-inadecuada') uniqueTexts(value.roomIds, 'roomIds', 1, 8)
  if (value.kind === 'exceso-de-carga') {
    const limit = value.limit
    if (!limit || typeof limit !== 'object' || Array.isArray(limit)) throw new TypeError('limit: objeto requerido')
    if (Object.hasOwn(limit, 'maxWeeklyMinutes')) {
      object(limit, ['maxWeeklyMinutes'], 'limit')
      integer(limit.maxWeeklyMinutes, 'maxWeeklyMinutes', 0)
    } else {
      object(limit, ['courseId', 'maxSections'], 'limit')
      text(limit.courseId, 'courseId', 80)
      integer(limit.maxSections, 'maxSections', 0)
    }
  }
}

// Decision DTO: the PA-DEMO-1 rules apply unchanged, plus the optional objection (only with changes-requested).
export function validateAcademicRoundReviewDecision(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('reviewDecision: objeto requerido')
  const { objection, ...base } = value
  validateAcademicReviewDecision(base)
  if (!Object.hasOwn(value, 'objection')) return
  if (value.decision !== 'changes-requested') throw new TypeError('La objeción solo acompaña a changes-requested')
  validateAcademicRoundObjectionInput(objection)
}

// ---------- §6.4 / §6.5 / §6.6 DTOs ----------

export function validateAcademicRoundObjectionDecision(value) {
  object(value, ['expectedVersion', 'decision', 'reason'], 'objectionDecision')
  integer(value.expectedVersion, 'expectedVersion', 1)
  if (!['confirm', 'reject'].includes(value.decision) || typeof value.reason !== 'string' || value.reason.length > 500 || value.reason.trim() !== value.reason
    || (value.decision === 'reject' && !value.reason)) throw new TypeError('Decisión de objeción inválida')
}
export function validateAcademicRoundRegenerationRequest(value) {
  object(value, ['expectedVersion'], 'regenerationRequest')
  integer(value.expectedVersion, 'expectedVersion', 1)
}
export function validateAcademicRoundResolutionRequest(value) {
  object(value, ['expectedVersion', 'teacherId', 'reason'], 'resolutionRequest')
  integer(value.expectedVersion, 'expectedVersion', 1)
  text(value.teacherId, 'teacherId', 80)
  text(value.reason, 'reason', 500)
}
// Only the `regeneration` half of the §6.5 response; the draft half belongs to validateAcademicSavedDraft (wired by F-R.2).
export function validateAcademicRoundRegeneration(value) {
  object(value, ['status', 'saved', 'fixedSectionIds', 'regeneratedSectionIds', 'appliedObjectionIds', 'diagnostics'], 'regeneration')
  if (!regenerationStatuses.includes(value.status) || typeof value.saved !== 'boolean' || (value.saved && value.status !== 'complete')) throw new TypeError('Estado de regeneración inválido')
  for (const key of ['fixedSectionIds', 'regeneratedSectionIds', 'appliedObjectionIds']) uniqueTexts(value[key], key, 0, 1024)
  if (!value.saved && value.appliedObjectionIds.length) throw new TypeError('Objeciones aplicadas sin guardar')
  list(value.diagnostics, 'diagnostics', 0, 64).forEach((item) => {
    object(item, ['code', 'message', 'sessionIds'], 'diagnostic')
    text(item.code, 'diagnostic.code', 80)
    if (typeof item.message !== 'string' || item.message.length > 1000) throw new TypeError('Mensaje de diagnóstico inválido')
    uniqueTexts(item.sessionIds, 'diagnostic.sessionIds', 0, 1024)
  })
}

// ---------- §7 operations ----------

function validateOperation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('operation: objeto requerido')
  switch (value.type) {
    case 'remove-teacher-availability':
      object(value, ['type', 'teacherId', 'intervals'], 'operation')
      text(value.teacherId, 'teacherId', 80)
      list(value.intervals, 'intervals', 1, 8).forEach(interval)
      return
    case 'limit-teacher-load':
      object(value, ['type', 'teacherId', 'maxWeeklyMinutes'], 'operation')
      text(value.teacherId, 'teacherId', 80)
      integer(value.maxWeeklyMinutes, 'maxWeeklyMinutes', 0)
      return
    case 'limit-teacher-sections':
      object(value, ['type', 'teacherId', 'courseId', 'maxSections'], 'operation')
      text(value.teacherId, 'teacherId', 80)
      text(value.courseId, 'courseId', 80)
      integer(value.maxSections, 'maxSections', 0)
      return
    case 'exclude-section-rooms':
      object(value, ['type', 'sectionIds', 'roomIds'], 'operation')
      uniqueTexts(value.sectionIds, 'sectionIds', 1, 32)
      uniqueTexts(value.roomIds, 'roomIds', 1, 8)
      return
    case 'manual':
      object(value, ['type'], 'operation')
      return
    default:
      throw new TypeError('Tipo de operación inválido')
  }
}
export function validateAcademicRoundOperation(value) { validateOperation(value) }

// Pure, deterministic mapping from a validated objection input to its proposed operation (one per kind).
export function mapRoundObjectionToOperation(objection, teacherId) {
  validateAcademicRoundObjectionInput(objection)
  text(teacherId, 'teacherId', 80)
  if (objection.kind === 'franja-no-disponible') return { type: 'remove-teacher-availability', teacherId, intervals: objection.intervals.map(({ day, startMinute, endMinute }) => ({ day, startMinute, endMinute })) }
  if (objection.kind === 'exceso-de-carga') {
    return Object.hasOwn(objection.limit, 'maxWeeklyMinutes')
      ? { type: 'limit-teacher-load', teacherId, maxWeeklyMinutes: objection.limit.maxWeeklyMinutes }
      : { type: 'limit-teacher-sections', teacherId, courseId: objection.limit.courseId, maxSections: objection.limit.maxSections }
  }
  if (objection.kind === 'aula-inadecuada') return { type: 'exclude-section-rooms', sectionIds: [...objection.sectionIds], roomIds: [...objection.roomIds] }
  return { type: 'manual' }
}
// `otra` needs no decision: it is recorded. Every other kind waits for the school to confirm or reject.
export function initialRoundObjectionStatus(operation) {
  validateOperation(operation)
  return operation.type === 'manual' ? 'recorded' : 'proposed'
}

function mergeIntervals(items) {
  const sorted = items.map(({ day, startMinute, endMinute }) => ({ day, startMinute, endMinute }))
    .sort((a, b) => a.day - b.day || a.startMinute - b.startMinute || a.endMinute - b.endMinute)
  const merged = []
  for (const item of sorted) {
    const last = merged.at(-1)
    if (last && last.day === item.day && item.startMinute <= last.endMinute) last.endMinute = Math.max(last.endMinute, item.endMinute)
    else merged.push(item)
  }
  return merged
}
// Interval subtraction; the result is sorted and merged.
export function subtractRoundIntervals(availability, removed) {
  const cuts = mergeIntervals(removed)
  const result = []
  for (const slot of mergeIntervals(availability)) {
    let start = slot.startMinute
    for (const cut of cuts) {
      if (cut.day !== slot.day || cut.endMinute <= start || cut.startMinute >= slot.endMinute) continue
      if (cut.startMinute > start) result.push({ day: slot.day, startMinute: start, endMinute: cut.startMinute })
      start = Math.max(start, cut.endMinute)
    }
    if (start < slot.endMinute) result.push({ day: slot.day, startMinute: start, endMinute: slot.endMinute })
  }
  return mergeIntervals(result)
}
function insideAvailability(availability, item) {
  return mergeIntervals(availability).some((slot) => slot.day === item.day && slot.startMinute <= item.startMinute && slot.endMinute >= item.endMinute)
}

// Applies a teacher-level operation to a teacher resource (pure, returns a new object). Returns null when the result no
// longer fits (more than 32 availability intervals, 422 OPERATION_STALE). Non-teacher operations throw.
export function applyRoundOperationToTeacher(teacher, operation) {
  validateOperation(operation)
  if (!['remove-teacher-availability', 'limit-teacher-load', 'limit-teacher-sections'].includes(operation.type)) throw new TypeError('La operación no modifica a un docente')
  if (!teacher || typeof teacher !== 'object' || teacher.id !== operation.teacherId) throw new TypeError('La operación no corresponde al docente')
  if (operation.type === 'remove-teacher-availability') {
    const availability = subtractRoundIntervals(teacher.availability, operation.intervals)
    return availability.length > 32 ? null : { ...teacher, availability }
  }
  if (operation.type === 'limit-teacher-load') return { ...teacher, maxWeeklyMinutes: operation.maxWeeklyMinutes }
  const limits = (teacher.sectionLimits ?? []).map((limit) => ({ ...limit }))
  const existing = limits.find((limit) => limit.courseId === operation.courseId)
  if (existing) existing.maxSections = Math.min(existing.maxSections, operation.maxSections)
  else limits.push({ courseId: operation.courseId, maxSections: operation.maxSections })
  return { ...teacher, sectionLimits: limits }
}

// ---------- §6.3 semantic rules (422 OBJECTION_INVALID) ----------
// context = { teacher: AcademicTeacherResource, assignments: Array<{ sectionId, courseId, teacherId, roomId }> } where
// assignments is the saved proposal's full list. Also usable to revalidate on confirm (422 OPERATION_STALE).
export function checkRoundObjection(objection, context) {
  validateAcademicRoundObjectionInput(objection)
  const { teacher, assignments } = context
  const held = assignments.filter((item) => item.teacherId === teacher.id)
  const heldSections = new Set(held.map((item) => item.sectionId))
  const fail = (message) => ({ ok: false, message })
  if (objection.sectionIds.some((id) => !heldSections.has(id))) return fail('Cada sección objetada debe pertenecer a las asignaciones actuales del docente')
  if (objection.kind === 'franja-no-disponible' && objection.intervals.some((item) => !insideAvailability(teacher.availability, item))) {
    return fail('Cada franja debe estar completamente dentro de la disponibilidad declarada del docente')
  }
  if (objection.kind === 'exceso-de-carga') {
    if (Object.hasOwn(objection.limit, 'maxWeeklyMinutes')) {
      if (objection.limit.maxWeeklyMinutes >= teacher.maxWeeklyMinutes) return fail('El máximo semanal debe ser menor al máximo actual del docente')
    } else {
      const { courseId, maxSections } = objection.limit
      const objected = new Set(held.filter((item) => objection.sectionIds.includes(item.sectionId)).map((item) => item.courseId))
      if (!teacher.courseIds.includes(courseId) || !objected.has(courseId)) return fail('El curso debe estar entre los cursos del docente y entre las secciones objetadas')
      const current = new Set(held.filter((item) => item.courseId === courseId).map((item) => item.sectionId)).size
      if (maxSections >= current) return fail('El máximo de secciones debe ser menor a las secciones actuales del docente en ese curso')
    }
  }
  if (objection.kind === 'aula-inadecuada') {
    const served = new Set(assignments.filter((item) => objection.sectionIds.includes(item.sectionId)).map((item) => item.roomId))
    if (objection.roomIds.some((id) => !served.has(id))) return fail('Cada aula debe atender al menos una sesión de las secciones objetadas')
  }
  return { ok: true, message: '' }
}

// ---------- §4 / §8 readiness ----------

// Teachers resolved by the school: a recorded resolution for the teacher's current fingerprint, and only once the round
// limit is reached (before it no resolution can exist, so the PA-DEMO-1 rule applies).
export function resolvedRoundTeacherIds(review, rounds) {
  if (!review || !rounds || review.round < rounds.profile.maxRounds.value) return []
  return review.teachers
    .filter((teacher) => teacher.status !== 'conformity'
      && rounds.resolutions.some((item) => item.teacherId === teacher.teacherId && item.fingerprint === teacher.fingerprint))
    .map((teacher) => teacher.teacherId)
}
// Single readiness rule shared by the five places in contract §8. `rounds` is undefined for legacy drafts.
export function isRoundReviewReady(review, rounds) {
  if (!review || !Array.isArray(review.teachers) || !review.teachers.length) return false
  const resolved = new Set(resolvedRoundTeacherIds(review, rounds))
  return review.teachers.every((teacher) => teacher.status === 'conformity' || resolved.has(teacher.teacherId))
}

// ---------- §9 persisted state ----------

function validateObjectionRecord(value, review, version) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !ROUND_OBJECTION_KINDS.includes(value.kind)) throw new TypeError('Objeción registrada inválida')
  const inputKeys = ['kind', 'sectionIds', ...kindKeys[value.kind]]
  object(value, [...inputKeys, 'id', 'round', 'teacherId', 'fingerprint', 'decisionVersion', 'operation', 'status', 'decidedVersion', 'decidedAt', 'reason', 'appliedVersion'], 'roundObjection')
  validateAcademicRoundObjectionInput(Object.fromEntries(inputKeys.map((key) => [key, value[key]])))
  integer(value.round, 'round', 1, review.round)
  text(value.teacherId, 'teacherId', 80)
  fingerprint(value.fingerprint, 'fingerprint')
  integer(value.decisionVersion, 'decisionVersion', 1, version)
  if (value.id !== `objection-${value.decisionVersion}`) throw new TypeError('Identificador de objeción inconsistente')
  validateOperation(value.operation)
  const input = Object.fromEntries(inputKeys.map((key) => [key, value[key]]))
  if (canonical(value.operation) !== canonical(mapRoundObjectionToOperation(input, value.teacherId))) throw new TypeError('Operación inconsistente con la objeción')
  if (!ROUND_OBJECTION_STATUSES.includes(value.status)) throw new TypeError('Estado de objeción inválido')
  if (typeof value.reason !== 'string' || value.reason.length > 500 || value.reason.trim() !== value.reason) throw new TypeError('Motivo inválido')
  const event = review.history.find((item) => item.type === 'decision' && item.decision === 'changes-requested' && item.teacherId === value.teacherId
    && item.version === value.decisionVersion && item.round === value.round && item.fingerprint === value.fingerprint)
  if (!event) throw new TypeError('La objeción no corresponde a una decisión registrada')
  const manual = value.operation.type === 'manual'
  if (manual !== (value.status === 'recorded') && value.status !== 'superseded') throw new TypeError('Estado incompatible con la operación')
  const decided = ['confirmed', 'rejected', 'applied'].includes(value.status)
  if (decided) {
    integer(value.decidedVersion, 'decidedVersion', value.decisionVersion, version)
    moment(value.decidedAt, 'decidedAt')
    if (value.status === 'rejected' && !value.reason) throw new TypeError('Rechazo sin motivo')
  } else if (value.decidedVersion !== null || value.decidedAt !== null) throw new TypeError('Decisión en una objeción no decidida')
  if (value.status === 'applied') integer(value.appliedVersion, 'appliedVersion', value.decidedVersion, version)
  else if (value.appliedVersion !== null) throw new TypeError('Versión de aplicación sin aplicar')
}

function validateRegenerationRecord(value, version) {
  object(value, ['version', 'at', 'fixedSectionIds', 'regeneratedSectionIds', 'appliedObjectionIds'], 'roundRegeneration')
  integer(value.version, 'version', 1, version)
  moment(value.at, 'at')
  for (const key of ['fixedSectionIds', 'regeneratedSectionIds', 'appliedObjectionIds']) uniqueTexts(value[key], key, 0, 1024)
}

// Structural checks of contract §9. Capacity overflow at write time is 429 ROUND_RECORD_LIMIT (server); here it is invalid.
export function validateAcademicRoundControl(value, review, version = Number.MAX_SAFE_INTEGER) {
  if (!review || typeof review !== 'object' || !Array.isArray(review.history) || !Array.isArray(review.teachers)) throw new TypeError('Las rondas requieren una revisión docente')
  object(value, ['revision', 'profile', 'legacyRounds', 'rounds', 'objections', 'regenerations', 'resolutions'], 'rounds')
  if (value.revision !== ROUNDS_REVISION) throw new TypeError('Revisión de rondas incompatible')
  validateAcademicRoundProfile(value.profile)
  integer(value.legacyRounds, 'legacyRounds', 0, ROUND_RECORD_LIMIT)

  const submitted = list(value.rounds, 'rounds', 0, ROUND_RECORD_LIMIT)
  if (submitted.length !== review.round - value.legacyRounds) throw new TypeError('Cantidad de rondas inconsistente con la revisión')
  submitted.forEach((item, index) => {
    object(item, ['round', 'submittedVersion', 'deadline'], 'roundEntry')
    if (item.round !== value.legacyRounds + index + 1) throw new TypeError('Rondas no consecutivas')
    integer(item.submittedVersion, 'submittedVersion', 1, version)
    if (item.deadline !== null && !isRoundDeadlineDate(item.deadline)) throw new TypeError('Plazo de ronda inválido')
    if (!review.history.some((event) => event.type === 'submitted' && event.round === item.round && event.version === item.submittedVersion)) throw new TypeError('La ronda no corresponde a un envío registrado')
  })

  const regenerations = list(value.regenerations, 'regenerations', 0, ROUND_RECORD_LIMIT)
  regenerations.forEach((item) => validateRegenerationRecord(item, version))
  if (new Set(regenerations.map((item) => item.version)).size !== regenerations.length) throw new TypeError('Regeneraciones repetidas')

  const objections = list(value.objections, 'objections', 0, ROUND_RECORD_LIMIT)
  objections.forEach((item) => validateObjectionRecord(item, review, version))
  if (new Set(objections.map((item) => item.id)).size !== objections.length) throw new TypeError('Objeciones repetidas')
  const active = new Set()
  for (const item of objections) {
    if (!['proposed', 'recorded'].includes(item.status)) continue
    const key = `${item.teacherId}|${item.round}`
    if (active.has(key)) throw new TypeError('Más de una objeción vigente para el mismo docente y ronda')
    active.add(key)
  }
  for (const item of objections) {
    if (item.status === 'applied' && !regenerations.some((entry) => entry.version === item.appliedVersion && entry.appliedObjectionIds.includes(item.id))) throw new TypeError('Objeción aplicada sin regeneración registrada')
  }
  for (const entry of regenerations) {
    if (entry.appliedObjectionIds.some((id) => !objections.some((item) => item.id === id && item.status === 'applied' && item.appliedVersion === entry.version))) throw new TypeError('Regeneración con objeciones no aplicadas')
  }

  const resolutions = list(value.resolutions, 'resolutions', 0, ROUND_RECORD_LIMIT)
  if (resolutions.length && review.round < value.profile.maxRounds.value) throw new TypeError('Resoluciones antes del límite de rondas')
  resolutions.forEach((item) => {
    object(item, ['teacherId', 'fingerprint', 'version', 'at', 'reason'], 'roundResolution')
    text(item.teacherId, 'teacherId', 80)
    fingerprint(item.fingerprint, 'fingerprint')
    integer(item.version, 'version', 1, version)
    moment(item.at, 'at')
    text(item.reason, 'reason', 500)
    if (!review.teachers.some((teacher) => teacher.teacherId === item.teacherId)) throw new TypeError('Resolución de un docente ajeno a la revisión')
  })
}
