// View models for the planning decision surfaces: coverage state, decision queue, regulatory gaps, teacher load
// limits and publication blockers. Pure functions over the contract fields of `AcademicProposal` and
// `AcademicTeacherResource`; the regulation itself stays in shared/academic-normative-profile.mjs (never re-encoded here).
// Plan: docs/reverse-engineering/plans/programacion-academica-normative-engine.md (T5).
import {
  LECTIVE_HOUR_MINUTES, TEACHER_REGIMES, resolveNormativeProfile, teacherLoadLimits,
} from '../../../shared/academic-normative-profile.mjs'
import type {
  LectiveHourMinutes, LoadAuthorization, LoadAuthorizationBlocker, LoadAuthorizationKind, NormativeProfile, TeacherLoadCondition, TeacherRegime,
} from '../../../shared/academic-normative-profile.mjs'
import type { PlanningPolicy } from '../../../shared/academic-planning-policy.mjs'
import { validateTeacherLoadFields } from '../../../shared/programacion-academica-api.mjs'
import type { AcademicAdvisorPatch, AcademicPlanningResources, AcademicProposal, AcademicTeacherResource } from '../../../shared/programacion-academica-api.mjs'

type Policy = Pick<PlanningPolicy, 'allowAfternoon' | 'allowSaturday'> | null | undefined
type Decision = NonNullable<AcademicProposal['decisions']>[number]

export { LECTIVE_HOUR_MINUTES }

function profileFor(period: string): NormativeProfile | null {
  try { return resolveNormativeProfile({ facultyId: 'FISI', period }) } catch { return null }
}
const sourceList = (profile: NormativeProfile | null, ids: string[] = []) =>
  ids.map((id) => ({ id, title: profile?.sources.find((source) => source.id === id)?.title ?? id }))

// ───────────── A. Coverage state ─────────────

export type CoverageKind = NonNullable<AcademicProposal['coverageProof']>
export type CoverageView = { kind: CoverageKind; label: string; detail: string }

const COVERAGE_TEXT: Record<CoverageKind, { label: string; detail: string }> = {
  complete: { label: 'Cobertura completa', detail: 'Todas las secciones quedaron programadas dentro de los recursos y topes autorizados.' },
  'shortfall-proven': { label: 'Faltante comprobado',
    detail: 'Con estos recursos ninguna búsqueda programará más secciones. Completar el horario requiere decisiones sobre los recursos o el horario.' },
  inconclusive: { label: 'Búsqueda inconclusa',
    detail: 'Podrían caber más secciones: la búsqueda se detuvo antes de decidirlo. No prueba que falten recursos.' },
}

// Proposals stored earlier or produced by the fallback generator carry no proof: null keeps their rendering unchanged.
export function describeCoverage(proposal: Pick<AcademicProposal, 'coverageProof'> & Partial<Pick<AcademicProposal, 'stats'>>): CoverageView | null {
  const kind = proposal.coverageProof
  if (kind === 'inconclusive' && proposal.stats?.limitReason === 'running') return { kind, label: 'Búsqueda en curso', detail: 'El motor sigue buscando mejoras. Este horario es provisional; no prueba que falten recursos.' }
  if (kind === 'inconclusive' && proposal.stats?.limitReason === 'cancelled') return { kind, label: 'Búsqueda cancelada', detail: 'Se conserva el mejor horario encontrado; no se ha demostrado que falten recursos.' }
  return kind ? { kind, ...COVERAGE_TEXT[kind] } : null
}

export type CapacityView = { coverable: number; required: number; proven: boolean; shortfallCourses: number; text: string }

// `courses` only lists courses with a shortfall: the totals are the source for "covered out of total".
export function describeCapacity(proposal: Pick<AcademicProposal, 'capacityCertificate'>): CapacityView | null {
  const certificate = proposal.capacityCertificate
  if (!certificate) return null
  const shortfallCourses = certificate.courses.filter((course) => course.coverableSections < course.requiredSections).length
  const text = `La carga docente autorizada cubre ${certificate.coverableSectionsTotal} de ${certificate.requiredSectionsTotal} secciones${certificate.proven ? '' : ' (no probado)'}.`
  return { coverable: certificate.coverableSectionsTotal, required: certificate.requiredSectionsTotal, proven: certificate.proven, shortfallCourses, text }
}

