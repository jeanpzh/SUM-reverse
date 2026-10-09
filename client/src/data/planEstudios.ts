import type { JsonValue } from './contracts.ts'
import type { PlanEstudios } from '../../../raw-types/plan-studios.ts'
import type { PlanEstudiosRepresentation } from '../../../shared/plan-estudios-wire.mjs'

const representations = new WeakMap<object, PlanEstudiosRepresentation>()

export function rememberPlanEstudiosRepresentation(
  response: object,
  representation: PlanEstudiosRepresentation,
): void {
  representations.set(response, representation)
}

export function getPlanEstudiosRepresentation(response: object): PlanEstudiosRepresentation | undefined {
  return representations.get(response)
}

export type PlanEstudiosLocal = JsonValue<PlanEstudios>['data']
const fail = () => new Error('La respuesta local del plan de estudios no cumple el contrato.')
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail()
  return value as Record<string, unknown>
}
const exact = (row: Record<string, unknown>, keys: string[]) => {
  if (Object.keys(row).length !== keys.length || keys.some((key) => !(key in row))) throw fail()
}
export function validatePlanEstudios(value: unknown, alumno?: Record<string, unknown>): asserts value is PlanEstudiosLocal {
  if (!Array.isArray(value)) throw fail()
  const seen = new Set<string>()
  const keys = ['codFacultad', 'codEscuela', 'codPlan', 'codEspecialidad', 'ciclo', 'codAsignatura', 'desAsignatura',
    'creditos', 'tipoAsignatura', 'codGrupo', 'codAsignaturaPre', 'desAsignaturaPre', 'codGrupoPre', 'creditosPre']
  for (const raw of value) {
    const row = object(raw); exact(row, keys)
    const textKeys = ['codPlan', 'codAsignatura', 'desAsignatura', 'codAsignaturaPre', 'desAsignaturaPre']
    if (textKeys.some((key) => typeof row[key] !== 'string') || !String(row.codPlan).trim()
      || row.codPlan !== '2018  '
      || !String(row.codAsignatura).trim() || !String(row.desAsignatura).trim()
      || !['O', 'E'].includes(String(row.tipoAsignatura)) || !['GEG', '--'].includes(String(row.codGrupo))
      || !['GEG', '--'].includes(String(row.codGrupoPre))
      || !Number.isSafeInteger(row.codFacultad) || Number(row.codFacultad) < 0
      || !Number.isSafeInteger(row.codEscuela) || Number(row.codEscuela) < 0
      || !Number.isSafeInteger(row.codEspecialidad) || Number(row.codEspecialidad) < 0
      || !Number.isSafeInteger(row.ciclo) || Number(row.ciclo) <= 0
      || typeof row.creditos !== 'number' || !Number.isFinite(row.creditos) || row.creditos < 0
      || typeof row.creditosPre !== 'number' || !Number.isFinite(row.creditosPre) || row.creditosPre < 0) throw fail()
    if (alumno && (row.codFacultad !== alumno.codFacultad || row.codEscuela !== alumno.codEscuela
      || row.codEspecialidad !== alumno.codEspecialidad || row.codPlan !== alumno.codPlan)) throw fail()
    if (Boolean(row.codAsignaturaPre) !== Boolean(row.desAsignaturaPre)) throw fail()
    const key = `${row.codPlan}/${row.codEspecialidad}/${row.codAsignatura}`
    if (seen.has(key)) throw fail()
    seen.add(key)
  }
}
