export const miInformacionWireKeys = Object.freeze([
  'perfil',
  'historial',
  'formularioDatos',
  'fichaSocioeconomica',
])

const profileStrings = [
  'tipoDocumento', 'numDocumento', 'estadoCivil', 'codSexo', 'desSexo', 'fechaNacimiento',
  'departamentoNac', 'provinciaNac', 'distritoNac', 'telefono', 'celular',
  'correoInstitucional', 'correoPersonal', 'departamentoDir', 'provinciaDir',
  'distritoDir', 'direccion', 'anioIngreso', 'codTipoIngreso', 'desTipoIngreso',
  'codColegioProc', 'desColegioProc', 'situAcademica', 'permanencia', 'codSemUltMat',
]
const profileNumbers = ['anioEstudio', 'promedio', 'promUltMat']

const alumnoStrings = [
  'codAlumno', 'apePaterno', 'apeMaterno', 'nomAlumno', 'desFacultad', 'desEscuela',
  'desEspecialidad', 'codPlan', 'desPlan', 'periodo', 'urlFoto', 'foto',
  'codPermanencia', 'desPermanencia', 'codSituacion', 'desSituacion', 'regimen',
  'egresadoEG', 'correoInstitucional', 'sexo', 'codSede', 'sedeAlumno',
]
const alumnoNumbers = [
  'codFacultad', 'areaFacultad', 'codEscuela', 'areaEscuela', 'codEspecialidad',
  'ponderado', 'cicloEstudios', 'anioIngreso', 'nroTicketMatEG', 'anioEstudio',
]
const alumnoBooleans = [
  'actualizoFormulario', 'habEncuesta', 'habEncuestaEgresados', 'habMatricula',
  'difCriterioCalif',
]
const infoMatriculaStrings = [
  'fecInicioMatInternet', 'fecFinMatInternet', 'indMatInternet', 'indMatObservados',
  'indMatDeudores', 'indMatIngresantes', 'indMatExonerados', 'indMatRepMultiple',
  'indProgramacionInterna', 'indPagosAdicionales', 'indCertificadoMed', 'indHabMatricula',
  'indAutoSeguro', 'indMatCtrlHorario', 'sfecInicioMatInternet', 'sfecFinMatInternet',
]
const infoSemestreStrings = [
  'fecInicioEncuestaDocente', 'fecFinEncuestaDocente', 'fecInicioEncuestaDocenteS1',
  'fecFinEncuestaDocenteS1', 'fecInicioEncuestaDocenteS2', 'fecFinEncuestaDocenteS2',
  'fecInicioEncuestaDocenteA1', 'fecFinEncuestaDocenteA1', 'fecInicioEncuestaDocenteA2',
  'fecFinEncuestaDocenteA2',
]
const formFlags = [
  'datosPersonalesCompletado', 'colegioCompletado', 'actividadProfesionalCompletado',
  'dependenciaEconomicaCompletado', 'recursosEstudioCompletado', 'transporteCompletado',
  'saludCompletado', 'interesAcademicoCompletado', 'contactoCompletado',
]
const formSectionTitles = [
  'Datos Personales', 'Colegio de Procedencia', 'Dependencia Económica', 'Recursos de Estudio',
  'Transporte', 'Salud', 'Interés Académico', 'Contacto',
]
const formFieldCounts = [23, 9, 6, 5, 3, 3, 7, 8]
const fichaSectionTitles = [
  'Datos Alumno', 'Colegio de Procedencia', 'Dependencia Económica', 'Contacto', 'Salud',
  'Interés Académico', 'Transporte', 'Familia Salud', 'Recursos de Estudio',
  'Datos Vivienda', 'Situación Económica', 'Recreación', 'Aptitudes y Habilidades',
]
const fichaFieldCounts = [18, 9, 7, 12, 6, 7, 3, 0, 5, 21, 22, 4, 27]

export class MiInformacionWireValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'MiInformacionWireValidationError'
  }
}

function fail(key, path, expected) {
  const fieldPath = path === key || path.startsWith(`${key}.`) ? path : `${key}.${path}`
  throw new MiInformacionWireValidationError(`${fieldPath}: se esperaba ${expected}`)
}

