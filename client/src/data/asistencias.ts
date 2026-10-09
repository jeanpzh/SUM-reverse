import type { ApiResponseMap } from './contracts.ts'

type AttendanceRow = ApiResponseMap['asistencias']['data'][number]

const attendanceKeys = [
  'codAlumno', 'apellidoMaterno', 'apellidoPaterno', 'nombreAlumno', 'codSemestre',
  'codFacultad', 'codEscuela', 'codEspecialidad', 'desEspecialidad', 'codPlan',
  'codAsignatura', 'desAsignatura', 'codSeccion', 'numClases', 'cantPresentes',
  'cantFaltas', 'cantTardanzas', 'cantAsistencias', 'porcentajePresentes',
  'porcentajeFaltas', 'porcentajeTardanzas', 'porcentajeAsistencias',
] as const satisfies readonly (keyof AttendanceRow)[]

const invalid = () => new Error('La respuesta local de asistencias no cumple el contrato.')

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function percentage(count: number, classes: number) {
  return classes > 0 ? Math.round((count / classes) * 10000) / 100 : 0
}

function validateRow(value: unknown): value is AttendanceRow {
  if (!isRecord(value) || Object.keys(value).length !== attendanceKeys.length
    || attendanceKeys.some((key) => !Object.hasOwn(value, key))) return false

  if (!isNonEmptyString(value.codAlumno) || !isNonEmptyString(value.codSemestre)
    || !isNonEmptyString(value.desEspecialidad) || !isNonEmptyString(value.codPlan)
    || !isNonEmptyString(value.codAsignatura) || !isNonEmptyString(value.desAsignatura)
    || value.apellidoMaterno !== null || value.apellidoPaterno !== null || value.nombreAlumno !== null) return false

  for (const key of ['codFacultad', 'codEscuela', 'codEspecialidad', 'codSeccion', 'numClases',
    'cantPresentes', 'cantFaltas', 'cantTardanzas', 'cantAsistencias'] as const) {
    if (!isCount(value[key])) return false
  }
  if (value.codSeccion === 0) return false

  const classes = value.numClases as number
  const present = value.cantPresentes as number
  const late = value.cantTardanzas as number
  const absent = value.cantFaltas as number
  const attendance = value.cantAsistencias as number
  if (present + late + absent !== classes || attendance !== present + late) return false

  for (const [key, count] of [
    ['porcentajePresentes', present], ['porcentajeTardanzas', late],
    ['porcentajeFaltas', absent], ['porcentajeAsistencias', attendance],
  ] as const) {
    const actual = value[key]
    if (typeof actual !== 'number' || !Number.isFinite(actual) || actual < 0 || actual > 100
      || Math.abs(actual - percentage(count, classes)) > 0.000001) return false
  }

  return true
}

export function validateAsistencias(value: unknown): AttendanceRow[] {
  if (!Array.isArray(value) || !value.every(validateRow)) throw invalid()
  return value
}
