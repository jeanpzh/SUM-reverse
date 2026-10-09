// Operator-only transformation. Agents must not execute it on private datasets.
import { readFile, writeFile, mkdir, lstat, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { snapshotJobs, validateSnapshot } from './sum-snapshot-contract.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const input = join(root, 'datos-reales')
const output = join(root, 'datos-sinteticos')
const args = process.argv.slice(2)
if (args.length && (args.length !== 2 || args[0] !== '--seed' || !/^\d{1,9}$/.test(args[1]))) {
  console.error('Uso: node scripts/generate-synthetic.mjs [--seed 42]')
  process.exit(1)
}
let state = Number(args[1] ?? 42) >>> 0
function random() {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0
  return state / 2 ** 32
}
const maps = new Map()
function alias(family, original) {
  if (!maps.has(family)) maps.set(family, new Map())
  const values = maps.get(family)
  const token = String(original)
  if (!values.has(token)) values.set(token, values.size + 1)
  return values.get(token)
}
const names = ['Matemática Aplicada', 'Sistemas de Información', 'Diseño de Software',
  'Investigación Académica', 'Comunicación Profesional', 'Redes y Servicios',
  'Gestión de Proyectos', 'Análisis de Datos', 'Fundamentos de Computación']
const courses = new Map()
const descriptions = new Map()
const periods = new Set()
const times = []
const grades = new Set()
const gradeKeys = /^(calificacion|promedio|promUltMat|ponderado|promedioPonderado)$/i
const structuralNumbers = /^(creditos|creditosPre|creditoAsignatura|creditosMatriculados|num_creditaje|totales_creditos|creditosAprobados|asignaturasAprobadas|ciclo|cicloEstudios|cicloEstudio|anioEstudio|num_ciclo_ano_asig|numRepitencias|numRepitenciasEquiv|num_rep_plan_act|num_mat_equiv|num_rep_total|numMaxRepitencias|codSeccion|seccion|horario|color|topeAlumnos|matriculados|topeAlumnosLab|matriculadosLab|areaFacultad|areaEscuela)$/i
const categories = /^(tipoAsignatura|codTipoAsignatura|codTipoActa|codTipoHoraAsignatura|desTipoHoraAsignatura|codGrupo|codGrupoPre|regimen|tipoDocumento|codSexo|codPermanencia|codSituacion|egresadoEG|ind[A-Za-z]+)$/
const marker = new Set(['', '--', 'NR'])
const categoryValues = new Set(['O', 'E', 'P', 'T', 'L', 'N', 'S', 'GEG', 'DNI', 'CE',
  'Semestral', 'SEMESTRAL', 'Teoría', 'Práctica', 'Laboratorio'])
let currentFile = 'inicio'

function normalizePeriod(value) {
  return typeof value === 'string' ? value.trim().replace(/^(\d{4})([12])$/, '$1-$2') : ''
}

function collect(value) {
  if (Array.isArray(value)) { value.forEach(collect); return }
  if (!value || typeof value !== 'object') return
  if (typeof value.codAsignatura === 'string' && !marker.has(value.codAsignatura)) {
    if (!courses.has(value.codAsignatura)) {
      const index = courses.size
      courses.set(value.codAsignatura, { code: `DEMO-${String(index + 1).padStart(3, '0')}`,
        name: `${names[index % names.length]} ${Math.floor(index / names.length) + 1}` })
    }
    if (typeof value.desAsignatura === 'string') descriptions.set(value.desAsignatura, courses.get(value.codAsignatura).name)
  }
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'number' && gradeKeys.test(key)) grades.add(item)
    for (const candidate of [key, item]) {
      if (typeof candidate !== 'string') continue
      if (/^\d{4}-?[12]$/.test(candidate.trim())) periods.add(normalizePeriod(candidate))
      if (/^\d{2}:\d{2}$/.test(candidate)) {
        const [hour, minute] = candidate.split(':').map(Number)
        times.push(hour * 60 + minute)
      }
    }
    collect(item)
  }
}