function record(value, key, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(key, path, 'objeto')
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) fail(key, path, 'objeto JSON')
  return value
}

function validateJson(value, key, path, ancestors = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return
    fail(key, path, 'valor JSON')
  }
  if (typeof value !== 'object' || value === null || ancestors.has(value)) fail(key, path, 'valor JSON')
  ancestors.add(value)
  if (Array.isArray(value)) {
    for (const item of value) validateJson(item, key, `${path}[*]`, ancestors)
  } else {
    record(value, key, path)
    for (const item of Object.values(value)) validateJson(item, key, `${path}[*]`, ancestors)
  }
  ancestors.delete(value)
}

function string(value, key, path) {
  if (typeof value !== 'string') fail(key, path, 'string')
}

function number(value, key, path) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(key, path, 'number finito')
}

function safeNonNegativeInteger(value, key, path) {
  if (!Number.isSafeInteger(value) || value < 0) fail(key, path, 'entero seguro no negativo')
}

function nonEmptyString(value, key, path) {
  string(value, key, path)
  if (value.length === 0) fail(key, path, 'string no vacío')
}

function boolean(value, key, path) {
  if (typeof value !== 'boolean') fail(key, path, 'boolean')
}

function fields(value, key, path, shape) {
  const target = record(value, key, path)
  for (const [name, validate] of Object.entries(shape)) {
    const fieldPath = `${path}.${name}`
    if (!Object.hasOwn(target, name)) fail(key, fieldPath, 'campo presente')
    validate(target[name], key, fieldPath)
  }
  for (const [name, extra] of Object.entries(target)) {
    if (!Object.hasOwn(shape, name)) validateJson(extra, key, `${path}.[extra]`)
  }
  return target
}

function shapeOfStrings(names) {
  return Object.fromEntries(names.map((name) => [name, string]))
}

function shapeOfNumbers(names) {
  return Object.fromEntries(names.map((name) => [name, number]))
}

function shapeOfBooleans(names) {
  return Object.fromEntries(names.map((name) => [name, boolean]))
}

function profileCandidate(value, key, path) {
  fields(value, key, path, { ...shapeOfStrings(profileStrings), ...shapeOfNumbers(profileNumbers) })
}

function alumnoCandidate(value, key, path) {
  fields(value, key, path, {
    ...shapeOfStrings(alumnoStrings),
    ...shapeOfNumbers(alumnoNumbers),
    ...shapeOfBooleans(alumnoBooleans),
    infoSemestre: (item, innerKey, innerPath) => fields(item, innerKey, innerPath, {
      fecSistema: validateJson,
      ...shapeOfStrings(infoSemestreStrings),
    }),
    infoMatricula: (item, innerKey, innerPath) => fields(item, innerKey, innerPath, {
      ...shapeOfStrings(infoMatriculaStrings),
      obsSemMatInternet: validateJson,
      numMaxRepitencias: number,
    }),
  })
}

function formularioCandidate(value, key, path) {
  fields(value, key, path, {
    alumno: alumnoCandidate,
    formulario: (item, innerKey, innerPath) => {
      if (item !== null && (typeof item !== 'object' || Array.isArray(item))) fail(innerKey, innerPath, 'null u objeto')
      if (item !== null) validateJson(item, innerKey, innerPath)
    },
    politicaPrivacidad: validateJson,
    llenar: boolean,
    ...shapeOfBooleans(formFlags),
  })
}

function historialCandidate(value, key, path) {
  fields(value, key, path, {
    historial: (items, innerKey, innerPath) => {
      if (!Array.isArray(items)) fail(innerKey, innerPath, 'array')
      items.forEach((item, index) => fields(item, innerKey, `${innerPath}[${index}]`, {
        codAlumno: validateJson,
        codSemestre: string,
        codFacultad: number,
        codEscuela: number,
        codEspecialidad: number,
        codPlan: string,
        codSeccion: number,
        ciclo: number,
        codTipoAsignatura: string,
        creditos: number,
        codAsignatura: string,
        desAsignatura: string,
        calificacion: number,
        codTipoActa: string,
        numActa: string,
        numResConv: validateJson,
      }))
    },
    promedios: (items, innerKey, innerPath) => {
      if (!Array.isArray(items)) fail(innerKey, innerPath, 'array')
      items.forEach((item, index) => fields(item, innerKey, `${innerPath}[${index}]`, {
        semestre: string,
        promedio: number,
      }))
    },
    creditaje: (item, innerKey, innerPath) => {
      const amounts = record(item, innerKey, innerPath)
      for (const amount of Object.values(amounts)) number(amount, innerKey, `${innerPath}[*]`)
    },
    criterioCalificacion: boolean,
    anioIngreso: number,
    facultad: number,
    escuela: number,
  })
}

