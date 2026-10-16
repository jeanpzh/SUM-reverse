import { Inject, Injectable } from '@nestjs/common'
import { scenarioIds, validateScenarioCatalogResponse } from '../../../shared/local-profile-dashboard.mjs'
import type {
  ScenarioCatalog,
  ScenarioChoice,
  ScenarioId,
  ScenarioProfile,
} from '../../../shared/local-profile-dashboard.mjs'
import type { MatriculaRegularEnvelope } from '../../../shared/matricula-regular.mjs'
import { MatriculaRegularError } from '../matricula-regular/matricula-regular-error.filter.js'
import { MatriculaRegularRepository } from '../matricula-regular/matricula-regular.repository.js'
import { MATRICULA_REGULAR_CLOCK } from '../matricula-regular/context.service.js'
import { createAdvancingSyntheticClock } from '../matricula-regular/clock.js'
import type { ServerClock, SwitchableServerClock } from '../matricula-regular/clock.js'
import type { EnrollmentScenarioBundle } from '../matricula-regular/enrollment-scenarios.js'
import { LocalProfileSessionService } from './local-profile-session.service.js'

const actorIds = ['SYN-SIS-A', 'SYN-SIS-B', 'SYN-SOFT-A', 'SYN-SOFT-B'] as const
const labels: Record<ScenarioId, { label: string; description: string }> = {
  regular: { label: 'Regular', description: 'Inscripción regular con selección válida para los cuatro perfiles.' },
  repitencia: { label: 'Repitencia', description: 'Perfiles con cursos desaprobados y prioridad de repitencia.' },
  tutoria: { label: 'Tutoría', description: 'El perfil B tiene un requisito de tutoría pendiente; el perfil A conserva el caso aceptado.' },
  prerrequisito: { label: 'Prerrequisito', description: 'Comprueba prerrequisitos. C13 queda fuera de la preinscripción validada y no debe elegirse.' },
  cruce: { label: 'Cruce de horario', description: 'La selección del perfil A contiene un cruce de horario.' },
  cupo: { label: 'Cupo', description: 'La sección de C09 está llena en estos perfiles.' },
  deuda: { label: 'Deuda', description: 'El perfil B tiene una condición de deuda pendiente.' },
  'gap-horario': { label: 'Horario no conocido', description: 'El horario de C09 no está disponible para evaluar la selección.' },
  prioridad: { label: 'Prioridad', description: 'Compara una selección que respeta la prioridad de repitencia con otra que la omite.' },
}
const causeText: Record<string, string> = {
  TUTORSHIP_REQUIREMENT_UNMET: 'requiere tutoría',
  COURSE_NOT_IN_PRE_ENROLLMENT: 'incluye un curso fuera de la preinscripción',
  PREREQUISITE_UNMET: 'tiene un prerrequisito pendiente',
  SCHEDULE_CONFLICT: 'presenta cruce de horario',
  SECTION_FULL: 'encuentra la sección llena',
  DEBT_REQUIREMENT_UNMET: 'tiene una condición de deuda pendiente',
  RETAKE_PRIORITY: 'omite un curso con prioridad de repitencia',
}

function isSwitchableClock(clock: ServerClock): clock is SwitchableServerClock {
  return typeof (clock as Partial<SwitchableServerClock>).use === 'function'
}

@Injectable()
export class LocalScenariosService {
  private bundles = new Map<ScenarioId, EnrollmentScenarioBundle>()
  private currentScenarioId: ScenarioId | null = null

  constructor(
    private readonly repository: MatriculaRegularRepository,
    private readonly sessions: LocalProfileSessionService,
    @Inject(MATRICULA_REGULAR_CLOCK) private readonly clock: ServerClock,
  ) {}

  configure(bundles: readonly EnrollmentScenarioBundle[]): string {
    const next = new Map<ScenarioId, EnrollmentScenarioBundle>()
    for (const bundle of bundles) {
      if (!scenarioIds.includes(bundle.scenarioId) || next.has(bundle.scenarioId)) {
        throw new TypeError('Los bundles deben contener escenarios únicos permitidos')
      }
      next.set(bundle.scenarioId, structuredClone(bundle))
    }
    if (next.size !== 0 && scenarioIds.some((id) => !next.has(id))) {
      throw new TypeError('La configuración requiere los nueve escenarios')
    }
    this.bundles = next
    if (next.size === 0) {
      this.currentScenarioId = null
      return this.repository.runId
    }
    return this.activate('regular')
  }

