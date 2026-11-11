import type { TeacherRegime, TeacherAppointment } from './academic-normative-profile.mjs'
export type PrototypeRegime = 'ordinario' | 'contratado'
export type PrototypeDedication = 'TC' | 'DE' | 'TP'
export type PrototypeTeacherProfile = { readonly id: string; readonly regime: PrototypeRegime; readonly dedication: PrototypeDedication }
export const PROTOTYPE_TEACHER_PROFILES: readonly PrototypeTeacherProfile[]
export function prototypeProfileFor(id: string): PrototypeTeacherProfile | null

export type SyntheticPlanningTeacherProfile = { readonly id: string; readonly regime: TeacherRegime; readonly appointment: TeacherAppointment }
export const SYNTHETIC_PLANNING_TEACHER_PROFILES: readonly SyntheticPlanningTeacherProfile[]
export function syntheticPlanningProfileFor(id: string): SyntheticPlanningTeacherProfile | null
