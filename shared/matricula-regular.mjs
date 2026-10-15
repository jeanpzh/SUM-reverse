/** Local, synthetic own-API wire contract for regular enrollment (MR-CONTRACT-2). */

export const matriculaRegularCauseCodes = Object.freeze([
  'PRE_ENROLLMENT_NOT_ENABLED', 'OUTSIDE_WINDOW', 'CREDIT_LOAD_INVALID',
  'COURSE_NOT_IN_PRE_ENROLLMENT', 'PLAN_MISMATCH', 'PREREQUISITE_UNMET',
  'RETAKE_PRIORITY', 'SCHEDULE_CONFLICT', 'SECTION_FULL',
  'DEBT_REQUIREMENT_UNMET', 'HEALTH_REQUIREMENT_UNMET', 'ACADEMIC_INELIGIBILITY',
  'TUTORSHIP_REQUIREMENT_UNMET', 'FOURTH_ENROLLMENT_RULE_UNMET', 'ALREADY_ENROLLED',
])

export const matriculaRegularGapCodes = Object.freeze([
  'PROFILE_MISSING', 'WINDOW_UNSPECIFIED', 'PRE_ENROLLMENT_UNKNOWN',
  'PLAN_OR_OFFER_UNKNOWN', 'PREREQUISITE_OR_EQUIVALENCE_UNKNOWN', 'SCHEDULE_UNKNOWN',
  'EXCEPTION_UNKNOWN', 'INSTITUTIONAL_REQUIREMENT_UNKNOWN',
  'REPETITION_OR_AUTHORIZATION_UNKNOWN',
])

export const matriculaRegularWindowOrigins = Object.freeze(['published-derived', 'synthetic'])

const causeCodes = new Set(matriculaRegularCauseCodes)
const gapCodes = new Set(matriculaRegularGapCodes)
const origins = new Set(matriculaRegularWindowOrigins)
const evidenceClasses = new Set(['normative', 'observed', 'testimony', 'inferred'])
const sourceOrigins = new Set(['evidence', 'local-decision'])
const sourceStatuses = new Set(['documented', 'reported', 'unverified', 'local-only'])
const eligibilityStates = new Set(['eligible', 'ineligible', 'configuration-pending'])
const outcomeStates = new Set(['accepted', 'rejected', 'configuration-pending'])
const selectionStates = new Set(['known', 'unknown'])
const windowOrigins = new Set(matriculaRegularWindowOrigins)
const idPattern = /^SYN-[A-Z0-9-]{1,48}$/
const profileRevisionPattern = /^MR-[A-Z0-9-]{1,48}$/
const uuid4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const dayPattern = /^\d{4}-\d{2}-\d{2}$/
const periodPattern = /^\d{4}-I{1,2}$/
const localTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/

function fail(path, expected) {
  throw new TypeError(`${path}: se esperaba ${expected}`)
}

function record(value, path) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'objeto')
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) fail(path, 'objeto plano')
  return value
}

function exact(value, shape, path, optionalShape = {}) {
  const item = record(value, path)
  for (const key of Object.keys(shape)) {
    if (!Object.hasOwn(item, key)) fail(`${path}.${key}`, 'campo presente')
    shape[key](item[key], `${path}.${key}`)
  }
  for (const key of Object.keys(optionalShape)) {
    if (Object.hasOwn(item, key)) optionalShape[key](item[key], `${path}.${key}`)
  }
  for (const key of Object.keys(item)) {
    if (!Object.hasOwn(shape, key) && !Object.hasOwn(optionalShape, key)) fail(`${path}.${key}`, 'clave permitida')
  }
  return item
}

function string(value, path) {
  if (typeof value !== 'string') fail(path, 'string')
}

function nonEmpty(value, path) {
  string(value, path)
  if (value.length === 0) fail(path, 'string no vacío')
}

function boolean(value, path) {
  if (typeof value !== 'boolean') fail(path, 'boolean')
}

function finite(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'número finito')
}

function integer(value, path, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(path, 'entero seguro en rango')
}

function enumValue(values, value, path) {
  if (!values.includes(value)) fail(path, `uno de ${values.join(', ')}`)
}

function id(value, path) {
  if (typeof value !== 'string' || !idPattern.test(value)) fail(path, 'ID SYN válido')
}

