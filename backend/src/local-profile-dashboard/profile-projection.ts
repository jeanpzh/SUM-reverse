import { buildSections } from '../mi-informacion/mi-informacion.catalogs.js'
import type { ActorProfile } from '../matricula-regular/profile.types.js'
import type { AlumnoFixture } from '../reportes/reportes.types.js'
import type { CompatibleKey, CompatiblePayload, CompatiblePayloadMap, LocalFormularioData } from './profile-projection.types.js'
import { validateSyntheticAcademicRecord } from '../matricula-regular/academic-demo.validation.js'


function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

const clone = <T>(value: T): T => structuredClone(value)

const formFlags = {
  datosPersonalesCompletado: false,
  colegioCompletado: false,
  actividadProfesionalCompletado: false,
  dependenciaEconomicaCompletado: false,
  recursosEstudioCompletado: false,
  transporteCompletado: false,
  saludCompletado: false,
  interesAcademicoCompletado: false,
  contactoCompletado: false,
} as const

export function projectStudent(actor: ActorProfile): AlumnoFixture {
  const emptyInfoSemestre = {
    fecSistema: null,
    fecInicioEncuestaDocente: '',
    fecFinEncuestaDocente: '',
    fecInicioEncuestaDocenteS1: '',
    fecFinEncuestaDocenteS1: '',
    fecInicioEncuestaDocenteS2: '',
    fecFinEncuestaDocenteS2: '',
    fecInicioEncuestaDocenteA1: '',
    fecFinEncuestaDocenteA1: '',
    fecInicioEncuestaDocenteA2: '',
    fecFinEncuestaDocenteA2: '',
  }
  const emptyInfoMatricula = {
    fecInicioMatInternet: '',
    fecFinMatInternet: '',
    indMatInternet: '',
    indMatObservados: '',
    indMatDeudores: '',
    indMatIngresantes: '',
    indMatExonerados: '',
    indMatRepMultiple: '',
    indProgramacionInterna: '',
    indPagosAdicionales: '',
    obsSemMatInternet: null,
    indCertificadoMed: '',
    indHabMatricula: '',
    numMaxRepitencias: 0,
    indAutoSeguro: '',
    indMatCtrlHorario: '',
    sfecInicioMatInternet: '',
    sfecFinMatInternet: '',
  }

  const student: AlumnoFixture = {
    codAlumno: actor.actorId,
    apePaterno: '',
    apeMaterno: '',
    nomAlumno: actor.name,
    codFacultad: 0,
    desFacultad: actor.scope.facultyId,
    areaFacultad: 0,
    codEscuela: 0,
    desEscuela: actor.scope.schoolId,
    areaEscuela: 0,
    codEspecialidad: 0,
    desEspecialidad: 'No disponible',
    codPlan: actor.scope.planId,
    desPlan: actor.scope.planId,
    ponderado: actor.ponderado ?? 0,
    actualizoFormulario: false,
    habEncuesta: false,
    habEncuestaEgresados: false,
    habMatricula: false,
    periodo: '2026-2',
    urlFoto: '',
    foto: '',
    codPermanencia: '',
    desPermanencia: '',
    codSituacion: '',
    desSituacion: '',
    regimen: '',
    egresadoEG: '',
    cicloEstudios: 0,
    anioIngreso: 0,
    correoInstitucional: '',
    sexo: '',
    nroTicketMatEG: 0,
    infoSemestre: emptyInfoSemestre,
    infoMatricula: emptyInfoMatricula,
    anioEstudio: 0,
    codSede: '',
    sedeAlumno: '',
    difCriterioCalif: false,
  }
  if (actor.scenarioData) {
    const profile = actor.scenarioData.profile
    Object.assign(student, {
      codFacultad: 20, desFacultad: 'INGENIERÍA DE SISTEMAS E INFORMÁTICA',
      codEscuela: actor.scope.schoolId === 'SISTEMAS' ? 1 : 2,
      desEscuela: actor.scope.schoolId === 'SISTEMAS' ? 'Ingeniería de Sistemas' : 'Ingeniería de Software',
      desEspecialidad: 'Estudios de especialidad', desPlan: 'Plan de Estudios 2018 (base sintética)',
      anioIngreso: 2022, anioEstudio: 5, cicloEstudios: 9, regimen: 'Semestral',
      sexo: profile.desSexo, correoInstitucional: profile.correoInstitucional,
      codSituacion: 'R', desSituacion: profile.situAcademica, codPermanencia: 'R', desPermanencia: 'Activo',
      sedeAlumno: 'Ciudad Universitaria', codSede: '01', habMatricula: true,
    })
  }
  return student
}