function nullableString(value, key, path) {
  if (value !== null) string(value, key, path)
}

function section(value, key, path) {
  fields(value, key, path, {
    id: string,
    titulo: string,
    campos: (items, innerKey, innerPath) => {
      if (!Array.isArray(items)) fail(innerKey, innerPath, 'array')
      items.forEach((item, index) => fields(item, innerKey, `${innerPath}[*]`, {
        id: string,
        etiqueta: string,
        valor: nullableString,
      }))
    },
  })
}

function validateSections(value, key, path, titles, fieldCounts, prefix) {
  if (!Array.isArray(value) || value.length !== titles.length) fail(key, path, 'estructura local-v1')
  const ids = new Set()
  value.forEach((item, index) => {
    const sectionPath = `${path}[*]`
    section(item, key, sectionPath)
    nonEmptyString(item.id, key, `${sectionPath}.id`)
    nonEmptyString(item.titulo, key, `${sectionPath}.titulo`)
    if (item.id !== `${prefix}-${String(index + 1).padStart(2, '0')}` || item.titulo !== titles[index] || ids.has(item.id)) {
      fail(key, sectionPath, 'sección local-v1')
    }
    ids.add(item.id)
    if (item.campos.length !== fieldCounts[index]) fail(key, `${sectionPath}.campos`, 'estructura local-v1')
    const fieldIds = new Set()
    item.campos.forEach((field, fieldIndex) => {
      const expectedId = `${prefix}-${String(index + 1).padStart(2, '0')}-${String(fieldIndex + 1).padStart(3, '0')}`
      nonEmptyString(field.id, key, `${sectionPath}.campos[*].id`)
      nonEmptyString(field.etiqueta, key, `${sectionPath}.campos[*].etiqueta`)
      if (field.id !== expectedId || fieldIds.has(field.id)) fail(key, `${sectionPath}.campos[*]`, 'campo local-v1')
      fieldIds.add(field.id)
    })
  })
}

function alumnoLocal(value, key, path) {
  alumnoCandidate(value, key, path)
  for (const name of ['codAlumno', 'nomAlumno', 'periodo', 'desFacultad', 'desEscuela',
    'desEspecialidad', 'codPlan', 'desPlan']) nonEmptyString(value[name], key, `${path}.${name}`)
  safeNonNegativeInteger(value.anioEstudio, key, `${path}.anioEstudio`)
}

function profileLocal(value, key, path) {
  profileCandidate(value, key, path)
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.fechaNacimiento)
  if (date === null) fail(key, `${path}.fechaNacimiento`, 'fecha local-v1')
  const year = Number(date[1])
  const month = Number(date[2])
  const day = Number(date[3])
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysByMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month < 1 || month > 12 || day < 1 || day > daysByMonth[month - 1]) {
    fail(key, `${path}.fechaNacimiento`, 'fecha local-v1')
  }
  safeNonNegativeInteger(value.anioEstudio, key, `${path}.anioEstudio`)
}

function formularioLocal(value, key, path) {
  formularioCandidate(value, key, path)
  alumnoLocal(value.alumno, key, `${path}.alumno`)
  if (value.formulario === null || typeof value.formulario !== 'object' || Array.isArray(value.formulario)) {
    fail(key, `${path}.formulario`, 'objeto local-v1 vacío')
  }
  if (Object.keys(value.formulario).length !== 0) fail(key, `${path}.formulario`, 'objeto local-v1 vacío')
  validateSections(value.secciones, key, `${path}.secciones`, formSectionTitles, formFieldCounts, 'formulario')
}

function alumnoFixture(value, key, path) {
  alumnoLocal(value, key, path)
}

