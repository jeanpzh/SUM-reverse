import { scenarioProgrammingRows } from '../matricula-regular/scenario-reference.seed.js'
import type { ProgramacionRow } from '../programacion/programacion.types.js'
import type { AcademicCatalog, AcademicHistory, AcademicWeeklySession } from '../../../shared/programacion-academica-api.d.mts'
import { createReferenceRooms } from './reference-rooms.js'

const dayNumbers = new Map([
  ['LUNES', 1],
  ['MARTES', 2],
  ['MIERCOLES', 3],
  ['JUEVES', 4],
  ['VIERNES', 5],
  ['SABADO', 6],
  ['DOMINGO', 7],
])

const plannerWindows = [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 8 * 60, endMinute: 22 * 60 }))
const plannerRooms = createReferenceRooms().filter((room) => ['101AP', '102AP', '101NP', 'LAB01AP'].includes(room.id)).map(({ pavilion: _pavilion, ...room }) => ({
  ...room,
  availability: plannerWindows,
}))

function teacherName(row: ProgramacionRow): string | undefined {
  const parts = [row.nomDocente, row.apePatDocente, row.apeMatDocente]
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== '--')
  return parts.length > 0 ? parts.join(' ') : undefined
}

function isKnownTeacherCode(value: string): boolean {
  const normalized = normalizeTeacherCode(value)
  return normalized.length > 0 && normalized !== '--' && normalized !== '0'
}

function normalizeTeacherCode(value: string): string {
  return value.trim()
}

function normalizeTeacherName(value: string | null): string | undefined {
  const normalized = value?.trim()
  return normalized && normalized !== '--' ? normalized : undefined
}

function parseTime(value: string, path: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) throw new TypeError(`${path}: hora HH:mm inválida`)
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) throw new TypeError(`${path}: hora HH:mm fuera de rango`)
  return hours * 60 + minutes
}

function dayNumber(value: string, path: string): number {
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  const day = dayNumbers.get(normalized)
  if (!day) throw new TypeError(`${path}: día de semana inválido`)
  return day
}

function sessionType(row: ProgramacionRow['horarios'][number]): string {
  const type = row.codTipoHoraAsignatura.trim()
  if (!type) throw new TypeError('codTipoHoraAsignatura: tipo requerido')
  return type
}

function weeklyPatternKey(sessions: ProgramacionRow['horarios']): string {
  return JSON.stringify(sessions.map((session) => [sessionType(session), parseTime(session.horaFin, 'horaFin') - parseTime(session.horaInicio, 'horaInicio')]))
}

function displayType(type: string): string {
  const labels = new Map([['T', 'Teoría'], ['P', 'Práctica'], ['L', 'Laboratorio']])
  return labels.get(type) ?? `Tipo ${type}`
}

function toWeeklySessions(sessions: ProgramacionRow['horarios'], prefix: string): AcademicWeeklySession[] {
  return sessions.map((session, index) => ({
    id: `${prefix}-session-${index + 1}-${sessionType(session)}`,
    durationMinutes: parseTime(session.horaFin, 'horaFin') - parseTime(session.horaInicio, 'horaInicio'),
    type: sessionType(session),
  }))
}

function toHistorySession(session: ProgramacionRow['horarios'][number], teacherId: string) {
  const startMinute = parseTime(session.horaInicio, 'horaInicio')
  const endMinute = parseTime(session.horaFin, 'horaFin')
  if (endMinute <= startMinute) throw new TypeError('La sesión histórica tiene una duración inválida')
  return {
    day: dayNumber(session.dia, 'dia'),
    startMinute,
    endMinute,
    room: session.codAula,
    teacherId,
    type: sessionType(session),
  }
}

/**
 * Converts the explicitly synthetic historical reference rows into a readonly
 * planning catalog. Historical occupancy and availability are never planner inputs.
 */
