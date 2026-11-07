// PA-READJUST-1 shared module (F-S5.1): pure proposal rules, DTO/response validators and the persisted record validator.
// Contract: docs/reverse-engineering/contracts/local-api/planning-readjustment.md. A local design requirement (`local-only`),
// not a norm and not observed SUM behavior; section caps and readjustment dates remain pending with the faculty.
export const READJUSTMENT_REVISION = 'PA-READJUST-1'
export const READJUSTMENT_MAX_ACCEPTED_ACTIONS = 64
export const READJUSTMENT_MAX_SECTION_CAPACITY = 1000
export const READJUSTMENT_KEEP_REASONS = Object.freeze(['LABORATORY_SECTION', 'ROOM_AT_CAPACITY', 'ROOM_KIND_UNKNOWN'])

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

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
function hash(value, path) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new TypeError(`${path}: huella inválida`)
}
function uuid(value, path) {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new TypeError(`${path}: identificador inválido`)
}
function moment(value, path) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new TypeError(`${path}: fecha inválida`)
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

// ---------- section identity (L-READJ-3) ----------

export function readjustmentSectionId(courseId, ordinal) {
  return `section:${JSON.stringify([courseId, ordinal])}`
}
// Parses `section:["courseId",n]`; returns null when the text is not that exact form.
export function parseReadjustmentSectionId(sectionId) {
  if (typeof sectionId !== 'string' || !sectionId.startsWith('section:')) return null
  try {
    const parsed = JSON.parse(sectionId.slice('section:'.length))
    if (!Array.isArray(parsed) || parsed.length !== 2 || typeof parsed[0] !== 'string' || !parsed[0] || !Number.isSafeInteger(parsed[1]) || parsed[1] < 1) return null
    const [courseId, ordinal] = parsed
    return readjustmentSectionId(courseId, ordinal) === sectionId ? { courseId, ordinal } : null
  } catch {
    return null
  }
}

// ---------- §2 basis fingerprint ----------

// Canonical text of the compare-and-set basis. The caller hashes it: sha256(canonicalReadjustmentBasis(...)). Hashing is not done
// here because this module also loads in the browser bundle.
export function canonicalReadjustmentBasis({ publicationId, publicationVersion, demand }) {
  return canonical({ publicationId, publicationVersion, demand })
}

// ---------- §3 proposal rules ----------

function compareText(a, b) { return a < b ? -1 : a > b ? 1 : 0 }

