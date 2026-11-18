import type { ActorProfile, OfferedCourse, Section } from '../matricula-regular/profile.types.js'
import type { RunSnapshot } from '../matricula-regular/store.types.js'
import type { HorarioProgramacion, ProgramacionEnvelope, ProgramacionRow } from '../programacion/programacion.types.js'
import { projectStudent } from './profile-projection.js'

const time = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
const days = ['', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']

const sessionTypeDescriptions: Record<'T' | 'P' | 'L', string> = {
  T: 'Teoría',
  P: 'Práctica',
  L: 'Laboratorio',
}

function resolveSectionNumber(section: Section, sectionIndex: number): number {
  const rawLabel = section.label?.trim()
  if (rawLabel && /^\d+$/.test(rawLabel)) {
    const parsed = Number(rawLabel)
    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed
  }
  return sectionIndex + 1
}

function projectOperationalSectionRow(
  actor: ActorProfile,
  course: OfferedCourse,
  codAsignatura: string,
  section: Section,
  sectionIndex: number,
): ProgramacionRow {
  if (!Number.isSafeInteger(section.capacity) || section.capacity < 0
    || !Number.isSafeInteger(section.occupied) || section.occupied < 0) {
    throw new TypeError('Capacidad o matrícula de sección operativa inválida')
  }
  if (!Number.isFinite(course.credits) || course.credits < 0) {
    throw new TypeError('Créditos de curso operativo inválidos')
  }
  const ciclo = course.cycle ?? actor.academic?.catalog.find((item) => item.courseId === course.courseId)?.cycle ?? 0
  if (!Number.isFinite(ciclo)) {
    throw new TypeError('Ciclo de curso operativo inválido')
  }

  const schedule = section.schedule ?? []
  const codSeccion = resolveSectionNumber(section, sectionIndex)
  const codEscuela = actor.scope.schoolId === 'SISTEMAS' ? 1 : 2
  const detailTeachers = [...new Set(
    schedule.map((meeting) => meeting.details?.teacherName).filter((name): name is string => Boolean(name && name.trim() !== '')),
  )]
  const detailRooms = [...new Set(
    schedule.map((meeting) => meeting.details?.roomName).filter((name): name is string => Boolean(name && name.trim() !== '')),
  )]
  const rawTeacher = section.teacher === undefined
    ? (detailTeachers.length > 0 ? detailTeachers.join(' / ') : undefined)
    : section.teacher
  const rawRoom = section.room === undefined
    ? (detailRooms.length > 0 ? detailRooms.join(' / ') : undefined)
    : section.room
  const teacherName = rawTeacher?.trim()
  const hasTeacher = Boolean(teacherName && teacherName !== '--')
  const codDocente = hasTeacher ? '' : '--'
  const nomDocente = hasTeacher ? teacherName! : '--'
  const apePatDocente = hasTeacher ? '' : '--'
  const apeMatDocente = hasTeacher ? '' : '--'
  const codAula = rawRoom?.trim() || '--'

  const horarios: HorarioProgramacion[] = schedule.map((meeting, meetingIndex) => {
    const dayName = Number.isInteger(meeting.day) ? days[meeting.day] : undefined
    if (!dayName || !Number.isSafeInteger(meeting.startMinute) || !Number.isSafeInteger(meeting.endMinute)
      || meeting.startMinute < 0 || meeting.endMinute > 1440 || meeting.startMinute >= meeting.endMinute) {
      throw new TypeError('Horario de sección operativa inválido')
    }
    const details = meeting.details
    const meetingTeacherName = section.teacher === null ? null : (details?.teacherName ?? null)
    const meetingTeacherCode = section.teacher === null ? '--' : (details?.teacherId ?? codDocente)
    const meetingRoomName = section.room === null ? '--' : (details?.roomName ?? codAula)
    const sessionType = details?.sessionType
    return {
      codSemestre: null,
      codFacultad: 0,
      codEscuela,
      codEspecialidad: 0,
      codPlan: null,
      codAsignatura,
      desAsignatura: null,
      codSeccion,
      codDocente: meetingTeacherCode,
      nomDocente: meetingTeacherName,
      horario: meetingIndex + 1,
      dia: dayName,
      horaInicio: time(meeting.startMinute),
      horaFin: time(meeting.endMinute),
      horaInicioMin: meeting.startMinute,
      horaFinMin: meeting.endMinute,
      codAula: meetingRoomName,
      topeAlumnosLab: 0,
      matriculadosLab: 0,
      codTipoHoraAsignatura: sessionType ?? '--',
      desTipoHoraAsignatura: sessionType ? sessionTypeDescriptions[sessionType] : '--',
    }
  })

  return {
    ciclo,
    codAsignatura,
    desAsignatura: course.name,
    creditos: course.credits,
    codSeccion,
    horario: 0,
    codDocente,
    nomDocente,
    apePatDocente,
    apeMatDocente,
    topeAlumnos: section.capacity,
    matriculados: section.occupied,
    horarios,
  }
}

function projectOperationalProgramming(
  actor: ActorProfile,
  snapshot: RunSnapshot,
  source: NonNullable<ActorProfile['scenarioData']>,
): ProgramacionEnvelope {
  if (!Array.isArray(source.sectionOrigins) || source.sectionOrigins.length === 0) {
    throw new TypeError('Falta proveniencia de oferta operativa')
  }

  const rows: ProgramacionRow[] = []
  for (const course of snapshot.offer) {
    if (course.planId !== actor.scope.planId) continue
    const codAsignatura = source.courseCodes[course.courseId]
    if (typeof codAsignatura !== 'string' || codAsignatura.trim() === '') {
      throw new TypeError('Curso operativo sin código de asignatura')
    }
    course.sections.forEach((section, sectionIndex) => {
      rows.push(projectOperationalSectionRow(actor, course, codAsignatura, section, sectionIndex))
    })
  }

  rows.sort((left, right) =>
    left.ciclo - right.ciclo
    || left.codAsignatura.localeCompare(right.codAsignatura)
    || left.codSeccion - right.codSeccion,
  )

  return { message: null, codError: null, data: { alumno: projectStudent(actor), programacion: rows } }
}

export function projectScenarioProgramming(actor: ActorProfile, snapshot: RunSnapshot): ProgramacionEnvelope {
  if (!actor.scenarioData) throw new TypeError('Falta programación del escenario')
  const source = actor.scenarioData
  if (source.sectionOrigins !== undefined) {
    return projectOperationalProgramming(actor, snapshot, source)
  }

  const rows = structuredClone(source.programming)
  for (const row of rows) {
    const course = snapshot.offer.find((item) => item.planId === actor.scope.planId && source.courseCodes[item.courseId] === row.codAsignatura)
    const section = course?.sections.find((item) => item.label === String(row.codSeccion))
    if (!section) throw new TypeError('Sección de programación sin oferta equivalente')
    row.matriculados = section.occupied
    row.topeAlumnos = section.capacity
    // Preserve the reference's teacher, room, class types and schedule metadata.
    // Only the first section of scenario courses has deliberate schedule variations.
    const number = Number(course!.courseId.slice(-2))
    if (number >= 7 && number <= 14 && section === course!.sections[0]) {
      row.horarios = (section.schedule ?? []).map((meeting, index) => ({
        ...row.horarios[index % row.horarios.length]!,
        dia: days[meeting.day]!, horaInicio: time(meeting.startMinute), horaFin: time(meeting.endMinute),
      }))
    }
    for (const meeting of row.horarios) meeting.codEscuela = actor.scope.schoolId === 'SISTEMAS' ? 1 : 2
  }
  return { message: null, codError: null, data: { alumno: projectStudent(actor), programacion: rows } }
}