function localHistory(value, key, path) {
  fields(value, key, path, {
    alumno: alumnoFixture,
    resumen: (item, innerKey, innerPath) => fields(item, innerKey, innerPath, {
      asignaturasAprobadas: safeNonNegativeInteger,
      creditosAprobados: safeNonNegativeInteger,
      promedioPonderado: nullableFiniteNumber,
    }),
    periodos: (items, innerKey, innerPath) => {
      if (!Array.isArray(items)) fail(innerKey, innerPath, 'array')
      items.forEach((item) => fields(item, innerKey, `${innerPath}[*]`, {
        periodoAcademico: nonEmptyString, creditos: safeNonNegativeInteger, promedio: number,
      }))
    },
    asignaturas: (items, innerKey, innerPath) => {
      if (!Array.isArray(items)) fail(innerKey, innerPath, 'array')
      items.forEach((item) => fields(item, innerKey, `${innerPath}[*]`, {
        ciclo: safeNonNegativeInteger, codPlan: nonEmptyString, tipoAsignatura: nonEmptyString,
        codAsignatura: nonEmptyString, desAsignatura: nonEmptyString, calificacion: number,
        creditos: safeNonNegativeInteger, seccion: safeNonNegativeInteger,
        acta: nonEmptyString, periodoAcademico: nonEmptyString,
      }))
    },
  })
}

function nullableFiniteNumber(value, key, path) {
  if (value !== null) number(value, key, path)
}

function localFicha(value, key, path) {
  fields(value, key, path, {
    alumno: alumnoFixture,
    secciones: (items, innerKey, innerPath) => validateSections(
      items, innerKey, innerPath, fichaSectionTitles, fichaFieldCounts, 'ficha',
    ),
    familiares: (items, innerKey, innerPath) => {
      if (!Array.isArray(items)) fail(innerKey, innerPath, 'array')
      const ids = new Set()
      items.map((item) => fields(item, innerKey, `${innerPath}[*]`, {
        id: nonEmptyString, nombre: string, edad: safeNonNegativeInteger,
        parentesco: string, grado: string,
        ocupacion: string, condicionLaboral: string, aporteEconomico: string,
        enfermedad: nullableString, tipoDiscapacidad: nullableString,
      })).forEach((family) => {
        if (ids.has(family.id)) fail(innerKey, `${innerPath}[*].id`, 'identificador único')
        ids.add(family.id)
        if (!/^\d+\.\d{2}$/.test(family.aporteEconomico)) {
          fail(innerKey, `${innerPath}[*].aporteEconomico`, 'monto local-v1')
        }
      })
    },
  })
}

const candidateData = {
  perfil: profileCandidate,
  historial: historialCandidate,
  formularioDatos: formularioCandidate,
}

function compatible(key, representation) {
  if (representation === 'local-v1') return true
  if (representation === 'candidate-v1') return key === 'perfil' || key === 'historial' || key === 'formularioDatos'
  return representation === 'opaque' && (key === 'historial' || key === 'fichaSocioeconomica')
}

function validateEnvelope(value, key) {
  return fields(value, key, key, {
    message: (item, innerKey, path) => {
      if (item !== null) string(item, innerKey, path)
    },
    codError: (item, innerKey, path) => {
      if (item !== null) fail(innerKey, path, 'null')
    },
    data: validateJson,
  })
}

export function validateMiInformacionWire(key, value, representation) {
  if (!miInformacionWireKeys.includes(key)) fail('wire', 'key', 'clave conocida')
  if (!['candidate-v1', 'local-v1', 'opaque'].includes(representation) || !compatible(key, representation)) {
    fail(key, 'representation', 'representación compatible')
  }

  const envelope = validateEnvelope(value, key)
  if (representation === 'opaque') return
  if (representation === 'candidate-v1') {
    candidateData[key](envelope.data, key, `${key}.data`)
    return
  }

  if (key === 'perfil') profileLocal(envelope.data, key, `${key}.data`)
  if (key === 'historial') localHistory(envelope.data, key, `${key}.data`)
  if (key === 'formularioDatos') formularioLocal(envelope.data, key, `${key}.data`)
  if (key === 'fichaSocioeconomica') localFicha(envelope.data, key, `${key}.data`)
}
