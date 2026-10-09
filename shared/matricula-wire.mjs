export const matriculaWireKeys = Object.freeze([
  'matriculaInfo',
  'programacion',
  'prematricula',
  'matricula',
  'horarios',
])

function fail(key, path, expected) {
  const fieldPath = path === key || path.startsWith(`${key}.`) ? path : `${key}.${path}`
  throw new Error(`${fieldPath}: se esperaba ${expected}`)
}

function isRecord(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function validateJson(value, key, path) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return
    fail(key, path, 'valor JSON')
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateJson(item, key, `${path}[${index}]`))
    return
  }
  if (isRecord(value)) {
    for (const [name, item] of Object.entries(value)) validateJson(item, key, `${path}.${name}`)
    return
  }
  fail(key, path, 'valor JSON')
}

function object(value, key, path) {
  if (!isRecord(value)) fail(key, path, 'objeto')
  return value
}

function required(record, name, predicate, key, path, expected) {
  const fieldPath = `${path}.${name}`
  if (!Object.hasOwn(record, name)) fail(key, fieldPath, 'campo presente')
  if (!predicate(record[name])) fail(key, fieldPath, expected)
  return record[name]
}

const isString = (value) => typeof value === 'string'
const isBoolean = (value) => typeof value === 'boolean'
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value)
const isArray = Array.isArray
function fields(record, shape, key, path) {
  for (const [name, validate] of Object.entries(shape)) {
    const fieldPath = `${path}.${name}`
    if (!Object.hasOwn(record, name)) fail(key, fieldPath, 'campo presente')
    validate(record[name], key, fieldPath)
  }
  for (const [name, value] of Object.entries(record)) {
    if (!Object.hasOwn(shape, name)) validateJson(value, key, `${path}.${name}`)
  }
}

function string(value, key, path) {
  if (!isString(value)) fail(key, path, 'string')
}

function number(value, key, path) {
  if (!isFiniteNumber(value)) fail(key, path, 'number finito')
}

function boolean(value, key, path) {
  if (!isBoolean(value)) fail(key, path, 'boolean')
}

function opaque(value, key, path) {
  try {
    validateJson(value, key, path)
  } catch {
    fail(key, path, 'valor JSON')
  }
}

function arrayOf(schema) {
  return (value, key, path) => {
    if (!Array.isArray(value)) fail(key, path, 'array')
    value.forEach((item, index) => schema(item, key, `${path}[${index}]`))
  }
}

function schema(shape) {
  return (value, key, path) => fields(object(value, key, path), shape, key, path)
}