// ───────────── B. Decision queue ─────────────

export type DecisionGroupId = 'load-adjustment' | 'load-exception' | 'additional-teacher' | 'planning-window' | 'delivery-mode-split'
export type DecisionAction =
  | { kind: 'record-authorization'; teacherId: string }
  | { kind: 'add-teacher'; courseIds: string[] }
  | { kind: 'apply-patches'; patches: AcademicAdvisorPatch[] }
export type DecisionItem = {
  id: string
  title: string
  kindLabel: string
  effect: string
  necessity: string
  // Course names when a decision spans several courses: the title then reads "N cursos" and the names go in a list.
  courseNames: string[]
  requires: string[]
  sources: Array<{ id: string; title: string }>
  provenance: string | null
  sectionsUnlocked: number
  additionalMinutes: number
  action: DecisionAction
  actionLabel: string
  applied: boolean
}
export type DecisionGroup = { id: DecisionGroupId; label: string; description: string; basis: Decision['basis']; sectionsUnlocked: number; items: DecisionItem[] }
export type DecisionQueue = { groups: DecisionGroup[]; summary: string | null; windowSummary: string | null; decisionCount: number }
export type DecisionContext = {
  period: string
  teacherNames?: Record<string, string>
  courseNames?: Record<string, string>
  resources?: AcademicPlanningResources
  policy?: Policy
  deliveryModes?: Record<string, 'continuous' | 'split'>
}

const GROUP_META: Record<DecisionGroupId, { label: string; description: string }> = {
  'load-adjustment': { label: 'Ajustes de carga configurada', description: 'El tope configurado es menor que el ya autorizado. Revisa y ajusta la carga explícitamente; no requiere un trámite formal nuevo.' },
  'load-exception': { label: 'Excepciones de carga docente',
    description: 'Ampliar la carga de un docente requiere una autorización formal fuera de este sistema; aquí solo se registra que existe.' },
  'additional-teacher': { label: 'Docentes adicionales',
    description: 'Cursos cuya carga docente autorizada no alcanza aun usando las excepciones de carga.' },
  'planning-window': { label: 'Ampliación de franjas',
    description: 'Secciones que no tienen franja de horario en la política actual. Alternativa a partir los cursos.' },
  'delivery-mode-split': { label: 'Dictado partido',
    description: 'Cursos que ganarían una franja si se dictan en bloques separados. Alternativa a ampliar franjas.' },
}
const WINDOW_PROVENANCE = 'Criterio de la facultad sin norma localizada (testimonio); no es una regla del reglamento.'
const NECESSITY = 'Condición necesaria; no garantiza que las secciones queden colocadas: el horario sigue sujeto a disponibilidad y cruces.'
const sections = (count: number) => `${count} ${count === 1 ? 'sección' : 'secciones'}`

function groupOf(decision: Decision): DecisionGroupId {
  return decision.kind === 'teacher-load-exception' ? decision.exceptionKind === 'configuration-adjustment' ? 'load-adjustment' : 'load-exception' : decision.kind
}

function windowTitle(change: Decision['policyChange']) {
  if (change?.allowAfternoon && change.allowSaturday) return 'Habilitar tardes y sábado'
  return change?.allowSaturday ? 'Habilitar sábado' : 'Habilitar tardes (lunes a viernes)'
}

