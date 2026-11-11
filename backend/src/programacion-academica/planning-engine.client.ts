import { validateAcademicAdvisorResponse, validateAcademicCatalog } from '../../../shared/programacion-academica-api.mjs'
import type {
  AcademicAdvisorBottleneck,
  AcademicAdvisorRecommendation,
  AcademicAdvisorResponse,
  AcademicCatalog,
  AcademicPlanningResources,
  AcademicProposal,
} from '../../../shared/programacion-academica-api.mjs'
import { prepareGeneratorInput } from './generator-input.js'
import { createCoverageAuthority } from './session-coverage.js'
import type { GeneratorInput, GeneratorResult } from './generator.types.js'
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

export async function trySolveWithPythonEngine(
  input: GeneratorInput,
  catalog: AcademicCatalog,
  resources: AcademicPlanningResources,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<GeneratorResult | null> {
  const baseUrl = engineUrl()
  if (!baseUrl) return null
  const payload = engineJobPayload(input, catalog, resources)
  const { schedule, requirements } = prepareGeneratorInput(input)

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
      limitReason: 'explorations' | 'work' | 'time' | 'running' | 'cancelled' | null
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

// PA-ENGINE-2 decisions are retained evidence, never an instruction to run another solver.
export function analyzeProposalAdvisor(
  proposal: AcademicProposal,
  input: GeneratorInput,
  resources: AcademicPlanningResources,
  catalog: AcademicCatalog,
): AcademicAdvisorResponse {
  validateAcademicCatalog(catalog)
  const recommendations: AcademicAdvisorRecommendation[] = []
  const bottlenecks: AcademicAdvisorBottleneck[] = []
  const necessary = 'Condición necesaria; no garantiza horario ni cobertura. El impacto real se mide después de aplicar y regenerar.'
  const analyzed = proposal.decisions !== undefined && proposal.coverageProof !== undefined && proposal.capacityCertificate !== undefined && proposal.normative !== undefined
  for (const decision of analyzed ? proposal.decisions ?? [] : []) {
    let patch: AcademicAdvisorRecommendation['patch'] | undefined
    let detail = necessary
    if (decision.kind === 'planning-window' && decision.policyChange && Object.keys(decision.policyChange).length) {
      patch = { kind: 'enable_planning_window', ...decision.policyChange, ...(decision.requiresSplit ? { splitCourseIds: [...decision.courseIds] } : {}) }
    } else if (decision.kind === 'delivery-mode-split' && decision.courseIds.length) {
      patch = { kind: 'change_delivery_mode', courseIds: [...decision.courseIds], deliveryMode: 'split' }
    } else if (decision.kind === 'teacher-load-exception') {
      const teacher = resources.teachers.find(t => t.id === decision.teacherId)
      const resolved = input.teachers.find(t => t.id === decision.teacherId)
      const next = teacher ? teacher.maxWeeklyMinutes + decision.additionalMinutes : 0
      if (decision.exceptionKind === 'configuration-adjustment' && teacher && resolved
        && proposal.normative?.profileRevision && decision.additionalMinutes > 0
        && resolved.configurationMaxWeeklyMinutes !== undefined && next <= resolved.configurationMaxWeeklyMinutes) {
        patch = { kind: 'increase_teacher_load', adjustments: [{ teacherId: teacher.id,
          previousMaxWeeklyMinutes: teacher.maxWeeklyMinutes, nextMaxWeeklyMinutes: next }] }
      } else {
        detail += ` Revisa la cola de decisiones y el registro de autorización del docente ${decision.teacherId ?? ''}. Requisitos: ${(decision.requires ?? []).join(', ') || 'pendientes de verificar'}. Fuentes: ${(decision.sourceIds ?? []).join(', ') || 'no disponibles'}.`
      }
    } else if (decision.kind === 'additional-teacher') {
      const teacherIds = (catalog.referenceTeachers ?? []).filter(t => !resources.teachers.some(current => current.id === t.id)
        && t.courseIds.some(id => decision.courseIds.includes(id))).map(t => t.id)
      if (teacherIds.length) {
        patch = { kind: 'incorporate_reference_resource', teacherIds, roomIds: [] }
        detail += ' Referencias sintéticas: faltan disponibilidad, carga configurada, régimen, categoría y autorización; completa los datos en Recursos. Incorporarlas no confirma capacidad.'
      } else detail += ' Se necesita un recurso docente adicional; no hay referencia compatible disponible.'
    }
    const labels = { 'teacher-load-exception': 'Carga docente', 'additional-teacher': 'Docente adicional', 'planning-window': 'Ampliación de franjas', 'delivery-mode-split': 'Dictado partido' }
    const title = `${labels[decision.kind]}${decision.requiresSplit ? ' y separación de componentes' : ''} · ${decision.teacherId ?? decision.courseIds.join(', ')}`
    bottlenecks.push({ category: decision.kind === 'teacher-load-exception' ? 'teacher_load'
      : decision.kind === 'additional-teacher' ? 'missing_resource' : decision.kind === 'planning-window' ? 'planning_window' : 'delivery_mode',
      title, detail, affectedSessionCount: 0 })
    if (patch) recommendations.push({ id: `decision:${decision.id}`, decisionIds: [decision.id], title,
      rationale: detail, impactSummary: `${decision.sectionsUnlocked} secciones en el análisis de ${decision.basis}. ${necessary}`,
      recommendedByDefault: false, patch })
  }
  for (const gap of proposal.normative?.gaps ?? []) bottlenecks.push({ category: 'other', title: gap.code, detail: gap.message, affectedSessionCount: 0 })
  for (const blocker of proposal.normative?.blockers ?? []) bottlenecks.push({ category: 'teacher_load', title: `Autorización pendiente · ${blocker.teacherId}`,
    detail: `${blocker.assignedMinutes} min asignados; ${blocker.authorizedMaxMinutes} min autorizados. Revisa el registro docente en la cola de decisiones. Fuentes: ${blocker.sourceIds.join(', ')}.`, affectedSessionCount: 0 })
  const certificate = proposal.capacityCertificate
  const capacitySummary = certificate ? ` Certificado de capacidad: ${certificate.coverableSectionsTotal} de ${certificate.requiredSectionsTotal} secciones (${certificate.proven ? 'probado' : 'no probado'}); no acredita colocación horaria.` : ''
  const summary = (!analyzed ? 'Falta el análisis de decisiones retenido. Ejecuta una nueva búsqueda; no se han inferido recomendaciones.'
    : proposal.coverageProof === 'complete' ? 'Cobertura completa en la propuesta retenida. Las condiciones de capacidad no sustituyen la validación de publicación.'
    : proposal.coverageProof === 'inconclusive' ? 'Análisis inconcluso o cancelado: no demuestra imposibilidad. Se muestran solo las decisiones retenidas; puedes ejecutar una nueva búsqueda.'
    : `Faltante comprobado en la propuesta retenida. ${necessary}`) + capacitySummary
  const result: AcademicAdvisorResponse = { proposalId: proposal.proposalId, editVersion: proposal.editVersion ?? 0,
    source: { mode: 'engine-decisions', providerLabel: null }, summary, bottlenecks, recommendations }
  validateAcademicAdvisorResponse(result, proposal.decisions ?? [])
  return result
}

export function engineJobPayload(input: GeneratorInput, catalog: AcademicCatalog, resources: AcademicPlanningResources) {
  const prepared = prepareGeneratorInput(input)
  const { schedule, requirements } = prepared
  const teacherNames = new Map(resources.teachers.map((t) => [t.id, t.name]))
  const roomNames = new Map(resources.rooms.map((r) => [r.id, r.name]))
  const courseNames = new Map(catalog.courses.map((c) => [c.courseId, c.name]))

  return {
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

}