async function main() {
  if (!(await lstat(input)).isDirectory()) throw new Error('DIRECTORIO_ENTRADA')
  const sources = []
  for (const job of snapshotJobs) {
    currentFile = job.filename
    const path = join(input, job.filename)
    if (!(await lstat(path)).isFile()) throw new Error('ARCHIVO_ENTRADA')
    const envelope = JSON.parse(await readFile(path, 'utf8'))
    validateSnapshot(job, envelope)
    collect(envelope)
    sources.push({ job, envelope })
  }
  // Public type names define the keys we may retain. Opaque dynamic names are replaced.
  const knownKeys = new Set(['message', 'codError', 'data'])
  for (const file of await readdir(join(root, 'raw-types'))) {
    if (!file.endsWith('.ts')) continue
    const text = await readFile(join(root, 'raw-types', file), 'utf8')
    for (const match of text.matchAll(/^\s*(\w+)\??\s*:/gm)) knownKeys.add(match[1])
  }
  const orderedPeriods = [...periods].sort()
  const yearShift = 2040 - Number(orderedPeriods[0]?.slice(0, 4) ?? 2026)
  const periodMap = new Map(orderedPeriods.map((period) => [period,
    `${Number(period.slice(0, 4)) + yearShift}-${period.slice(-1)}`]))
  const orderedGrades = [...grades].sort((a, b) => a - b)
  const gradeMap = new Map(orderedGrades.map((grade, index) => [grade,
    Number((10 + 9 * (index + 1) / (orderedGrades.length + 1)).toFixed(2))]))
  const timeShift = times.length && Math.max(...times) < 24 * 60 - 30 ? 30
    : times.length && Math.min(...times) >= 30 ? -30 : 0
  const days = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']

  function transform(value, key = '', parent = '') {
    if (value === null || typeof value === 'boolean') return value
    if (Array.isArray(value)) return value.map((item) => transform(item, key, parent))
    if (typeof value === 'object') {
      const entries = Object.entries(value).map(([name, item]) => {
        const renamed = knownKeys.has(name) ? name : periodMap.get(normalizePeriod(name))
          ?? (key === 'creditaje' && /^[OE]$/.test(name) ? name : `campo${alias('keys', name)}`)
        return [renamed, transform(item, name, key)]
      })
      return Object.fromEntries(entries)
    }
    if (typeof value === 'number') {
      if (gradeKeys.test(key)) return gradeMap.get(value)
      if (/^(anioIngreso|anioEstudioIngreso)$/.test(key)) return value + yearShift
      if (key === 'numDia') return value >= 1 && value <= 7 ? (value + 1) % 7 + 1 : 0
      if (/^hora(Inicio|Fin)Min$/.test(key)) return value + timeShift
      if (structuralNumbers.test(key) || parent === 'creditaje') return value
      if (/^(codFacultad|facultad|codEscuela|escuela|codEspecialidad)$/.test(key)) return 1
      return value === 0 ? 0 : 1 + Math.floor(random() * 99)
    }
    if (typeof value !== 'string') throw new Error('VALOR_NO_JSON')
    if (marker.has(value)) return value
    if (/foto|imagen|url|password|cookie|token|secret/i.test(key)) return ''
    if (periodMap.has(normalizePeriod(value))) return periodMap.get(normalizePeriod(value))
    if (categories.test(key)) return categoryValues.has(value) ? value : 'DEMO'
    if (/^\d{2}:\d{2}$/.test(value)) {
      const [hour, minute] = value.split(':').map(Number)
      const shifted = hour * 60 + minute + timeShift
      return `${String(Math.floor(shifted / 60)).padStart(2, '0')}:${String(shifted % 60).padStart(2, '0')}`
    }
    if (/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value)) {
      const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value)
      if (!Number.isFinite(date.getTime())) return '2040-01-01'
      date.setUTCFullYear(date.getUTCFullYear() + yearShift)
      date.setUTCDate(date.getUTCDate() + 13)
      return value.length === 10 ? date.toISOString().slice(0, 10) : date.toISOString()
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      const [day, month, year] = value.split('/').map(Number)
      const date = new Date(Date.UTC(year + yearShift, month - 1, day + 13))
      return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`
    }
    if (/^anioIngreso$/.test(key) && /^\d{4}$/.test(value)) return String(Number(value) + yearShift)
    if (key === 'dia') return days.includes(value.toUpperCase()) ? days[(days.indexOf(value.toUpperCase()) + 2) % 7] : 'LUNES'
    if (/^codAsignatura(Pre)?$/.test(key)) return courses.get(value)?.code ?? `DEMO-${String(alias('course', value) + courses.size).padStart(3, '0')}`
    if (/^desAsignatura(Pre)?$/.test(key)) return descriptions.get(value) ?? 'Asignatura de demostración'
    if (/correo|email/i.test(key)) return `demo${alias('mail', value)}@example.test`
    if (/telefono|celular/i.test(key)) return `90000${String(alias('phone', value)).padStart(4, '0')}`
    if (/numDocumento/i.test(key)) return `DEMO-DOC-${alias('document', value)}`
    if (/^(codAlumno|codDocente|codColegioProc|numActa|acta|id|nroTicketMatEG)$/.test(key)) return `DEMO-${key}-${alias(key, value)}`
    if (/^(apePaterno|apePatAlumno|apePatDocente)$/.test(key)) return 'DEMOSTRACIÓN'
    if (/^(apeMaterno|apeMatAlumno|apeMatDocente)$/.test(key)) return 'LOCAL'
    if (/^(nomAlumno|nombreAlumno)$/.test(key)) return 'ESTUDIANTE'
    if (key === 'nomDocente') return 'DOCENTE'
    if (key === 'codPlan') return '2040  '
    if (/^(situAcademica|permanencia|desPermanencia|desSituacion)$/.test(key)) return 'Regular'
    if (/estadoCivil/.test(key)) return 'No especificado'
    if (/sexo/i.test(key)) return 'No especificado'
    if (/monto|aporte|pago/i.test(key) && /^\d+(\.\d+)?$/.test(value)) return (25 + Math.floor(random() * 20) * 5).toFixed(2)
    return `Dato de demostración ${alias('text', value)}`
  }

  const results = sources.map(({ job, envelope }) => ({ job, envelope: transform(envelope) }))
  // Period averages follow the rewritten course grades. No pass threshold is inferred.
  const history = results.find(({ job }) => job.key === 'historial').envelope.data
  for (const average of history.promedios) {
    const rows = history.historial.filter((row) => row.codSemestre === average.semestre)
    const credits = rows.reduce((sum, row) => sum + row.creditos, 0)
    if (credits > 0) average.promedio = Number((rows.reduce((sum, row) => sum + row.calificacion * row.creditos, 0) / credits).toFixed(2))
  }
  for (const { job, envelope } of results) {
    currentFile = job.filename
    validateSnapshot(job, envelope)
  }
  await mkdir(output, { recursive: true, mode: 0o700 })
  if (!(await lstat(output)).isDirectory()) throw new Error('DIRECTORIO_SALIDA')
  for (const { job, envelope } of results) {
    const path = join(output, job.filename)
    try { if (!(await lstat(path)).isFile()) throw new Error('DESTINO_INVALIDO') }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    await writeFile(path, `${JSON.stringify(envelope, null, 2)}\n`, { mode: 0o600 })
  }
  console.log('Generados y validados 9 fixtures derivados en datos-sinteticos/. No se imprimieron datos originales.')
}

try { await main() }
catch {
  console.error(`Generación detenida: ${currentFile} · revise el archivo y su esquema localmente. No se muestran valores ni errores originales.`)
  process.exitCode = 1
}
