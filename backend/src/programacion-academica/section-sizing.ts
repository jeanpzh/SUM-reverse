import type { CourseDemand, SectionEstimate } from './programacion-academica.types.js'

/** Validates plain input without coercion, defaults or unknown fields. */
export function validateCourseDemand(value: unknown): asserts value is CourseDemand {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new TypeError('demanda: se esperaba un objeto plano')
  }

  const input = value as Record<string, unknown>
  const fields = ['courseId', 'estimatedDemand', 'targetCapacity']
  for (const field of fields) {
    if (!Object.hasOwn(input, field)) throw new TypeError(`${field}: campo obligatorio`)
  }
  for (const field of Object.keys(input)) {
    if (!fields.includes(field)) throw new TypeError(`${field}: campo no permitido`)
  }

  if (typeof input.courseId !== 'string' || input.courseId.trim().length === 0
    || input.courseId !== input.courseId.trim()) {
    throw new TypeError('courseId: se esperaba un identificador no vacío y sin espacios en los extremos')
  }
  if (typeof input.estimatedDemand !== 'number' || !Number.isSafeInteger(input.estimatedDemand)
    || input.estimatedDemand < 0) {
    throw new TypeError('estimatedDemand: se esperaba un entero seguro mayor o igual a cero')
  }
  if (typeof input.targetCapacity !== 'number' || !Number.isSafeInteger(input.targetCapacity)
    || input.targetCapacity <= 0) {
    throw new TypeError('targetCapacity: se esperaba un entero seguro mayor que cero')
  }
}

/** Estimates sections only: does not create sections, reserve seats or persist data. */
export function calculateRequiredSections(input: unknown): SectionEstimate {
  validateCourseDemand(input)

  return {
    courseId: input.courseId,
    estimatedDemand: input.estimatedDemand,
    targetCapacity: input.targetCapacity,
    requiredSections: Math.ceil(input.estimatedDemand / input.targetCapacity),
  }
}