function uuid(value, path) {
  if (typeof value !== 'string' || !uuid4Pattern.test(value)) fail(path, 'UUID v4 canónico minúsculo')
}

function profileRevision(value, path) {
  if (typeof value !== 'string' || !profileRevisionPattern.test(value)) fail(path, 'revisión MR válida')
}

function date(value, path) {
  if (typeof value !== 'string' || !dayPattern.test(value)) fail(path, 'fecha YYYY-MM-DD')
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail(path, 'fecha real YYYY-MM-DD')
}

function instant(value, path) {
  if (typeof value !== 'string' || !isoPattern.test(value)) fail(path, 'ISO UTC YYYY-MM-DDTHH:mm:ss.sssZ')
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) fail(path, 'instante UTC real')
}

function array(value, path, validate, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Array.isArray(value)) fail(path, 'array')
  if (value.length < min || value.length > max) fail(path, `array de ${min} a ${max} elementos`)
  value.forEach((item, index) => validate(item, `${path}[${index}]`))
}

function unique(values, path, keyOf = (value) => value) {
  const keys = values.map(keyOf)
  if (new Set(keys).size !== keys.length) fail(path, 'elementos únicos')
}

function sortedUniqueStrings(values, path, validateItem) {
  array(values, path, validateItem)
  unique(values, path)
  for (let index = 1; index < values.length; index += 1) {
    if (values[index - 1] > values[index]) fail(path, 'valores únicos ordenados lexicalmente')
  }
}

function orderedSet(values, path, validateItem, keyOf) {
  array(values, path, validateItem)
  unique(values, path, keyOf)
  const keys = values.map(keyOf)
  for (let index = 1; index < keys.length; index += 1) {
    if (keys[index - 1] > keys[index]) fail(path, 'elementos únicos ordenados lexicalmente')
  }
}

function nullable(validate) {
  return (value, path) => {
    if (value !== null) validate(value, path)
  }
}

// MR-CONTRACT-3: optional display fields observed in SUM (V-02, V-04, V-05, V-08). Absent = not provided by this producer.
const courseTypes = Object.freeze(['mandatory', 'elective'])

function cycleValue(value, path) {
  integer(value, path, 1, 14)
}

function courseTypeValue(value, path) {
  enumValue(courseTypes, value, path)
}

function choice(value, path) {
  exact(value, { courseId: id, sectionId: id }, path)
}

function scope(value, path) {
  exact(value, {
    facultyId: nonEmpty,
    schoolId: nonEmpty,
    period: (item, itemPath) => {
      if (typeof item !== 'string' || !periodPattern.test(item)) fail(itemPath, 'periodo YYYY-I o YYYY-II')
    },
    planId: id,
    modality: (item, itemPath) => enumValue(['regular-virtual'], item, itemPath),
  }, path)
}

function source(value, path) {
  const item = record(value, path)
  const origin = item.origin
  exact(item, {
    id: nonEmpty,
    origin: (field, itemPath) => enumValue([...sourceOrigins], field, itemPath),
    class: (field, itemPath) => {
      if (field !== null) enumValue([...evidenceClasses], field, itemPath)
    },
    reference: nonEmpty,
    date,
    status: (field, itemPath) => enumValue([...sourceStatuses], field, itemPath),
  }, path)
  if (origin === 'evidence' && !evidenceClasses.has(item.class)) fail(`${path}.class`, 'clase requerida para evidence')
  if (origin === 'local-decision' && (item.class !== null || item.status !== 'local-only')) {
    fail(path, 'local-decision con class null y status local-only')
  }
}

function gap(value, path) {
  exact(value, {
    code: (item, itemPath) => enumValue([...gapCodes], item, itemPath),
    courseIds: (items, itemPath) => sortedUniqueStrings(items, itemPath, id),
    sourceIds: (items, itemPath) => sortedUniqueStrings(items, itemPath, nonEmpty),
  }, path)
}

function cause(value, path) {
  exact(value, {
    code: (item, itemPath) => enumValue([...causeCodes], item, itemPath),
    courseIds: (items, itemPath) => sortedUniqueStrings(items, itemPath, id),
    sectionIds: (items, itemPath) => sortedUniqueStrings(items, itemPath, id),
    sourceIds: (items, itemPath) => sortedUniqueStrings(items, itemPath, nonEmpty),
  }, path)
}

