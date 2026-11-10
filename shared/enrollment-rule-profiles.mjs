// ENR-RULES-1 shared module (F-E2.1): versioned prematrícula rule profiles and the pure credit/retake evaluators.
// Contract: docs/reverse-engineering/contracts/local-api/prematricula-rules.md.
// A norm states a requirement within its scope; it does not show that SUM enforces it during prematrícula. Applying it to the
// synthetic 2027-I scope, enabling the exceptions and the retake mode are local decisions (`local-only`) and FISI-pending
// questions (Q-02, Q-16, PROP-13.2). Nothing here is an official SUM or FISI value.
export const ENROLLMENT_RULES_REVISION = 'ENR-RULES-1'
export const CREDIT_EXCEPTION_KINDS = Object.freeze(['remaining-for-completion', 'return-after-suspension', 'plan-change-no-offer'])
export const RETAKE_INCLUSION_MODES = Object.freeze(['mandatory-inclusion', 'seat-priority'])
export const ENROLLMENT_RULE_ISSUE_CODES = Object.freeze([
  'CREDIT_ABOVE_MAX', 'CREDIT_BELOW_MIN', 'CREDIT_EXCEPTION_UNKNOWN', 'RETAKE_REQUIRED', 'REPETITION_RULE_NOT_EVALUATED', 'RULE_PROFILE_MISSING',
])
// Local placeholder texts (`local-only`): no SUM evidence for these messages exists.
export const ENROLLMENT_RULE_MESSAGES = Object.freeze({
  CREDIT_ABOVE_MAX: 'La selección supera el máximo de créditos del perfil.',
  CREDIT_BELOW_MIN: 'La selección no alcanza el mínimo de créditos del perfil.',
  CREDIT_EXCEPTION_UNKNOWN: 'No se pudo determinar si aplica una excepción de créditos.',
  RETAKE_REQUIRED: 'Debe incluir el curso desaprobado ofertado en este periodo.',
  REPETITION_RULE_NOT_EVALUATED: 'La regla para cursos con tres o más desaprobaciones no se evalúa en esta etapa.',
  RULE_PROFILE_MISSING: 'No existe un perfil de reglas para este periodo.',
})

const sourceOrigins = ['evidence', 'local-decision']
const sourceClasses = ['normative', 'observed', 'testimony', 'inferred', null]
const sourceStatuses = ['documented', 'reported', 'unverified', 'local-only']
const applicabilities = ['applicable', 'not-applicable', 'unknown']

function deepFreeze(value) {
  if (value && typeof value === 'object') Object.values(value).forEach(deepFreeze)
  return Object.freeze(value)
}

const PROFILES = deepFreeze([{
  revision: ENROLLMENT_RULES_REVISION,
  profileId: 'E2-SYN-SIS-2027-I-1',
  scope: { facultyId: 'FISI', schoolId: 'SISTEMAS', academicPeriod: '2027-I' },
  creditRange: { min: 12, max: 26, sourceIds: ['RN-01', 'OF-01', 'L-ENR-SYN-1', 'Q-02'] },
  creditExceptions: { enabled: ['remaining-for-completion', 'return-after-suspension', 'plan-change-no-offer'], sourceIds: ['RN-01', 'L-ENR-SYN-1', 'Q-16'] },
  retakeInclusion: { mode: 'mandatory-inclusion', sourceIds: ['RN-18', 'PROP-6', 'PROP-13.2'] },
  sources: [
    { id: 'RN-01', origin: 'evidence', class: 'normative', reference: 'docs/domain/fisi/2026-II/business-rules.md RN-01 (F1 art. 13.p): carga regular de 12 a 26 créditos, con excepciones; no demuestra que SUM la aplique en prematrícula', date: '2026-10-11', status: 'documented' },
    { id: 'OF-01', origin: 'evidence', class: 'normative', reference: 'docs/domain/fisi/2026-II/phase3-planning-sources-2026-11-05.md OF-01: mismo rango del art. 13.p; el art. 19 admite hasta 12 créditos con autorización', date: '2026-11-05', status: 'documented' },
    { id: 'RN-18', origin: 'evidence', class: 'normative', reference: 'docs/domain/fisi/2026-II/business-rules.md RN-18 (art. 18): los cursos desaprobados se llevan en el siguiente periodo en que se ofrezcan, con prioridad y respetando prerrequisitos', date: '2026-10-11', status: 'documented' },
    { id: 'Q-02', origin: 'evidence', class: null, reference: 'docs/domain/fisi/2026-II/open-questions.md Q-02 (abierta): cuándo bloquea el límite de créditos y con qué mensaje', date: '2026-10-11', status: 'unverified' },
    { id: 'Q-16', origin: 'evidence', class: null, reference: 'docs/domain/fisi/2026-II/open-questions.md Q-16 (abierta): quién autoriza las excepciones de créditos', date: '2026-10-11', status: 'unverified' },
    { id: 'PROP-6', origin: 'local-decision', class: null, reference: 'Propuesta v1.0, §6: parámetros del perfil (excepciones del art. 13.p, inclusión obligatoria o prioridad de vacante del art. 18); el piloto FISI usa inclusión obligatoria (requisito de diseño)', date: '2026-10-29', status: 'local-only' },
    { id: 'PROP-13.2', origin: 'local-decision', class: null, reference: 'Propuesta v1.0, §13.2: el alcance del art. 18 es una decisión de la facultad (pregunta abierta)', date: '2026-10-29', status: 'unverified' },
    { id: 'L-ENR-SYN-1', origin: 'local-decision', class: null, reference: 'prematricula-rules.md §2: aplicar el rango y habilitar las tres excepciones en el ámbito sintético SISTEMAS 2027-I es una decisión local', date: '2026-11-07', status: 'local-only' },
  ],
}])

