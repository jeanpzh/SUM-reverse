import { validateAcademicAdvisorResponse } from '../../../shared/programacion-academica-api.mjs'
import type {
  AcademicAdvisorBottleneck,
  AcademicAdvisorRecommendation,
  AcademicAdvisorResponse,
  AcademicCatalog,
  AcademicPlanningResources,
  AcademicProposal,
} from '../../../shared/programacion-academica-api.mjs'
import { queryNormative } from './normative.client.js'
import type { AcademicNormativeRequest, AcademicNormativeResponse } from '../../../shared/programacion-academica-api.mjs'
import { THESIS_COURSE_IDS } from '../../../shared/academic-planning-policy.mjs'
import { prepareGeneratorInput } from './generator-input.js'
import { createCoverageAuthority } from './session-coverage.js'
import type { GeneratorInput, GeneratorResult, RequiredSession } from './generator.types.js'
import type { AcademicAssignment, AcademicSchedule } from './schedule.types.js'

const DEFAULT_ENGINE_URL = 'http://127.0.0.1:3220'

export function engineUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env.SUM_PLANNING_ENGINE_URL?.trim()
  if (raw === '0' || raw === 'off' || raw === 'disabled') return null
  const candidate = raw || DEFAULT_ENGINE_URL
  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]', '::1'].includes(parsed.hostname)) return null
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

function isEligibleTeacher(teacher: GeneratorInput['teachers'][number], courseId: string, hasPolicy: boolean): boolean {
  if (!teacher.courseIds.includes(courseId)) return false
  if (!THESIS_COURSE_IDS.includes(courseId) || !hasPolicy) return true
  return teacher.facultyId === 'FISI' && teacher.qualificationSource === 'synthetic'
}

