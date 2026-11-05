import { validateDashboardIdentity } from './local-profile-dashboard.mjs'
import { validateAcademicPublication, validateAcademicPublicationList } from './programacion-academica-api.mjs'
export const E2_API = '/api/local/prematricula/v1'
export const E2_REVISION = 'E2-LOCAL-1'
const obj = (v, keys) => { if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).sort().join(',') !== [...keys].sort().join(',')) throw new TypeError('Campos E2 inválidos') }
const text = (v) => { if (typeof v !== 'string' || !v.trim() || v.length > 2048) throw new TypeError('Texto E2 inválido') }
const num = (v, min = 0) => { if (!Number.isSafeInteger(v) || v < min) throw new TypeError('Número E2 inválido') }
const uuid = (v) => { if (typeof v !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v)) throw new TypeError('ID E2 inválido') }
const hash = (v) => { if (typeof v !== 'string' || !/^[a-f0-9]{64}$/.test(v)) throw new TypeError('Revisión E2 inválida') }
const actor = (v) => { if (!['SYN-SIS-A', 'SYN-SIS-B'].includes(v)) throw new TypeError('Perfil E2 no disponible') }
const array = (v, max = 256) => { if (!Array.isArray(v) || v.length > max) throw new TypeError('Lista E2 inválida') }
function identity(v) { validateDashboardIdentity(v); actor(v.actorId) }
function choices(v) { array(v, 128); const seen = new Set(); v.forEach(c => { obj(c, ['courseId', 'sectionId']); text(c.courseId); text(c.sectionId); if (seen.has(c.courseId)) throw new TypeError('Solo una sección por asignatura'); seen.add(c.courseId) }) }
function scope(v) { actor(v.actorId); if (v.sourceId !== 'regular-SISTEMAS-v1' || v.schoolId !== 'SISTEMAS' || v.planId !== 'SYN-SIS-PLAN' || v.academicPeriod !== '2027-I') throw new TypeError('Ámbito E2 inválido'); hash(v.academicRevision) }
function reference(v) { uuid(v.publicationId); num(v.publicationVersion, 1) }
function issues(v) { array(v, 1024); v.forEach(i => { obj(i, ['kind','code','message','courseIds','sectionIds']); if (!['unmet','insufficient','incomplete'].includes(i.kind)) throw new TypeError('Diagnóstico E2 inválido'); text(i.code); text(i.message); for (const k of ['courseIds','sectionIds']) { array(i[k]); i[k].forEach(text) } }) }
export function validateE2ContextRequest(v) { obj(v, ['identity']); identity(v.identity) }
export function validateE2PublicationRequest(v) { obj(v, ['identity','publicationId']); identity(v.identity); uuid(v.publicationId) }
export function validateE2ValidateRequest(v) { obj(v, ['identity','publicationId','publicationVersion','selection']); identity(v.identity); reference(v); choices(v.selection) }
export function validateE2SaveRequest(v) {
  obj(v, ['identity','publicationId','publicationVersion','selection','id','expectedVersion','expectedAcademicRevision']); identity(v.identity); reference(v); choices(v.selection); hash(v.expectedAcademicRevision)
  if (v.id === null) { if (v.expectedVersion !== null) throw new TypeError('Borrador nuevo sin versión previa') } else { uuid(v.id); num(v.expectedVersion, 1) }
}
export function validateE2Draft(v) {
  obj(v, ['revision','id','version','actorId','sourceId','schoolId','planId','academicPeriod','publicationId','publicationVersion','academicRevision','selection','createdAt','updatedAt'])
  if (v.revision !== E2_REVISION) throw new TypeError('Contrato E2 desconocido')
  uuid(v.id); num(v.version, 1); scope(v); reference(v); choices(v.selection)
  for (const k of ['createdAt','updatedAt']) if (typeof v[k] !== 'string' || !Number.isFinite(Date.parse(v[k]))) throw new TypeError('Fecha E2 inválida')
  if (Date.parse(v.updatedAt) < Date.parse(v.createdAt)) throw new TypeError('Fechas E2 inconsistentes')
}
export function validateE2Validation(v) {
  obj(v, ['actorId','publicationId','publicationVersion','academicRevision','selection','credits','courseCount','status','issues']); actor(v.actorId); reference(v); hash(v.academicRevision); choices(v.selection); num(v.credits); num(v.courseCount); issues(v.issues)
  if (v.courseCount !== v.selection.length || !['valid','unmet','insufficient','incomplete'].includes(v.status)) throw new TypeError('Resultado E2 inválido')
  const expected = v.issues.some(i => i.kind === 'unmet') ? 'unmet' : v.issues.some(i => i.kind === 'insufficient') ? 'insufficient' : v.issues.length ? 'incomplete' : 'valid'
  if (v.status !== expected || (!v.selection.length && !v.issues.some(i => i.kind === 'incomplete'))) throw new TypeError('Diagnósticos E2 inconsistentes')
}
export function validateE2Context(v) {
  obj(v, ['revision','actorId','sourceId','schoolId','planId','academicPeriod','academicRevision','publications','draft','draftValidation'])
  if (v.revision !== E2_REVISION) throw new TypeError('Contrato E2 desconocido')
  scope(v); validateAcademicPublicationList(v.publications)
  if ((v.draft === null) !== (v.draftValidation === null)) throw new TypeError('Borrador E2 incompleto')
  if (v.draft !== null) { validateE2Draft(v.draft); validateE2Validation(v.draftValidation); correlate(v.draft, v.draftValidation); if (v.actorId !== v.draft.actorId || v.academicRevision !== v.draftValidation.academicRevision) throw new TypeError('Contexto E2 de otro perfil'); if (v.draft.academicRevision !== v.academicRevision && !v.draftValidation.issues.some(i => i.code === 'ACADEMIC_CONTEXT_CHANGED' && i.kind === 'insufficient')) throw new TypeError('Contexto académico desactualizado sin aviso') }
}
export function validateE2PublicationResponse(v) {
  obj(v, ['actorId','academicRevision','publication','eligibility']); actor(v.actorId); hash(v.academicRevision); validateAcademicPublication(v.publication); array(v.eligibility)
  const seen = new Set()
  v.eligibility.forEach(c => { obj(c, ['courseId','issues']); text(c.courseId); issues(c.issues); if (seen.has(c.courseId) || !v.publication.schedule.courses.some(p => p.courseId === c.courseId)) throw new TypeError('Asignatura E2 inválida'); seen.add(c.courseId) })
  if (seen.size !== v.publication.schedule.courses.length) throw new TypeError('Habilitación E2 incompleta')
}
function correlate(d, v) { const normalized = s => JSON.stringify(s.map(c => [c.courseId,c.sectionId]).sort((a,b)=>a[0].localeCompare(b[0]))); if (d.actorId !== v.actorId || d.publicationId !== v.publicationId || d.publicationVersion !== v.publicationVersion || normalized(d.selection) !== normalized(v.selection)) throw new TypeError('Resultado E2 no corresponde al borrador') }
export function validateE2SaveResponse(v) { obj(v, ['draft','validation']); validateE2Draft(v.draft); validateE2Validation(v.validation); correlate(v.draft,v.validation); if (v.draft.academicRevision !== v.validation.academicRevision) throw new TypeError('Revisión E2 inconsistente') }
