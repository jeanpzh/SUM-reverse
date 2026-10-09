import { validateMiInformacionWire } from '../../../shared/mi-informacion-wire.mjs'
import type {
  HistorialCandidateData,
  MiInformacionRepresentation,
  MiInformacionWireEnvelope,
  MiInformacionWireKey,
} from '../../../shared/mi-informacion-wire.mjs'
export type { HistorialCandidateData } from '../../../shared/mi-informacion-wire.mjs'
import type { MatriculaFormularioDatos } from '../../../raw-types/matricula-formulario-datos.ts'

type MiJsonValue<T> = T extends null | undefined ? T
  : T extends Date ? string
  : T extends (infer Item)[] ? MiJsonValue<Item>[]
  : T extends object ? { [Key in keyof T]: MiJsonValue<T[Key]> }
  : T
export type MiStudentRecord = MiJsonValue<MatriculaFormularioDatos>['data']['alumno']

export type PerfilLocal = {
  tipoDocumento: string
  numDocumento: string
  estadoCivil: string
  codSexo: string
  desSexo: string
  fechaNacimiento: string
  departamentoNac: string
  provinciaNac: string
  distritoNac: string
  telefono: string
  celular: string
  correoInstitucional: string
  correoPersonal: string
  departamentoDir: string
  provinciaDir: string
  distritoDir: string
  direccion: string
  anioIngreso: string
  codTipoIngreso: string
  desTipoIngreso: string
  codColegioProc: string
  desColegioProc: string
  anioEstudio: number
  promedio: number
  situAcademica: string
  permanencia: string
  codSemUltMat: string
  promUltMat: number
}

export type CampoInformacion = { id: string; etiqueta: string; valor: string | null }
export type SeccionInformacion = { id: string; titulo: string; campos: CampoInformacion[] }
export type FamiliarSocioeconomico = {
  id: string
  nombre: string
  edad: number
  parentesco: string
  grado: string
  ocupacion: string
  condicionLaboral: string
  aporteEconomico: string
  enfermedad: string | null
  tipoDiscapacidad: string | null
}

export type HistorialLocalData = {
  alumno: MiStudentRecord
  resumen: { asignaturasAprobadas: number; creditosAprobados: number; promedioPonderado: number | null }
  periodos: { periodoAcademico: string; creditos: number; promedio: number }[]
  asignaturas: { ciclo: number; codPlan: string; tipoAsignatura: string; codAsignatura: string;
    desAsignatura: string; calificacion: number; creditos: number; seccion: number; acta: string;
    periodoAcademico: string }[]
}

export type FichaSocioeconomicaLocalData = {
  alumno: MiStudentRecord
  secciones: SeccionInformacion[]
  familiares: FamiliarSocioeconomico[]
}

export type FormularioLocalData = {
  alumno: MiStudentRecord
  formulario: Record<string, unknown>
  politicaPrivacidad: unknown
  llenar: boolean
  datosPersonalesCompletado: boolean
  colegioCompletado: boolean
  actividadProfesionalCompletado: boolean
  dependenciaEconomicaCompletado: boolean
  recursosEstudioCompletado: boolean
  transporteCompletado: boolean
  saludCompletado: boolean
  interesAcademicoCompletado: boolean
  contactoCompletado: boolean
  secciones: SeccionInformacion[]
}

export type FormularioCandidateData = Omit<MiJsonValue<MatriculaFormularioDatos>['data'], 'formulario' | 'politicaPrivacidad'> & {
  formulario: Record<string, MiJsonValue<unknown>> | null
  politicaPrivacidad: MiJsonValue<unknown>
}
export type MiInformacionEnvelope<T> = Omit<MiInformacionWireEnvelope, 'data'> & { data: T }
export type MiHistorialResponse = MiInformacionEnvelope<HistorialLocalData>
  | MiInformacionEnvelope<HistorialCandidateData> | MiInformacionWireEnvelope
export type MiFichaResponse = MiInformacionEnvelope<FichaSocioeconomicaLocalData> | MiInformacionWireEnvelope

const representations = new WeakMap<object, MiInformacionRepresentation>()

export function rememberMiRepresentation(response: object, representation: MiInformacionRepresentation) {
  representations.set(response, representation)
}

export function getMiRepresentation(response: object) {
  return representations.get(response)
}

export function validateMiInformacionResponse(key: MiInformacionWireKey, value: unknown, representation: MiInformacionRepresentation) {
  validateMiInformacionWire(key, value, representation)
}

function validatedLocalData<K extends 'historial' | 'fichaSocioeconomica'>(
  key: K,
  response: K extends 'historial' ? MiHistorialResponse : MiFichaResponse,
  representation: MiInformacionRepresentation | undefined,
) {
  if (!representation) throw new Error('La respuesta de Mi Información no tiene representación declarada.')
  if (representation === 'opaque') return null
  validateMiInformacionWire(key, response, representation)
  if (representation !== 'local-v1') return null
  return response.data
}

export function toHistorialLocalData(response: MiHistorialResponse): HistorialLocalData | null {
  return validatedLocalData('historial', response, getMiRepresentation(response)) as HistorialLocalData | null
}

export function toHistorialCandidateData(response: MiHistorialResponse): HistorialCandidateData | null {
  const representation = getMiRepresentation(response)
  if (!representation) throw new Error('La respuesta de Mi Información no tiene representación declarada.')
  if (representation !== 'candidate-v1') {
    if (representation === 'local-v1') validateMiInformacionWire('historial', response, representation)
    return null
  }
  validateMiInformacionWire('historial', response, representation)
  return response.data as HistorialCandidateData
}

export function toFichaLocalData(response: MiFichaResponse): FichaSocioeconomicaLocalData | null {
  return validatedLocalData('fichaSocioeconomica', response, getMiRepresentation(response)) as FichaSocioeconomicaLocalData | null
}

export function validatePerfilLocal(value: unknown): asserts value is PerfilLocal {
  validateMiInformacionWire('perfil', { message: null, codError: null, data: value }, 'local-v1')
}

export function validateFormularioLocal(value: unknown): asserts value is FormularioLocalData {
  validateMiInformacionWire('formularioDatos', { message: null, codError: null, data: value }, 'local-v1')
}

export function validateHistorialLocal(value: unknown): asserts value is HistorialLocalData {
  validateMiInformacionWire('historial', { message: null, codError: null, data: value }, 'local-v1')
}

export function validateFichaLocal(value: unknown): asserts value is FichaSocioeconomicaLocalData {
  validateMiInformacionWire('fichaSocioeconomica', { message: null, codError: null, data: value }, 'local-v1')
}