export function buildDecisionQueue(decisions: AcademicProposal['decisions'] | undefined, context: DecisionContext): DecisionQueue | null {
  if (!decisions?.length) return null
  const profile = profileFor(context.period)
  const teacherName = (id: string) => context.teacherNames?.[id] ?? id
  const courseName = (id: string) => context.courseNames?.[id] ?? id
  const teachers = context.resources?.teachers ?? []

  const toItem = (decision: Decision): DecisionItem => {
    const base = { id: decision.id, necessity: NECESSITY, sectionsUnlocked: decision.sectionsUnlocked, additionalMinutes: decision.additionalMinutes,
      requires: [...(decision.requires ?? [])], sources: sourceList(profile, decision.sourceIds), provenance: null as string | null,
      courseNames: decision.courseIds.length > 1 ? decision.courseIds.map(courseName) : [] }
    const coursesTitle = decision.courseIds.length > 1 ? `${decision.courseIds.length} cursos` : decision.courseIds.map(courseName).join('')
    if (decision.kind === 'teacher-load-exception') {
      const teacherId = decision.teacherId ?? ''
      if (decision.exceptionKind === 'configuration-adjustment') return { ...base, title: teacherName(teacherId), applied: false,
        action: { kind: 'record-authorization', teacherId }, actionLabel: 'Ajustar carga configurada', kindLabel: 'Ajuste dentro del tope autorizado',
        effect: `+${decision.additionalMinutes} min semanales · libera ${sections(decision.sectionsUnlocked)}. No requiere una nueva autorización formal.`,
        provenance: 'Ajusta explícitamente la carga máxima del docente y regenera la propuesta.' }
      const recorded = teachers.find((teacher) => teacher.id === teacherId)?.loadAuthorizations?.some((item) => item.kind === decision.exceptionKind) ?? false
      return { ...base, title: teacherName(teacherId), applied: recorded, action: { kind: 'record-authorization', teacherId }, actionLabel: 'Registrar autorización',
        kindLabel: decision.exceptionKind === 'vrap-authorization' ? 'Autorización del VRAP' : 'Declaración jurada del docente',
        effect: `+${decision.additionalMinutes} min semanales · libera ${sections(decision.sectionsUnlocked)}.` }
    }
    if (decision.kind === 'additional-teacher') {
      return { ...base, title: coursesTitle || 'Curso sin nombre', applied: false,
        action: { kind: 'add-teacher', courseIds: [...decision.courseIds] }, actionLabel: 'Ver docentes del curso', kindLabel: 'Docente adicional',
        effect: `Faltan ${decision.additionalMinutes} min semanales de docencia · ${sections(decision.sectionsUnlocked)}.` }
    }
    if (decision.kind === 'planning-window') {
      const change = decision.policyChange ?? {}
      const applied = (!change.allowAfternoon || Boolean(context.policy?.allowAfternoon)) && (!change.allowSaturday || Boolean(context.policy?.allowSaturday))
      return { ...base, title: windowTitle(change), applied, provenance: WINDOW_PROVENANCE, kindLabel: 'Franja del horario',
        action: { kind: 'apply-patches', patches: [{ kind: 'enable_planning_window', ...(change.allowAfternoon ? { allowAfternoon: true as const } : {}),
          ...(change.allowSaturday ? { allowSaturday: true as const } : {}) }] }, actionLabel: 'Habilitar y regenerar',
        effect: `${sections(decision.sectionsUnlocked)} ganarían una franja.` }
    }
    const applied = decision.courseIds.length > 0 && decision.courseIds.every((courseId) => context.deliveryModes?.[courseId] === 'split')
    return { ...base, title: coursesTitle, applied, kindLabel: 'Modalidad de dictado',
      action: { kind: 'apply-patches', patches: [{ kind: 'change_delivery_mode', courseIds: [...decision.courseIds], deliveryMode: 'split' }] },
      actionLabel: 'Partir y regenerar', effect: `${sections(decision.sectionsUnlocked)} ganarían una franja si se dictan partidos.` }
  }

  const byGroup = new Map<DecisionGroupId, DecisionItem[]>()
  const basisOf = new Map<DecisionGroupId, Decision['basis']>()
  for (const decision of decisions) {
    const group = groupOf(decision)
    basisOf.set(group, decision.basis)
    byGroup.set(group, [...(byGroup.get(group) ?? []), toItem(decision)])
  }
  const groups: DecisionGroup[] = [...byGroup.entries()].map(([id, items]) => {
    const sorted = [...items].sort((left, right) => right.sectionsUnlocked - left.sectionsUnlocked || left.id.localeCompare(right.id))
    const basis = basisOf.get(id)!
    // Capacity decisions form one minimal set and add up; window alternatives overlap and take the maximum.
    const unlocked = basis === 'capacity-relaxation' ? sorted.reduce((total, item) => total + item.sectionsUnlocked, 0)
      : Math.max(...sorted.map((item) => item.sectionsUnlocked))
    return { id, ...GROUP_META[id], basis, sectionsUnlocked: unlocked, items: sorted }
  }).sort((left, right) => right.sectionsUnlocked - left.sectionsUnlocked || left.id.localeCompare(right.id))

  const capacity = decisions.filter((decision) => decision.basis === 'capacity-relaxation')
  const windows = decisions.filter((decision) => decision.basis === 'window-precheck')
  const capacitySections = capacity.reduce((total, decision) => total + decision.sectionsUnlocked, 0)
  const summary = capacity.length ? `${capacity.length} ${capacity.length === 1 ? 'decisión cubre' : 'decisiones cubren'} ${sections(capacitySections)}` : null
  const windowSummary = windows.length
    ? `Ampliar franjas o partir cursos daría franja a hasta ${sections(Math.max(...windows.map((decision) => decision.sectionsUnlocked)))}; son alternativas, no se suman.` : null
  return { groups, summary, windowSummary, decisionCount: decisions.length }
}

