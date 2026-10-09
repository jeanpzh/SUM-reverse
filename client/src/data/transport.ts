import type { ApiResponseMap, EndpointKey } from './contracts.ts'
import { endpoints } from './endpoints.ts'
import { validateBaseUrl } from './config.ts'
import { validateDeudas, validateEvaluaciones } from './reportes.ts'
import { validateAsistencias } from './asistencias.ts'
import { isRawMatriculaInformacion, validateMatriculaInformacion } from './matriculaInformacion.ts'
import { rememberMiRepresentation, validateMiInformacionResponse } from './miInformacion.ts'
import type { MiInformacionRepresentation, MiInformacionWireKey } from '../../../shared/mi-informacion-wire.mjs'
import { validateProgramacion } from './programacion.ts'
import { assertMatriculaWire, type MatriculaWireKey } from './matriculaWire.ts'
import { rememberPlanEstudiosRepresentation, validatePlanEstudios } from './planEstudios.ts'
import type { PlanEstudiosRepresentation } from '../../../shared/plan-estudios-wire.mjs'
import { validatePlanEstudiosWire } from '../../../shared/plan-estudios-wire.mjs'
import { validateTutoriaLocal } from './tutoria.ts'

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
export function parseResponse<K extends EndpointKey>(
  key: K,
  value: unknown,
  local = false,
  miRepresentation?: MiInformacionRepresentation,
  planRepresentation?: PlanEstudiosRepresentation,
): ApiResponseMap[K] {
  if (isMiKey(key) && local) {
    if (!miRepresentation) throw new Error('La respuesta local de Mi Información no declara su representación.')
    validateMiInformacionResponse(toMiWireKey(key), value, miRepresentation)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
    rememberMiRepresentation(value, miRepresentation)
    return value as ApiResponseMap[K]
  }

  const response = record(value)
  if (!('message' in response) || !('codError' in response) || !('data' in response)) throw invalid()

  if (key === 'matriculaInfo' && !isRawMatriculaInformacion(response.data)) {
    if (response.codError !== null) throw new Error('La API rechazó la consulta.')
    if (response.message !== null && typeof response.message !== 'string') throw invalid()
    if (local && (response.message !== null || response.codError !== null || Object.keys(response).length !== 3)) {
      throw invalid()
    }
    validateMatriculaInformacion(response.data)
    return value as ApiResponseMap[K]
  }

  if (isMatriculaWireKey(key)) {
    if (key === 'programacion') validateProgramacion(value)
    else assertMatriculaWire(key, value)
    return value as ApiResponseMap[K]
  }

  if (key === 'plan' && local) {
    if (!planRepresentation) {
      throw new Error('La respuesta local de Plan de Estudios no declara su representación.')
    }
    if (planRepresentation === 'candidate-v1') {
      validatePlanEstudiosWire(value)
      rememberPlanEstudiosRepresentation(value, planRepresentation)
      return value as ApiResponseMap[K]
    }
  }

  if (local && (response.message !== null || Object.keys(response).length !== 3)) throw invalid()
  if (response.codError !== null) throw new Error('La API rechazó la consulta.')
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
    case 'historial':
      throw new Error('La consulta local de historial no está disponible en modo API heredado.')
    case 'fichaSocioeconomica':
      throw new Error('La consulta local de ficha no está disponible en modo API heredado.')
    case 'asistencias':
      if (local) validateAsistencias(data)
      else rows(data, { strings: ['desAsignatura'], numbers: ['codSeccion', 'numClases', 'cantPresentes',
        'porcentajePresentes', 'cantTardanzas', 'porcentajeTardanzas', 'cantFaltas', 'porcentajeFaltas',
        'cantAsistencias', 'porcentajeAsistencias'] })
      break
    case 'plan':
      if (local) {
        const planData = rows(data, { strings: ['codPlan', 'codAsignatura', 'desAsignatura', 'tipoAsignatura',
          'codGrupo', 'codAsignaturaPre', 'desAsignaturaPre', 'codGrupoPre'], numbers: ['codFacultad', 'codEscuela',
          'codEspecialidad', 'ciclo', 'creditos', 'creditosPre'] })
        validatePlanEstudios(planData)
        rememberPlanEstudiosRepresentation(response, 'local-v1')
        break
      }
      rows(data, { strings: ['codAsignatura', 'desAsignatura', 'tipoAsignatura', 'codGrupo',
        'codAsignaturaPre', 'desAsignaturaPre', 'codGrupoPre'], numbers: ['codEspecialidad', 'creditos'] })
      break
    case 'evaluaciones':
      if (local) validateEvaluaciones(data)
      else if (!Array.isArray(data) || data.length) throw new Error('La API heredada devolvió filas de evaluaciones sin contrato local.')
      break
    case 'deudas':
      if (local) validateDeudas(data)
      else if (!Array.isArray(data) || data.length) throw new Error('La API heredada devolvió filas de deudas sin contrato local.')
      break
    case 'tutoria':
      if (local) validateTutoriaLocal(data)
      else if (!Array.isArray(data)) throw invalid()
      break
  }
  return value as ApiResponseMap[K]
}

