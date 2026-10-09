import type { EndpointKey } from './contracts.ts'

// method is the independent local API method. legacyMethod records only
// frontend-observed methods for the legacy api mode.
export const endpoints = {
  perfil: { path: 'informacion/perfil', action: 'obtenerInformacionAlumno', method: 'POST' },
  formulario: { path: 'informacion/formularioDatos', action: 'obtenerFormularioDatosMatricula', method: 'POST', legacyMethod: 'GET' },
  historial: { path: 'informacion/historial', action: 'obtenerHistorialAcademico', method: 'POST' },
  fichaSocioeconomica: { path: 'informacion/fichaSocioeconomica', action: 'obtenerFichaSocioeconomica', method: 'POST' },
  matriculaInfo: { path: 'matricula/informacion', action: 'obtenerInformacion', method: 'POST', legacyMethod: 'GET' },
  programacion: { path: 'matricula/programacion', action: 'obtenerProgramacionAsignaturas', method: 'POST', legacyMethod: 'GET' },
  prematricula: { path: 'reportes/prematricula', action: 'obtenerAlumnoPrematricula', method: 'POST', legacyMethod: 'GET' },
  matricula: { path: 'reportes/matricula', action: 'obtenerAlumnoMatricula', method: 'POST', legacyMethod: 'GET' },
  horarios: { path: 'reportes/horarios', action: 'obtenerHorariosAsignatura', method: 'POST', legacyMethod: 'GET' },
  evaluaciones: { path: 'reportes/evaluaciones', action: 'recuperarEvaluacionesCalificaciones', method: 'POST' },
  deudas: { path: 'reportes/deudas', action: 'obtenerAlumnoDeuda', method: 'POST' },
  asistencias: { path: 'asistencia', action: 'obtenerResumenAsistencia', method: 'POST' },
  tutoria: { path: 'tutoria', action: 'obtenerListaAsignaturaTutoria', method: 'POST' },
  plan: { path: 'planEstudios', action: 'obtenerPlanEstudios', method: 'POST' },
} satisfies Record<EndpointKey, { path: string; action: string; method: 'POST'; legacyMethod?: 'GET' }>
