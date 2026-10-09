import type {
  FamiliarSocioeconomico, HistorialAcademico, PerfilAlumno,
} from './mi-informacion.types.js'

export const perfilFixture: PerfilAlumno = {
  tipoDocumento: 'DNI', numDocumento: 'DEMO-DOC-001', estadoCivil: 'Soltero/a', codSexo: 'N',
  desSexo: 'No especificado', fechaNacimiento: '2008-01-15', departamentoNac: 'Lima',
  provinciaNac: 'Lima', distritoNac: 'Cercado de Lima', telefono: '010000000',
  celular: '900000001', correoInstitucional: 'estudiante@example.test',
  correoPersonal: 'persona@example.test', departamentoDir: 'Lima', provinciaDir: 'Lima',
  distritoDir: 'Cercado de Lima', direccion: 'Dirección de demostración 123', anioIngreso: '2026',
  codTipoIngreso: 'DEMO', desTipoIngreso: 'Ingreso de demostración', codColegioProc: 'DEMO-COL-001',
  desColegioProc: 'Colegio de Demostración', anioEstudio: 1, promedio: 15,
  situAcademica: 'Regular', permanencia: 'Regular', codSemUltMat: '2026-2', promUltMat: 15,
}

export const historialFixture: Omit<HistorialAcademico, 'alumno'> = {
  resumen: { asignaturasAprobadas: 3, creditosAprobados: 12, promedioPonderado: 15 },
  periodos: [{ periodoAcademico: '2026-2', creditos: 12, promedio: 15 }],
  asignaturas: [
    { ciclo: 1, codPlan: '2018  ', tipoAsignatura: 'O', codAsignatura: 'DEMO-001', desAsignatura: 'Matemática I', calificacion: 15, creditos: 4, seccion: 1, acta: 'DEMO-ACTA-001', periodoAcademico: '2026-2' },
    { ciclo: 1, codPlan: '2018  ', tipoAsignatura: 'O', codAsignatura: 'DEMO-002', desAsignatura: 'Introducción a la Informática', calificacion: 15, creditos: 4, seccion: 1, acta: 'DEMO-ACTA-002', periodoAcademico: '2026-2' },
    { ciclo: 1, codPlan: '2018  ', tipoAsignatura: 'O', codAsignatura: 'DEMO-003', desAsignatura: 'Lenguaje y Comunicación', calificacion: 15, creditos: 4, seccion: 1, acta: 'DEMO-ACTA-003', periodoAcademico: '2026-2' },
  ],
}

export const familiaresFixture: FamiliarSocioeconomico[] = [{
  id: 'DEMO-FAMILIAR-001', nombre: 'FAMILIAR DE DEMOSTRACIÓN', edad: 42,
  parentesco: 'Familiar', grado: 'Secundaria', ocupacion: 'Ocupación de demostración',
  condicionLaboral: 'Empleo de demostración', aporteEconomico: '100.00', enfermedad: null,
  tipoDiscapacidad: null,
}]