// input = {
//   publicationId, publicationVersion, basisFingerprint,
//   demand: E2Demand (E2-DEMAND-1) for that publication,
//   courses: Array<{ courseId, targetCapacity, sections: Array<{ sectionId, capacity, rooms: Array<{ kind: 'classroom'|'laboratory'|null, capacity }> }> }>
// }
// `courses` is the structure of the publication P (effective capacities, rooms of every session). `demand` supplies D_c and n_s.
export function proposeReadjustment(input) {
  const { publicationId, publicationVersion, basisFingerprint, demand, courses } = input
  hash(basisFingerprint, 'basisFingerprint')
  integer(publicationVersion, 'publicationVersion', 1)
  if (!Array.isArray(courses)) throw new TypeError('courses: lista requerida')
  const demandByCourse = new Map(demand.courses.map((course) => [course.courseId, course]))
  const entries = []
  for (const course of courses) {
    integer(course.targetCapacity, 'targetCapacity', 1)
    const sections = course.sections.map((section) => {
      const parsed = parseReadjustmentSectionId(section.sectionId)
      if (!parsed || parsed.courseId !== course.courseId) throw new TypeError('Sección ajena al curso')
      return { ...section, ordinal: parsed.ordinal }
    })
    if (!sections.length) throw new TypeError('Curso sin secciones')
    const courseDemand = demandByCourse.get(course.courseId)
    const studentsBySection = new Map((courseDemand?.sections ?? []).map((section) => [section.sectionId, section.students]))
    const D = courseDemand?.students ?? 0
    const n = sections.length
    const K = sections.reduce((sum, section) => sum + section.capacity, 0)
    const T = course.targetCapacity
    if (D > K) {
      const count = Math.ceil((D - K) / T)
      entries.push({ courseId: course.courseId, ordinal: n + 1, action: {
        id: `open:${course.courseId}`, type: 'open-section', courseId: course.courseId, demand: D, capacity: K, targetCapacity: T, count,
        ordinals: Array.from({ length: count }, (_, index) => n + 1 + index), reason: 'COURSE_DEMAND_EXCEEDS_CAPACITY',
      } })
    }
    for (const section of sections) {
      const ns = studentsBySection.get(section.sectionId) ?? 0
      const k = section.capacity
      if (ns <= k) continue
      const base = { courseId: course.courseId, sectionId: section.sectionId, demand: ns, capacity: k }
      const rooms = section.rooms
      let action
      if (rooms.some((room) => room.kind === 'laboratory')) action = { id: `keep:${section.sectionId}`, type: 'keep', ...base, reason: 'LABORATORY_SECTION' }
      else if (!rooms.length || rooms.some((room) => room.kind !== 'classroom')) action = { id: `keep:${section.sectionId}`, type: 'keep', ...base, reason: 'ROOM_KIND_UNKNOWN' }
      else {
        const minRoom = Math.min(...rooms.map((room) => room.capacity))
        const newCapacity = Math.min(minRoom, READJUSTMENT_MAX_SECTION_CAPACITY)
        action = newCapacity > k
          ? { id: `widen:${section.sectionId}`, type: 'widen-cap', ...base, newCapacity, remainingExcess: Math.max(0, ns - newCapacity), reason: 'SECTION_DEMAND_EXCEEDS_CAP' }
          : { id: `keep:${section.sectionId}`, type: 'keep', ...base, reason: 'ROOM_AT_CAPACITY' }
      }
      entries.push({ courseId: course.courseId, ordinal: section.ordinal, action })
    }
  }
  entries.sort((a, b) => compareText(a.courseId, b.courseId) || a.ordinal - b.ordinal)
  const actions = entries.map((entry) => entry.action)
  return {
    revision: READJUSTMENT_REVISION, publicationId, publicationVersion, basisFingerprint,
    status: actions.length ? 'actions' : 'no-change',
    demand: { counted: demand.countedStudents, excluded: demand.excludedStudents },
    actions,
  }
}

// §4.2 step 3: an accepted `open` action keeps existing ordinals and yields exactly n + count sections.
export function readjustedEstimatedDemand({ demand, sectionCount, count, targetCapacity }) {
  integer(demand, 'demand', 0); integer(sectionCount, 'sectionCount', 1); integer(count, 'count', 1); integer(targetCapacity, 'targetCapacity', 1)
  return Math.min(Math.max(demand, (sectionCount + count - 1) * targetCapacity + 1), (sectionCount + count) * targetCapacity)
}

// §4.2: only open/widen actions present in the recomputed proposal can be accepted (a `keep` or unknown ID is
// 422 READJUSTMENT_ACTION_INVALID at the server).
export function resolveAcceptedReadjustmentActions(proposal, ids) {
  const byId = new Map(proposal.actions.map((action) => [action.id, action]))
  const invalidIds = ids.filter((id) => !byId.has(id) || byId.get(id).type === 'keep')
  return { ok: invalidIds.length === 0, invalidIds, actions: invalidIds.length ? [] : ids.map((id) => byId.get(id)) }
}

// ---------- §4 DTOs ----------

export function validateReadjustmentProposalRequest(value) {
  object(value, [], 'readjustmentProposalRequest')
}

