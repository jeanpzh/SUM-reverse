import { PLANNING_LIMITS, isPlanningPeriod, validatePlanningPolicy } from './academic-planning-policy.mjs'
import { LOAD_AUTHORIZATION_KINDS, TEACHER_APPOINTMENTS, TEACHER_LOAD_CONDITIONS, TEACHER_REGIMES, LECTIVE_HOUR_MINUTES } from './academic-normative-profile.mjs'
/** PA-DEMO-1: independent local synthetic planning wire contract. */
export const ACADEMIC_REVISION = 'PA-DEMO-1'
export const ACADEMIC_ROUTE = '/local/programacion-academica'
export const ACADEMIC_API = '/api/local/programacion-academica/v1'
const demandSources = ['existing-regular-v1', 'independent-120-v1']
const draftStates = ['draft', 'ready-for-review', 'in-review', 'ready-for-approval', 'approved', 'published']
function draftId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) throw new TypeError('Identificador de propuesta guardada inválido')
}
function draftTitle(value) {
  string(value, 'title')
  if (value.length > 100 || value.trim() !== value) throw new TypeError('Nombre de propuesta: 1–100 caracteres sin espacios en extremos')
}
function draftDates(value) {
  for (const key of ['createdAt', 'updatedAt']) {
    string(value[key], key)
    if (!Number.isFinite(Date.parse(value[key]))) throw new TypeError('Fecha de propuesta guardada inválida')
  }
  if (Date.parse(value.updatedAt) < Date.parse(value.createdAt)) throw new TypeError('Fechas de propuesta guardada inconsistentes')
}
function validateLectiveDuration(value) {
  if (Object.hasOwn(value, 'lectiveHourMinutes') && !LECTIVE_HOUR_MINUTES.includes(value.lectiveHourMinutes)) throw new TypeError('lectiveHourMinutes: duración inválida')
}
export function validateAcademicWorkspace(value) {
  object(value, ['schoolId', 'academicPeriod', 'request', 'demandSourceId', 'demandBaseRequest'], 'workspace', ['lectiveHourMinutes'])
  validateLectiveDuration(value)
  if (value.schoolId !== 'SISTEMAS' || !isPlanningPeriod(value.academicPeriod) || !demandSources.includes(value.demandSourceId)) throw new TypeError('Ámbito local de propuesta no admitido')
  validateAcademicRequest(value.request)
  if (value.request.academicPeriod !== undefined && value.request.academicPeriod !== value.academicPeriod) throw new TypeError('El periodo de solicitud no corresponde al borrador')
  if (value.request.lectiveHourMinutes !== undefined && value.request.lectiveHourMinutes !== value.lectiveHourMinutes) throw new TypeError('La duración lectiva no corresponde al borrador')
  if (value.request.planningPolicy && value.request.planningPolicy.period !== value.academicPeriod) throw new TypeError('El periodo de política no corresponde al borrador')
  if (!value.request.resources) throw new TypeError('Guardar requiere configuración explícita de docentes y ambientes')
  if (value.demandBaseRequest !== null) {
    validateAcademicDemandRequest(value.demandBaseRequest)
    const base = value.demandBaseRequest
    if (base.sourceId !== value.demandSourceId || base.targetPeriod !== value.academicPeriod || base.revision !== value.request.revision
      || base.courses.length !== value.request.demands.length
      || base.courses.some((course) => !value.request.demands.some((demand) => demand.courseId === course.courseId && demand.targetCapacity === course.targetCapacity))) throw new TypeError('La base de demanda no corresponde a la configuración actual')
  }
}
export function validateAcademicDraftSaveRequest(value) {
  object(value, ['id', 'expectedVersion', 'title', 'state', 'configuration', 'proposalId', 'proposalEditVersion'], 'draftSave')
  draftTitle(value.title)
  if (!['draft', 'ready-for-review'].includes(value.state)) throw new TypeError('El estado de revisión lo calcula el servidor')
  if (value.id === null) { if (value.expectedVersion !== null) throw new TypeError('Una propuesta nueva no tiene versión anterior') }
  else { draftId(value.id); number(value.expectedVersion, 'expectedVersion', 1) }
  if (value.proposalId === null) { if (value.proposalEditVersion !== null) throw new TypeError('Versión de horario sin horario') }
  else { string(value.proposalId, 'proposalId'); number(value.proposalEditVersion, 'proposalEditVersion') }
  validateAcademicWorkspace(value.configuration)
  if (value.state === 'ready-for-review' && value.proposalId === null) throw new TypeError('Lista para revisión requiere horario completo')
}
export function validateAcademicSavedDraft(value) {
  object(value, ['id', 'version', 'title', 'state', 'createdAt', 'updatedAt', 'configuration', 'demandBase', 'proposal'], 'savedDraft', ['review', 'approval', 'publication', 'origin'])
  draftId(value.id)
  number(value.version, 'version', 1)
  draftTitle(value.title)
  draftDates(value)
  if (!draftStates.includes(value.state)) throw new TypeError('Estado de borrador inválido')
  validateAcademicWorkspace(value.configuration)
  const baseRequest = value.configuration.demandBaseRequest
  if ((value.demandBase === null) !== (baseRequest === null)) throw new TypeError('Base guardada incompleta')
  if (value.demandBase !== null) {
    validateAcademicDemandEstimate(value.demandBase)
    if (value.demandBase.source.id !== baseRequest.sourceId || value.demandBase.source.targetPeriod !== baseRequest.targetPeriod
      || value.demandBase.rows.length !== baseRequest.courses.length
      || value.demandBase.rows.some((row) => !baseRequest.courses.some((course) => course.courseId === row.courseId && course.targetCapacity === row.targetCapacity))) throw new TypeError('Base guardada no corresponde a su solicitud')
  }
  if (value.proposal !== null) validateAcademicProposal(value.proposal)
  if (value.review !== undefined) validateAcademicTeacherReview(value.review, value.version)
  if (['in-review', 'ready-for-approval', 'approved', 'published'].includes(value.state) && !value.review) throw new TypeError('Estado de revisión sin revisión')
  if (['ready-for-approval', 'approved', 'published'].includes(value.state) && (!value.proposal || value.proposal.status !== 'complete' || !value.proposal.coverageComplete || !value.proposal.assignments.length || !value.review.teachers.length || value.review.teachers.some((teacher) => teacher.status !== 'conformity'))) throw new TypeError('Faltan conformidades vigentes')
  if (['ready-for-review', 'in-review', 'ready-for-approval', 'approved', 'published'].includes(value.state) && (value.proposal === null || value.proposal.status !== 'complete' || !value.proposal.coverageComplete || value.proposal.assignments.length === 0)) throw new TypeError('La revisión requiere cobertura completa y no vacía')
  if (['approved', 'published'].includes(value.state) !== (value.approval !== undefined)) throw new TypeError('Aprobación y estado incompatibles')
  if (value.approval !== undefined) {
    object(value.approval, ['sourceVersion', 'approvedVersion', 'approvedAt', 'fingerprint'], 'approval')
    number(value.approval.sourceVersion, 'sourceVersion', 1); number(value.approval.approvedVersion, 'approvedVersion', 2)
    if (value.approval.approvedVersion !== value.approval.sourceVersion + 1 || value.version !== value.approval.approvedVersion + (value.state === 'published' ? 1 : 0)
      || typeof value.approval.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(value.approval.fingerprint)) throw new TypeError('Versión de aprobación inválida')
    releaseDate(value.approval.approvedAt)
    validateAcademicTeacherReview(value.review, value.approval.sourceVersion)
  }
  if ((value.state === 'published') !== (value.publication !== undefined)) throw new TypeError('Publicación y estado incompatibles')
  if (value.publication !== undefined) {
    object(value.publication, ['publicationVersion', 'publishedAt'], 'publication')
    number(value.publication.publicationVersion, 'publicationVersion', 1); releaseDate(value.publication.publishedAt)
    if (Date.parse(value.publication.publishedAt) < Date.parse(value.approval.approvedAt)) throw new TypeError('Publicación anterior a aprobación')
  }
  if (value.origin !== undefined) {
    object(value.origin, ['draftId', 'version', 'publicationVersion'], 'origin')
    draftId(value.origin.draftId); number(value.origin.version, 'originVersion', 1)
    if (value.origin.draftId === value.id) throw new TypeError('Origen circular')
    if (value.origin.publicationVersion !== null) number(value.origin.publicationVersion, 'publicationVersion', 1)
  }
}
export function validateAcademicDraftList(value) {
  object(value, ['items', 'unavailableCount'], 'draftList')
  number(value.unavailableCount, 'unavailableCount', 0, 1000)
  const ids = new Set()
  array(value.items, 'items', 50).forEach((item) => {
    object(item, ['id', 'version', 'title', 'state', 'schoolId', 'academicPeriod', 'createdAt', 'updatedAt', 'hasSchedule'], 'draftSummary')
    draftId(item.id)
    number(item.version, 'version', 1)
    draftTitle(item.title)
    draftDates(item)
    if (ids.has(item.id) || !draftStates.includes(item.state) || item.schoolId !== 'SISTEMAS' || !isPlanningPeriod(item.academicPeriod)
      || typeof item.hasSchedule !== 'boolean' || (['ready-for-review', 'ready-for-approval', 'approved', 'published'].includes(item.state) && !item.hasSchedule)) throw new TypeError('Resumen de propuesta inválido')
    ids.add(item.id)
  })
}
export function validateAcademicDraftResume(value) {
  object(value, ['draft'], 'draftResume')
  validateAcademicSavedDraft(value.draft)
}

