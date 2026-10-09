const rowFields = {
  codFacultad: 'number',
  codEscuela: 'number',
  codPlan: 'codPlan',
  codEspecialidad: 'number',
  ciclo: 'number',
  codAsignatura: 'string',
  desAsignatura: 'string',
  creditos: 'number',
  tipoAsignatura: 'tipoAsignatura',
  codGrupo: 'codGrupo',
  codAsignaturaPre: 'string',
  desAsignaturaPre: 'string',
  codGrupoPre: 'codGrupo',
  creditosPre: 'number',
}

const literalValues = {
  codPlan: ['2018  '],
  tipoAsignatura: ['E', 'O'],
  codGrupo: ['GEG', '--'],
}

export class PlanEstudiosWireValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'PlanEstudiosWireValidationError'
  }
}

function fail(path, expected) {
  throw new PlanEstudiosWireValidationError(`${path}: ${expected}`)
}

function record(value, path) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'se esperaba objeto')
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) fail(path, 'se esperaba objeto JSON')
  return value
}

function validateArrayShape(value, path) {
  if (Object.getPrototypeOf(value) !== Array.prototype) fail(path, 'se esperaba array JSON')
  for (const key of Reflect.ownKeys(value)) {
    if (key === 'length') continue
    if (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length) {
      fail(`${path}.[extra]`, 'se esperaba valor JSON')
    }
  }
}

function validateJson(value, path, ancestors) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return
    fail(path, 'se esperaba valor JSON')
  }
  if (typeof value !== 'object') fail(path, 'se esperaba valor JSON')
  if (ancestors.has(value)) fail(path, 'se esperaba valor JSON sin ciclos')
  ancestors.add(value)

  if (Array.isArray(value)) {
    validateArrayShape(value, path)
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) fail(`${path}[${index}]`, 'se esperaba valor JSON')
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
        fail(`${path}[${index}]`, 'se esperaba valor JSON')
      }
      validateJson(descriptor.value, `${path}[${index}]`, ancestors)
    }
  } else {
    record(value, path)
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') fail(`${path}.[extra]`, 'se esperaba valor JSON')
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
        fail(`${path}.[extra]`, 'se esperaba valor JSON')
      }
      validateJson(descriptor.value, `${path}.[extra]`, ancestors)
    }
  }

  ancestors.delete(value)
}

function validateExtraFields(value, knownFields, path, ancestors) {
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') fail(`${path}.[extra]`, 'se esperaba valor JSON')
    if (Object.hasOwn(knownFields, key)) continue
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
      fail(`${path}.[extra]`, 'se esperaba valor JSON')
    }
    validateJson(descriptor.value, `${path}.[extra]`, ancestors)
  }
}

function required(recordValue, key, path) {
  if (!Object.hasOwn(recordValue, key)) fail(`${path}.${key}`, 'se esperaba campo presente')
  const descriptor = Object.getOwnPropertyDescriptor(recordValue, key)
  if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
    fail(`${path}.${key}`, 'se esperaba campo presente')
  }
  return descriptor.value
}

function validateRow(value, index, ancestors) {
  const path = `plan.data[${index}]`
  const row = record(value, path)
  for (const [key, kind] of Object.entries(rowFields)) {
    const field = required(row, key, path)
    if (kind === 'number' && (typeof field !== 'number' || !Number.isFinite(field))) {
      fail(`${path}.${key}`, 'se esperaba number finito')
    }
    if (kind === 'string' && typeof field !== 'string') fail(`${path}.${key}`, 'se esperaba string')
    if (kind in literalValues && !literalValues[kind].includes(field)) {
      fail(`${path}.${key}`, 'literal no admitido')
    }
  }
  validateExtraFields(row, rowFields, path, ancestors)
}

export function validatePlanEstudiosWire(value) {
  const envelope = record(value, 'plan')
  const message = required(envelope, 'message', 'plan')
  if (message !== null && typeof message !== 'string') fail('plan.message', 'se esperaba string o null')
  if (required(envelope, 'codError', 'plan') !== null) fail('plan.codError', 'se esperaba null')
  const data = required(envelope, 'data', 'plan')
  if (!Array.isArray(data)) fail('plan.data', 'se esperaba array')
  validateArrayShape(data, 'plan.data')

  const ancestors = new WeakSet([envelope, data])
  validateExtraFields(envelope, { message: true, codError: true, data: true }, 'plan', ancestors)
  for (let index = 0; index < data.length; index += 1) {
    if (!Object.hasOwn(data, index)) fail(`plan.data[${index}]`, 'se esperaba objeto')
    const descriptor = Object.getOwnPropertyDescriptor(data, String(index))
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
      fail(`plan.data[${index}]`, 'se esperaba objeto')
    }
    validateRow(descriptor.value, index, ancestors)
  }
  return value
}
