// Explicit local demo parameters supplied by the project operator, not official statistics.
export const PLANNING_LIMITS = Object.freeze({ courses: 96, teachers: 128, rooms: 128, sessions: 1024 })
export const THESIS_COURSE_IDS = Object.freeze(['20118081', '20118091', '20118101'])
export const KNOWN_FACULTY_IDS = Object.freeze(['FISI'])
export const FACULTY_PLANNING_PROFILES = Object.freeze({
  FISI: Object.freeze({
    facultyId: 'FISI',
    weekdayStartMinute: 8 * 60,
    weekdayEndMinute: 22 * 60,
    seniorCycleThreshold: 7,
    seniorDefaultStartMinute: 18 * 60,
    seniorAfternoonStartMinute: 14 * 60,
    saturdayStartMinute: 8 * 60,
    saturdayDefaultEndMinute: 13 * 60,
  }),
})
export function isPlanningPeriod(value) {
  return typeof value === 'string' && /^(20\d{2})-(I|II)$/.test(value)
}
const allowedPolicyKeys = ['allowAfternoon', 'allowSaturday', 'exceptions', 'facultyId', 'period', 'revision', 'source']
export function validatePlanningPolicy(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Política local de planificación inválida')
  }
  const keys = Object.keys(value)
  for (const required of ['allowAfternoon', 'allowSaturday', 'period', 'revision']) {
    if (!Object.hasOwn(value, required)) throw new TypeError('Política local de planificación inválida')
  }
  if (keys.some((key) => !allowedPolicyKeys.includes(key))
    || value.revision !== 'FISI-PLANNING-1' || !isPlanningPeriod(value.period)
    || typeof value.allowAfternoon !== 'boolean' || typeof value.allowSaturday !== 'boolean') {
    throw new TypeError('Política local de planificación inválida')
  }
  if (Object.hasOwn(value, 'facultyId') && !KNOWN_FACULTY_IDS.includes(value.facultyId)) {
    throw new TypeError(`Facultad de política local no admitida o desconocida: ${String(value.facultyId)}`)
  }
  if (Object.hasOwn(value, 'source') && (typeof value.source !== 'string' || !value.source.trim() || value.source.length > 120)) {
    throw new TypeError('Procedencia de política local inválida')
  }
  if (Object.hasOwn(value, 'exceptions')) {
    const exc = value.exceptions
    if (!exc || typeof exc !== 'object' || Array.isArray(exc)
      || Object.keys(exc).some((k) => !['saturdayStartMinute', 'saturdayEndMinute'].includes(k))) {
      throw new TypeError('Excepciones de política local inválidas')
    }
    const start = exc.saturdayStartMinute ?? 8 * 60
    const end = exc.saturdayEndMinute ?? 13 * 60
    if (!Number.isSafeInteger(start) || start < 0 || start > 1439
      || !Number.isSafeInteger(end) || end < 1 || end > 1440 || start >= end) {
      throw new TypeError('Rango horario de excepción de sábado inválido')
    }
    if ((Object.hasOwn(exc, 'saturdayStartMinute') || Object.hasOwn(exc, 'saturdayEndMinute')) && !value.allowSaturday) {
      throw new TypeError('La excepción de franja de sábado requiere allowSaturday activo')
    }
  }
}
export function resolvePlanningTimeProfile(policy) {
  if (!policy) {
    return {
      facultyId: null,
      period: null,
      source: 'unconstrained',
      weekdayStartMinute: 0,
      weekdayEndMinute: 1440,
      seniorCycleThreshold: null,
      seniorStartMinute: 0,
      seniorDefaultStartMinute: 0,
      saturdayAllowed: true,
      saturdayStartMinute: 0,
      saturdayEndMinute: 1440,
      exceptions: {},
    }
  }
  validatePlanningPolicy(policy)
  const facultyId = policy.facultyId ?? 'FISI'
  const base = FACULTY_PLANNING_PROFILES[facultyId]
  return {
    facultyId,
    period: policy.period,
    source: policy.source ?? 'synthetic-local-default',
    weekdayStartMinute: base.weekdayStartMinute,
    weekdayEndMinute: base.weekdayEndMinute,
    seniorCycleThreshold: base.seniorCycleThreshold,
    seniorStartMinute: policy.allowAfternoon ? base.seniorAfternoonStartMinute : base.seniorDefaultStartMinute,
    seniorDefaultStartMinute: base.seniorDefaultStartMinute,
    saturdayAllowed: policy.allowSaturday,
    saturdayStartMinute: policy.exceptions?.saturdayStartMinute ?? base.saturdayStartMinute,
    saturdayEndMinute: policy.exceptions?.saturdayEndMinute ?? base.saturdayDefaultEndMinute,
    exceptions: policy.exceptions ? { ...policy.exceptions } : {},
  }
}
export function planningIntervalRank(cycle, startMinute, day, duration, policy) {
  if (!policy) return 0
  const profile = resolvePlanningTimeProfile(policy)
  const endMinute = startMinute + duration
  const senior = (cycle ?? 0) >= profile.seniorCycleThreshold
  if (day === 7) return null
  if (day === 6) {
    return profile.saturdayAllowed && startMinute >= profile.saturdayStartMinute && endMinute <= profile.saturdayEndMinute
      ? (senior ? 2 : 1)
      : null
  }
  if (day < 1 || day > 5 || endMinute > profile.weekdayEndMinute) return null
  if (senior) {
    if (startMinute >= FACULTY_PLANNING_PROFILES[profile.facultyId].seniorDefaultStartMinute) return 0
    if (policy.allowAfternoon && startMinute >= profile.seniorStartMinute) return 1
    return null
  }
  return startMinute >= profile.weekdayStartMinute ? 0 : null
}
export function isAllowedPlanningInterval(cycle, interval, policy) {
  if (!policy) return true
  return planningIntervalRank(cycle, interval.startMinute, interval.day, interval.endMinute - interval.startMinute, policy) !== null
}
export function getEffectivePlanningWindows(baseWindows, policy) {
  const result = baseWindows.map((w) => ({ ...w }))
  if (!policy) return result
  const profile = resolvePlanningTimeProfile(policy)
  if (profile.saturdayAllowed) {
    result.push({ day: 6, startMinute: profile.saturdayStartMinute, endMinute: profile.saturdayEndMinute })
  }
  return result
}
export function planningDefaults(cycle, period) {
  if (!Number.isInteger(cycle) || cycle < 1 || cycle > 10 || !isPlanningPeriod(period)) {
    throw new TypeError('Ciclo o periodo de planificación inválido')
  }
  return { estimatedDemand: cycle % 2 === (period.endsWith('-II') ? 0 : 1) ? 180 : 90, targetCapacity: 45 }
}
export function syntheticTeachingMetadata(index = 0) {
  return { facultyId: 'FISI', category: ['principal', 'asociado', 'auxiliar'][index % 3], qualificationSource: 'synthetic' }
}
