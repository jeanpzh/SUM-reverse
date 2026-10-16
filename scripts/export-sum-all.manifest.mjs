export const origin = 'https://sum.unmsm.edu.pe'

export const planRevision = 'ME-EXPORT-2'

export const viewJobs = Object.freeze([
  { slug: 'inicio', path: '/alumnoWebSum/v2/inicio' },
  { slug: 'perfil', path: '/alumnoWebSum/v2/informacion/perfil' },
  { slug: 'historial', path: '/alumnoWebSum/v2/informacion/historial' },
  { slug: 'formulario-datos', path: '/alumnoWebSum/v2/informacion/formularioDatos' },
  { slug: 'ficha-socioeconomica', path: '/alumnoWebSum/v2/informacion/fichaSocioeconomica' },
  { slug: 'matricula-info', path: '/alumnoWebSum/v2/matricula/informacion' },
  { slug: 'programacion-asignaturas', path: '/alumnoWebSum/v2/matricula/programacion' },
  { slug: 'reporte-pre-matricula', path: '/alumnoWebSum/v2/reportes/prematricula' },
  { slug: 'reporte-matricula', path: '/alumnoWebSum/v2/reportes/matricula' },
  { slug: 'reporte-horario', path: '/alumnoWebSum/v2/reportes/horarios' },
  { slug: 'reporte-evaluaciones', path: '/alumnoWebSum/v2/reportes/evaluaciones' },
  { slug: 'reporte-deudas', path: '/alumnoWebSum/v2/reportes/deudas' },
  { slug: 'asistencias', path: '/alumnoWebSum/v2/asistencia' },
  { slug: 'tutoria', path: '/alumnoWebSum/v2/tutoria' },
  { slug: 'plan-estudios', path: '/alumnoWebSum/v2/planEstudios' },
  { slug: 'manuales', path: '/alumnoWebSum/v2/manuales' }
].map((job) => Object.freeze(job)))

export const readJobs = Object.freeze([
  { key: 'perfil', path: '/alumnoWebSum/v2/informacion/perfil', action: 'obtenerInformacionAlumno', filename: 'mi-perfil.json', evidenceLevel: 'candidate' },
  { key: 'formulario-datos-matricula', path: '/alumnoWebSum/v2/informacion/formularioDatos', action: 'obtenerFormularioDatosMatricula', filename: 'formulario-datos-matricula.json', evidenceLevel: 'observed' },
  { key: 'matricula-info', path: '/alumnoWebSum/v2/matricula/informacion', action: 'obtenerInformacion', filename: 'matricula-info.json', evidenceLevel: 'observed' },
  { key: 'programacion-asignaturas', path: '/alumnoWebSum/v2/matricula/programacion', action: 'obtenerProgramacionAsignaturas', filename: 'programacion-asignaturas.json', evidenceLevel: 'observed' },
  { key: 'reporte-pre-matricula', path: '/alumnoWebSum/v2/reportes/prematricula', action: 'obtenerAlumnoPrematricula', filename: 'reporte-pre-matricula.json', evidenceLevel: 'observed' },
  { key: 'reporte-matricula', path: '/alumnoWebSum/v2/reportes/matricula', action: 'obtenerAlumnoMatricula', filename: 'reporte-matricula.json', evidenceLevel: 'observed' },
  { key: 'reporte-horario', path: '/alumnoWebSum/v2/reportes/horarios', action: 'obtenerHorariosAsignatura', filename: 'reporte-horario.json', evidenceLevel: 'observed' },
  { key: 'reporte-evaluaciones', path: '/alumnoWebSum/v2/reportes/evaluaciones', action: 'recuperarEvaluacionesCalificaciones', filename: 'reporte-evaluaciones.json', evidenceLevel: 'candidate' },
  { key: 'reporte-deudas', path: '/alumnoWebSum/v2/reportes/deudas', action: 'obtenerAlumnoDeuda', filename: 'reporte-deudas.json', evidenceLevel: 'candidate' },
  { key: 'asistencias', path: '/alumnoWebSum/v2/asistencia', action: 'obtenerResumenAsistencia', filename: 'mis-asistencias.json', evidenceLevel: 'candidate' },
  { key: 'tutoria', path: '/alumnoWebSum/v2/tutoria', action: 'obtenerListaAsignaturaTutoria', filename: 'tutoria.json', evidenceLevel: 'candidate' },
  { key: 'plan-estudios', path: '/alumnoWebSum/v2/planEstudios', action: 'obtenerPlanEstudios', filename: 'plan-estudios.json', evidenceLevel: 'candidate' }
].map((job) => Object.freeze(job)))
