import type { ApiResponseMap } from './contracts.ts'
import { assertMatriculaWire } from './matriculaWire.ts'

export type ProgramacionLocal = ApiResponseMap['programacion']

export function validateProgramacion(value: unknown): asserts value is ProgramacionLocal {
  assertMatriculaWire('programacion', value)
}
