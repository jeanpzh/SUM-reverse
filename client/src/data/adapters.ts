import type { ApiResponseMap, StudentRecord } from './contracts.ts'
import { isRawMatriculaInformacion, legacyEnrollmentArticle, type ArticuloMatricula } from './matriculaInformacion.ts'
import type { HistorialCandidateData, HistorialLocalData } from './miInformacion.ts'
import type { PlanEstudiosWireRow } from '../../../shared/plan-estudios-wire.mjs'

export function toEnrollmentArticle(
  data: ApiResponseMap['matriculaInfo']['data'],
): ArticuloMatricula | null {
  if (isRawMatriculaInformacion(data)) return structuredClone(legacyEnrollmentArticle)
  return data.articulo
}

export type StudentSummaryData = {
  name: string
  code: string
  period: string
  faculty: string
  program: string
  specialty: string
  plan: string
}

type StudentSummarySource = {
  codAlumno: string
  apePaterno: string
  apeMaterno: string
  nomAlumno: string
  periodo: string
  desFacultad: string
  desEscuela: string
  desEspecialidad: string
  codPlan: string
  desPlan: string
}

export function toStudentSummary(alumno: StudentRecord | StudentSummarySource): StudentSummaryData {
  return {
    name: [alumno.apePaterno, alumno.apeMaterno, alumno.nomAlumno].filter(Boolean).join(' '),
    code: alumno.codAlumno, period: alumno.periodo, faculty: alumno.desFacultad,
    program: alumno.desEscuela, specialty: alumno.desEspecialidad,
    plan: `${alumno.codPlan.trim()} - ${alumno.desPlan}`,
  }
}

type ProfileStudentIdentity = Pick<StudentRecord, 'codAlumno' | 'apePaterno' | 'apeMaterno' | 'nomAlumno'>

export function toProfileRows(profile: ApiResponseMap['perfil']['data'], alumno: ProfileStudentIdentity) {
  return [
    ['Código de estudiante', alumno.codAlumno],
    ['Apellidos', `${alumno.apePaterno} ${alumno.apeMaterno}`.trim()],
    ['Nombres', alumno.nomAlumno], ['Tipo de documento', profile.tipoDocumento],
    ['Número de documento', profile.numDocumento], ['Fecha de nacimiento', profile.fechaNacimiento],
    ['Sexo', profile.desSexo], ['Estado civil', profile.estadoCivil],
    ['Lugar de nacimiento', [profile.departamentoNac, profile.provinciaNac, profile.distritoNac].filter(Boolean).join(' / ')],
    ['Dirección', profile.direccion], ['Correo electrónico', profile.correoPersonal],
    ['Correo institucional', profile.correoInstitucional], ['Teléfono', profile.telefono], ['Celular', profile.celular],
  ].map(([label, value]) => [label, value || 'No registrado'])
}

export function toProfileAcademicRows(profile: ApiResponseMap['perfil']['data']) {
  return [
    ['Año de Ingreso', profile.anioIngreso],
    ['Modalidad de Ingreso', profile.desTipoIngreso],
    ['Colegio de Procedencia', profile.desColegioProc],
    ['Año / Ciclo de Estudio', String(profile.anioEstudio)],
    ['Promedio Ponderado', profile.promedio.toFixed(2)],
    ['Situación Académica', profile.situAcademica],
    ['Estado de Permanencia', profile.permanencia],
    ['Última Matricula', profile.codSemUltMat],
    ['Promedio de Última Matricula', profile.promUltMat.toFixed(2)],
  ].map(([label, value]) => [label, value || 'No registrado'])
}

export function toHistoryRows(data: HistorialLocalData['asignaturas']) {
  return data.map((row) => [row.ciclo, row.codPlan.trim(), row.tipoAsignatura,
    `${row.codAsignatura} - ${row.desAsignatura}`, row.calificacion.toFixed(2), row.creditos,
    row.seccion, row.acta])
}

export function toHistorialCandidateRows(data: HistorialCandidateData): string[][] {
  return data.historial.map((row) => [
    String(row.ciclo),
    row.codPlan,
    row.codTipoAsignatura,
    `${row.codAsignatura} - ${row.desAsignatura}`,
    String(row.calificacion),
    String(row.creditos),
    String(row.codSeccion),
    row.numActa,
    row.codSemestre,
  ])
}

export function toHistorialCandidatePromedios(data: HistorialCandidateData): string[][] {
  return data.promedios.map((row) => [row.semestre, String(row.promedio)])
}