const infoSemestre = schema({
  fecSistema: opaque,
  fecInicioEncuestaDocente: string,
  fecFinEncuestaDocente: string,
  fecInicioEncuestaDocenteS1: string,
  fecFinEncuestaDocenteS1: string,
  fecInicioEncuestaDocenteS2: string,
  fecFinEncuestaDocenteS2: string,
  fecInicioEncuestaDocenteA1: string,
  fecFinEncuestaDocenteA1: string,
  fecInicioEncuestaDocenteA2: string,
  fecFinEncuestaDocenteA2: string,
})
const infoMatricula = schema({
  fecInicioMatInternet: string,
  fecFinMatInternet: string,
  indMatInternet: string,
  indMatObservados: string,
  indMatDeudores: string,
  indMatIngresantes: string,
  indMatExonerados: string,
  indMatRepMultiple: string,
  indProgramacionInterna: string,
  indPagosAdicionales: string,
  obsSemMatInternet: opaque,
  indCertificadoMed: string,
  indHabMatricula: string,
  numMaxRepitencias: number,
  indAutoSeguro: string,
  indMatCtrlHorario: string,
  sfecInicioMatInternet: string,
  sfecFinMatInternet: string,
})
const alumno = schema({
  codAlumno: string, apePaterno: string, apeMaterno: string, nomAlumno: string,
  codFacultad: number, desFacultad: string, areaFacultad: number, codEscuela: number,
  desEscuela: string, areaEscuela: number, codEspecialidad: number, desEspecialidad: string,
  codPlan: string, desPlan: string, ponderado: number, actualizoFormulario: boolean,
  habEncuesta: boolean, habEncuestaEgresados: boolean, habMatricula: boolean, periodo: string,
  urlFoto: string, foto: string, codPermanencia: string, desPermanencia: string,
  codSituacion: string, desSituacion: string, regimen: string, egresadoEG: string,
  cicloEstudios: number, anioIngreso: number, correoInstitucional: string, sexo: string,
  nroTicketMatEG: number, infoSemestre, infoMatricula, anioEstudio: number, codSede: string,
  sedeAlumno: string, difCriterioCalif: boolean,
})
const programacionHorario = schema({
  codSemestre: opaque, codFacultad: number, codEscuela: number, codEspecialidad: number,
  codPlan: opaque, codAsignatura: string, desAsignatura: opaque, codSeccion: number,
  codDocente: string, nomDocente: opaque, horario: number, dia: string, horaInicio: string,
  horaFin: string, horaInicioMin: number, horaFinMin: number, codAula: string,
  topeAlumnosLab: number, matriculadosLab: number, codTipoHoraAsignatura: string,
  desTipoHoraAsignatura: string,
})
const programacionRow = schema({
  ciclo: number, codAsignatura: string, desAsignatura: string, creditos: number,
  codSeccion: number, horario: number, codDocente: string, nomDocente: string,
  apePatDocente: string, apeMatDocente: string, topeAlumnos: number, matriculados: number,
  horarios: arrayOf(programacionHorario),
})
const preMatriculaRow = schema({
  codFacultad: number, codEscuela: number, codEspecialidad: number, codArea: opaque,
  codPlan: string, codAsignatura: string, desAsignatura: string, num_ciclo_ano_asig: number,
  num_creditaje: number, num_rep_plan_act: number, num_mat_equiv: number, num_rep_total: number,
  ind_etapa: string, gs_cod_orient: opaque, gs_tip_asig: opaque, totales_creditos: number,
  codSeccion: number, lisSeccion: opaque,
})
const matriculaRow = schema({
  codSemestre: opaque, codFacultad: number, desFacultad: string, codEscuela: number,
  desEscuela: string, codEspecialidad: number, codAsignatura: string, desAsignatura: string,
  codPlan: string, desPlan: string, codSeccion: number, creditoAsignatura: number,
  numRepitencias: number, numRepitenciasEquiv: number, codAlumno: opaque, nomAlumno: opaque,
  apePatAlumno: opaque, apeMatAlumno: opaque, nomDocente: string, creditosMatriculados: number,
  cicloEstudio: number, horario: number, codAula: string, codTurno: opaque, tipoHorario: opaque,
  anioIngreso: opaque, correoIntitucional: opaque, etapa: opaque, sexo: string,
  usuarioMatricula: opaque, fechaMatricula: opaque, apePatDocente: string, apeMatDocente: string,
})
const datosMatricula = schema({ fechaMatricula: string, codOrientacion: string, tipoMatricula: string })
const horarioRow = schema({
  codSemestre: opaque, codFacultad: number, desFacultad: opaque, codEscuela: number,
  desEscuela: opaque, codEspecialidad: number, codAsignatura: string, desAsignatura: string,
  codPlan: opaque, desPlan: opaque, codSeccion: number, color: number, horaInicio: string,
  horaFin: string, dia: string, numDia: number, codTipoHoraAsignatura: string,
  desTipoHoraAsignatura: string,
})

const dataSchemas = {
  matriculaInfo: schema({
    codSemestre: string, codFacultad: number, fechaDB: string, fecIniMatInternet: string,
    fecFinMatInternet: string, mensajeMatricula: string, mensaje: string,
    indMatHabilitada: boolean, matriculado: boolean, indMatCtrlHorario: string,
    valProgramacion: opaque,
    perfil: schema({
      anioIngreso: number, anioEstudio: number, promedio: number, situAcademica: string,
      permanencia: string, semestreSuspension: opaque, codTipoAutorizacion: opaque,
    }),
    creditaje: (value, key, path) => {
      const record = object(value, key, path)
      for (const [name, amount] of Object.entries(record)) number(amount, key, `${path}.${name}`)
    },
    amonestaciones: opaque,
  }),
  programacion: schema({ alumno, programacion: arrayOf(programacionRow) }),
  prematricula: arrayOf(preMatriculaRow),
  matricula: schema({
    matricula: arrayOf(matriculaRow), datosMatricula, indMatHabilitadaLabPra: boolean,
    codFacultad: number,
  }),
  horarios: arrayOf(horarioRow),
}

export function validateMatriculaWire(key, value) {
  if (!matriculaWireKeys.includes(key)) throw new Error(`matriculaWire.${String(key)}: clave desconocida`)
  const envelope = object(value, key, key)
  required(envelope, 'message', (field) => field === null || isString(field), key, key, 'string o null')
  required(envelope, 'codError', (field) => field === null, key, key, 'null')
  if (!Object.hasOwn(envelope, 'data')) fail(key, `${key}.data`, 'campo presente')
  dataSchemas[key](envelope.data, key, `${key}.data`)
  for (const [name, field] of Object.entries(envelope)) {
    if (!['message', 'codError', 'data'].includes(name)) validateJson(field, key, `${key}.${name}`)
  }
}