function session(value, path) {
  exact(value, { runId: uuid, actorId: id, sessionId: uuid, startedAt: instant, expiresAt: instant }, path)
}

function courseDocument(value, path) {
  exact(value, {
    courseId: id,
    planId: id,
    name: nonEmpty,
    credits: (item, itemPath) => { finite(item, itemPath); if (item <= 0) fail(itemPath, 'número mayor que cero') },
  }, path)
}

function meeting(value, path) {
  exact(value, {
    day: (item, itemPath) => integer(item, itemPath, 1, 7),
    startMinute: (item, itemPath) => integer(item, itemPath, 0, 1439),
    endMinute: (item, itemPath) => integer(item, itemPath, 1, 1440),
  }, path)
  if (value.startMinute >= value.endMinute) fail(path, 'inicio menor que fin')
}

function section(value, path) {
  exact(value, {
    sectionId: id,
    capacity: (item, itemPath) => integer(item, itemPath),
    occupied: (item, itemPath) => integer(item, itemPath),
    schedule: nullable((item, itemPath) => array(item, itemPath, meeting)),
  }, path, {
    label: nonEmpty,
    teacher: nullable(nonEmpty),
    room: nullable(nonEmpty),
  })
  if (value.occupied > value.capacity) fail(`${path}.occupied`, 'ocupación menor o igual a capacidad')
}

function offeredCourse(value, path) {
  exact(value, {
    courseId: id,
    planId: id,
    name: nonEmpty,
    credits: (item, itemPath) => { finite(item, itemPath); if (item <= 0) fail(itemPath, 'número mayor que cero') },
    prerequisiteIds: (items, itemPath) => { array(items, itemPath, id); unique(items, itemPath) },
    sections: (items, itemPath) => {
      array(items, itemPath, section)
      unique(items, itemPath, (item) => item.sectionId)
    },
  }, path, {
    cycle: nullable(cycleValue),
    courseType: nullable(courseTypeValue),
  })
}

function publishedRow(value, path) {
  exact(value, {
    row: (item, itemPath) => integer(item, itemPath, 1, 9),
    groupLabel: string,
    day: (item, itemPath) => { if (item !== '2026-08-10') fail(itemPath, '2026-08-10') },
    startLocal: (item, itemPath) => { if (typeof item !== 'string' || !localTimePattern.test(item)) fail(itemPath, 'hora local HH:mm') },
    endLocal: (item, itemPath) => { if (typeof item !== 'string' || !localTimePattern.test(item)) fail(itemPath, 'hora local HH:mm') },
    ppMin: (item, itemPath) => { finite(item, itemPath); if (item < 0) fail(itemPath, 'número no negativo') },
    ppMax: (item, itemPath) => { finite(item, itemPath); if (item < 0) fail(itemPath, 'número no negativo') },
    sourceId: (item, itemPath) => { if (item !== 'F6') fail(itemPath, 'F6') },
  }, path)
  if (value.startLocal >= value.endLocal) fail(path, 'hora inicial menor que hora final')
  if (value.ppMin > value.ppMax) fail(path, 'ppMin menor o igual a ppMax')
}

function window(value, path) {
  exact(value, {
    id,
    startsAt: instant,
    endsAt: instant,
    minPp: (item, itemPath) => { finite(item, itemPath); if (item < 0) fail(itemPath, 'número no negativo') },
    origin: (item, itemPath) => enumValue([...windowOrigins], item, itemPath),
    sourceIds: (items, itemPath) => sortedUniqueStrings(items, itemPath, nonEmpty),
  }, path)
  if (Date.parse(value.startsAt) >= Date.parse(value.endsAt)) fail(path, 'startsAt anterior a endsAt')
}

