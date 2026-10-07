import type { ApiResponseMap, EndpointKey } from './contracts.ts'
import { endpoints } from './endpoints.ts'
import { validateBaseUrl } from './config.ts'

export function buildEndpointUrl(baseUrl: string, key: EndpointKey) {
  validateBaseUrl(baseUrl)
  const relative = baseUrl.startsWith('/')
  const url = new URL(baseUrl, 'http://local.invalid')
  url.pathname = `${url.pathname.replace(/\/$/, '')}/alumnoWebSum/v2/${endpoints[key].path}`
  url.searchParams.set('accion', endpoints[key].action)
  url.hash = ''
  return relative ? `${url.pathname}${url.search}` : url.href
}

type Fields = { strings?: string[]; numbers?: string[]; booleans?: string[] }
const invalid = () => new Error('La respuesta de API no tiene la estructura esperada.')
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  return value as Record<string, unknown>
}
function fields(value: unknown, schema: Fields) {
  const row = record(value)
  for (const name of schema.strings ?? []) if (typeof row[name] !== 'string') throw invalid()
  for (const name of schema.numbers ?? []) if (typeof row[name] !== 'number' || !Number.isFinite(row[name])) throw invalid()
  for (const name of schema.booleans ?? []) if (typeof row[name] !== 'boolean') throw invalid()
  return row
}
function rows(value: unknown, schema: Fields) {
  if (!Array.isArray(value)) throw invalid()
  for (const row of value) fields(row, schema)
  return value
}
function student(value: unknown) {
  fields(value, {
    strings: ['codAlumno', 'apePaterno', 'apeMaterno', 'nomAlumno', 'periodo', 'desFacultad',
      'desEscuela', 'desEspecialidad', 'codPlan', 'desPlan'],
  })
}

// Minimum validation of the envelope and fields read by the UI. This is the
// only JSON/type assertion boundary; it is not a full validator for raw types.
export function parseResponse<K extends EndpointKey>(key: K, value: unknown): ApiResponseMap[K] {
  const response = record(value)
  if (!('message' in response) || !('codError' in response) || !('data' in response)) throw invalid()
  if (response.codError !== null) throw new Error('La API rechazó la consulta. Revisa el acceso a la sesión.')
  const data = response.data
  switch (key) {
    case 'perfil':
      fields(data, { strings: ['tipoDocumento', 'numDocumento', 'estadoCivil', 'desSexo',
        'fechaNacimiento', 'departamentoNac', 'provinciaNac', 'distritoNac', 'telefono', 'celular',
        'correoInstitucional', 'correoPersonal', 'departamentoDir', 'provinciaDir', 'distritoDir', 'direccion'] })
      break
    case 'formulario': {
      const form = fields(data, { booleans: ['llenar', 'datosPersonalesCompletado', 'colegioCompletado',
        'actividadProfesionalCompletado', 'dependenciaEconomicaCompletado', 'recursosEstudioCompletado',
        'transporteCompletado', 'saludCompletado', 'interesAcademicoCompletado', 'contactoCompletado'] })
      student(form.alumno)
      record(form.formulario)
      break
    }
    case 'matriculaInfo': {
      const info = fields(data, { strings: ['codSemestre', 'fecIniMatInternet', 'fecFinMatInternet', 'mensajeMatricula'],
        booleans: ['indMatHabilitada', 'matriculado'] })
      fields(info.perfil, { strings: ['situAcademica', 'permanencia'], numbers: ['promedio', 'anioIngreso', 'anioEstudio'] })
      break
    }
    case 'programacion': {
      const programming = record(data)
      student(programming.alumno)
      const courses = rows(programming.programacion, { strings: ['codAsignatura', 'desAsignatura',
        'nomDocente', 'apePatDocente', 'apeMatDocente'], numbers: ['creditos', 'codSeccion', 'topeAlumnos', 'matriculados'] })
      for (const course of courses) rows(record(course).horarios, { strings: ['dia', 'horaInicio', 'horaFin'] })
      break
    }
    case 'prematricula':
      rows(data, { strings: ['codPlan', 'codAsignatura', 'desAsignatura', 'ind_etapa'],
        numbers: ['num_ciclo_ano_asig', 'num_creditaje', 'num_rep_plan_act', 'num_mat_equiv', 'num_rep_total'] })
      break
    case 'matricula': {
      const enrollment = record(data)
      rows(enrollment.matricula, { strings: ['codAsignatura', 'desAsignatura', 'nomDocente', 'apePatDocente', 'apeMatDocente'],
        numbers: ['cicloEstudio', 'creditoAsignatura', 'codSeccion'] })
      break
    }
    case 'horarios':
      rows(data, { strings: ['desAsignatura', 'horaInicio', 'horaFin', 'dia', 'desTipoHoraAsignatura'], numbers: ['codSeccion', 'numDia'] })
      break
    case 'asistencias':
      rows(data, { strings: ['desAsignatura'], numbers: ['codSeccion', 'numClases', 'cantPresentes',
        'porcentajePresentes', 'cantTardanzas', 'porcentajeTardanzas', 'cantFaltas', 'porcentajeFaltas',
        'cantAsistencias', 'porcentajeAsistencias'] })
      break
    case 'plan':
      rows(data, { strings: ['codAsignatura', 'desAsignatura', 'tipoAsignatura', 'codGrupo',
        'codAsignaturaPre', 'desAsignaturaPre', 'codGrupoPre'], numbers: ['codEspecialidad', 'creditos'] })
      break
    case 'evaluaciones': case 'tutoria':
      if (!Array.isArray(data)) throw invalid()
      break
    case 'deudas': break // No supplied contract: data is deliberately opaque.
  }
  return value as ApiResponseMap[K]
}

export async function readHttpResponse<K extends EndpointKey>(response: Response, key: K) {
  if (!response.ok) throw new Error(`No se pudo consultar la API (HTTP ${response.status}).`)
  if (!/application\/(?:[\w.-]+\+)?json/i.test(response.headers.get('content-type') ?? '')) {
    throw new Error('La API no devolvió JSON. Revisa la sesión o la URL configurada.')
  }
  let value: unknown
  try { value = await response.json() } catch { throw new Error('La API devolvió JSON inválido.') }
  return parseResponse(key, value)
}
