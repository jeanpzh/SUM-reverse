// Explicit local demo parameters supplied by the project operator, not official statistics.
export const PLANNING_LIMITS = Object.freeze({ courses: 96, teachers: 128, rooms: 128, sessions: 1024 })
export const THESIS_COURSE_IDS = Object.freeze(['20118081', '20118091', '20118101'])
export function isPlanningPeriod(value) {
  return typeof value === 'string' && /^(20\d{2})-(I|II)$/.test(value)
}
export function validatePlanningPolicy(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join(',') !== 'allowAfternoon,allowSaturday,period,revision'
    || value.revision !== 'FISI-PLANNING-1' || !isPlanningPeriod(value.period)
    || typeof value.allowAfternoon !== 'boolean' || typeof value.allowSaturday !== 'boolean') {
    throw new TypeError('Política local de planificación inválida')
  }
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
