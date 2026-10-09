import type { AlumnoFixture, FormularioData } from '../reportes/reportes.types.js'
import type {
  MiInformacionRepresentation,
  MiInformacionWireEnvelope,
  MiInformacionWireKey,
  HistorialCandidateData,
  HistorialCandidatePromedio,
  HistorialCandidateRow,
} from '../../../shared/mi-informacion-wire.mjs'

export type { HistorialCandidateData, HistorialCandidatePromedio, HistorialCandidateRow }

export type PerfilAlumno = {
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
export type HistorialAcademico = {
  alumno: AlumnoFixture
  resumen: { asignaturasAprobadas: number; creditosAprobados: number; promedioPonderado: number | null }
  periodos: { periodoAcademico: string; creditos: number; promedio: number }[]
  asignaturas: {
    ciclo: number; codPlan: string; tipoAsignatura: string; codAsignatura: string
    desAsignatura: string; calificacion: number; creditos: number; seccion: number
    acta: string; periodoAcademico: string
  }[]
}
export type FamiliarSocioeconomico = {
  id: string; nombre: string; edad: number; parentesco: string; grado: string
  ocupacion: string; condicionLaboral: string; aporteEconomico: string
  enfermedad: string | null; tipoDiscapacidad: string | null
}
export type FichaSocioeconomica = {
  alumno: AlumnoFixture
  secciones: SeccionInformacion[]
  familiares: FamiliarSocioeconomico[]
}
export type FormularioExtendido = FormularioData & { secciones: SeccionInformacion[] }
export type MiInformacionKey = MiInformacionWireKey
export type MiInformacionDataMap = {
  perfil: PerfilAlumno
  historial: HistorialAcademico
  formularioDatos: FormularioExtendido
  fichaSocioeconomica: FichaSocioeconomica
}
export type MiInformacionEnvelope<T> = { message: null; codError: null; data: T }
export type MiInformacionSnapshot = {
  envelope: MiInformacionWireEnvelope
  representation: MiInformacionRepresentation
}
export type MiInformacionResponseEnvelope = {
  message: string | null
  codError: null
  data: unknown
  [key: string]: unknown
}