function eligibility(value, path) {
  exact(value, {
    state: (item, itemPath) => enumValue([...eligibilityStates], item, itemPath),
    windowId: nullable(id),
    windowOrigin: nullable((item, itemPath) => enumValue([...windowOrigins], item, itemPath)),
    causes: (items, itemPath) => orderedSet(items, itemPath, cause,
      (item) => `${item.code}|${item.courseIds.join(',')}|${item.sectionIds.join(',')}`),
    gaps: (items, itemPath) => orderedSet(items, itemPath, gap,
      (item) => `${item.code}|${item.courseIds.join(',')}`),
  }, path)
  if ((value.windowId === null) !== (value.windowOrigin === null)) fail(path, 'windowId y windowOrigin ambos nulos o presentes')
  if (value.state === 'eligible' && (value.causes.length || value.gaps.length)) {
    fail(path, 'eligible sin causas ni gaps')
  }
  if (value.state === 'ineligible' && (!value.causes.length || value.gaps.length)) {
    fail(path, 'ineligible con causas y sin gaps')
  }
  if (value.state === 'configuration-pending' && !value.gaps.length) {
    fail(path, 'configuration-pending con gaps')
  }
}

function calendar(value, path) {
  exact(value, {
    publishedRows: (items, itemPath) => array(items, itemPath, publishedRow),
    effectiveWindows: (items, itemPath) => {
      array(items, itemPath, window)
      unique(items, itemPath, (item) => item.id)
    },
    unknownDates: (items, itemPath) => { array(items, itemPath, date); unique(items, itemPath) },
  }, path)
}

function context(value, path) {
  exact(value, {
    actorId: id,
    scope,
    profileRevision,
    serverNow: instant,
    preEnrollmentEnabled: nullable(boolean),
    preEnrollmentComplete: boolean,
    preEnrollment: (items, itemPath) => {
      array(items, itemPath, courseDocument)
      unique(items, itemPath, (item) => item.courseId)
    },
    offerKnown: boolean,
    offer: (items, itemPath) => {
      array(items, itemPath, offeredCourse)
      unique(items, itemPath, (item) => item.courseId)
    },
    calendar,
    eligibility,
    sources: (items, itemPath) => { array(items, itemPath, source); unique(items, itemPath, (item) => item.id) },
  }, path, {
    retakeCourseIds: (items, itemPath) => sortedUniqueStrings(items, itemPath, id),
    creditCap: nullable((item, itemPath) => integer(item, itemPath, 1, 60)),
  })
  if (Object.hasOwn(value, 'retakeCourseIds')) {
    const offered = new Set(value.offer.map((course) => course.courseId))
    value.retakeCourseIds.forEach((courseId, index) => {
      if (!offered.has(courseId)) fail(`${path}.retakeCourseIds[${index}]`, 'asignatura presente en offer')
    })
  }
  if (value.preEnrollmentEnabled === null && !value.eligibility.gaps.some((item) => item.code === 'PRE_ENROLLMENT_UNKNOWN')) {
    fail(`${path}.eligibility.gaps`, 'gap PRE_ENROLLMENT_UNKNOWN cuando habilitación es null')
  }
  if (value.preEnrollmentEnabled === null && value.eligibility.state !== 'configuration-pending') {
    fail(`${path}.eligibility.state`, 'configuration-pending cuando habilitación es null')
  }
  if (!value.preEnrollmentComplete || !value.offerKnown) {
    if (!value.eligibility.gaps.some((item) => item.code === 'PLAN_OR_OFFER_UNKNOWN')) {
      fail(`${path}.eligibility.gaps`, 'gap PLAN_OR_OFFER_UNKNOWN cuando datos están incompletos')
    }
    if (value.eligibility.state !== 'configuration-pending') {
      fail(`${path}.eligibility.state`, 'configuration-pending cuando datos están incompletos')
    }
  }
}

function selection(value, path, canonical = false) {
  array(value, path, choice, { min: 1, max: 32 })
  unique(value, path, (item) => item.courseId)
  unique(value, path, (item) => `${item.courseId}|${item.sectionId}`)
  if (canonical) {
    const sorted = [...value].sort((a, b) => a.courseId.localeCompare(b.courseId) || a.sectionId.localeCompare(b.sectionId))
    if (value.some((item, index) => item.courseId !== sorted[index].courseId || item.sectionId !== sorted[index].sectionId)) {
      fail(path, 'selección canónica ordenada por courseId y sectionId')
    }
  }
}

