export type PrototypeRegime = 'ordinario' | 'contratado'
export type PrototypeDedication = 'TC' | 'DE' | 'TP'
export type PrototypeTeacherProfile = { readonly id: string; readonly regime: PrototypeRegime; readonly dedication: PrototypeDedication }
export const PROTOTYPE_TEACHER_PROFILES: readonly PrototypeTeacherProfile[]
export function prototypeProfileFor(id: string): PrototypeTeacherProfile | null
