import { validateE2ContextRequest, validateE2Draft, validateE2Validation } from './prematricula-api.mjs'
export { validateE2ContextRequest }
export const E2_INTENTION_REVISION = 'E2-INTENT-1'
const object = (v, keys) => { if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).sort().join(',') !== [...keys].sort().join(',')) throw new TypeError('Campos de intención inválidos') }
const integer = (v, min = 0, max = Number.MAX_SAFE_INTEGER) => { if (!Number.isSafeInteger(v) || v < min || v > max) throw new TypeError('Contador de intención inválido') }
const text = v => { if (typeof v !== 'string' || !v.trim() || v.length > 2048) throw new TypeError('Texto de intención inválido') }
const uuid = v => { if (typeof v !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v)) throw new TypeError('ID de intención inválido') }
const hash = v => { if (typeof v !== 'string' || !/^[a-f0-9]{64}$/.test(v)) throw new TypeError('Revisión académica inválida') }
const actor = v => { if (!['SYN-SIS-A', 'SYN-SIS-B'].includes(v)) throw new TypeError('Perfil de intención inválido') }
const selectionKey = choices => JSON.stringify(choices.map(c => [c.courseId,c.sectionId]).sort((a,b)=>a[0].localeCompare(b[0])))
export function validateE2RegisterIntentionRequest(v) {
  object(v, ['identity','draftId','expectedDraftVersion','expectedIntentionVersion','expectedAcademicRevision'])
  validateE2ContextRequest({ identity: v.identity }); uuid(v.draftId); integer(v.expectedDraftVersion,1); hash(v.expectedAcademicRevision)
  if (v.expectedIntentionVersion !== null) integer(v.expectedIntentionVersion,1,100)
}
export function validateE2Intention(v) {
  object(v, ['revision','draftId','actorId','sourceId','schoolId','planId','academicPeriod','version','history'])
  if (v.revision !== E2_INTENTION_REVISION) throw new TypeError('Revisión de intención desconocida')
  integer(v.version,1,100)
  if (!Array.isArray(v.history) || v.history.length !== v.version) throw new TypeError('Historial de intención incompleto')
  let previousTime = -Infinity, previousDraftVersion = 0
  v.history.forEach((record,index) => {
    object(record, ['version','draftVersion','publicationId','publicationVersion','academicRevision','selection','registeredAt'])
    if (record.version !== index+1 || record.draftVersion <= previousDraftVersion || !record.selection?.length) throw new TypeError('Historial de intención inconsistente')
    // Reuse E2 scope, reference, selection and date validation, without another academic contract.
    validateE2Draft({ revision:'E2-LOCAL-1', id:v.draftId, version:record.draftVersion, actorId:v.actorId,
      sourceId:v.sourceId, schoolId:v.schoolId, planId:v.planId, academicPeriod:v.academicPeriod,
      publicationId:record.publicationId, publicationVersion:record.publicationVersion, academicRevision:record.academicRevision,
      selection:record.selection, createdAt:record.registeredAt, updatedAt:record.registeredAt })
    const time = Date.parse(record.registeredAt)
    if (time < previousTime) throw new TypeError('Fechas de intención inconsistentes')
    previousTime = time; previousDraftVersion = record.draftVersion
  })
}
export function validateE2IntentionContext(v) {
  object(v, ['revision','actorId','academicRevision','draftId','draftVersion','intention','validation'])
  if (v.revision !== E2_INTENTION_REVISION) throw new TypeError('Revisión de intención desconocida')
  actor(v.actorId); hash(v.academicRevision)
  if (v.draftId === null) { if (v.draftVersion !== null || v.intention !== null) throw new TypeError('Intención sin borrador') }
  else { uuid(v.draftId); integer(v.draftVersion,1) }
  if ((v.intention === null) !== (v.validation === null)) throw new TypeError('Validación de intención incompleta')
  if (v.intention) {
    validateE2Intention(v.intention); validateE2Validation(v.validation)
    const current = v.intention.history.at(-1)
    if (v.intention.actorId !== v.actorId || v.intention.draftId !== v.draftId || current.draftVersion > v.draftVersion
      || v.validation.actorId !== v.actorId || v.validation.academicRevision !== v.academicRevision
      || v.validation.publicationId !== current.publicationId || v.validation.publicationVersion !== current.publicationVersion
      || selectionKey(v.validation.selection) !== selectionKey(current.selection)) throw new TypeError('Intención de otro contexto')
    if (current.academicRevision !== v.academicRevision && !v.validation.issues.some(i=>i.kind==='insufficient' && i.code==='ACADEMIC_CONTEXT_CHANGED')) throw new TypeError('Intención desactualizada sin aviso')
  }
}
export function validateE2DemandRequest(v) { object(v,['publicationId','publicationVersion']); uuid(v.publicationId); integer(v.publicationVersion,1) }
export function validateE2Demand(v) {
  object(v,['revision','schoolId','academicPeriod','publicationId','publicationVersion','registeredStudents','countedStudents','excludedStudents','courses'])
  if (v.revision !== 'E2-DEMAND-1' || v.schoolId !== 'SISTEMAS' || v.academicPeriod !== '2027-I') throw new TypeError('Ámbito de demanda inválido')
  validateE2DemandRequest({publicationId:v.publicationId,publicationVersion:v.publicationVersion})
  for (const key of ['registeredStudents','countedStudents','excludedStudents']) integer(v[key],0,2)
  if (v.countedStudents+v.excludedStudents !== v.registeredStudents || !Array.isArray(v.courses) || !v.courses.length || v.courses.length>256) throw new TypeError('Totales de demanda inconsistentes')
  const courses=new Set(), sections=new Set()
  v.courses.forEach(course=>{
    object(course,['courseId','name','students','sections']); text(course.courseId); text(course.name); integer(course.students,0,v.countedStudents)
    if (courses.has(course.courseId) || !Array.isArray(course.sections) || !course.sections.length || course.sections.length>128) throw new TypeError('Asignatura de demanda inválida')
    courses.add(course.courseId)
    let total=0
    course.sections.forEach(section=>{
      object(section,['sectionId','capacity','students']); text(section.sectionId); integer(section.capacity,1); integer(section.students,0,course.students)
      if (sections.has(section.sectionId)) throw new TypeError('Sección de demanda duplicada')
      sections.add(section.sectionId); total+=section.students
    })
    if (total!==course.students) throw new TypeError('Conteo de curso/secciones inconsistente')
  })
  if (v.courses.reduce((sum,course)=>sum+course.students,0)<v.countedStudents) throw new TypeError('Estudiantes sin selección registrada')
}