function actionIdShape(value, path) {
  text(value, path, 260)
  if (value.startsWith('open:')) text(value.slice(5), path, 80)
  else if (value.startsWith('widen:')) {
    if (!parseReadjustmentSectionId(value.slice(6))) throw new TypeError(`${path}: sección inválida`)
  } else throw new TypeError(`${path}: acción aceptable inválida (solo open: o widen:)`)
}
// A `keep:` ID is rejected here as acceptance criterion S2 requires; the contract maps it to 422 READJUSTMENT_ACTION_INVALID,
// so the server can test for the `keep:` prefix before validating when it wants that status instead of 400.
export function validateReadjustmentAcceptRequest(value) {
  object(value, ['expectedCurrentId', 'expectedBasisFingerprint', 'acceptedActionIds'], 'readjustmentAcceptRequest', ['title'])
  uuid(value.expectedCurrentId, 'expectedCurrentId')
  hash(value.expectedBasisFingerprint, 'expectedBasisFingerprint')
  if (!Array.isArray(value.acceptedActionIds) || value.acceptedActionIds.length < 1 || value.acceptedActionIds.length > READJUSTMENT_MAX_ACCEPTED_ACTIONS) throw new TypeError('acceptedActionIds: lista inválida')
  value.acceptedActionIds.forEach((id) => actionIdShape(id, 'acceptedActionIds'))
  if (new Set(value.acceptedActionIds).size !== value.acceptedActionIds.length) throw new TypeError('acceptedActionIds: valores repetidos')
  if (Object.hasOwn(value, 'title') && (typeof value.title !== 'string' || value.title.length < 1 || value.title.length > 120 || !value.title.trim())) throw new TypeError('Título de reajuste inválido')
}

// ---------- §4.1 response ----------

function validateAction(action) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) throw new TypeError('action: objeto requerido')
  if (action.type === 'open-section') {
    object(action, ['id', 'type', 'courseId', 'demand', 'capacity', 'targetCapacity', 'count', 'ordinals', 'reason'], 'action')
    text(action.courseId, 'courseId', 80)
    if (action.id !== `open:${action.courseId}` || action.reason !== 'COURSE_DEMAND_EXCEEDS_CAPACITY') throw new TypeError('Acción open inconsistente')
    integer(action.demand, 'demand', 1); integer(action.capacity, 'capacity', 1); integer(action.targetCapacity, 'targetCapacity', 1); integer(action.count, 'count', 1)
    if (action.demand <= action.capacity || action.count !== Math.ceil((action.demand - action.capacity) / action.targetCapacity)) throw new TypeError('Conteo de secciones inconsistente')
    if (!Array.isArray(action.ordinals) || action.ordinals.length !== action.count || action.ordinals.some((ordinal, index) => !Number.isSafeInteger(ordinal) || ordinal < 2 || ordinal !== action.ordinals[0] + index)) throw new TypeError('Ordinales inconsistentes')
    return { courseId: action.courseId, ordinal: action.ordinals[0] }
  }
  if (action.type === 'widen-cap') {
    object(action, ['id', 'type', 'courseId', 'sectionId', 'demand', 'capacity', 'newCapacity', 'remainingExcess', 'reason'], 'action')
    const parsed = parseReadjustmentSectionId(action.sectionId)
    if (!parsed || parsed.courseId !== action.courseId || action.id !== `widen:${action.sectionId}` || action.reason !== 'SECTION_DEMAND_EXCEEDS_CAP') throw new TypeError('Acción widen inconsistente')
    integer(action.capacity, 'capacity', 1); integer(action.demand, 'demand', 1); integer(action.newCapacity, 'newCapacity', 1, READJUSTMENT_MAX_SECTION_CAPACITY)
    if (action.demand <= action.capacity || action.newCapacity <= action.capacity || action.remainingExcess !== Math.max(0, action.demand - action.newCapacity)) throw new TypeError('Capacidad ampliada inconsistente')
    return { courseId: parsed.courseId, ordinal: parsed.ordinal }
  }
  if (action.type === 'keep') {
    object(action, ['id', 'type', 'courseId', 'sectionId', 'demand', 'capacity', 'reason'], 'action')
    const parsed = parseReadjustmentSectionId(action.sectionId)
    if (!parsed || parsed.courseId !== action.courseId || action.id !== `keep:${action.sectionId}` || !READJUSTMENT_KEEP_REASONS.includes(action.reason)) throw new TypeError('Acción keep inconsistente')
    integer(action.capacity, 'capacity', 1); integer(action.demand, 'demand', 1)
    if (action.demand <= action.capacity) throw new TypeError('Acción keep sin exceso')
    return { courseId: parsed.courseId, ordinal: parsed.ordinal }
  }
  throw new TypeError('Tipo de acción inválido')
}