export function adaptSyntheticCatalog(rows: readonly ProgramacionRow[] = scenarioProgrammingRows): AcademicCatalog {
  const courses = new Map<string, {
    courseId: string
    name: string
    cycle: number
    credits: number
    sections: AcademicHistory['sections']
    patterns: Map<string, { types: string[]; sessions: AcademicWeeklySession[] }>
    seenSections: Set<number>
    teachers: Set<string>
  }>()
  const referenceIds = new Map<string, string>()
  const referenceNames = new Map<string, string>()
  const referenceCourses = new Map<string, Set<string>>()
  const referenceIdFor = (code: string): string => {
    const key = normalizeTeacherCode(code)
    let id = referenceIds.get(key)
    if (!id) {
      id = `REF-TEACHER-${String(referenceIds.size + 1).padStart(3, '0')}`
      referenceIds.set(key, id)
    }
    return id
  }

  for (const row of rows) {
    if (!isKnownTeacherCode(row.codDocente)) continue
    const id = referenceIdFor(row.codDocente)
    const name = teacherName(row)
    if (name && !referenceNames.has(id)) referenceNames.set(id, name)
    let courseIds = referenceCourses.get(id)
    if (!courseIds) {
      courseIds = new Set()
      referenceCourses.set(id, courseIds)
    }
    courseIds.add(row.codAsignatura)
  }

  for (const row of rows) {
    if (!row.codAsignatura.trim() || !row.desAsignatura.trim() || !Number.isInteger(row.ciclo) || row.ciclo < 0
      || !Number.isInteger(row.creditos) || row.creditos < 0 || !Number.isInteger(row.codSeccion) || row.codSeccion < 0
      || !Number.isInteger(row.topeAlumnos) || row.topeAlumnos < 0 || row.horarios.length === 0) {
      throw new TypeError('Fila de referencia con metadatos incompletos o inválidos')
    }
    let course = courses.get(row.codAsignatura)
    if (!course) {
      course = {
        courseId: row.codAsignatura,
        name: row.desAsignatura,
        cycle: row.ciclo,
        credits: row.creditos,
        sections: [],
        patterns: new Map(),
        seenSections: new Set(),
        teachers: new Set(),
      }
      courses.set(row.codAsignatura, course)
    } else if (course.name !== row.desAsignatura || course.cycle !== row.ciclo || course.credits !== row.creditos) {
      throw new TypeError(`Metadatos contradictorios para el curso ${row.codAsignatura}`)
    }
    if (course.seenSections.has(row.codSeccion)) throw new TypeError(`Sección duplicada para el curso ${row.codAsignatura}`)
    course.seenSections.add(row.codSeccion)

    const historicalSessions = row.horarios.map((session, sessionIndex) => {
      if (session.codAsignatura !== row.codAsignatura || session.codSeccion !== row.codSeccion) {
        throw new TypeError(`Sesión con referencias ambiguas en curso ${row.codAsignatura}`)
      }
      const knownCode = isKnownTeacherCode(session.codDocente)
      const sessionName = normalizeTeacherName(session.nomDocente)
      let teacherId: string
      if (knownCode) {
        const referenceId = referenceIdFor(session.codDocente)
        teacherId = referenceId
        const displayName = sessionName ?? referenceNames.get(teacherId)
        if (displayName && !referenceNames.has(teacherId)) referenceNames.set(teacherId, displayName)
        let courseIds = referenceCourses.get(teacherId)
        if (!courseIds) {
          courseIds = new Set()
          referenceCourses.set(teacherId, courseIds)
        }
        courseIds.add(row.codAsignatura)
      } else {
        // A placeholder code cannot establish a shared identity across records.
        teacherId = `REF-UNRESOLVED-${row.codAsignatura}-${row.codSeccion}-${sessionIndex + 1}`
      }
      course.teachers.add(teacherId)
      const displayName = knownCode
        ? sessionName ?? referenceNames.get(teacherId)
          ?? (normalizeTeacherCode(session.codDocente) === normalizeTeacherCode(row.codDocente) ? teacherName(row) : undefined)
        : undefined
      return {
        ...toHistorySession(session, teacherId),
        ...(knownCode && displayName ? { teacherName: displayName } : {}),
      }
    })
    course.sections.push({ sectionId: String(row.codSeccion), capacity: row.topeAlumnos, sessions: historicalSessions })

    const key = weeklyPatternKey(row.horarios)
    if (!course.patterns.has(key)) {
      course.patterns.set(key, {
        types: row.horarios.map(sessionType),
        sessions: toWeeklySessions(row.horarios, `pattern-${course.patterns.size + 1}`),
      })
    }
  }

  const catalogCourses = [...courses.values()].map((course) => {
    const planningPatterns = [...course.patterns.entries()].map(([key, pattern], index) => ({
      id: `pattern-${index + 1}`,
      label: `Patrón ${index + 1}: ${pattern.types.map((type, sessionIndex) => `${displayType(type)} ${pattern.sessions[sessionIndex].durationMinutes} min`).join(' + ')}`,
      weeklySessions: pattern.sessions.map((session, sessionIndex) => ({ ...session, id: `weekly-${sessionIndex + 1}` })),
      key,
    }))
    return {
      courseId: course.courseId,
      name: course.name,
      cycle: course.cycle,
      credits: course.credits,
      estimatedDemand: 0,
      targetCapacity: 30,
      weeklySessions: planningPatterns[0].weeklySessions,
      history: { sections: course.sections },
      planningPatterns: planningPatterns.map(({ key: _key, ...pattern }) => pattern),
    }
  })

  const referenceTeachers = [...referenceNames.entries()].map(([id, name]) => ({
    id,
    name,
    courseIds: [...(referenceCourses.get(id) ?? [])],
  }))
  const teachers = referenceTeachers.slice(0, 8).map((teacher) => ({
    ...teacher,
    maxWeeklyMinutes: 600,
    availability: plannerWindows,
  }))

  return structuredClone({
    revision: 'PA-DEMO-1',
    source: {
      kind: 'referencia sintética histórica',
      reference: 'backend/src/matricula-regular/scenario-reference.seed.ts',
      sourcePeriod: 'Periodo de origen desconocido; la referencia no confirma vigencia institucional',
      planningPeriod: 'Semestre sintético de planificación local',
      assumptions: 'Nombres docentes del catálogo sintético autorizado; las asignaciones históricas no confirman participación futura. Habilitación inicial solo como supuesto de demostración. Los 49 ambientes y capacidad de referencia 45 fueron proporcionados por el usuario para la demo. Disponibilidad inicial lunes-viernes 08:00-22:00 y carga son parámetros sintéticos editables, no confirmaciones institucionales. Bloque continuo y docente único son la regla funcional solicitada para este prototipo FISI; sesiones divididas solo como excepción explícita.',
    },
    courses: catalogCourses,
    referenceTeachers,
    referenceRooms: createReferenceRooms(),
    teachers,
    rooms: plannerRooms,
    windows: plannerWindows,
    startStepMinutes: 60,
    maxExplorations: 10000,
  })
}
