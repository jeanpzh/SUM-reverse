import type { TeacherRegime, TeacherAppointment, NormativeTeacher, LectiveHourMinutes } from './academic-normative-profile.mjs'
export const PLANNING_LIMITS: Readonly<{ courses: 96; teachers: 128; rooms: 128; sessions: 1024 }>
export const THESIS_COURSE_IDS: readonly string[]
export type PlanningPeriod = `${number}-${'I' | 'II'}`
export type PlanningPolicy = { revision: 'FISI-PLANNING-1'; period: PlanningPeriod; allowAfternoon: boolean; allowSaturday: boolean }
export function isPlanningPeriod(value: unknown): value is PlanningPeriod
export function validatePlanningPolicy(value: unknown): asserts value is PlanningPolicy
export function planningDefaults(cycle: number, period: PlanningPeriod): { estimatedDemand: number; targetCapacity: number }
export function syntheticTeachingMetadata(index?: number, teacherId?: string): { facultyId: 'FISI'; category: 'principal' | 'asociado' | 'auxiliar'; qualificationSource: 'synthetic'; regime?: TeacherRegime; appointment?: TeacherAppointment }

export function syntheticTeacherMaxMinutes(teacher: NormativeTeacher, options: { period: PlanningPeriod; lectiveHourMinutes: LectiveHourMinutes }): number
