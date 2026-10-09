import { validateMatriculaWire } from '../shared/matricula-wire.mjs'
import { validateMiInformacionWire } from '../shared/mi-informacion-wire.mjs'
import { validatePlanEstudiosWire } from '../shared/plan-estudios-wire.mjs'

export const sumOrigin = 'https://sum.unmsm.edu.pe'
// Operator-provided raw-types/README.md, supplied Historial URL and archived public JS.
// Methods are detected from each screen's native read request, rather than guessed.
export const snapshotJobs = Object.freeze([
  ['perfil', 'informacion/perfil', 'obtenerInformacionAlumno', 'mi-perfil.json'],
  ['formularioDatos', 'informacion/formularioDatos', 'obtenerFormularioDatosMatricula', 'formulario-datos-matricula.json'],
  ['historial', 'informacion/historial', 'obtenerHistorialAcademico', 'historial-academico.json'],
  ['matriculaInfo', 'matricula/informacion', 'obtenerInformacion', 'matricula-info.json'],
  ['programacion', 'matricula/programacion', 'obtenerProgramacionAsignaturas', 'programacion-asignaturas.json'],
  ['prematricula', 'reportes/prematricula', 'obtenerAlumnoPrematricula', 'reporte-pre-matricula.json'],
  ['matricula', 'reportes/matricula', 'obtenerAlumnoMatricula', 'reporte-matricula.json'],
  ['horarios', 'reportes/horarios', 'obtenerHorariosAsignatura', 'reporte-horario.json'],
  ['plan', 'planEstudios', 'obtenerPlanEstudios', 'plan-estudios.json'],
].map(([key, route, action, filename]) => Object.freeze({
  key, path: `/alumnoWebSum/v2/${route}`, action, filename,
})))

export function validateSnapshot(job, envelope) {
  if (['perfil', 'formularioDatos', 'historial'].includes(job.key)) {
    validateMiInformacionWire(job.key, envelope, 'candidate-v1')
  } else if (job.key === 'plan') validatePlanEstudiosWire(envelope)
  else validateMatriculaWire(job.key, envelope)
}

export function hasAuthenticationFields(value) {
  if (value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.some(hasAuthenticationFields)
  return Object.entries(value).some(([key, item]) =>
    /password|contrase|cookie|authorization|access.?token|refresh.?token|secret|jsessionid/i.test(key)
    || hasAuthenticationFields(item))
}