function object(value, keys, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) throw new TypeError(`${path}: campos inválidos`)
}
function text(value, path, max = 1000) {
  if (typeof value !== 'string' || !value.length || value.length > max || value.trim() !== value) throw new TypeError(`${path}: texto inválido`)
}
function integer(value, path, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new TypeError(`${path}: entero inválido`)
}
function sourceIds(ids, known, path) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 16 || new Set(ids).size !== ids.length || ids.some((id) => !known.has(id))) throw new TypeError(`${path}: fuentes inválidas`)
}

export function validateEnrollmentRuleProfile(value) {
  object(value, ['revision', 'profileId', 'scope', 'creditRange', 'creditExceptions', 'retakeInclusion', 'sources'], 'ruleProfile')
  if (value.revision !== ENROLLMENT_RULES_REVISION) throw new TypeError('Revisión de perfil de reglas incompatible')
  text(value.profileId, 'profileId', 80)
  object(value.scope, ['facultyId', 'schoolId', 'academicPeriod'], 'ruleProfile.scope')
  if (value.scope.facultyId !== 'FISI' || value.scope.schoolId !== 'SISTEMAS') throw new TypeError('Alcance de perfil de reglas inválido')
  text(value.scope.academicPeriod, 'academicPeriod', 20)
  if (!Array.isArray(value.sources) || value.sources.length < 1 || value.sources.length > 32) throw new TypeError('sources: lista inválida')
  value.sources.forEach((source) => {
    object(source, ['id', 'origin', 'class', 'reference', 'date', 'status'], 'source')
    text(source.id, 'source.id', 80); text(source.reference, 'source.reference')
    if (!sourceOrigins.includes(source.origin) || !sourceClasses.includes(source.class) || !sourceStatuses.includes(source.status)
      || typeof source.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(source.date) || !Number.isFinite(Date.parse(source.date))) throw new TypeError('Fuente de perfil inválida')
  })
  const known = new Set(value.sources.map((source) => source.id))
  if (known.size !== value.sources.length) throw new TypeError('Fuentes de perfil repetidas')
  object(value.creditRange, ['min', 'max', 'sourceIds'], 'creditRange')
  integer(value.creditRange.min, 'creditRange.min', 1, 200)
  integer(value.creditRange.max, 'creditRange.max', value.creditRange.min, 200)
  sourceIds(value.creditRange.sourceIds, known, 'creditRange.sourceIds')
  object(value.creditExceptions, ['enabled', 'sourceIds'], 'creditExceptions')
  if (!Array.isArray(value.creditExceptions.enabled) || new Set(value.creditExceptions.enabled).size !== value.creditExceptions.enabled.length
    || value.creditExceptions.enabled.some((kind) => !CREDIT_EXCEPTION_KINDS.includes(kind))) throw new TypeError('Excepciones de créditos inválidas')
  sourceIds(value.creditExceptions.sourceIds, known, 'creditExceptions.sourceIds')
  object(value.retakeInclusion, ['mode', 'sourceIds'], 'retakeInclusion')
  if (!RETAKE_INCLUSION_MODES.includes(value.retakeInclusion.mode)) throw new TypeError('Modo de inclusión de repitencia inválido')
  sourceIds(value.retakeInclusion.sourceIds, known, 'retakeInclusion.sourceIds')
}

