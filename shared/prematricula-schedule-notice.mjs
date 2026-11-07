// E2-NOTICE-1 validators (F-S5.1). Contract: planning-readjustment.md §4.3. The notice is computed on read and never stored;
// it has no UI in this program.
import { validateE2ContextRequest } from './prematricula-api.mjs'

export const E2_NOTICE_REVISION = 'E2-NOTICE-1'
const changes = ['section-removed', 'schedule-changed', 'course-removed']
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/

const object = (value, keys, path) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) throw new TypeError(`${path}: campos inválidos`)
}
const text = (value, path) => { if (typeof value !== 'string' || !value.trim() || value.length > 2048) throw new TypeError(`${path}: texto inválido`) }
function reference(value, path) {
  if (value === null) return
  object(value, ['publicationId', 'publicationVersion'], path)
  if (typeof value.publicationId !== 'string' || !uuidPattern.test(value.publicationId) || !Number.isSafeInteger(value.publicationVersion) || value.publicationVersion < 1) throw new TypeError(`${path}: referencia inválida`)
}

// Request: `{ identity: E2Identity }`, the same identity shape and access checks as the intention endpoints.
export function validateE2ScheduleNoticeRequest(value) { validateE2ContextRequest(value) }

export function validateE2ScheduleChangeNotice(value) {
  object(value, ['revision', 'actorId', 'registered', 'current', 'changed', 'affected', 'newSectionCourseIds'], 'scheduleNotice')
  if (value.revision !== E2_NOTICE_REVISION) throw new TypeError('Revisión de aviso incompatible')
  if (!['SYN-SIS-A', 'SYN-SIS-B'].includes(value.actorId)) throw new TypeError('Perfil de aviso inválido')
  reference(value.registered, 'registered'); reference(value.current, 'current')
  if (typeof value.changed !== 'boolean' || !Array.isArray(value.affected) || value.affected.length > 128 || !Array.isArray(value.newSectionCourseIds) || value.newSectionCourseIds.length > 128) throw new TypeError('Aviso inválido')
  const seen = new Set()
  value.affected.forEach((item) => {
    object(item, ['courseId', 'sectionId', 'change'], 'affected')
    text(item.courseId, 'courseId'); text(item.sectionId, 'sectionId')
    if (!changes.includes(item.change) || seen.has(item.sectionId)) throw new TypeError('Cambio de sección inválido')
    seen.add(item.sectionId)
  })
  value.newSectionCourseIds.forEach((id) => text(id, 'newSectionCourseIds'))
  if (new Set(value.newSectionCourseIds).size !== value.newSectionCourseIds.length) throw new TypeError('Cursos repetidos')
  if (value.registered === null && value.changed) throw new TypeError('Cambio sin intención registrada')
  if (value.registered && value.current) {
    const same = value.registered.publicationId === value.current.publicationId && value.registered.publicationVersion === value.current.publicationVersion
    if (value.changed === same) throw new TypeError('Indicador de cambio inconsistente con las publicaciones')
  }
  if (!value.changed && (value.affected.length || value.newSectionCourseIds.length)) throw new TypeError('Cambios reportados sin cambio de publicación')
}