export async function trySolveWithPythonEngine(
  input: GeneratorInput,
  catalog: AcademicCatalog,
  resources: AcademicPlanningResources,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<GeneratorResult | null> {
  const baseUrl = engineUrl()
  if (!baseUrl) return null
  let prepared: ReturnType<typeof prepareGeneratorInput>
  try {
    prepared = prepareGeneratorInput(input)
  } catch {
    return null
  }
  const { schedule, requirements } = prepared
  const teacherNames = new Map(resources.teachers.map((t) => [t.id, t.name]))
  const roomNames = new Map(resources.rooms.map((r) => [r.id, r.name]))
  const courseNames = new Map(catalog.courses.map((c) => [c.courseId, c.name]))

  const payload = {
    courses: input.courses.map((c) => ({
      ...c,
      name: courseNames.get(c.courseId) ?? c.courseId,
    })),
    teachers: input.teachers.map((t) => ({
      ...t,
      name: teacherNames.get(t.id) ?? t.id,
    })),
    rooms: input.rooms.map((r) => ({
      ...r,
      name: roomNames.get(r.id) ?? r.id,
    })),
    sections: schedule.sections,
    requirements,
    windows: input.windows,
    startStepMinutes: input.startStepMinutes,
    allocationPolicy: input.allocationPolicy ?? 'preferences',
    ...(input.planningPolicy ? { planningPolicy: input.planningPolicy } : {}),
    maxTimeSeconds: 2.5,
  }

  try {
    const response = await fetchImpl(`${baseUrl}/v1/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4500),
    })
    if (!response.ok) return null
    const body = await response.json() as {
      status: 'complete' | 'impossible' | 'search-limit'
      assignments: AcademicAssignment[]
      exploredCandidates: number
      candidateVisits: number
      backtracks: number
      limitReason: 'explorations' | 'work' | 'time' | null
      diagnostics: Array<{ code: string; message: string; sessionIds: string[] }>
    } & Pick<AcademicProposal, 'coverageProof' | 'capacityCertificate' | 'decisions' | 'prelation'>
    const candidateSchedule: AcademicSchedule = {
      ...schedule,
      assignments: body.assignments,
    }
    const authority = createCoverageAuthority(input)
    const coverage = authority.check(candidateSchedule)
    // Reject if the external solver produced any hard constraint violation
    if (coverage.issues.some((issue) => issue.code !== 'MISSING_SESSION')) {
      return null
    }
    const status = coverage.complete ? 'complete' : body.status === 'search-limit' ? 'search-limit' : 'impossible'
    return {
      status,
      schedule: candidateSchedule,
      requirements,
      coverage,
      exploredCandidates: body.exploredCandidates,
      candidateVisits: body.candidateVisits,
      backtracks: body.backtracks,
      limitReason: body.limitReason,
      rejectionCounts: {},
      diagnostics: body.diagnostics,
      ...(body.coverageProof != null ? { coverageProof: body.coverageProof } : {}),
      ...(body.capacityCertificate != null ? { capacityCertificate: body.capacityCertificate } : {}),
      ...(body.decisions != null ? { decisions: body.decisions } : {}),
      ...(body.prelation != null ? { prelation: body.prelation } : {}),
    }
  } catch {
    return null
  }
}

class LocalPrivacyCodec {
  private readonly idToAlias = new Map<string, string>()
  private readonly aliasToName = new Map<string, string>()
  private readonly nameToAlias = new Map<string, string>()

  constructor(teachers: Array<{ id: string; name: string }>) {
    const sorted = [...teachers].sort((a, b) => a.id.localeCompare(b.id))
    sorted.forEach((teacher, index) => {
      const alias = `DOCENTE_${String(index + 1).padStart(3, '0')}`
      const clean = teacher.name.trim() || teacher.id
      this.idToAlias.set(teacher.id, alias)
      this.aliasToName.set(alias, clean)
      this.nameToAlias.set(clean, alias)
    })
  }

  sanitize(text: string): string {
    let output = text
    const names = [...this.nameToAlias.keys()].sort((a, b) => b.length - a.length)
    for (const name of names) {
      if (name.length >= 3) {
        output = output.replaceAll(name, this.nameToAlias.get(name)!)
      }
    }
    return output
  }

  rehydrate(text: string): string {
    let output = text
    const aliases = [...this.aliasToName.keys()].sort((a, b) => b.length - a.length)
    for (const alias of aliases) {
      output = output.replaceAll(alias, this.aliasToName.get(alias)!)
    }
    return output
  }
}

export function buildLocalDeterministicAdvisor(
  proposal: AcademicProposal,
  input: GeneratorInput,
  resources: AcademicPlanningResources,
  catalog: AcademicCatalog,
): {
  summary: string
  bottlenecks: AcademicAdvisorBottleneck[]
  recommendations: AcademicAdvisorRecommendation[]
  codec: LocalPrivacyCodec
} {
  const courseById = new Map(input.courses.map((c) => [c.courseId, c]))
  const catalogCourseById = new Map(catalog.courses.map((c) => [c.courseId, c]))
  const teacherById = new Map(input.teachers.map((t) => [t.id, t]))
  const teacherNameById = new Map(resources.teachers.map((t) => [t.id, t.name]))
  const hasPolicy = Boolean(input.planningPolicy)

  const allKnownTeachers = [
    ...resources.teachers.map((t) => ({ id: t.id, name: t.name })),
    ...(catalog.referenceTeachers ?? []).map((t) => ({ id: t.id, name: t.name })),
  ]
  const codec = new LocalPrivacyCodec(allKnownTeachers)

  const pendingByCourse = new Map<string, AcademicProposal['pending']>()
  for (const item of proposal.pending) {
    const list = pendingByCourse.get(item.courseId) ?? []
    list.push(item)
    pendingByCourse.set(item.courseId, list)
  }

  const assignedMinutesByTeacher = new Map<string, number>()
  for (const assignment of proposal.assignments) {
    assignedMinutesByTeacher.set(
      assignment.teacherId,
      (assignedMinutesByTeacher.get(assignment.teacherId) ?? 0) + (assignment.endMinute - assignment.startMinute),
    )
  }

  const bottlenecks: AcademicAdvisorBottleneck[] = []
  const recommendations: AcademicAdvisorRecommendation[] = []

  // 1. Teacher load deficit
  const extraByTeacher = new Map<string, number>()
  const unlockedByTeacher = new Map<string, Set<string>>()
  const deficitCourses: string[] = []
  let deficitSessionCount = 0

  const reservedByTeacher = new Map<string, number>()
  for (const [courseId, pendingItems] of pendingByCourse) {
    const eligible = input.teachers.filter((t) => isEligibleTeacher(t, courseId, hasPolicy))
    if (!eligible.length) continue
    const pendingMinutes = pendingItems.reduce((sum, item) => sum + item.durationMinutes, 0)
    const spareMinutes = eligible.reduce(
      (sum, t) => sum + Math.max(0, t.maxWeeklyMinutes + (extraByTeacher.get(t.id) ?? 0) - (assignedMinutesByTeacher.get(t.id) ?? 0) - (reservedByTeacher.get(t.id) ?? 0)),
      0,
    )
    if (spareMinutes < pendingMinutes) {
      const deficit = pendingMinutes - spareMinutes
      deficitSessionCount += pendingItems.length
      deficitCourses.push(catalogCourseById.get(courseId)?.name ?? courseId)
      const expandable = eligible.filter(
        (t) => t.maxWeeklyMinutes + (extraByTeacher.get(t.id) ?? 0) < 2400,
      )
      if (expandable.length) {
        const share = Math.ceil(deficit / expandable.length)
        const rounded = Math.ceil(share / 60) * 60 + 60
        for (const teacher of expandable) {
          const currentExtra = extraByTeacher.get(teacher.id) ?? 0
          const roomLeft = 2400 - (teacher.maxWeeklyMinutes + currentExtra)
          const add = Math.min(roomLeft, Math.max(60, rounded))
          if (add > 0) {
            extraByTeacher.set(teacher.id, currentExtra + add)
            const set = unlockedByTeacher.get(teacher.id) ?? new Set<string>()
            pendingItems.forEach((p) => set.add(p.sectionId))
            unlockedByTeacher.set(teacher.id, set)
          }
        }
      }
    }
    let remaining = pendingMinutes
    for (const teacher of eligible) {
      const spare = Math.max(0, teacher.maxWeeklyMinutes + (extraByTeacher.get(teacher.id) ?? 0) - (assignedMinutesByTeacher.get(teacher.id) ?? 0) - (reservedByTeacher.get(teacher.id) ?? 0))
      const take = Math.min(remaining, spare)
      reservedByTeacher.set(teacher.id, (reservedByTeacher.get(teacher.id) ?? 0) + take)
      remaining -= take
    }
  }

  if (extraByTeacher.size > 0) {
    const adjustments: Array<{ teacherId: string; previousMaxWeeklyMinutes: number; nextMaxWeeklyMinutes: number }> = []
    const labels: string[] = []
    const unlockedSections = new Set<string>()
    for (const [teacherId, extra] of [...extraByTeacher.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const teacher = teacherById.get(teacherId)!
      const nextMax = Math.min(2400, teacher.maxWeeklyMinutes + extra)
      if (nextMax > teacher.maxWeeklyMinutes) {
        adjustments.push({
          teacherId,
          previousMaxWeeklyMinutes: teacher.maxWeeklyMinutes,
          nextMaxWeeklyMinutes: nextMax,
        })
        labels.push(`${teacherNameById.get(teacherId) ?? teacherId} (${teacher.maxWeeklyMinutes} → ${nextMax} min)`)
        unlockedByTeacher.get(teacherId)?.forEach((s) => unlockedSections.add(s))
      }
    }
    if (adjustments.length > 0) {
      const coursePreview = deficitCourses.slice(0, 4).join(', ')
        + (deficitCourses.length > 4 ? ` y ${deficitCourses.length - 4} más` : '')
      bottlenecks.push({
        category: 'teacher_load',
        title: `Tope semanal docente insuficiente en ${deficitCourses.length} curso(s)`,
        detail: `Los docentes habilitados agotan su tope actual frente a las secciones requeridas de ${coursePreview}.`,
        affectedSessionCount: deficitSessionCount,
      })
      const teacherPreview = labels.slice(0, 4).join(', ')
        + (labels.length > 4 ? ` (+${labels.length - 4} docentes)` : '')
      recommendations.push({
        id: 'rec-increase-teacher-load',
        title: `Ampliar carga máxima semanal de ${adjustments.length} docente(s) habilitados`,
        rationale: `Escenario sintético sujeto a autorización externa; ${2400} min es el tope del simulador, no autorización normativa, para absorber las secciones pendientes: ${teacherPreview}.`,
        impactSummary: `Destraba hasta ${unlockedSections.size} sección(es) en ${deficitCourses.length} curso(s)`,
        recommendedByDefault: false,
        patch: { kind: 'increase_teacher_load', adjustments },
      })
    }
  }

  // 2. Planning window exceptions
  const policy = input.planningPolicy
  const seniorPending = proposal.pending.filter((p) => (courseById.get(p.courseId)?.cycle ?? 0) >= 7)
  if (policy && (!policy.allowAfternoon || !policy.allowSaturday)) {
    const needAfternoon = !policy.allowAfternoon && seniorPending.length > 0
    const needSaturday = !policy.allowSaturday && proposal.pending.length > 6
    if (needAfternoon || needSaturday) {
      const pendingSections = new Set(proposal.pending.map((p) => p.sectionId))
      bottlenecks.push({
        category: 'planning_window',
        title: 'Restricción de franja horaria en ciclos VII–X y cierre de sábado',
        detail: `Los cursos de ciclos superiores se concentran entre 18:00 y 22:00 (${seniorPending.length} componentes pendientes) sin excepción de tarde ni mañana de sábado.`,
        affectedSessionCount: needAfternoon ? seniorPending.length : proposal.pending.length,
      })
      recommendations.push({
        id: 'rec-enable-planning-window',
        title: 'Habilitar excepción de turno tarde (14:00–22:00) y sábado (08:00–13:00)',
        rationale: 'Permite programar secciones de ciclos VII–X desde las 14:00 y abre la mañana del sábado para eliminar colisiones de cohorte y aula.',
        impactSummary: `Amplía ventanas para ${pendingSections.size} sección(es) pendientes`,
        recommendedByDefault: true,
        patch: {
          kind: 'enable_planning_window',
          ...(!policy.allowAfternoon ? { allowAfternoon: true as const } : {}),
          ...(!policy.allowSaturday ? { allowSaturday: true as const } : {}),
        },
      })
    }
  }

  // 3. Reference resources missing from workspace
  const workspaceTeacherIds = new Set(resources.teachers.map((t) => t.id))
  const missingTeacherIds: string[] = []
  let unqualifiedCount = 0
  for (const [courseId, pendingItems] of pendingByCourse) {
    const eligible = input.teachers.filter((t) => isEligibleTeacher(t, courseId, hasPolicy))
    if (!eligible.length) {
      unqualifiedCount += pendingItems.length
      for (const refTeacher of catalog.referenceTeachers ?? []) {
        if (!workspaceTeacherIds.has(refTeacher.id) && refTeacher.courseIds.includes(courseId) && !missingTeacherIds.includes(refTeacher.id)) {
          missingTeacherIds.push(refTeacher.id)
        }
      }
    }
  }
  const workspaceRoomIds = new Set(resources.rooms.map((r) => r.id))
  const hasRoomIssue = proposal.diagnostics.some((d) => d.code === 'NO_COMPATIBLE_ROOM' || d.code === 'ROOM_CAPACITY')
  const missingRoomIds = hasRoomIssue
    ? (catalog.referenceRooms ?? []).filter((r) => !workspaceRoomIds.has(r.id)).map((r) => r.id).slice(0, 6)
    : []

  if (missingTeacherIds.length > 0 || missingRoomIds.length > 0) {
    bottlenecks.push({
      category: 'missing_resource',
      title: 'Recursos habilitados del catálogo de referencia excluidos del workspace',
      detail: `Hay ${missingTeacherIds.length} docente(s) y ${missingRoomIds.length} ambiente(s) en el catálogo de referencia aplicables a las secciones pendientes.`,
      affectedSessionCount: Math.max(1, unqualifiedCount),
    })
    recommendations.push({
      id: 'rec-incorporate-reference-resource',
      title: 'Incorporar docentes/ambientes habilitados del catálogo de referencia',
      rationale: 'Reincorpora al workspace los recursos de referencia con habilitación oficial para cubrir asignaturas sin docente o aula compatible.',
      impactSummary: `Incorpora ${missingTeacherIds.length} docente(s) y ${missingRoomIds.length} ambiente(s)`,
      recommendedByDefault: true,
      patch: {
        kind: 'incorporate_reference_resource',
        teacherIds: missingTeacherIds,
        roomIds: missingRoomIds,
      },
    })
  }

  // 4. Long continuous courses
  const splitCourseIds: string[] = []
  let splitSessionCount = 0
  for (const [courseId, pendingItems] of pendingByCourse) {
    const course = courseById.get(courseId)
    if (!course) continue
    const totalMinutes = course.weeklySessions.reduce((sum, s) => sum + s.durationMinutes, 0)
    if ((course.deliveryMode ?? 'continuous') === 'continuous' && course.weeklySessions.length > 1 && totalMinutes >= 240) {
      splitCourseIds.push(courseId)
      splitSessionCount += pendingItems.length
    }
  }
  if (splitCourseIds.length > 0) {
    bottlenecks.push({
      category: 'delivery_mode',
      title: `${splitCourseIds.length} curso(s) con bloques continuos largos (≥ 4 h)`,
      detail: 'Exigir que todos los componentes ocurran contiguos el mismo día reduce las combinaciones libres de aula y cohorte.',
      affectedSessionCount: splitSessionCount,
    })
    recommendations.push({
      id: 'rec-change-delivery-mode',
      title: `Permitir sesiones divididas en ${splitCourseIds.length} curso(s) con pendientes`,
      rationale: 'Conserva un único docente responsable por sección, pero permite separar teoría y práctica/laboratorio en distintos bloques.',
      impactSummary: `Flexibiliza ${splitCourseIds.length} curso(s) (${splitSessionCount} componentes)`,
      recommendedByDefault: false,
      patch: {
        kind: 'change_delivery_mode',
        courseIds: splitCourseIds.sort(),
        deliveryMode: 'split',
      },
    })
  }

  const pendingSectionsCount = new Set(proposal.pending.map((p) => p.sectionId)).size
  const summary = `La propuesta cubre ${proposal.counts.scheduledSessions}/${proposal.counts.requiredSessions} componentes requeridos y deja ${proposal.pending.length} componentes pendientes en ${pendingSectionsCount} sección(es). Se detectaron ${bottlenecks.length} cuello(s) de botella y ${recommendations.length} recomendación(es) accionables.`
  return { summary, bottlenecks, recommendations, codec }
}

export async function analyzeProposalAdvisor(
  proposal: AcademicProposal,
  input: GeneratorInput,
  resources: AcademicPlanningResources,
  requirements: RequiredSession[],
  catalog: AcademicCatalog,
  fetchImpl: typeof fetch = globalThis.fetch,
  selectedRecommendationIds?: string[],
): Promise<AcademicAdvisorResponse> {
  const baseUrl = engineUrl()
  if (baseUrl) {
    const teacherNames = new Map(resources.teachers.map((t) => [t.id, t.name]))
    const roomNames = new Map(resources.rooms.map((r) => [r.id, r.name]))
    const courseNames = new Map(catalog.courses.map((c) => [c.courseId, c.name]))
    const sections = prepareGeneratorInput(input).schedule.sections
    const payload = {
      selectedRecommendationIds,
      windows: input.windows,
      startStepMinutes: input.startStepMinutes,
      proposalId: proposal.proposalId,
      editVersion: proposal.editVersion ?? 0,
      courses: input.courses.map((c) => ({ ...c, name: courseNames.get(c.courseId) ?? c.courseId })),
      teachers: input.teachers.map((t) => ({ ...t, name: teacherNames.get(t.id) ?? t.id })),
      rooms: input.rooms.map((r) => ({ ...r, name: roomNames.get(r.id) ?? r.id })),
      sections,
      requirements,
      assignments: proposal.assignments.map((a) => ({
        id: a.sessionId,
        sectionId: a.sectionId,
        teacherId: a.teacherId,
        roomId: a.roomId,
        interval: { day: a.day, startMinute: a.startMinute, endMinute: a.endMinute },
        ...(a.sessionType ? { sessionType: a.sessionType } : {}),
      })),
      pending: proposal.pending,
      diagnostics: proposal.diagnostics,
      ...(input.planningPolicy ? { planningPolicy: input.planningPolicy } : {}),
      referenceTeachers: catalog.referenceTeachers ?? [],
      referenceRooms: (catalog.referenceRooms ?? []).map(({ id, name, capacity, kind }) => ({ id, name, capacity, kind })),
    }

    try {
      const response = await fetchImpl(`${baseUrl}/v1/advisor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(35000),
      })
      if (response.ok) {
        const body = await response.json()
        validateAcademicAdvisorResponse(body)
        if (body.proposalId !== proposal.proposalId || body.editVersion !== (proposal.editVersion ?? 0)) throw new Error('Stale advisor response')
        if (body.verifiedImpact && selectedRecommendationIds && JSON.stringify([...body.verifiedImpact.recommendationIds].sort()) !== JSON.stringify([...selectedRecommendationIds].sort())) throw new Error('Selection mismatch')
        return body
      }
    } catch {
      // Fall through to in-process deterministic + LLM router fallback
    }
  }

  const { summary, bottlenecks, recommendations } = buildLocalDeterministicAdvisor(
    proposal,
    input,
    resources,
    catalog,
  )

  const normativeRequest: AcademicNormativeRequest = { question: 'carga lectiva máximo hora académica excepciones autorización', facultyId: 'FISI', academicPeriod: input.planningPolicy?.period ?? `${new Date().getUTCFullYear()}-II`, asOf: new Date().toISOString().slice(0, 10), teacherType: 'unknown' }
  let normativeContext: AcademicNormativeResponse
  try { normativeContext = await queryNormative(normativeRequest, fetchImpl) } catch {
    const { question, ...context } = normativeRequest
    normativeContext = { revision: 'PA-NORMATIVE-1', question, context, status: 'not-determined', answer: 'Evidencia normativa no disponible. Cualquier aumento de carga requiere autorización externa.', retrievalMode: 'unavailable', citations: [], gaps: ['Motor normativo no disponible; no se verificó normativa ni autorización.', ...(!input.planningPolicy ? ['Periodo de contexto local inferido del año actual; no confirma periodo académico.'] : [])] }
  }
  const result: AcademicAdvisorResponse = {
    normativeContext,
    proposalId: proposal.proposalId,
    editVersion: proposal.editVersion ?? 0,
    source: { mode: 'deterministic-fallback', providerLabel: null, fallbackReason: 'upstream_error' },
    summary, bottlenecks, recommendations,
  }
  validateAcademicAdvisorResponse(result)
  return result
}