function submission(value, path) {
  exact(value, {
    runId: uuid,
    actorId: id,
    sessionId: uuid,
    requestId: uuid,
    profileRevision,
    selection: (items, itemPath) => selection(items, itemPath),
  }, path)
}

function outcome(value, path) {
  exact(value, {
    requestId: uuid,
    actorId: id,
    profileRevision,
    state: (item, itemPath) => enumValue([...outcomeStates], item, itemPath),
    evaluatedAt: instant,
    windowOrigin: nullable((item, itemPath) => enumValue([...windowOrigins], item, itemPath)),
    selection: (items, itemPath) => selection(items, itemPath, true),
    causes: (items, itemPath) => orderedSet(items, itemPath, cause,
      (item) => `${item.code}|${item.courseIds.join(',')}|${item.sectionIds.join(',')}`),
    gaps: (items, itemPath) => orderedSet(items, itemPath, gap,
      (item) => `${item.code}|${item.courseIds.join(',')}`),
    enrollmentId: nullable(uuid),
    reportPath: nullable(string),
  }, path)
  if (value.state === 'accepted') {
    if (value.causes.length || value.gaps.length || value.enrollmentId === null) fail(path, 'accepted con enrollment y sin causas/gaps')
    const expectedPath = `/local/matricula-regular/v1/reportes/${value.enrollmentId}`
    if (value.reportPath !== expectedPath) fail(`${path}.reportPath`, 'ruta local exacta del enrollment')
  } else {
    if (value.enrollmentId !== null || value.reportPath !== null) fail(path, 'resultado no aceptado sin matrícula ni reporte')
    if (value.state === 'rejected' && (!value.causes.length || value.gaps.length)) fail(path, 'rejected con causas y sin gaps')
    if (value.state === 'configuration-pending' && !value.gaps.length) fail(path, 'configuration-pending con gaps')
  }
}

function lookup(value, path) {
  exact(value, {
    state: (item, itemPath) => enumValue([...selectionStates], item, itemPath),
    outcome: nullable(outcome),
  }, path)
  if ((value.state === 'known') !== (value.outcome !== null)) fail(path, 'known con outcome y unknown con null')
}

function reportRow(value, path) {
  exact(value, {
    courseId: id,
    sectionId: id,
    planId: id,
    name: nonEmpty,
    credits: (item, itemPath) => { finite(item, itemPath); if (item <= 0) fail(itemPath, 'número mayor que cero') },
    schedule: (items, itemPath) => array(items, itemPath, meeting),
  }, path, {
    cycle: nullable(cycleValue),
    label: nonEmpty,
    teacher: nullable(nonEmpty),
  })
}

function enrollmentReport(value, path) {
  exact(value, {
    enrollmentId: uuid,
    requestId: uuid,
    actorId: id,
    scope,
    profileRevision,
    acceptedAt: instant,
    windowOrigin: (item, itemPath) => enumValue([...windowOrigins], item, itemPath),
    rows: (items, itemPath) => {
      array(items, itemPath, reportRow, { min: 1 })
      unique(items, itemPath, (item) => item.courseId)
      for (let index = 1; index < items.length; index += 1) {
        if (items[index - 1].courseId > items[index].courseId) fail(itemPath, 'rows ordenadas por courseId')
      }
    },
    totalCredits: (item, itemPath) => { finite(item, itemPath); if (item <= 0) fail(itemPath, 'número mayor que cero') },
  }, path)
  const total = value.rows.reduce((sum, row) => sum + row.credits, 0)
  if (total !== value.totalCredits) fail(`${path}.totalCredits`, 'suma exacta de rows')
}

function responseEnvelope(value, dataValidator, path = 'response') {
  exact(value, { runId: uuid, data: dataValidator }, path)
}

export function validateChoice(value) { choice(value, 'choice') }
export function validateScope(value) { scope(value, 'scope') }
export function validateSource(value) { source(value, 'source') }
export function validateGap(value) { gap(value, 'gap') }
export function validateCause(value) { cause(value, 'cause') }
export function validateSession(value) { session(value, 'session') }
export function validateContext(value) { context(value, 'context') }
export function validateSubmission(value) { submission(value, 'submission') }
export function validateOutcome(value) { outcome(value, 'outcome') }
export function validateLookup(value) { lookup(value, 'lookup') }
export function validateEnrollmentReport(value) { enrollmentReport(value, 'enrollmentReport') }