function scenarioSections(actor: ActorProfile, kind: 'formulario' | 'ficha') {
  const sections = buildSections(kind, projectStudent(actor), true)
  const profile = actor.scenarioData?.profile
  if (!profile) return sections
  const values: Record<string, string> = {
    'Tipo de Doc. de Identidad': profile.tipoDocumento, 'Número de Doc. de Identidad': profile.numDocumento,
    'Fecha de Nacimiento': profile.fechaNacimiento, Sexo: profile.desSexo, 'Estado Civil': profile.estadoCivil,
    País: 'Perú', Departamento: 'Lima', Provincia: 'Lima', Distrito: profile.distritoDir,
    Dirección: profile.direccion, 'Teléfono Fijo': profile.telefono, 'Teléfono Móvil': profile.celular,
    'Correo Personal': profile.correoPersonal, 'Nombre del Colegio': profile.desColegioProc,
    'nombre de Colegio': profile.desColegioProc, 'Tipo de Colegio': 'Público',
    'Año de conclusión de Secundaria': '2021', 'Tipo de Preparación Universitaria': 'Academia',
    'Acceso a Internet': 'Internet fijo en el domicilio', 'Acceso a Bibliotecas': 'Biblioteca universitaria',
    Alimentación: 'En el hogar', Transporte: 'Transporte público',
    'Medio de transporte hacia la Universidad': 'Bus', 'Lengua Materna': 'Castellano',
    '¿Con quien vive?': 'Familia', 'Tipo de vivienda': 'Departamento',
    '¿Depende económicamente de sus padres o tutores?': 'Sí', 'Número de Hijos': '0',
    '¿Usted trabaja en la actualidad?': actor.actorId.endsWith('-B') ? 'Sí, medio tiempo' : 'No',
    '¿Se siente motivado con la carrera?': 'Sí', '¿Cómo se siente en la carrera?': 'Motivado/a',
    '¿Qué área de cursos le agrada más?': actor.scope.schoolId === 'SISTEMAS' ? 'Sistemas de información' : 'Desarrollo de software',
    '¿A que seguro de salud se encuentra incorporado?': 'Seguro público (simulado)',
    '¿Cuánto tiempo te demoras(minutos) en llegar a la Universidad?': '45',
    '¿Cuánto tiempo te demoras en llegar a la Universidad?(mins)': '45',
    'Nombres y Apellidos': 'Contacto familiar sintético', 'Parentesco': 'Madre',
  }
  for (const section of sections) for (const field of section.campos) {
    if (values[field.etiqueta] !== undefined) field.valor = values[field.etiqueta]!
  }
  return sections
}

function projectFormulario(actor: ActorProfile): LocalFormularioData {
  const alumno = projectStudent(actor)
  return {
    alumno,
    formulario: {},
    politicaPrivacidad: null,
    llenar: false,
    ...formFlags,
    secciones: scenarioSections(actor, 'formulario'),
  }
}

function projectHistorial(actor: ActorProfile): CompatiblePayloadMap['historial'] {
  const record = actor.academic
  if (record === undefined) {
    return {
      alumno: projectStudent(actor),
      resumen: { asignaturasAprobadas: 0, creditosAprobados: 0, promedioPonderado: null },
      periodos: [],
      asignaturas: [],
    }
  }

  validateSyntheticAcademicRecord(actor, record)
  const courses = new Map(record.catalog.map((course) => [course.courseId, course]))
  const attempts = record.attempts.map((attempt) => {
    const course = courses.get(attempt.courseId)!
    return {
      ciclo: course.cycle!,
      codPlan: course.planId,
      tipoAsignatura: course.courseType === 'mandatory' ? 'O' : 'E',
      codAsignatura: actor.scenarioData?.courseCodes[course.courseId] ?? course.courseId,
      desAsignatura: course.name,
      calificacion: attempt.grade,
      creditos: course.credits,
      seccion: attempt.sectionNumber,
      acta: attempt.recordId,
      periodoAcademico: attempt.period,
      result: attempt.result,
    }
  })
  const approvedCourses = new Set(attempts.filter(({ result }) => result === 'approved').map(({ codAsignatura }) => codAsignatura))
  const approvedCredits = [...approvedCourses].reduce((total, courseId) => total + record.catalog.find((course) => (actor.scenarioData?.courseCodes[course.courseId] ?? course.courseId) === courseId)!.credits, 0)
  const attemptedCredits = attempts.reduce((total, attempt) => total + attempt.creditos, 0)
  const weightedTotal = attempts.reduce((total, attempt) => total + attempt.calificacion * attempt.creditos, 0)
  const average = attempts.length === 0 || attemptedCredits === 0 ? null : round2(weightedTotal / attemptedCredits)
  const periodMap = new Map<string, { credits: number; weightedTotal: number }>()
  for (const attempt of attempts) {
    const current = periodMap.get(attempt.periodoAcademico) ?? { credits: 0, weightedTotal: 0 }
    current.credits += attempt.creditos
    current.weightedTotal += attempt.calificacion * attempt.creditos
    periodMap.set(attempt.periodoAcademico, current)
  }
  const periods = [...periodMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([periodoAcademico, value]) => ({
      periodoAcademico,
      creditos: value.credits,
      promedio: round2(value.weightedTotal / value.credits),
    }))

  return {
    alumno: { ...projectStudent(actor), ponderado: average ?? actor.ponderado ?? 0 },
    resumen: {
      asignaturasAprobadas: approvedCourses.size,
      creditosAprobados: approvedCredits,
      promedioPonderado: average,
    },
    periodos: periods,
    asignaturas: attempts.map(({ result: _result, ...attempt }) => attempt),
  }
}

function projectFicha(actor: ActorProfile): CompatiblePayloadMap['fichaSocioeconomica'] {
  const alumno = projectStudent(actor)
  return {
    alumno,
    secciones: scenarioSections(actor, 'ficha'),
    familiares: [],
  }
}

function projectCompatible<K extends CompatibleKey>(key: K, actor: ActorProfile): CompatiblePayload<K> {
  const projections: CompatiblePayloadMap = {
    perfil: actor.scenarioData ? { message: null, codError: null, data: actor.scenarioData.profile } : null,
    formulario: projectFormulario(actor),
    historial: projectHistorial(actor),
    fichaSocioeconomica: projectFicha(actor),
    evaluaciones: { message: null, codError: null, data: [] },
    deudas: { message: null, codError: null, data: [] },
    asistencias: { message: null, codError: null, data: [] },
    tutoria: { message: null, codError: null, data: [] },
  }
  return clone(projections[key])
}

export function projectProfileRead<K extends CompatibleKey>(key: K, actor: ActorProfile): CompatiblePayload<K> {
  return projectCompatible(key, actor)
}
