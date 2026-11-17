export const PLANNING_LIMITS: Readonly<{ courses: 96; teachers: 128; rooms: 128; sessions: 1024 }>
export const THESIS_COURSE_IDS: readonly string[]
export const KNOWN_FACULTY_IDS: readonly ['FISI']
export type PlanningPeriod = `${number}-${'I' | 'II'}`
export type PlanningPolicyExceptions = { saturdayStartMinute?: number; saturdayEndMinute?: number }
export type PlanningPolicy = {
  revision: 'FISI-PLANNING-1'
  period: PlanningPeriod
  allowAfternoon: boolean
  allowSaturday: boolean
  facultyId?: 'FISI'
  source?: string
  exceptions?: PlanningPolicyExceptions
}
export type PlanningTimeProfile = {
  facultyId: 'FISI' | null
  period: PlanningPeriod | null
  source: string
  weekdayStartMinute: number
  weekdayEndMinute: number
  seniorCycleThreshold: number | null
  seniorStartMinute: number
  seniorDefaultStartMinute: number
  saturdayAllowed: boolean
  saturdayStartMinute: number
  saturdayEndMinute: number
  exceptions: PlanningPolicyExceptions
}
export function isPlanningPeriod(value: unknown): value is PlanningPeriod
export function validatePlanningPolicy(value: unknown): asserts value is PlanningPolicy
export function resolvePlanningTimeProfile(policy?: PlanningPolicy | null): PlanningTimeProfile
export function planningIntervalRank(cycle: number | undefined | null, startMinute: number, day: number, duration: number, policy?: PlanningPolicy | null): number | null
export function isAllowedPlanningInterval(cycle: number | undefined | null, interval: { day: number; startMinute: number; endMinute: number }, policy?: PlanningPolicy | null): boolean
export function getEffectivePlanningWindows<T extends { day: number; startMinute: number; endMinute: number }>(baseWindows: T[], policy?: PlanningPolicy | null): Array<{ day: number; startMinute: number; endMinute: number }>
export function planningDefaults(cycle: number, period: PlanningPeriod): { estimatedDemand: number; targetCapacity: number }
export function syntheticTeachingMetadata(index?: number): { facultyId: 'FISI'; category: 'principal' | 'asociado' | 'auxiliar'; qualificationSource: 'synthetic' }
