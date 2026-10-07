import type { EndpointKey } from './contracts.ts'

// POST is explicit for the first four entries in the README. For the remaining
// eight it is an assumption following that pattern, not a confirmed observation.
export const endpoints = {
  perfil: { path: 'informacion/perfil', action: 'obtenerInformacionAlumno', method: 'POST' },
  formulario: { path: 'informacion/formularioDatos', action: 'obtenerFormularioDatosMatricula', method: 'POST' },
  matriculaInfo: { path: 'matricula/informacion', action: 'obtenerInformacion', method: 'POST' },
  programacion: { path: 'matricula/programacion', action: 'obtenerProgramacionAsignaturas', method: 'POST' },
  prematricula: { path: 'reportes/prematricula', action: 'obtenerAlumnoPrematricula', method: 'POST' },
  matricula: { path: 'reportes/matricula', action: 'obtenerAlumnoMatricula', method: 'POST' },
  horarios: { path: 'reportes/horarios', action: 'obtenerHorariosAsignatura', method: 'POST' },
  evaluaciones: { path: 'reportes/evaluaciones', action: 'recuperarEvaluacionesCalificaciones', method: 'POST' },
  deudas: { path: 'reportes/deudas', action: 'obtenerAlumnoDeuda', method: 'POST' },
  asistencias: { path: 'asistencia', action: 'obtenerResumenAsistencia', method: 'POST' },
  tutoria: { path: 'tutoria', action: 'obtenerListaAsignaturaTutoria', method: 'POST' },
  plan: { path: 'planEstudios', action: 'obtenerPlanEstudios', method: 'POST' },
} satisfies Record<EndpointKey, { path: string; action: string; method: 'POST' }>