  catalog(): MatriculaRegularEnvelope<ScenarioCatalog> {
    const response = {
      runId: this.repository.runId,
      data: {
        serverNow: this.clock.now().toISOString(),
        currentScenarioId: this.currentScenarioId,
        scenarios: scenarioIds.flatMap((scenarioId) => {
          const bundle = this.bundles.get(scenarioId)
          return bundle === undefined ? [] : [this.describe(scenarioId, bundle)]
        }),
      },
    }
    validateScenarioCatalogResponse(response)
    return response
  }

  async select(runId: string, scenarioId: ScenarioId): Promise<MatriculaRegularEnvelope<ReturnType<LocalProfileSessionService['catalog']>['data']>> {
    return this.repository.enqueue(() => {
      if (this.repository.runId !== runId) {
        throw new MatriculaRegularError(409, this.repository.runId, 'RUN_CHANGED')
      }
      const bundle = this.bundles.get(scenarioId)
      if (bundle === undefined) throw new MatriculaRegularError(400, this.repository.runId, 'INVALID_REQUEST', ['body.scenarioId'])
      this.activate(scenarioId)
      return this.sessions.catalog()
    })
  }

  private activate(scenarioId: ScenarioId): string {
    const bundle = this.bundles.get(scenarioId)
    if (bundle === undefined) throw new TypeError(`Falta el bundle ${scenarioId}`)
    if (isSwitchableClock(this.clock)) this.clock.use(createAdvancingSyntheticClock(bundle.clockBase))
    const fixtures = bundle.fixtures.map((fixture) => structuredClone(fixture))
    const runId = this.repository.resetForTests(fixtures)
    this.currentScenarioId = scenarioId
    return runId
  }

  private describe(scenarioId: ScenarioId, bundle: EnrollmentScenarioBundle): ScenarioChoice {
    const profiles = actorIds.map((actorId): ScenarioProfile => {
      const scenarioCase = bundle.cases.find((candidate) => candidate.actorId === actorId)
      if (scenarioCase === undefined) throw new TypeError(`Falta el perfil ${actorId} en ${scenarioId}`)
      const recommendation = scenarioId === 'prerrequisito' && actorId.endsWith('-A')
        ? bundle.fixtures[0]?.actors[0]?.scenarioData ? ['C09', 'C10', 'C11', 'C12'] : ['C09', 'C10', 'C11']
        : scenarioCase.selection.map(({ courseId }) => courseId.slice(-3))
      const prerequisitePreview = scenarioId === 'prerrequisito' && actorId.endsWith('-A')
      const outcome = prerequisitePreview
        ? 'C13 no aparece en prematrícula ni en matrícula porque requiere aprobar C09. Con las asignaturas sugeridas, la matrícula se acepta.'
        : scenarioCase.expected.state === 'accepted'
        ? 'Resultado esperado: aceptación.'
        : scenarioCase.expected.state === 'rejected'
          ? `Resultado esperado: rechazo; ${scenarioCase.expected.causes.map(({ code }) => causeText[code] ?? code).join('; ') || 'revisar las condiciones del caso'}.`
          : 'Resultado esperado: pendiente de configuración por información de horario no disponible.'
      const actor = bundle.fixtures.flatMap((fixture) => fixture.actors).find((candidate) => candidate.actorId === actorId)
      if (actor === undefined) throw new TypeError(`Falta la historia del perfil ${actorId}`)
      const approved = new Set(actor.approvedCourseIds)
      const approvedCredits = actor.academic?.catalog.filter((course) => approved.has(course.courseId))
        .reduce((sum, course) => sum + course.credits, 0) ?? 0
      const failed = actor.failedCourses.length > 0
        ? ` Repitencias: ${actor.failedCourses.map((course) => `${course.courseId.slice(-3)} (${course.failures})`).join(', ')}.`
        : ' Sin cursos desaprobados.'
      const summary = `Ponderado ${actor.ponderado?.toFixed(2) ?? 'no disponible'} · ${approved.size} aprobadas · ${approvedCredits} créditos.${failed}`
      return { actorId, summary, recommendedCourseIds: recommendation.map((code) => `${actorId.startsWith('SYN-SIS-') ? 'SYN-SIS' : 'SYN-SOFT'}-${code}`), expectedResult: outcome }
    })
    return { scenarioId, ...labels[scenarioId], profiles }
  }
}