// ───────────── C. Regulatory gaps, provenance, prelation ─────────────

export type GapClass = 'regulation' | 'inference' | 'unverified' | 'data'
export type NormativeGapView = { code: string; message: string; teacherCount: number; classification: GapClass }
export type NormativeSummaryView = { profileRevision: string | null; lectiveHourMinutes: number | null; lectiveHourNote: string | null; gaps: NormativeGapView[] }

// The gap text is the evidence: its own wording says whether it is an inference, an unverified parameter or a regulatory limit.
function classifyGap(message: string): GapClass {
  if (/inferred|inferencia|interpretación/i.test(message)) return 'inference'
  if (/no está verificada|sin verificar|unverified/i.test(message)) return 'unverified'
  // Missing data first: several of these texts also cite an article while saying that nothing was recorded.
  if (/no se registr|no existe fuente/i.test(message)) return 'data'
  if (/reglamento|art\.|disposición|no regula|no establece|no existe un perfil/i.test(message)) return 'regulation'
  return 'data'
}

export function describeNormativeSummary(proposal: Pick<AcademicProposal, 'normative'>, period: string): NormativeSummaryView | null {
  const normative = proposal.normative
  if (!normative) return null
  const profile = profileFor(period)
  const unverified = profile?.loadRules.lectiveHourMinutes.status === 'unverified'
  return {
    profileRevision: normative.profileRevision,
    lectiveHourMinutes: normative.lectiveHourMinutes,
    lectiveHourNote: unverified ? 'La duración de la hora lectiva de FISI no está verificada: es un parámetro que el operador debe indicar.' : null,
    gaps: normative.gaps.map((gap) => ({ code: gap.code, message: gap.message.replaceAll('`', ''), teacherCount: gap.teacherIds?.length ?? 0, classification: classifyGap(gap.message) })),
  }
}

export const GAP_CLASS_LABEL: Record<GapClass, string> = { regulation: 'Límite del reglamento', inference: 'Inferencia', unverified: 'Sin verificar', data: 'Dato no registrado' }