export function toPlanRows(data: ApiResponseMap['plan']['data']) {
  return data.map((row) => [row.codEspecialidad, `${row.codAsignatura} - ${row.desAsignatura}`,
    row.creditos, row.tipoAsignatura === 'O' ? 'Obligatorio' : 'Electivo', row.codGrupo,
    row.codAsignaturaPre ? `${row.codAsignaturaPre} - ${row.desAsignaturaPre}` : 'Ninguno', row.codGrupoPre])
}

export function toPlanCandidateRows(data: PlanEstudiosWireRow[]): string[][] {
  return data.map((row) => {
    const prerequisite = row.codAsignaturaPre && row.desAsignaturaPre
      ? `${row.codAsignaturaPre} - ${row.desAsignaturaPre}`
      : row.codAsignaturaPre || row.desAsignaturaPre
    return [
      String(row.codEspecialidad),
      `${row.codAsignatura} - ${row.desAsignatura}`,
      String(row.creditos),
      row.tipoAsignatura,
      row.codGrupo,
      prerequisite,
      row.codGrupoPre,
    ]
  })
}
export function toPrematriculaRows(data: ApiResponseMap['prematricula']['data']) {
  return data.map((row) => [row.codPlan.trim(), row.num_ciclo_ano_asig, row.desAsignatura, row.num_creditaje,
    row.num_rep_plan_act, row.num_mat_equiv, row.num_rep_total, row.ind_etapa])
}
export function toMatriculaRows(data: ApiResponseMap['matricula']['data']['matricula']) {
  return data.map((row) => [row.cicloEstudio, row.desAsignatura, row.creditoAsignatura, row.codSeccion,
    [row.nomDocente, row.apePatDocente, row.apeMatDocente].filter(Boolean).join(' ')])
}
export function toAttendanceRows(data: ApiResponseMap['asistencias']['data']) {
  return data.map((row) => [row.desAsignatura, row.codSeccion, row.numClases,
    row.cantPresentes, row.porcentajePresentes, row.cantTardanzas, row.porcentajeTardanzas,
    row.cantFaltas, row.porcentajeFaltas, row.cantAsistencias, row.porcentajeAsistencias])
}
export function toProgrammingRows(data: ApiResponseMap['programacion']['data']['programacion']) {
  return data.map((row) => {
    const extra = row.s
    const first = typeof extra === 'string' || typeof extra === 'number' || typeof extra === 'boolean'
      ? String(extra) : ''
    const teacher = row.codDocente === '--' ? '--'
      : `${row.codDocente} - ${row.apePatDocente} ${row.apeMatDocente}, ${row.nomDocente}`
    return [first, `${row.codAsignatura} - ${row.desAsignatura}`, row.creditos, row.codSeccion,
      teacher, row.topeAlumnos, row.matriculados, `${row.horarios.length} horarios`]
  })
}

export function toCourseScheduleRows(data: ApiResponseMap['programacion']['data']['programacion'][number]['horarios']) {
  return data.map((row) => [row.horario, row.dia,
    `${row.horaInicio} - ${row.horaFin}`, row.codAula, row.desTipoHoraAsignatura])
}

function timeMinutes(value: string, path: string) {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || Number(match[3] ?? '0') > 59) {
    throw new Error(`horarios.data${path}: hora no representable; se esperaba HH:mm o HH:mm:ss válido.`)
  }
  return Number(match[1]) * 60 + Number(match[2]) + Number(match[3] ?? '0') / 60
}
export function toScheduleEvents(data: ApiResponseMap['horarios']['data']) {
  return data.map((row, index) => {
    const startPath = `[${index}].horaInicio`
    const endPath = `[${index}].horaFin`
    const start = timeMinutes(row.horaInicio, startPath)
    const end = timeMinutes(row.horaFin, endPath)
    if (!Number.isInteger(row.numDia) || row.numDia < 1 || row.numDia > 7) {
      throw new Error(`horarios.data[${index}].numDia: se esperaba entero entre 1 y 7.`)
    }
    if (start >= end) {
      throw new Error(`horarios.data[${index}].horaFin: debe ser posterior a horaInicio.`)
    }
    return { day: row.numDia, start, end, course: row.desAsignatura,
      section: row.codSeccion, kind: row.desTipoHoraAsignatura,
      time: `${row.horaInicio}–${row.horaFin}` }
  })
}

export function toEvaluacionRows(data: ApiResponseMap['evaluaciones']['data']) {
  return data.map((row) => [row.ciclo, row.desAsignatura, row.tipoEvaluacion,
    row.calificacion.toFixed(2), row.formula])
}

export function toDeudaRows(data: ApiResponseMap['deudas']['data']) {
  return data.map((row) => {
    const [year, month, day] = row.fechaRegistro.split('-')
    return [`${day}/${month}/${year}`, row.periodoAcademico, row.concepto,
      `S/ ${row.montoInicial}`, `S/ ${row.montoFinal}`, row.observacion]
  })
}
