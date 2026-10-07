import type { ApiResponseMap, StudentRecord } from './contracts.ts'

export function toStudentSummary(alumno: StudentRecord) {
  return {
    name: [alumno.apePaterno, alumno.apeMaterno, alumno.nomAlumno].filter(Boolean).join(' '),
    code: alumno.codAlumno, period: alumno.periodo, faculty: alumno.desFacultad,
    program: alumno.desEscuela, specialty: alumno.desEspecialidad,
    plan: `${alumno.codPlan.trim()} - ${alumno.desPlan}`,
  }
}

export function toProfileRows(profile: ApiResponseMap['perfil']['data'], alumno: StudentRecord) {
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

export function toPlanRows(data: ApiResponseMap['plan']['data']) {
  return data.map((row) => [row.codEspecialidad, `${row.codAsignatura} - ${row.desAsignatura}`,
    row.creditos, row.tipoAsignatura === 'O' ? 'Obligatorio' : 'Electivo', row.codGrupo,
    row.codAsignaturaPre ? `${row.codAsignaturaPre} - ${row.desAsignaturaPre}` : 'Ninguno', row.codGrupoPre])
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
  return data.map((row) => [row.desAsignatura, row.creditos, row.codSeccion,
    [row.nomDocente, row.apePatDocente, row.apeMatDocente].filter(Boolean).join(' '),
    row.topeAlumnos, row.matriculados, `${row.horarios.length} horarios`])
}

export function toCourseScheduleRows(data: ApiResponseMap['programacion']['data']['programacion'][number]['horarios']) {
  return data.map((row) => [row.horario, row.dia,
    `${row.horaInicio} - ${row.horaFin}`, row.codAula || '--', row.desTipoHoraAsignatura])
}

function timeMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value)
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) throw new Error('Horario con hora inválida.')
  return Number(match[1]) * 60 + Number(match[2])
}
export function toScheduleEvents(data: ApiResponseMap['horarios']['data']) {
  return data.map((row) => {
    const start = timeMinutes(row.horaInicio)
    const end = timeMinutes(row.horaFin)
    if (!Number.isInteger(row.numDia) || row.numDia < 1 || row.numDia > 7 || start >= end) {
      throw new Error('Horario con día o intervalo inválido.')
    }
    return { day: row.numDia, start, end, course: row.desAsignatura,
      section: row.codSeccion, kind: row.desTipoHoraAsignatura,
      time: `${row.horaInicio}–${row.horaFin}` }
  })
}