function isMatriculaWireKey(key: EndpointKey): key is MatriculaWireKey {
  return key === 'matriculaInfo' || key === 'programacion' || key === 'prematricula'
    || key === 'matricula' || key === 'horarios'
}

function isMiKey(key: EndpointKey): key is 'perfil' | 'historial' | 'formulario' | 'fichaSocioeconomica' {
  return key === 'perfil' || key === 'historial' || key === 'formulario' || key === 'fichaSocioeconomica'
}

function toMiWireKey(key: 'perfil' | 'historial' | 'formulario' | 'fichaSocioeconomica'): MiInformacionWireKey {
  return key === 'formulario' ? 'formularioDatos' : key
}

const snapshotMissingMessages = {
  perfil: 'perfil.mi-perfil.json: snapshot no disponible',
  historial: 'historial.historial-academico.json: snapshot no disponible',
  formulario: 'formularioDatos.formulario-datos-matricula.json: snapshot no disponible',
  fichaSocioeconomica: 'fichaSocioeconomica.ficha-socioeconomica.json: snapshot no disponible',
} as const

const planSnapshotMissingMessage = 'plan.plan-estudios.json: snapshot no disponible'

export async function readHttpResponse<K extends EndpointKey>(response: Response, key: K, local = false) {
  if (!response.ok) {
    if (local && key === 'plan' && response.status === 503) {
      let value: unknown
      try { value = await response.json() } catch { throw invalid() }
      const errorEnvelope = record(value)
      if (Object.keys(errorEnvelope).length !== 3 || errorEnvelope.message !== planSnapshotMissingMessage
        || errorEnvelope.codError !== 'SNAPSHOT_MISSING' || errorEnvelope.data !== null) throw invalid()
      throw new Error('Información aún no disponible.')
    }
    if (local && isMiKey(key) && response.status === 503) {
      let value: unknown
      try { value = await response.json() } catch { throw invalid() }
      const errorEnvelope = record(value)
      if (Object.keys(errorEnvelope).length !== 3 || errorEnvelope.message !== snapshotMissingMessages[key]
        || errorEnvelope.codError !== 'SNAPSHOT_MISSING'
        || errorEnvelope.data !== null) throw invalid()
      throw new Error('Información aún no disponible.')
    }
    throw new Error(`No se pudo consultar la API (HTTP ${response.status}).`)
  }
  if (!/application\/(?:[\w.-]+\+)?json/i.test(response.headers.get('content-type') ?? '')) {
    throw new Error('La API no devolvió JSON. Revisa la sesión o la URL configurada.')
  }
  let value: unknown
  try { value = await response.json() } catch { throw new Error('La API devolvió JSON inválido.') }
  if (local && isMiKey(key)) {
    const representation = response.headers.get('X-SUM-MI-Representation')
    if (representation !== 'candidate-v1' && representation !== 'local-v1' && representation !== 'opaque') {
      throw new Error('La API local no declara una representación compatible de Mi Información.')
    }
    return parseResponse(key, value, local, representation)
  }
  if (local && key === 'plan') {
    const representation = response.headers.get('X-SUM-PLAN-Representation')
    if (representation !== 'candidate-v1' && representation !== 'local-v1') {
      throw new Error('La API local no declara una representación compatible de Plan de Estudios.')
    }
    return parseResponse(key, value, local, undefined, representation)
  }
  return parseResponse(key, value, local)
}