function releaseDate(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new TypeError('Fecha académica inválida')
}
export function validateAcademicPublicationRequest(value) {
  object(value, ['expectedVersion', 'expectedCurrentId'], 'publicationRequest')
  number(value.expectedVersion, 'expectedVersion', 1)
  if (value.expectedCurrentId !== null) draftId(value.expectedCurrentId)
}
export function validateAcademicScheduleSnapshot(value) {
  object(value, ['schoolId', 'academicPeriod', 'courses', 'sections', 'assignments'], 'scheduleSnapshot')
  if (value.schoolId !== 'SISTEMAS' || !isPlanningPeriod(value.academicPeriod)) throw new TypeError('Ámbito de publicación no admitido')
  const courses = new Map()
  array(value.courses, 'publishedCourses', 256).forEach((course) => {
    object(course, ['courseId', 'name', 'cycle', 'credits'], 'publishedCourse')
    string(course.courseId, 'courseId'); string(course.name, 'courseName')
    number(course.cycle, 'cycle', 1, 10); number(course.credits, 'credits', 0, 100)
    if (courses.has(course.courseId)) throw new TypeError('Asignatura publicada duplicada')
    courses.set(course.courseId, course.name)
  })
  if (!Array.isArray(value.assignments) || !value.assignments.length || !Array.isArray(value.sections) || !value.sections.length) throw new TypeError('Publicación vacía')
  validateAcademicProposal({ proposalId: 'published-readonly', createdAt: '2000-01-01T00:00:00Z', expiresAt: '2000-01-01T00:15:00Z',
    status: 'complete', sections: value.sections, assignments: value.assignments, pending: [], diagnostics: [], coverageComplete: true,
    counts: { sections: value.sections.length, requiredSessions: value.assignments.length, scheduledSessions: value.assignments.length },
    stats: { exploredCandidates: 0, candidateVisits: 0, backtracks: 0, limitReason: null } })
  if (new Set(value.sections.map((s) => s.courseId)).size !== courses.size
    || value.sections.some((s) => courses.get(s.courseId) !== s.courseName)
    || value.assignments.some((a) => courses.get(a.courseId) !== a.courseName)) throw new TypeError('Catálogo y horario publicado inconsistentes')
}
export function validateAcademicReleasePreview(value) {
  object(value, ['id', 'version', 'title', 'state', 'schedule'], 'releasePreview')
  draftId(value.id); number(value.version, 'version', 1); draftTitle(value.title)
  if (!draftStates.includes(value.state)) throw new TypeError('Estado de vista previa inválido')
  validateAcademicScheduleSnapshot(value.schedule)
}
function validatePublicationSummary(value) {
  draftId(value.id); number(value.publicationVersion, 'publicationVersion', 1); draftTitle(value.title)
  number(value.sourceProposalVersion, 'sourceProposalVersion', 1); number(value.approvedVersion, 'approvedVersion', 2)
  releaseDate(value.approvedAt); releaseDate(value.publishedAt)
  if (value.approvedVersion !== value.sourceProposalVersion + 1 || Date.parse(value.publishedAt) < Date.parse(value.approvedAt)) throw new TypeError('Versión publicada inconsistente')
}
export function validateAcademicPublication(value) {
  object(value, ['revision', 'id', 'publicationVersion', 'title', 'sourceProposalVersion', 'approvedVersion', 'approvedAt', 'publishedAt', 'schedule'], 'publishedSchedule')
  if (value.revision !== 'PA-PUBLICATION-1') throw new TypeError('Contrato de publicación desconocido')
  validatePublicationSummary(value)
  validateAcademicScheduleSnapshot(value.schedule)
}
export function validateAcademicPublicationList(value) {
  object(value, ['currentId', 'items'], 'publicationList')
  if (value.currentId !== null) draftId(value.currentId)
  const ids = new Set(), versions = new Set()
  array(value.items, 'publications', 50).forEach((item) => {
    object(item, ['id', 'publicationVersion', 'title', 'sourceProposalVersion', 'approvedVersion', 'approvedAt', 'publishedAt'], 'publicationSummary')
    validatePublicationSummary(item)
    if (ids.has(item.id) || versions.has(item.publicationVersion)) throw new TypeError('Versión publicada duplicada')
    ids.add(item.id); versions.add(item.publicationVersion)
  })
  const latest = [...value.items].sort((a, b) => b.publicationVersion - a.publicationVersion)[0]
  if (value.currentId !== (latest?.id ?? null)) throw new TypeError('Versión vigente inconsistente')
}