// Returns a copy. A scope with no profile is an explicit gap (null): the caller must block, never fall back to another scope.
// The faculty is FISI for every regular E2 scenario, so the scope carries school and period only.
export function resolveEnrollmentRuleProfile(scope) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) return null
  const found = PROFILES.find((profile) => profile.scope.schoolId === scope.schoolId && profile.scope.academicPeriod === scope.academicPeriod)
  return found ? structuredClone(found) : null
}

const issue = (kind, code, courseIds = []) => ({ kind, code, message: ENROLLMENT_RULE_MESSAGES[code], courseIds, sectionIds: [] })

// §3.3: a scope without a profile blocks registration (`insufficient`) with no fallback.
export function ruleProfileMissingIssue() {
  return issue('insufficient', 'RULE_PROFILE_MISSING')
}

// §3.1. `exception` reuses the matrícula-regular `creditException` shape ({ kind, applicability }, extra keys ignored).
// courseIds stay empty: the credit rules concern the whole selection.
export function evaluateCreditRange({ profile, selectedCredits, selectedCount, exception }) {
  validateEnrollmentRuleProfile(profile)
  if (typeof selectedCredits !== 'number' || !Number.isFinite(selectedCredits) || selectedCredits < 0) throw new TypeError('Créditos seleccionados inválidos')
  integer(selectedCount, 'selectedCount', 0)
  if (!exception || typeof exception !== 'object' || ![...CREDIT_EXCEPTION_KINDS, 'none'].includes(exception.kind) || !applicabilities.includes(exception.applicability)) throw new TypeError('Excepción de créditos inválida')
  if (selectedCount === 0) return []
  const { min, max } = profile.creditRange
  if (selectedCredits > max) return [issue('unmet', 'CREDIT_ABOVE_MAX')]
  if (selectedCredits >= min) return []
  if (exception.applicability === 'unknown') return [issue('insufficient', 'CREDIT_EXCEPTION_UNKNOWN')]
  if (profile.creditExceptions.enabled.includes(exception.kind) && exception.applicability === 'applicable') return []
  return [issue('unmet', 'CREDIT_BELOW_MIN')]
}

// §3.2. `eligible` is the demand estimator's `classify` returning `retake` (prerequisites stay with that check).
// An empty selection is handled by EMPTY_SELECTION in the caller (§4); this evaluator does not special-case it.
export function evaluateRetakeInclusion({ profile, failedCourses, offeredCourseIds, selectedCourseIds }) {
  validateEnrollmentRuleProfile(profile)
  for (const [name, list] of [['offeredCourseIds', offeredCourseIds], ['selectedCourseIds', selectedCourseIds]]) {
    if (!Array.isArray(list) || list.some((id) => typeof id !== 'string' || !id)) throw new TypeError(`${name}: lista inválida`)
  }
  if (!Array.isArray(failedCourses)) throw new TypeError('failedCourses: lista requerida')
  const seen = new Set()
  for (const course of failedCourses) {
    object(course, ['courseId', 'attempts', 'eligible'], 'failedCourse')
    text(course.courseId, 'courseId', 80); integer(course.attempts, 'attempts', 1)
    if (typeof course.eligible !== 'boolean' || seen.has(course.courseId)) throw new TypeError('Curso desaprobado inválido')
    seen.add(course.courseId)
  }
  const offered = new Set(offeredCourseIds)
  const selected = new Set(selectedCourseIds)
  const issues = []
  for (const course of [...failedCourses].sort((a, b) => (a.courseId < b.courseId ? -1 : a.courseId > b.courseId ? 1 : 0))) {
    if (course.attempts >= 3) issues.push(issue('insufficient', 'REPETITION_RULE_NOT_EVALUATED', [course.courseId]))
    else if (profile.retakeInclusion.mode === 'mandatory-inclusion' && course.eligible && offered.has(course.courseId) && !selected.has(course.courseId)) {
      issues.push(issue('unmet', 'RETAKE_REQUIRED', [course.courseId]))
    }
  }
  return issues
}