export function validateReadjustmentProposal(value) {
  object(value, ['revision', 'publicationId', 'publicationVersion', 'basisFingerprint', 'status', 'demand', 'actions'], 'readjustmentProposal')
  if (value.revision !== READJUSTMENT_REVISION) throw new TypeError('Revisión de reajuste incompatible')
  uuid(value.publicationId, 'publicationId')
  integer(value.publicationVersion, 'publicationVersion', 1)
  hash(value.basisFingerprint, 'basisFingerprint')
  object(value.demand, ['counted', 'excluded'], 'readjustmentProposal.demand')
  integer(value.demand.counted, 'counted'); integer(value.demand.excluded, 'excluded')
  if (!['actions', 'no-change'].includes(value.status) || !Array.isArray(value.actions) || value.actions.length > 4096) throw new TypeError('Estado de propuesta inválido')
  if ((value.status === 'no-change') !== (value.actions.length === 0)) throw new TypeError('Estado inconsistente con las acciones')
  const ids = new Set()
  let previous = null
  for (const action of value.actions) {
    const key = validateAction(action)
    if (ids.has(action.id)) throw new TypeError('Acciones repetidas')
    ids.add(action.id)
    if (previous && (compareText(previous.courseId, key.courseId) || previous.ordinal - key.ordinal) > 0) throw new TypeError('Acciones fuera de orden')
    previous = key
  }
}

// ---------- §5 persisted record ----------

export function validateAcademicReadjustmentRecord(value) {
  object(value, ['revision', 'basisFingerprint', 'publicationId', 'publicationVersion', 'acceptedActions', 'createdAt'], 'readjustment')
  if (value.revision !== READJUSTMENT_REVISION) throw new TypeError('Revisión de reajuste incompatible')
  hash(value.basisFingerprint, 'basisFingerprint')
  uuid(value.publicationId, 'publicationId')
  integer(value.publicationVersion, 'publicationVersion', 1)
  moment(value.createdAt, 'createdAt')
  if (!Array.isArray(value.acceptedActions) || value.acceptedActions.length < 1 || value.acceptedActions.length > READJUSTMENT_MAX_ACCEPTED_ACTIONS) throw new TypeError('acceptedActions: lista inválida')
  const ids = new Set()
  for (const action of value.acceptedActions) {
    if (!action || typeof action !== 'object' || Array.isArray(action)) throw new TypeError('acción aceptada inválida')
    if (action.type === 'open-section') {
      object(action, ['id', 'type', 'courseId', 'count'], 'acceptedAction')
      text(action.courseId, 'courseId', 80); integer(action.count, 'count', 1)
      if (action.id !== `open:${action.courseId}`) throw new TypeError('Identificador de acción inconsistente')
    } else if (action.type === 'widen-cap') {
      object(action, ['id', 'type', 'courseId', 'sectionId', 'newCapacity'], 'acceptedAction')
      const parsed = parseReadjustmentSectionId(action.sectionId)
      integer(action.newCapacity, 'newCapacity', 2, READJUSTMENT_MAX_SECTION_CAPACITY)
      if (!parsed || parsed.courseId !== action.courseId || action.id !== `widen:${action.sectionId}`) throw new TypeError('Identificador de acción inconsistente')
    } else throw new TypeError('Tipo de acción aceptada inválido')
    if (ids.has(action.id)) throw new TypeError('Acciones aceptadas repetidas')
    ids.add(action.id)
  }
}
