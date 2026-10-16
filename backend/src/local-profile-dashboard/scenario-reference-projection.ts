import type { ActorProfile } from '../matricula-regular/profile.types.js'
import type { RunSnapshot } from '../matricula-regular/store.types.js'
import type { ProgramacionEnvelope } from '../programacion/programacion.types.js'
import { projectStudent } from './profile-projection.js'

const time = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
const days = ['', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']

export function projectScenarioProgramming(actor: ActorProfile, snapshot: RunSnapshot): ProgramacionEnvelope {
  if (!actor.scenarioData) throw new TypeError('Falta programación del escenario')
  const source = actor.scenarioData
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