export function validateAcademicReviewSubmission(value) {
  object(value, ['expectedVersion'], 'reviewSubmission')
  number(value.expectedVersion, 'expectedVersion', 1)
}
export function validateAcademicReviewDecision(value) {
  object(value, ['expectedVersion', 'round', 'teacherId', 'decision', 'observation'], 'reviewDecision')
  number(value.expectedVersion, 'expectedVersion', 1)
  number(value.round, 'round', 1)
  string(value.teacherId, 'teacherId')
  if (!['conformity', 'changes-requested'].includes(value.decision) || typeof value.observation !== 'string' || value.observation.length > 1000 || value.observation.trim() !== value.observation || (value.decision === 'changes-requested' && !value.observation)) throw new TypeError('Decisión u observación inválida')
}
export function validateAcademicTeacherReview(value, version = Number.MAX_SAFE_INTEGER) {
  object(value, ['round', 'submittedVersion', 'submittedAt', 'teachers', 'history'], 'teacherReview')
  number(value.round, 'round', 1)
  number(value.submittedVersion, 'submittedVersion', 1, version)
  const date = (v) => { if (typeof v !== 'string' || !Number.isFinite(Date.parse(v))) throw new TypeError('Fecha de revisión inválida') }
  const fingerprint = (v) => { if (typeof v !== 'string' || !/^[a-f0-9]{64}$/.test(v)) throw new TypeError('Huella de revisión inválida') }
  date(value.submittedAt)
  const ids = new Set()
  array(value.teachers, 'reviewTeachers', 200).forEach((teacher) => {
    object(teacher, ['teacherId', 'teacherName', 'fingerprint', 'status', 'observation', 'decisionVersion', 'decidedAt'], 'reviewTeacher')
    string(teacher.teacherId, 'teacherId'); string(teacher.teacherName, 'teacherName'); fingerprint(teacher.fingerprint)
    if (ids.has(teacher.teacherId) || !['pending', 'conformity', 'changes-requested', 'outdated'].includes(teacher.status) || typeof teacher.observation !== 'string' || teacher.observation.length > 1000) throw new TypeError('Respuesta docente inválida')
    ids.add(teacher.teacherId)
    if (teacher.decisionVersion !== null) { number(teacher.decisionVersion, 'decisionVersion', 1, version); date(teacher.decidedAt) }
    else if (teacher.decidedAt !== null) throw new TypeError('Fecha sin decisión')
    if (['conformity', 'changes-requested'].includes(teacher.status) && teacher.decisionVersion === null) throw new TypeError('Decisión sin versión')
    if (teacher.status === 'changes-requested' && !teacher.observation.trim()) throw new TypeError('Observación requerida')
  })
  array(value.history, 'reviewHistory', 200).forEach((event) => {
    object(event, ['type', 'version', 'round', 'at', 'teacherId', 'decision', 'observation', 'fingerprint'], 'reviewEvent')
    if (!['submitted', 'decision', 'invalidated'].includes(event.type)) throw new TypeError('Evento inválido')
    number(event.version, 'version', 1, version); number(event.round, 'round', 1, value.round); date(event.at)
    if (typeof event.observation !== 'string' || event.observation.length > 1000) throw new TypeError('Observación inválida')
    if (event.type === 'submitted') { if (event.teacherId !== null || event.decision !== null || event.fingerprint !== null) throw new TypeError('Envío inválido') }
    else { string(event.teacherId, 'teacherId'); fingerprint(event.fingerprint); if (event.type === 'decision' ? !['conformity', 'changes-requested'].includes(event.decision) : event.decision !== null) throw new TypeError('Evento docente inválido') }
  })
  if (!value.history.length) throw new TypeError('Historial requerido')
}
const states = ['complete', 'impossible', 'search-limit', 'invalid-input']
function object(value, keys, path, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${path}: objeto requerido`)
  if (keys.some((key) => !Object.hasOwn(value, key)) || Object.keys(value).some((key) => !keys.includes(key) && !optional.includes(key))) throw new TypeError(`${path}: campos inválidos`)
  return value
}
function string(value, path) {
  if (typeof value !== 'string' || !value.length || value.length > 2048) throw new TypeError(`${path}: texto inválido`)
}
function number(value, path, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new TypeError(`${path}: entero inválido`)
}
function array(value, path, max = PLANNING_LIMITS.sessions) {
  if (!Array.isArray(value) || value.length > max || Array.from(value).some((item) => item === undefined)) throw new TypeError(`${path}: lista inválida`)
  return value
}
function strings(value, path) { array(value, path).forEach((item) => string(item, path)) }
function interval(value) {
  object(value, ['day', 'startMinute', 'endMinute'], 'interval')
  number(value.day, 'day', 1, 7)
  number(value.startMinute, 'startMinute', 0, 1439)
  number(value.endMinute, 'endMinute', value.startMinute + 1, 1440)
}
export function validateAcademicDemandRequest(value) {
  object(value, ['revision', 'sourceId', 'targetPeriod', 'courses'], 'demandRequest')
  string(value.revision, 'revision')
  if (!demandSources.includes(value.sourceId) || value.targetPeriod !== '2027-I') throw new TypeError('Fuente o periodo de demanda no admitido')
  const ids = new Set()
  array(value.courses, 'courses', 32).forEach((row) => {
    object(row, ['courseId', 'targetCapacity'], 'demandCourse')
    resourceId(row.courseId)
    number(row.targetCapacity, 'targetCapacity', 1)
    if (ids.has(row.courseId)) throw new TypeError('Curso duplicado en estimación')
    ids.add(row.courseId)
  })
}
export function validateAcademicDemandEstimate(value) {
  object(value, ['revision', 'source', 'rows'], 'demandEstimate')
  if (value.revision !== ACADEMIC_REVISION) throw new TypeError('Revisión de estimación incompatible')
  const source = value.source
  object(source, ['id', 'label', 'revision', 'kind', 'targetPeriod', 'cutoffPeriod', 'schoolId', 'planId', 'populationSize', 'recordCount', 'duplicateRecords', 'reference', 'limitations'], 'demandSource')
  if (!demandSources.includes(source.id) || source.kind !== 'synthetic' || source.targetPeriod !== '2027-I'
    || source.cutoffPeriod !== '2026-1' || source.schoolId !== 'SISTEMAS' || source.planId !== 'SYN-SIS-PLAN') throw new TypeError('Procedencia de demanda inválida')
  for (const field of ['label', 'revision', 'reference']) string(source[field], field)
  for (const field of ['populationSize', 'recordCount', 'duplicateRecords']) number(source[field], field, 0, 1000)
  if (source.recordCount !== source.populationSize + source.duplicateRecords) throw new TypeError('Población inconsistente')
  array(source.limitations, 'limitations', 32).forEach((item) => string(item, 'limitation'))
  if (!source.limitations.length) throw new TypeError('Faltan limitaciones de la estimación')
  const ids = new Set()
  array(value.rows, 'rows', 32).forEach((row) => {
    object(row, ['courseId', 'eligible', 'retakeEligible', 'nonEligible', 'insufficient', 'baseDemand', 'targetCapacity', 'suggestedSections', 'reasons'], 'demandRow')
    resourceId(row.courseId)
    if (ids.has(row.courseId)) throw new TypeError('Curso duplicado en estimación')
    ids.add(row.courseId)
    for (const field of ['eligible', 'retakeEligible', 'nonEligible', 'insufficient', 'baseDemand']) number(row[field], field, 0, source.populationSize)
    number(row.targetCapacity, 'targetCapacity', 1)
    number(row.suggestedSections, 'suggestedSections', 0, source.populationSize)
    if (row.eligible + row.nonEligible + row.insufficient !== source.populationSize || row.retakeEligible > row.eligible
      || row.baseDemand !== row.eligible || row.suggestedSections !== Math.ceil(row.baseDemand / row.targetCapacity)) throw new TypeError('Conteos de demanda inconsistentes')
    const seen = new Set()
    const counts = { 'non-eligible': 0, insufficient: 0 }
    array(row.reasons, 'reasons', 32).forEach((reason) => {
      object(reason, ['category', 'code', 'message', 'count'], 'reason')
      if (!['non-eligible', 'insufficient'].includes(reason.category)) throw new TypeError('Categoría de motivo inválida')
      string(reason.code, 'code')
      string(reason.message, 'message')
      number(reason.count, 'count', 1, source.populationSize)
      const key = `${reason.category}:${reason.code}`
      if (seen.has(key)) throw new TypeError('Motivo repetido')
      seen.add(key)
      counts[reason.category] += reason.count
    })
    if (counts['non-eligible'] !== row.nonEligible || counts.insufficient !== row.insufficient) throw new TypeError('Motivos inconsistentes')
  })
}
/** F-0: per-section capacity override. The ordinal is bounded by the computed section count when the demand carries its own targetCapacity; otherwise the service checks it against the catalog default. */
function sectionCapacities(row) {
  const entries = array(row.sectionCapacities, 'sectionCapacities', 32)
  const ordinals = new Set()
  const count = Object.hasOwn(row, 'targetCapacity') ? Math.ceil(row.estimatedDemand / row.targetCapacity) : Number.MAX_SAFE_INTEGER
  entries.forEach((entry) => {
    object(entry, ['ordinal', 'capacity'], 'sectionCapacity')
    number(entry.ordinal, 'sectionCapacity.ordinal', 1, count)
    number(entry.capacity, 'sectionCapacity.capacity', 1, 1000)
    if (ordinals.has(entry.ordinal)) throw new TypeError('sectionCapacity.ordinal: repetido')
    ordinals.add(entry.ordinal)
  })
}
export function validateAcademicRequest(value) {
  object(value, ['revision', 'demands'], 'request', ['resources', 'allocationPolicy', 'planningPolicy', 'academicPeriod', 'lectiveHourMinutes'])
  validateLectiveDuration(value)
  if (Object.hasOwn(value, 'academicPeriod') && !isPlanningPeriod(value.academicPeriod)) throw new TypeError('academicPeriod: periodo inválido')
  if (value.academicPeriod && value.planningPolicy && value.academicPeriod !== value.planningPolicy.period) throw new TypeError('El periodo de política no corresponde a la solicitud')
  if (Object.hasOwn(value, 'planningPolicy')) validatePlanningPolicy(value.planningPolicy)
  if (Object.hasOwn(value, 'allocationPolicy') && !['preferences', 'balanced', 'first-feasible'].includes(value.allocationPolicy)) throw new TypeError('Política docente inválida')
  if (Object.hasOwn(value, 'resources')) validateAcademicResources(value.resources)
  string(value.revision, 'revision')
  const seen = new Set()
  array(value.demands, 'demands', PLANNING_LIMITS.courses).forEach((row) => {
    object(row, ['courseId', 'estimatedDemand'], 'demand', ['targetCapacity', 'patternId', 'deliveryMode', 'sectionCapacities'])
    if (Object.hasOwn(row, 'deliveryMode') && !['continuous', 'split'].includes(row.deliveryMode)) throw new TypeError('Modalidad de sección inválida')
    string(row.courseId, 'courseId')
    number(row.estimatedDemand, 'estimatedDemand')
    if (Object.hasOwn(row, 'targetCapacity')) number(row.targetCapacity, 'targetCapacity', 1)
    if (Object.hasOwn(row, 'patternId')) string(row.patternId, 'patternId')
    if (Object.hasOwn(row, 'sectionCapacities')) sectionCapacities(row)
    if (seen.has(row.courseId)) throw new TypeError('courseId: repetido')
    seen.add(row.courseId)
  })
}
function resourceId(value) {
  string(value, 'resource.id')
  if (value.length > 80 || value.trim() !== value) throw new TypeError('Identificación de recurso inválida')
}
// Optional teaching-load fields read by the Perfil normativo (academic-normative-profile.mjs). The regulation itself lives there.
export function validateTeacherLoadFields(row) {
  if (Object.hasOwn(row, 'regime') && !TEACHER_REGIMES.includes(row.regime)) throw new TypeError('Régimen docente inválido')
  if (Object.hasOwn(row, 'appointment') && !TEACHER_APPOINTMENTS.includes(row.appointment)) throw new TypeError('Nombramiento docente inválido')
  if (Object.hasOwn(row, 'weeklyServiceHours')) number(row.weeklyServiceHours, 'weeklyServiceHours', 1, 39)
  if (Object.hasOwn(row, 'loadConditions')) {
    array(row.loadConditions, 'loadConditions', TEACHER_LOAD_CONDITIONS.length)
    if (row.loadConditions.some((item) => !TEACHER_LOAD_CONDITIONS.includes(item)) || new Set(row.loadConditions).size !== row.loadConditions.length) throw new TypeError('Condición de carga docente inválida')
  }
  if (Object.hasOwn(row, 'loadAuthorizations')) {
    array(row.loadAuthorizations, 'loadAuthorizations', 16).forEach((item) => {
      object(item, ['kind', 'reference'], 'loadAuthorization', ['maxLectiveHours'])
      if (!LOAD_AUTHORIZATION_KINDS.includes(item.kind)) throw new TypeError('Tipo de autorización de carga inválido')
      string(item.reference, 'loadAuthorization.reference')
      if (!item.reference.trim()) throw new TypeError('Referencia de autorización requerida')
      if (item.kind === 'vrap-authorization') number(item.maxLectiveHours, 'loadAuthorization.maxLectiveHours', 1, 168)
      else if (Object.hasOwn(item, 'maxLectiveHours')) throw new TypeError('Solo la autorización de la VRAP indica horas máximas')
    })
  }
}
function teacherResource(row) {
  object(row, ['id', 'name', 'courseIds', 'maxWeeklyMinutes', 'availability'], 'teacher', ['preferences', 'sectionLimits', 'facultyId', 'category', 'qualificationSource', 'regime', 'appointment', 'weeklyServiceHours', 'loadConditions', 'loadAuthorizations'])
  resourceId(row.id)
  if (Object.hasOwn(row, 'facultyId')) resourceId(row.facultyId)
  if (Object.hasOwn(row, 'category') && !['principal', 'asociado', 'auxiliar'].includes(row.category)) throw new TypeError('Categoría docente inválida')
  if (Object.hasOwn(row, 'qualificationSource') && row.qualificationSource !== 'synthetic') throw new TypeError('Procedencia docente inválida')
  validateTeacherLoadFields(row)
  string(row.name, 'teacher.name')
  if (!row.name.trim()) throw new TypeError('Nombre de docente requerido')
  strings(row.courseIds, 'courseIds')
  if (new Set(row.courseIds).size !== row.courseIds.length) throw new TypeError('Habilitación de curso repetida')
  number(row.maxWeeklyMinutes, 'maxWeeklyMinutes', 0, 10080)
  array(row.availability, 'availability', 32).forEach(interval)
  if (Object.hasOwn(row, 'preferences')) array(row.preferences, 'preferences', 32).forEach(interval)
  if (Object.hasOwn(row, 'sectionLimits')) {
    const limits = new Set()
    array(row.sectionLimits, 'sectionLimits', 128).forEach((limit) => {
      object(limit, ['courseId', 'maxSections'], 'sectionLimit')
      string(limit.courseId, 'sectionLimit.courseId')
      number(limit.maxSections, 'sectionLimit.maxSections', 0, 128)
      if (limits.has(limit.courseId)) throw new TypeError('Límite de secciones repetido')
      limits.add(limit.courseId)
    })
  }
}
function roomResource(row) {
  object(row, ['id', 'name', 'capacity', 'availability'], 'room', ['kind'])
  resourceId(row.id)
  string(row.name, 'room.name')
  if (!row.name.trim()) throw new TypeError('Nombre de aula requerido')
  number(row.capacity, 'capacity', 1)
  array(row.availability, 'availability', 32).forEach(interval)
  if (Object.hasOwn(row, 'kind') && !['classroom', 'laboratory'].includes(row.kind)) throw new TypeError('Tipo de aula inválido')
}
export function validateAcademicResources(value) {
  object(value, ['teachers', 'rooms'], 'resources')
  for (const [key, validate] of [['teachers', teacherResource], ['rooms', roomResource]]) {
    const ids = new Set()
    array(value[key], key, PLANNING_LIMITS[key]).forEach((row) => {
      validate(row)
      if (ids.has(row.id)) throw new TypeError(`${key}: identificación repetida`)
      ids.add(row.id)
    })
  }
}
export function validateAcademicCatalog(value) {
  object(value, ['revision', 'courses', 'teachers', 'rooms', 'windows', 'startStepMinutes', 'maxExplorations'], 'catalog', ['source', 'referenceTeachers', 'referenceRooms'])
  if (Object.hasOwn(value, 'source')) {
    object(value.source, ['kind', 'reference', 'sourcePeriod', 'planningPeriod', 'assumptions'], 'source')
    for (const key of Object.keys(value.source)) string(value.source[key], `source.${key}`)
  }
  if (value.revision !== ACADEMIC_REVISION) throw new TypeError('Revisión de catálogo incompatible')
  const courseIds = new Set()
  array(value.courses, 'courses', 256).forEach((row) => {
    object(row, ['courseId', 'name', 'estimatedDemand', 'targetCapacity', 'weeklySessions'], 'course', ['cycle', 'credits', 'history', 'planningPatterns'])
    string(row.courseId, 'courseId')
    string(row.name, 'name')
    if (courseIds.has(row.courseId)) throw new TypeError('Catálogo: curso repetido')
    courseIds.add(row.courseId)
    if (Object.hasOwn(row, 'cycle')) number(row.cycle, 'cycle')
    if (Object.hasOwn(row, 'credits')) number(row.credits, 'credits')
    if (Object.hasOwn(row, 'history')) {
      object(row.history, ['sections'], 'history')
      array(row.history.sections, 'history.sections', 256).forEach((section) => {
        object(section, ['sectionId', 'capacity', 'sessions'], 'history.section')
        string(section.sectionId, 'history.sectionId')
        number(section.capacity, 'history.capacity')
        array(section.sessions, 'history.sessions').forEach((session) => {
          object(session, ['day', 'startMinute', 'endMinute', 'room', 'teacherId', 'type'], 'history.session', ['teacherName'])
          if (Object.hasOwn(session, 'teacherName')) string(session.teacherName, 'teacherName')
          interval({ day: session.day, startMinute: session.startMinute, endMinute: session.endMinute })
          for (const key of ['room', 'teacherId', 'type']) string(session[key], key)
        })
      })
    }
    if (Object.hasOwn(row, 'planningPatterns')) {
      const patternIds = new Set()
      array(row.planningPatterns, 'planningPatterns').forEach((pattern) => {
        object(pattern, ['id', 'label', 'weeklySessions'], 'pattern')
        string(pattern.id, 'pattern.id')
        string(pattern.label, 'pattern.label')
        if (patternIds.has(pattern.id)) throw new TypeError('Patrón repetido')
        patternIds.add(pattern.id)
        if (!array(pattern.weeklySessions, 'pattern.weeklySessions').length) throw new TypeError('Patrón sin sesiones')
        pattern.weeklySessions.forEach((session) => {
          object(session, ['id', 'durationMinutes'], 'pattern.session', ['type'])
          if (Object.hasOwn(session, 'type')) string(session.type, 'session.type')
          string(session.id, 'session.id')
          number(session.durationMinutes, 'durationMinutes', 1, 1440)
        })
      })
    }
    number(row.estimatedDemand, 'estimatedDemand')
    number(row.targetCapacity, 'targetCapacity', 1)
    array(row.weeklySessions, 'weeklySessions').forEach((session) => {
      object(session, ['id', 'durationMinutes'], 'session', ['type'])
      if (Object.hasOwn(session, 'type')) string(session.type, 'session.type')
      string(session.id, 'session.id')
      number(session.durationMinutes, 'durationMinutes', 1, 1440)
    })
    if (!row.weeklySessions.length) throw new TypeError('Sesiones semanales requeridas')
  })
  if (Object.hasOwn(value, 'referenceTeachers')) {
    const ids = new Set()
    array(value.referenceTeachers, 'referenceTeachers', 256).forEach((row) => {
      object(row, ['id', 'name', 'courseIds'], 'referenceTeacher')
      resourceId(row.id)
      string(row.name, 'referenceTeacher.name')
      strings(row.courseIds, 'referenceTeacher.courseIds')
      if (ids.has(row.id) || row.courseIds.some((id) => !courseIds.has(id))) throw new TypeError('Docente de referencia inválido')
      ids.add(row.id)
    })
  }
  if (Object.hasOwn(value, 'referenceRooms')) {
    const ids = new Set()
    array(value.referenceRooms, 'referenceRooms', 64).forEach((row) => {
      object(row, ['id', 'name', 'capacity', 'kind', 'pavilion'], 'referenceRoom')
      roomResource({ id: row.id, name: row.name, capacity: row.capacity, kind: row.kind, availability: [] })
      if (!['AP', 'NP'].includes(row.pavilion) || ids.has(row.id)) throw new TypeError('Ambiente de referencia inválido')
      ids.add(row.id)
    })
  }
  array(value.teachers, 'teachers', 256).forEach(teacherResource)
  array(value.rooms, 'rooms', 32).forEach(roomResource)
  array(value.windows, 'windows', 32).forEach(interval)
  number(value.startStepMinutes, 'startStepMinutes', 1, 1440)
  number(value.maxExplorations, 'maxExplorations', 0, 100000)
}
export function validateAcademicProposal(value) {
  object(value, ['proposalId', 'createdAt', 'expiresAt', 'status', 'sections', 'assignments', 'pending', 'diagnostics', 'coverageComplete', 'counts', 'stats'], 'proposal', ['preferenceReport', 'editVersion', 'manuallyAdjustedSectionIds', 'coverageProof', 'capacityCertificate', 'decisions', 'prelation', 'normative'])
  validateProposalNormativeResult(value)
  string(value.proposalId, 'proposalId')
  for (const field of ['createdAt', 'expiresAt']) {
    string(value[field], field)
    if (!Number.isFinite(Date.parse(value[field]))) throw new TypeError(`${field}: fecha inválida`)
  }
  if (!states.includes(value.status) || typeof value.coverageComplete !== 'boolean') throw new TypeError('Estado de propuesta inválido')
  array(value.sections, 'sections').forEach((row) => {
    object(row, ['sectionId', 'courseId', 'courseName', 'capacity'], 'section', ['deliveryMode'])
    if (Object.hasOwn(row, 'deliveryMode') && !['continuous', 'split'].includes(row.deliveryMode)) throw new TypeError('Modalidad de sección inválida')
    for (const field of ['sectionId', 'courseId', 'courseName']) string(row[field], field)
    number(row.capacity, 'capacity', 1)
  })
  if (Object.hasOwn(value, 'editVersion') !== Object.hasOwn(value, 'manuallyAdjustedSectionIds')) throw new TypeError('Metadatos de revisión incompletos')
  if (Object.hasOwn(value, 'editVersion')) {
    number(value.editVersion, 'editVersion')
    strings(value.manuallyAdjustedSectionIds, 'manuallyAdjustedSectionIds')
    if (new Set(value.manuallyAdjustedSectionIds).size !== value.manuallyAdjustedSectionIds.length
      || value.manuallyAdjustedSectionIds.some((id) => !value.sections.some((section) => section.sectionId === id))
      || value.editVersion < value.manuallyAdjustedSectionIds.length
      || (value.editVersion > 0 && !value.manuallyAdjustedSectionIds.length)) throw new TypeError('Secciones ajustadas inválidas')
  }
  array(value.assignments, 'assignments').forEach((row) => {
    object(row, ['sessionId', 'sectionId', 'courseId', 'courseName', 'teacherId', 'teacherName', 'roomId', 'roomName', 'day', 'startMinute', 'endMinute'], 'assignment', ['sessionType'])
    if (Object.hasOwn(row, 'sessionType')) string(row.sessionType, 'sessionType')
    for (const field of ['sessionId', 'sectionId', 'courseId', 'courseName', 'teacherId', 'teacherName', 'roomId', 'roomName']) string(row[field], field)
    interval({ day: row.day, startMinute: row.startMinute, endMinute: row.endMinute })
    if (!value.sections.some((section) => section.sectionId === row.sectionId && section.courseId === row.courseId)) throw new TypeError('Asignación sin sección')
  })
  array(value.pending, 'pending').forEach((row) => {
    object(row, ['sessionId', 'sectionId', 'courseId', 'durationMinutes'], 'pending')
    for (const field of ['sessionId', 'sectionId', 'courseId']) string(row[field], field)
    number(row.durationMinutes, 'durationMinutes', 1, 1440)
  })
  array(value.diagnostics, 'diagnostics').forEach((row) => {
    object(row, ['code', 'message', 'sessionIds'], 'diagnostic')
    string(row.code, 'code')
    string(row.message, 'message')
    strings(row.sessionIds, 'sessionIds')
  })
  object(value.counts, ['sections', 'requiredSessions', 'scheduledSessions'], 'counts')
  for (const field of ['sections', 'requiredSessions', 'scheduledSessions']) number(value.counts[field], field, 0, PLANNING_LIMITS.sessions)
  if (value.counts.sections !== value.sections.length || value.counts.scheduledSessions !== value.assignments.length
    || value.counts.requiredSessions !== value.assignments.length + value.pending.length) throw new TypeError('Conteos inconsistentes')
  object(value.stats, ['exploredCandidates', 'candidateVisits', 'backtracks', 'limitReason'], 'stats')
  for (const field of ['exploredCandidates', 'candidateVisits', 'backtracks']) number(value.stats[field], field)
  if (![null, 'explorations', 'work', 'time'].includes(value.stats.limitReason)) throw new TypeError('Límite inválido')
  if (value.coverageComplete !== (value.status === 'complete') || (value.coverageComplete && value.pending.length)) throw new TypeError('Cobertura inconsistente')
  if (new Set(value.sections.map((row) => row.sectionId)).size !== value.sections.length
    || new Set([...value.assignments, ...value.pending].map((row) => row.sessionId)).size !== value.assignments.length + value.pending.length) throw new TypeError('Sección o componente repetido')
  for (const pending of value.pending) {
    if (!value.sections.some((section) => section.sectionId === pending.sectionId && section.courseId === pending.courseId)) throw new TypeError('Componente pendiente sin sección')
  }
  const hasLimitDiagnostic = value.diagnostics.some((diagnostic) => diagnostic.code === 'SEARCH_LIMIT')
  if (hasLimitDiagnostic && value.status !== 'search-limit') throw new TypeError('Diagnóstico SEARCH_LIMIT incompatible con el estado de la propuesta')
  if (value.status === 'search-limit' && value.stats.limitReason === null) throw new TypeError('Búsqueda inconclusa sin motivo de límite')
  if (value.status === 'complete' && value.sections.some((section) => !value.assignments.some((assignment) => assignment.sectionId === section.sectionId))) throw new TypeError('Propuesta completa con sección sin asignar')
  for (const section of value.sections) {
    const assignments = value.assignments.filter((assignment) => assignment.sectionId === section.sectionId)
    if (new Set(assignments.map((assignment) => assignment.teacherId)).size > 1) throw new TypeError('Sección con docentes responsables distintos')
    if (section.deliveryMode === 'continuous' && assignments.length > 1) {
      const ordered = [...assignments].sort((a, b) => a.startMinute - b.startMinute)
      if (ordered.some((assignment, index) => index > 0 && (assignment.day !== ordered[0].day || assignment.startMinute !== ordered[index - 1].endMinute))) throw new TypeError('Bloque continuo fragmentado')
    }
  }
  if (Object.hasOwn(value, 'preferenceReport')) {
    const report = value.preferenceReport
    object(report, ['policy', 'evaluatedSections', 'withinPreferenceSections', 'outsidePreferenceSections', 'withoutPreferenceSections', 'optimality'], 'preferenceReport')
    if (!['preferences', 'balanced', 'first-feasible'].includes(report.policy) || report.optimality !== 'not-proven') throw new TypeError('Informe de preferencias inválido')
    for (const key of ['evaluatedSections', 'withinPreferenceSections', 'outsidePreferenceSections', 'withoutPreferenceSections']) number(report[key], key, 0, PLANNING_LIMITS.sessions)
    if (report.evaluatedSections !== report.withinPreferenceSections + report.outsidePreferenceSections + report.withoutPreferenceSections
      || report.evaluatedSections > value.sections.length) throw new TypeError('Contadores de preferencias inconsistentes')
  }
}

export function validateAcademicAdjustment(value) {
  object(value, ['expectedVersion', 'sectionId', 'sessionIds', 'teacherId', 'day', 'startMinute', 'roomIds'], 'adjustment')
  number(value.expectedVersion, 'expectedVersion')
  resourceId(value.sectionId)
  resourceId(value.teacherId)
  number(value.day, 'day', 1, 7)
  number(value.startMinute, 'startMinute', 0, 1439)
  strings(value.sessionIds, 'sessionIds')
  strings(value.roomIds, 'roomIds')
  if (!value.sessionIds.length || value.sessionIds.length !== value.roomIds.length
    || new Set(value.sessionIds).size !== value.sessionIds.length) throw new TypeError('Componentes o ambientes del ajuste inválidos')
}

export function validateAcademicAdvisorRequest(value) {
  object(value, ['expectedEditVersion'], 'advisorRequest', ['selectedRecommendationIds'])
  if (value.selectedRecommendationIds !== undefined) {
    strings(value.selectedRecommendationIds, 'selectedRecommendationIds')
    if (new Set(value.selectedRecommendationIds).size !== value.selectedRecommendationIds.length) throw new TypeError('IDs duplicados')
  }
  number(value.expectedEditVersion, 'expectedEditVersion', 0)
}

export function validateAcademicAdvisorPatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('patch: objeto requerido')
  if (value.kind === 'increase_teacher_load') {
    object(value, ['kind', 'adjustments'], 'patch')
    const adjustments = array(value.adjustments, 'adjustments')
    if (!adjustments.length) throw new TypeError('adjustments: al menos un docente requerido')
    adjustments.forEach((row) => {
      object(row, ['teacherId', 'previousMaxWeeklyMinutes', 'nextMaxWeeklyMinutes'], 'adjustment')
      resourceId(row.teacherId)
      number(row.previousMaxWeeklyMinutes, 'previousMaxWeeklyMinutes', 0, 2400)
      number(row.nextMaxWeeklyMinutes, 'nextMaxWeeklyMinutes', 1, 2400)
      if (row.nextMaxWeeklyMinutes <= row.previousMaxWeeklyMinutes) throw new TypeError('nextMaxWeeklyMinutes debe superar a previousMaxWeeklyMinutes')
    })
    return
  }
  if (value.kind === 'enable_planning_window') {
    object(value, ['kind'], 'patch', ['allowAfternoon', 'allowSaturday'])
    if (value.allowAfternoon !== undefined && value.allowAfternoon !== true) throw new TypeError('allowAfternoon inválido')
    if (value.allowSaturday !== undefined && value.allowSaturday !== true) throw new TypeError('allowSaturday inválido')
    if (!value.allowAfternoon && !value.allowSaturday) throw new TypeError('enable_planning_window requiere al menos una ventana')
    return
  }
  if (value.kind === 'change_delivery_mode') {
    object(value, ['kind', 'courseIds', 'deliveryMode'], 'patch')
    if (value.deliveryMode !== 'split') throw new TypeError('deliveryMode debe ser split')
    strings(value.courseIds, 'courseIds')
    if (!value.courseIds.length) throw new TypeError('courseIds vacío')
    return
  }
  if (value.kind === 'incorporate_reference_resource') {
    object(value, ['kind', 'teacherIds', 'roomIds'], 'patch')
    if (!Array.isArray(value.teacherIds) || !Array.isArray(value.roomIds)) throw new TypeError('teacherIds/roomIds deben ser listas')
    value.teacherIds.forEach(resourceId)
    value.roomIds.forEach(resourceId)
    if (!value.teacherIds.length && !value.roomIds.length) throw new TypeError('incorporate_reference_resource requiere al menos un recurso')
    return
  }
  throw new TypeError('kind de recomendación desconocido')
}

export function validateAcademicAdvisorResponse(value) {
  object(value, ['proposalId', 'editVersion', 'source', 'summary', 'bottlenecks', 'recommendations'], 'advisorResponse', ['verifiedImpact', 'reasoningSteps', 'normativeContext'])
  if (value.normativeContext !== undefined) validateAcademicNormativeResponse(value.normativeContext)
  string(value.proposalId, 'proposalId')
  number(value.editVersion, 'editVersion', 0)
  object(value.source, ['mode', 'providerLabel'], 'source', ['fallbackReason'])
  if (!['llm-assisted', 'deterministic-fallback'].includes(value.source.mode)) throw new TypeError('source.mode inválido')
  if (value.source.providerLabel !== null) string(value.source.providerLabel, 'providerLabel')
  if (value.source.fallbackReason !== undefined
    && !['not_configured', 'timeout', 'rate_limited', 'upstream_error', 'invalid_llm_output'].includes(value.source.fallbackReason)) {
    throw new TypeError('source.fallbackReason inválido')
  }
  if (value.reasoningSteps !== undefined) array(value.reasoningSteps, 'reasoningSteps').forEach((step) => {
    object(step, ['toolName', 'inputSummary', 'outputSummary'], 'reasoningStep')
    if (!['inspect_bottlenecks', 'simulate_patches_cpsat'].includes(step.toolName)) throw new TypeError('Herramienta desconocida')
    string(step.inputSummary, 'inputSummary')
    string(step.outputSummary, 'outputSummary')
  })
  if (value.verifiedImpact !== undefined) {
    const impact = value.verifiedImpact
    const counters = ['currentScheduledSessions', 'projectedScheduledSessions', 'requiredSessions', 'currentCompleteSections', 'projectedCompleteSections', 'totalSections']
    object(impact, [...counters, 'recommendationIds', 'solverStatus'], 'verifiedImpact')
    counters.forEach((key) => number(impact[key], key, 0))
    strings(impact.recommendationIds, 'recommendationIds')
    if (new Set(impact.recommendationIds).size !== impact.recommendationIds.length
      || impact.recommendationIds.some((id) => !value.recommendations.some((r) => r.id === id))) throw new TypeError('Recomendación desconocida o duplicada')
    if (!['complete', 'impossible', 'search-limit'].includes(impact.solverStatus)) throw new TypeError('solverStatus inválido')
    if (impact.currentScheduledSessions > impact.requiredSessions || impact.projectedScheduledSessions > impact.requiredSessions
      || impact.currentCompleteSections > impact.totalSections || impact.projectedCompleteSections > impact.totalSections) throw new TypeError('Contadores fuera de rango')
    if (impact.solverStatus === 'complete' && (impact.projectedScheduledSessions !== impact.requiredSessions
      || impact.projectedCompleteSections !== impact.totalSections)) throw new TypeError('Cobertura completa inconsistente')
  }
  string(value.summary, 'summary')
  array(value.bottlenecks, 'bottlenecks').forEach((row) => {
    object(row, ['category', 'title', 'detail', 'affectedSessionCount'], 'bottleneck')
    if (!['teacher_load', 'planning_window', 'missing_resource', 'delivery_mode', 'other'].includes(row.category)) {
      throw new TypeError('bottleneck.category inválido')
    }
    string(row.title, 'title')
    string(row.detail, 'detail')
    number(row.affectedSessionCount, 'affectedSessionCount', 0)
  })
  array(value.recommendations, 'recommendations').forEach((row) => {
    object(row, ['id', 'title', 'rationale', 'impactSummary', 'recommendedByDefault', 'patch'], 'recommendation')
    string(row.id, 'id')
    string(row.title, 'title')
    string(row.rationale, 'rationale')
    string(row.impactSummary, 'impactSummary')
    if (typeof row.recommendedByDefault !== 'boolean') throw new TypeError('recommendedByDefault debe ser booleano')
    validateAcademicAdvisorPatch(row.patch)
  })
}

const normativeSourceBase = 'https://medicina.unmsm.edu.pe/wp-content/uploads/2026/03/RESOLUCION-RECTORAL-001380-2026-R'
const normativeSources = [`${normativeSourceBase}.pdf`, `${normativeSourceBase}-ANEXO.pdf`]
function normativeDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value))
    || value.startsWith('0000-') || new Date(value).toISOString().slice(0, 10) !== value) throw new TypeError('Fecha normativa inválida')
}
export function validateAcademicNormativeRequest(value) {
  object(value, ['question', 'facultyId', 'academicPeriod', 'asOf', 'teacherType'], 'normativeRequest', ['previousQuestion'])
  if (typeof value.question !== 'string' || !value.question.trim() || value.question.trim().length > 1000) throw new TypeError('Pregunta normativa inválida')
  if (value.previousQuestion !== undefined && (typeof value.previousQuestion !== 'string' || !value.previousQuestion.trim() || value.previousQuestion.trim().length > 1000)) throw new TypeError('Antecedente normativo inválido')
  if (value.facultyId !== 'FISI' || !isPlanningPeriod(value.academicPeriod)
    || !['ordinario', 'contratado', 'unknown'].includes(value.teacherType)) throw new TypeError('Ámbito normativo inválido')
  normativeDate(value.asOf)
}
export function validateAcademicNormativeResponse(value, request) {
  object(value, ['revision', 'question', 'context', 'status', 'answer', 'retrievalMode', 'citations', 'gaps'], 'normativeResponse', ['generation', 'nextStep'])
  validateAcademicNormativeRequest({ question: value.question, ...value.context })
  object(value.context, ['facultyId', 'academicPeriod', 'asOf', 'teacherType'], 'normativeContext')
  if (value.question.trim() !== value.question || value.revision !== 'PA-NORMATIVE-1'
    || !['supported', 'not-determined', 'conflict'].includes(value.status)
    || !['hybrid', 'lexical-only', 'unavailable'].includes(value.retrievalMode)) throw new TypeError('Respuesta normativa inválida')
  if (typeof value.answer !== 'string' || !value.answer.trim() || value.answer.length > 6000) throw new TypeError('Respuesta normativa sin texto válido')
  if (value.nextStep !== undefined && (typeof value.nextStep !== 'string' || !value.nextStep.trim() || value.nextStep.length > 500)) throw new TypeError('Siguiente paso normativo inválido')
  array(value.citations, 'citations', 8).forEach((c) => {
    object(c, ['id', 'documentId', 'title', 'article', 'page', 'url', 'excerpt', 'sourceClass', 'scope', 'reviewedAt', 'effectiveFrom', 'effectiveTo'], 'citation')
    for (const key of ['id', 'documentId', 'title', 'article', 'excerpt']) string(c[key], key)
    number(c.page, 'page', 1)
    if (!normativeSources.includes(c.url) || c.sourceClass !== 'normative' || !['UNMSM', 'FISI'].includes(c.scope)) throw new TypeError('Fuente normativa inválida')
    normativeDate(c.reviewedAt)
    for (const key of ['effectiveFrom', 'effectiveTo']) if (c[key] !== null) normativeDate(c[key])
    if (c.effectiveFrom && c.effectiveTo && c.effectiveFrom > c.effectiveTo) throw new TypeError('Vigencia invertida')
    if ((c.effectiveFrom && c.effectiveFrom > value.context.asOf) || (c.effectiveTo && c.effectiveTo < value.context.asOf)) throw new TypeError('Cita fuera de fecha')
  })
  if (new Set(value.citations.map((c) => c.id)).size !== value.citations.length || (value.status !== 'not-determined' && !value.citations.length)) throw new TypeError('Citas inconsistentes')
  strings(value.gaps, 'gaps')
  if (value.generation !== undefined) {
    const g = value.generation
    object(g, ['mode', 'providerLabel'], 'normativeGeneration', ['fallbackReason'])
    if (!['llm-assisted', 'extractive'].includes(g.mode)
      || (g.providerLabel !== null && (typeof g.providerLabel !== 'string' || !g.providerLabel.trim()))
      || (g.mode === 'llm-assisted' && (g.providerLabel === null || g.fallbackReason !== undefined))
      || (g.mode === 'extractive' && g.providerLabel !== null)
      || (g.fallbackReason !== undefined && !['not_configured', 'timeout', 'upstream_error', 'invalid_llm_output', 'insufficient_evidence', 'disabled'].includes(g.fallbackReason))) throw new TypeError('Generación normativa inválida')
  }

  if (request) {
    validateAcademicNormativeRequest(request)
    if (value.question !== request.question.trim() || ['facultyId', 'academicPeriod', 'asOf', 'teacherType'].some((key) => value.context[key] !== request[key])) throw new TypeError('Respuesta normativa de otra consulta')
  }
}

// Optional PA-ENGINE-2 evidence; old stored proposals remain valid.
function validateProposalNormativeResult(value) {
  const boolean = (item) => { if (typeof item !== 'boolean') throw new TypeError('Prueba booleana requerida') }
  const authorization = (item) => { if (item !== null && !LOAD_AUTHORIZATION_KINDS.includes(item)) throw new TypeError('Autorización inválida') }
  if (Object.hasOwn(value, 'coverageProof') && !['complete', 'shortfall-proven', 'inconclusive'].includes(value.coverageProof)) throw new TypeError('Prueba de cobertura inválida')
  if (Object.hasOwn(value, 'capacityCertificate')) {
    const certificate = value.capacityCertificate
    object(certificate, ['proven', 'requiredSectionsTotal', 'coverableSectionsTotal', 'courses'], 'capacityCertificate')
    boolean(certificate.proven)
    number(certificate.requiredSectionsTotal, 'requiredSectionsTotal')
    number(certificate.coverableSectionsTotal, 'coverableSectionsTotal', 0, certificate.requiredSectionsTotal)
    const ids = new Set()
    array(certificate.courses, 'capacityCourses', PLANNING_LIMITS.courses).forEach((course) => {
      object(course, ['courseId', 'requiredSections', 'coverableSections', 'requiredMinutes'], 'capacityCourse')
      string(course.courseId, 'courseId')
      if (ids.has(course.courseId)) throw new TypeError('Curso de capacidad repetido')
      ids.add(course.courseId)
      number(course.requiredSections, 'requiredSections')
      number(course.coverableSections, 'coverableSections', 0, course.requiredSections)
      number(course.requiredMinutes, 'requiredMinutes')
    })
    if (certificate.courses.reduce((sum, c) => sum + c.requiredSections, 0) !== certificate.requiredSectionsTotal
      || certificate.courses.reduce((sum, c) => sum + c.coverableSections, 0) !== certificate.coverableSectionsTotal) throw new TypeError('Totales de capacidad inconsistentes')
  }
  if (Object.hasOwn(value, 'decisions')) {
    const ids = new Set()
    array(value.decisions, 'decisions', PLANNING_LIMITS.sessions).forEach((decision) => {
      object(decision, ['id', 'kind', 'teacherId', 'courseIds', 'exceptionKind', 'additionalMinutes', 'sectionsUnlocked', 'basis'], 'decision', ['policyChange', 'requires', 'sourceIds'])
      string(decision.id, 'decision.id')
      if (ids.has(decision.id)) throw new TypeError('Decisión repetida')
      ids.add(decision.id)
      if (!['teacher-load-exception', 'additional-teacher', 'planning-window', 'delivery-mode-split'].includes(decision.kind)
        || !['capacity-relaxation', 'window-precheck'].includes(decision.basis)) throw new TypeError('Decisión inválida')
      if (decision.teacherId !== null) string(decision.teacherId, 'teacherId')
      strings(decision.courseIds, 'courseIds')
      authorization(decision.exceptionKind)
      number(decision.additionalMinutes, 'additionalMinutes')
      number(decision.sectionsUnlocked, 'sectionsUnlocked')
      if (decision.kind === 'teacher-load-exception' && (decision.teacherId === null || decision.exceptionKind === null)) throw new TypeError('Excepción sin docente o autorización')
      for (const key of ['requires', 'sourceIds']) if (Object.hasOwn(decision, key)) strings(decision[key], key)
      if (Object.hasOwn(decision, 'policyChange')) {
        object(decision.policyChange, [], 'policyChange', ['allowAfternoon', 'allowSaturday'])
        if (!Object.keys(decision.policyChange).length || Object.values(decision.policyChange).some((item) => item !== true)) throw new TypeError('Cambio de política inválido')
      }
    })
  }
  if (Object.hasOwn(value, 'prelation')) {
    object(value.prelation, ['levels'], 'prelation')
    const ids = new Set()
    array(value.prelation.levels, 'prelation.levels', 3).forEach((level) => {
      object(level, ['id', 'value', 'proven'], 'prelation.level')
      if (!['contract-sections', 'interfaculty-sections', 'category-rank'].includes(level.id) || ids.has(level.id)) throw new TypeError('Nivel de prelación inválido')
      ids.add(level.id)
      number(level.value, 'prelation.value')
      boolean(level.proven)
    })
  }
  if (Object.hasOwn(value, 'normative')) {
    const normative = value.normative
    object(normative, ['profileRevision', 'lectiveHourMinutes', 'gaps', 'blockers'], 'normative')
    if (normative.profileRevision !== null) string(normative.profileRevision, 'profileRevision')
    if (normative.lectiveHourMinutes !== null && !LECTIVE_HOUR_MINUTES.includes(normative.lectiveHourMinutes)) throw new TypeError('Duración lectiva inválida')
    array(normative.gaps, 'normative.gaps', PLANNING_LIMITS.sessions).forEach((gap) => {
      object(gap, ['code', 'message'], 'normative.gap', ['teacherIds'])
      string(gap.code, 'gap.code')
      string(gap.message, 'gap.message')
      if (Object.hasOwn(gap, 'teacherIds')) strings(gap.teacherIds, 'gap.teacherIds')
    })
    array(normative.blockers, 'normative.blockers', PLANNING_LIMITS.teachers).forEach((blocker) => {
      object(blocker, ['teacherId', 'assignedMinutes', 'authorizedMaxMinutes', 'reason', 'requiredAuthorization', 'sourceIds'], 'normative.blocker')
      string(blocker.teacherId, 'teacherId')
      number(blocker.assignedMinutes, 'assignedMinutes')
      number(blocker.authorizedMaxMinutes, 'authorizedMaxMinutes')
      if (!['over-authorized-load', 'on-leave'].includes(blocker.reason)) throw new TypeError('Motivo de bloqueo inválido')
      authorization(blocker.requiredAuthorization)
      strings(blocker.sourceIds, 'sourceIds')
    })
  }
}