export type PrelationLevelView = { id: 'contract-sections' | 'interfaculty-sections' | 'category-rank'; label: string; value: number; proven: boolean; mark: 'probado' | 'no probado' }
const PRELATION_LABEL: Record<PrelationLevelView['id'], string> = {
  'contract-sections': 'Secciones con docentes por contrato',
  'interfaculty-sections': 'Secciones con docentes interfacultativos',
  'category-rank': 'Puesto de categoría y régimen',
}
export function describePrelation(proposal: Pick<AcademicProposal, 'prelation'>): PrelationLevelView[] | null {
  const levels = proposal.prelation?.levels
  return levels ? levels.map((level) => ({ id: level.id, label: PRELATION_LABEL[level.id], value: level.value, proven: level.proven, mark: level.proven ? 'probado' : 'no probado' })) : null
}

// ───────────── D. Teacher regulatory data ─────────────

type TeacherLoadOk = {
  status: 'ok'
  minimumMinutes: number | null
  ordinaryMaxMinutes: number | null
  authorizedMaxMinutes: number | null
  nextException: { kind: LoadAuthorizationKind; maxMinutes: number | null; requires: string[] } | null
  gaps: Array<{ code: string; message: string }>
  sources: Array<{ id: string; title: string }>
  articles: string[]
}
export type TeacherLoadView = TeacherLoadOk | { status: 'unavailable'; reason: string }

export function teacherLoadView(teacher: Partial<AcademicTeacherResource>, options: { period: string; lectiveHourMinutes: LectiveHourMinutes | undefined }): TeacherLoadView {
  if (options.lectiveHourMinutes === undefined) {
    return { status: 'unavailable', reason: 'Indica la duración de la hora lectiva para calcular los topes de cada docente.' }
  }
  let profile: NormativeProfile
  try { profile = resolveNormativeProfile({ facultyId: 'FISI', period: options.period }) } catch (error) {
    return { status: 'unavailable', reason: error instanceof Error ? error.message : 'No hay perfil normativo para este periodo.' }
  }
  // A key present with value undefined means "not set" for display; resources never carry such keys (see `without`).
  const present = Object.fromEntries(Object.entries(teacher).filter(([, value]) => value !== undefined)) as Partial<AcademicTeacherResource>
  const invalid = validateTeacherLoadInput(present)
  if (invalid.length) return { status: 'unavailable', reason: `Corrige los datos reglamentarios: ${invalid[0]}` }
  const limits = teacherLoadLimits(profile, { regime: present.regime, appointment: present.appointment, category: present.category,
    weeklyServiceHours: present.weeklyServiceHours, loadConditions: present.loadConditions, loadAuthorizations: present.loadAuthorizations },
  { lectiveHourMinutes: options.lectiveHourMinutes })
  return { status: 'ok', minimumMinutes: limits.minimumMinutes, ordinaryMaxMinutes: limits.ordinaryMaxMinutes, authorizedMaxMinutes: limits.authorizedMaxMinutes,
    nextException: limits.nextException ? { kind: limits.nextException.kind, maxMinutes: limits.nextException.maxMinutes, requires: [...limits.nextException.requires] } : null,
    gaps: limits.gaps.map((gap) => ({ code: gap.code, message: gap.message.replaceAll('`', '') })),
    sources: sourceList(profile, limits.sourceIds), articles: [...limits.articles] }
}

const TEACHER_LOAD_LABELS = {
  reference: 'Indica la referencia del documento que acredita la autorización.',
  hours: 'La autorización del VRAP requiere las horas lectivas máximas (entero de 1 a 168).',
  declarationHours: 'La declaración jurada no indica horas máximas: el tope lo fija el reglamento.',
  serviceHours: 'Las horas semanales de servicio deben ser un entero entre 1 y 39.',
  tooMany: 'Se admiten hasta 16 autorizaciones por docente.',
} as const

