import {
  validateActorId,
  validateScope,
  validateSessionId,
  validateSessionRequest,
} from './matricula-regular.mjs'

export const dashboardKeys = Object.freeze([
  'perfil',
  'formulario',
  'historial',
  'fichaSocioeconomica',
  'matriculaInfo',
  'programacion',
  'prematricula',
  'matricula',
  'horarios',
  'evaluaciones',
  'deudas',
  'asistencias',
  'tutoria',
  'plan',
])

const actorIds = Object.freeze(['SYN-SIS-A', 'SYN-SIS-B', 'SYN-SOFT-A', 'SYN-SOFT-B'])
const objectPrototype = Object.prototype

function fail(path, expected) {
  throw new TypeError(`${path}: se esperaba ${expected}`)
}

function record(value, path) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'objeto')
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== objectPrototype && prototype !== null) fail(path, 'objeto plano')
  return value
}

function exact(value, shape, path) {
  const item = record(value, path)
  for (const [key, validate] of Object.entries(shape)) {
    if (!Object.hasOwn(item, key)) fail(`${path}.${key}`, 'campo presente')
    validate(item[key], `${path}.${key}`)
  }
  for (const key of Object.keys(item)) {
    if (!Object.hasOwn(shape, key)) fail(`${path}.${key}`, 'clave permitida')
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

function canonicalInstant(value, path) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    fail(path, 'instante UTC YYYY-MM-DDTHH:mm:ss.sssZ')
  }
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    fail(path, 'instante UTC canónico')
  }
}

function validateActorChoice(value, path) {
  const choice = record(value, path)
  if (!actorIds.includes(choice.actorId)) fail(`${path}.actorId`, 'actor sintético permitido')
  exact(choice, {
    actorId: (item, itemPath) => {
      if (!actorIds.includes(item)) fail(itemPath, 'actor sintético permitido')
    },
    name: nonEmpty,
    scope: (item, itemPath) => validateScope(item),
  }, path)
  const school = choice.actorId.startsWith('SYN-SIS-') ? 'SISTEMAS' : 'SOFTWARE'
  const plan = school === 'SISTEMAS' ? 'SYN-SIS-PLAN' : 'SYN-SOFT-PLAN'
  if (choice.scope.schoolId !== school || choice.scope.planId !== plan) {
    fail(`${path}.scope`, 'alcance correlacionado con actorId')
  }
}

function validateCatalog(value) {
  const catalog = exact(value, {
    serverNow: canonicalInstant,
    profiles: (items, path) => {
      if (!Array.isArray(items)) fail(path, 'array')
      if (items.length !== actorIds.length) fail(path, 'catálogo exacto de cuatro perfiles')
      const seen = new Set()
      items.forEach((item, index) => {
        validateActorChoice(item, `${path}[${index}]`)
        if (seen.has(item.actorId)) fail(path, 'actorId únicos')
        seen.add(item.actorId)
        if (item.actorId !== actorIds[index]) fail(`${path}[${index}].actorId`, 'orden fijo de perfiles')
      })
    },
  }, 'profileCatalogResponse.data')
  return catalog
}

export function validateDashboardKey(value) {
  if (typeof value !== 'string' || !dashboardKeys.includes(value)) {
    fail('dashboardKey', `uno de ${dashboardKeys.join(', ')}`)
  }
}

export function validateDashboardIdentity(value) {
  const identity = record(value, 'dashboardIdentity')
  exact(identity, {
    runId: string,
    actorId: string,
    sessionId: string,
  }, 'dashboardIdentity')
  validateSessionRequest({ runId: identity.runId, actorId: identity.actorId })
  validateActorId(identity.actorId)
  if (!actorIds.includes(identity.actorId)) fail('dashboardIdentity.actorId', 'actor sintético permitido')
  validateSessionId(identity.sessionId)
}

export function validateProfileCatalogResponse(value) {
  const envelope = exact(value, {
    runId: string,
    data: validateCatalog,
  }, 'profileCatalogResponse')
  validateSessionRequest({ runId: envelope.runId, actorId: actorIds[0] })
}

export function validateDashboardReadResponse(value, expected, validatePayload) {
  const identity = record(expected, 'expectedDashboardIdentity')
  exact(identity, {
    runId: string,
    actorId: string,
    sessionId: string,
    key: validateDashboardKey,
  }, 'expectedDashboardIdentity')
  validateDashboardIdentity({
    runId: identity.runId,
    actorId: identity.actorId,
    sessionId: identity.sessionId,
  })

  let read
  const envelope = exact(value, {
    runId: string,
    data: (data, path) => {
      read = exact(data, {
        actorId: string,
        sessionId: string,
        key: validateDashboardKey,
        serverNow: canonicalInstant,
        payload: () => {},
      }, path)
    },
  }, 'dashboardReadResponse')
  validateSessionRequest({ runId: envelope.runId, actorId: read.actorId })
  validateSessionId(read.sessionId)
  if (envelope.runId !== identity.runId) fail('dashboardReadResponse.runId', 'runId esperado')
  if (read.actorId !== identity.actorId) fail('dashboardReadResponse.data.actorId', 'actorId esperado')
  if (read.sessionId !== identity.sessionId) fail('dashboardReadResponse.data.sessionId', 'sessionId esperado')
  if (read.key !== identity.key) fail('dashboardReadResponse.data.key', 'key esperada')
  if (typeof validatePayload !== 'function') fail('validatePayload', 'función')
  validatePayload(read.payload)
}