export function validateSessionRequest(value) {
  exact(value, { runId: uuid, actorId: id }, 'sessionRequest')
}

export function validateRenewalRequest(sessionId, value) {
  uuid(sessionId, 'sessionId')
  exact(value, { runId: uuid, actorId: id }, 'renewalRequest')
}

export function validateLookupQuery(value) {
  exact(value, { runId: uuid, actorId: id }, 'lookupQuery')
}

export function validateReportQuery(value) {
  exact(value, { runId: uuid, actorId: id }, 'reportQuery')
}

export function validateSubmissionRequest(value) {
  submission(value, 'submissionRequest')
}

export function validateActorId(value) { id(value, 'actorId') }
export function validateSessionId(value) { uuid(value, 'sessionId') }
export function validateRequestId(value) { uuid(value, 'requestId') }
export function validateEnrollmentId(value) { uuid(value, 'enrollmentId') }

export function validateContextResponse(value, expectedRunId, expectedActorId) {
  responseEnvelope(value, context, 'contextResponse')
  if (expectedRunId !== undefined && value.runId !== expectedRunId) fail('contextResponse.runId', 'runId esperado')
  if (expectedActorId !== undefined && value.data.actorId !== expectedActorId) fail('contextResponse.data.actorId', 'actorId esperado')
}

export function validateSessionResponse(value, expectedIdentity) {
  responseEnvelope(value, session, 'sessionResponse')
  if (value.runId !== expectedIdentity.runId || value.data.runId !== expectedIdentity.runId) fail('sessionResponse.runId', 'runId esperado')
  if (value.data.actorId !== expectedIdentity.actorId) fail('sessionResponse.data.actorId', 'actorId esperado')
  if (expectedIdentity.sessionId !== undefined && value.data.sessionId !== expectedIdentity.sessionId) fail('sessionResponse.data.sessionId', 'sessionId esperado')
}

export function validateOutcomeResponse(value, expectedIdentity) {
  responseEnvelope(value, outcome, 'outcomeResponse')
  if (value.runId !== expectedIdentity.runId) fail('outcomeResponse.runId', 'runId esperado')
  if (value.data.actorId !== expectedIdentity.actorId) fail('outcomeResponse.data.actorId', 'actorId esperado')
  if (value.data.requestId !== expectedIdentity.requestId) fail('outcomeResponse.data.requestId', 'requestId esperado')
  if (expectedIdentity.enrollmentId !== undefined && value.data.enrollmentId !== expectedIdentity.enrollmentId) fail('outcomeResponse.data.enrollmentId', 'enrollmentId esperado')
}

export function validateLookupResponse(value, expectedIdentity) {
  responseEnvelope(value, lookup, 'lookupResponse')
  if (value.runId !== expectedIdentity.runId) fail('lookupResponse.runId', 'runId esperado')
  if (value.data.outcome && (value.data.outcome.actorId !== expectedIdentity.actorId || value.data.outcome.requestId !== expectedIdentity.requestId)) {
    fail('lookupResponse.data.outcome', 'identidad actorId/requestId esperada')
  }
}

export function validateEnrollmentReportResponse(value, expectedIdentity) {
  responseEnvelope(value, enrollmentReport, 'enrollmentReportResponse')
  if (value.runId !== expectedIdentity.runId) fail('enrollmentReportResponse.runId', 'runId esperado')
  if (value.data.actorId !== expectedIdentity.actorId) fail('enrollmentReportResponse.data.actorId', 'actorId esperado')
  if (value.data.enrollmentId !== expectedIdentity.enrollmentId) fail('enrollmentReportResponse.data.enrollmentId', 'enrollmentId esperado')
  if (expectedIdentity.requestId !== undefined && value.data.requestId !== expectedIdentity.requestId) fail('enrollmentReportResponse.data.requestId', 'requestId esperado')
}

export function validateErrorResponse(value) {
  exact(value, {
    runId: uuid,
    error: (item, path) => exact(item, {
      code: nonEmpty,
      fields: (items, itemPath) => { array(items, itemPath, nonEmpty); unique(items, itemPath) },
    }, path),
  }, 'errorResponse')
}