// Mirrors validateTeacherLoadFields (shared/programacion-academica-api.mjs): the shared validator remains the authority
// and decides acceptance; the checks below only produce messages a person can act on.
export function validateTeacherLoadInput(teacher: Partial<AcademicTeacherResource>): string[] {
  const messages: string[] = []
  if (Object.hasOwn(teacher, 'regime') && !(TEACHER_REGIMES as readonly unknown[]).includes(teacher.regime)) messages.push('Selecciona un régimen de dedicación válido.')
  if (Object.hasOwn(teacher, 'appointment') && !['faculty-ordinary', 'interfaculty-ordinary', 'contract'].includes(teacher.appointment as string)) messages.push('Selecciona un tipo de nombramiento válido.')
  if (Object.hasOwn(teacher, 'weeklyServiceHours') && !(Number.isSafeInteger(teacher.weeklyServiceHours) && teacher.weeklyServiceHours! >= 1 && teacher.weeklyServiceHours! <= 39)) messages.push(TEACHER_LOAD_LABELS.serviceHours)
  if (Object.hasOwn(teacher, 'loadConditions') && (!Array.isArray(teacher.loadConditions) || new Set(teacher.loadConditions).size !== teacher.loadConditions.length
    || teacher.loadConditions.some((item) => !['renacyt-researcher', 'postgraduate-study', 'on-leave'].includes(item)))) messages.push('Las condiciones de carga deben ser válidas y no repetirse.')
  if (Object.hasOwn(teacher, 'loadAuthorizations')) {
    const list = Array.isArray(teacher.loadAuthorizations) ? teacher.loadAuthorizations : []
    if (!Array.isArray(teacher.loadAuthorizations) || list.length > 16) messages.push(TEACHER_LOAD_LABELS.tooMany)
    for (const item of list) {
      const message = authorizationMessage(item)
      if (message) messages.push(message)
    }
  }
  try { validateTeacherLoadFields(teacher) } catch (error) {
    if (!messages.length) messages.push(error instanceof Error ? error.message : 'Los datos reglamentarios del docente no son válidos.')
  }
  return messages
}

function authorizationMessage(item: Partial<LoadAuthorization> | null | undefined): string | null {
  if (!item || !['voluntary-declaration', 'vrap-authorization'].includes(item.kind as string)) return 'Selecciona el tipo de autorización.'
  if (typeof item.reference !== 'string' || !item.reference.trim()) return TEACHER_LOAD_LABELS.reference
  if (item.kind === 'vrap-authorization') return Number.isSafeInteger(item.maxLectiveHours) && item.maxLectiveHours! >= 1 && item.maxLectiveHours! <= 168 ? null : TEACHER_LOAD_LABELS.hours
  return Object.hasOwn(item, 'maxLectiveHours') ? TEACHER_LOAD_LABELS.declarationHours : null
}

export type TeacherEdit = { ok: true; teacher: AcademicTeacherResource } | { ok: false; message: string }

function without<T extends object, K extends string>(value: T, ...keys: K[]): Omit<T, K> {
  const copy = { ...value } as Record<string, unknown>
  for (const key of keys) delete copy[key]
  return copy as Omit<T, K>
}

// Optional keys are removed instead of set to undefined: the contract validators treat a present key as a value.
export function setTeacherRegime(teacher: AcademicTeacherResource, regime: TeacherRegime | undefined): AcademicTeacherResource {
  const next = regime === undefined ? without(teacher, 'regime') : { ...teacher, regime }
  return (regime === 'tiempo-parcial' ? next : without(next, 'weeklyServiceHours')) as AcademicTeacherResource
}

export function setTeacherAppointment(teacher: AcademicTeacherResource, appointment: AcademicTeacherResource['appointment']): AcademicTeacherResource {
  return (appointment === undefined ? without(teacher, 'appointment') : { ...teacher, appointment }) as AcademicTeacherResource
}

export function setWeeklyServiceHours(teacher: AcademicTeacherResource, text: string): TeacherEdit {
  if (text.trim() === '') return { ok: true, teacher: without(teacher, 'weeklyServiceHours') as AcademicTeacherResource }
  const value = Number(text)
  if (!Number.isSafeInteger(value) || value < 1 || value > 39) return { ok: false, message: TEACHER_LOAD_LABELS.serviceHours }
  return { ok: true, teacher: { ...teacher, weeklyServiceHours: value } }
}

