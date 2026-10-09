import type { DeudaLocalRow, EvaluacionLocalRow } from './contracts.ts'

const evaluationKeys = ['ciclo', 'codAsignatura', 'desAsignatura', 'tipoEvaluacion', 'calificacion', 'formula']
const debtKeys = ['fechaRegistro', 'periodoAcademico', 'concepto', 'montoInicial', 'montoFinal', 'observacion']

function invalid(): never {
  throw new Error('La respuesta local de reportes no cumple el contrato.')
}

function exactRecord(value: unknown, keys: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  const record = value as Record<string, unknown>
  if (Object.keys(record).length !== keys.length || keys.some((key) => !Object.hasOwn(record, key))) return invalid()
  return record
}

export function validateEvaluaciones(value: unknown): EvaluacionLocalRow[] {
  if (!Array.isArray(value)) return invalid()
  for (const item of value) {
    const row = exactRecord(item, evaluationKeys)
    if (!Number.isInteger(row.ciclo) || Number(row.ciclo) <= 0 || !Number.isFinite(row.calificacion)
      || ['codAsignatura', 'desAsignatura', 'tipoEvaluacion', 'formula'].some((key) =>
        typeof row[key] !== 'string' || row[key] === '')) return invalid()
  }
  return value as EvaluacionLocalRow[]
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

export function validateDeudas(value: unknown): DeudaLocalRow[] {
  if (!Array.isArray(value)) return invalid()
  for (const item of value) {
    const row = exactRecord(item, debtKeys)
    if (!validDate(row.fechaRegistro)
      || ['periodoAcademico', 'concepto'].some((key) => typeof row[key] !== 'string' || row[key] === '')
      || ['montoInicial', 'montoFinal'].some((key) => typeof row[key] !== 'string' || !/^\d+\.\d{2}$/.test(row[key] as string))
      || typeof row.observacion !== 'string') return invalid()
  }
  return value as DeudaLocalRow[]
}
