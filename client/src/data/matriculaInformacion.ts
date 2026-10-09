import type { MatriculaInformacion as EnrollmentInformation } from '../../../raw-types/matricula-info.ts'
import type { WireShape } from './matriculaWire.ts'

export type SeccionMatriculaId = 'cronograma' | 'acceso-facultad' | 'prematricula' | 'deudas' | 'interfaz'

export type SeccionMatricula = {
  id: SeccionMatriculaId
  titulo: string
  descripcion: string
}

export type ArticuloMatricula = {
  introduccion: string
  secciones: SeccionMatricula[]
}

export type MatriculaInformacionLocalData = {
  codSemestre: string
  articulo: ArticuloMatricula | null
}

export type MatriculaInformacionWireData = WireShape<EnrollmentInformation['data']>

const sectionIds: SeccionMatriculaId[] = [
  'cronograma', 'acceso-facultad', 'prematricula', 'deudas', 'interfaz',
]

export const legacyEnrollmentArticle: ArticuloMatricula = {
  introduccion: 'Módulo de Matrícula Vía Internet',
  secciones: [
    {
      id: 'cronograma',
      titulo: 'Control de Cronograma de Matrícula',
      descripcion: 'Información sobre el cronograma académico relacionado con la matrícula.',
    },
    {
      id: 'acceso-facultad',
      titulo: 'Control de Acceso de Facultad',
      descripcion: 'Información sobre el control de acceso de la facultad.',
    },
    {
      id: 'prematricula',
      titulo: 'Control de Pre-Matrícula',
      descripcion: 'Información sobre el proceso de pre-matrícula.',
    },
    {
      id: 'deudas',
      titulo: 'Control de Deudas Registradas',
      descripcion: 'Información sobre las deudas registradas.',
    },
    {
      id: 'interfaz',
      titulo: 'Interfaz de Matrícula',
      descripcion: 'Información sobre la interfaz del módulo de matrícula.',
    },
  ],
}

const contractError = () => new Error('La respuesta local de información de matrícula no cumple el contrato.')

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]) {
  return Object.keys(value).length === expected.length && expected.every((key) => key in value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function validateMatriculaInformacion(value: unknown): asserts value is MatriculaInformacionLocalData {
  if (!isRecord(value) || !hasExactKeys(value, ['codSemestre', 'articulo']) ||
    typeof value.codSemestre !== 'string' || !/^\d{4}-[12]$/.test(value.codSemestre)) {
    throw contractError()
  }

  if (value.articulo === null) return
  if (!isRecord(value.articulo) || !hasExactKeys(value.articulo, ['introduccion', 'secciones']) ||
    !isNonEmptyString(value.articulo.introduccion) || !Array.isArray(value.articulo.secciones) ||
    value.articulo.secciones.length !== sectionIds.length) {
    throw contractError()
  }

  for (const [index, section] of value.articulo.secciones.entries()) {
    if (!isRecord(section) || !hasExactKeys(section, ['id', 'titulo', 'descripcion']) ||
      section.id !== sectionIds[index] || !isNonEmptyString(section.titulo) ||
      !isNonEmptyString(section.descripcion)) {
      throw contractError()
    }
  }
}

export function isRawMatriculaInformacion(value: unknown): value is MatriculaInformacionWireData {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return 'indMatHabilitada' in record || ['fechaDB', 'fecIniMatInternet', 'mensajeMatricula', 'matriculado',
    'indMatCtrlHorario', 'valProgramacion', 'perfil', 'creditaje', 'amonestaciones'].some((key) => key in record)
}