export function toggleLoadCondition(teacher: AcademicTeacherResource, condition: TeacherLoadCondition, checked: boolean): AcademicTeacherResource {
  const current = teacher.loadConditions ?? []
  const next = checked ? [...new Set([...current, condition])] : current.filter((item) => item !== condition)
  return (next.length ? { ...teacher, loadConditions: next } : without(teacher, 'loadConditions')) as AcademicTeacherResource
}

export function addLoadAuthorization(teacher: AcademicTeacherResource, authorization: LoadAuthorization): TeacherEdit {
  const message = authorizationMessage(authorization)
  if (message) return { ok: false, message }
  const entry: LoadAuthorization = { kind: authorization.kind, reference: authorization.reference.trim(),
    ...(authorization.kind === 'vrap-authorization' ? { maxLectiveHours: authorization.maxLectiveHours } : {}) }
  const next = { ...teacher, loadAuthorizations: [...(teacher.loadAuthorizations ?? []), entry] }
  const invalid = validateTeacherLoadInput(next)
  return invalid.length ? { ok: false, message: invalid[0] } : { ok: true, teacher: next }
}

export function removeLoadAuthorization(teacher: AcademicTeacherResource, index: number): AcademicTeacherResource {
  const next = (teacher.loadAuthorizations ?? []).filter((_, position) => position !== index)
  return (next.length ? { ...teacher, loadAuthorizations: next } : without(teacher, 'loadAuthorizations')) as AcademicTeacherResource
}

// ───────────── E. Publication blockers ─────────────

export type BlockerView = { teacherId: string; teacherName: string; load: string; requirement: string; sources: Array<{ id: string; title: string }> }

export const PUBLICATION_BLOCK_EXPLANATION = 'No se puede publicar mientras existan bloqueos de carga docente. Registra la autorización formal en el docente y regenera la propuesta, o corrige las asignaciones; aprobar no resuelve un bloqueo.'

export function describeBlockers(blockers: readonly LoadAuthorizationBlocker[], teacherNames: Record<string, string>, period: string): BlockerView[] {
  const profile = profileFor(period)
  return blockers.map((blocker) => ({
    teacherId: blocker.teacherId,
    teacherName: teacherNames[blocker.teacherId] ?? blocker.teacherId,
    load: `${blocker.assignedMinutes} min asignados · ${blocker.authorizedMaxMinutes} min autorizados`,
    requirement: blocker.reason === 'on-leave' ? 'Docente con licencia: no disponible para carga lectiva. Reasigna sus secciones.'
      : blocker.requiredAuthorization === 'vrap-authorization' ? 'Requiere la autorización del VRAP registrada para superar este tope.'
        : blocker.requiredAuthorization === 'voluntary-declaration' ? 'Requiere la declaración jurada del docente registrada para superar este tope.'
          : 'Reduce la carga asignada: no existe una autorización regulada que la amplíe.',
    sources: sourceList(profile, blocker.sourceIds),
  }))
}

export function parseLoadAuthorizationBlockers(value: unknown): LoadAuthorizationBlocker[] | null {
  if (!Array.isArray(value) || value.length > 200) return null
  const rows: LoadAuthorizationBlocker[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') return null
    const blocker = item as Record<string, unknown>
    const keys = Object.keys(blocker)
    if (keys.length !== 6 || !['teacherId', 'assignedMinutes', 'authorizedMaxMinutes', 'reason', 'requiredAuthorization', 'sourceIds'].every((key) => keys.includes(key))) return null
    if (typeof blocker.teacherId !== 'string' || !Number.isSafeInteger(blocker.assignedMinutes) || !Number.isSafeInteger(blocker.authorizedMaxMinutes)
      || !['over-authorized-load', 'on-leave'].includes(blocker.reason as string)
      || !(blocker.requiredAuthorization === null || ['voluntary-declaration', 'vrap-authorization'].includes(blocker.requiredAuthorization as string))
      || !Array.isArray(blocker.sourceIds) || blocker.sourceIds.some((id) => typeof id !== 'string')) return null
    rows.push(blocker as unknown as LoadAuthorizationBlocker)
  }
  return rows
}

