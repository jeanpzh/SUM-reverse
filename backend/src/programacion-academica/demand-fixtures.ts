import { buildBuiltInEnrollmentScenarioBundles } from '../matricula-regular/enrollment-scenarios.js'
import type { AcademicAttempt, AcademicCatalogCourse, ActorProfile, SyntheticAcademicRecord } from '../matricula-regular/profile.types.js'
import type { AcademicCatalog, AcademicDemandSource, AcademicDemandSourceId } from '../../../shared/programacion-academica-api.d.mts'

export type DemandAttempt = Pick<AcademicAttempt, 'period' | 'result'> & { courseCode: string }
export type DemandPlanCourse = Pick<AcademicCatalogCourse, 'name' | 'prerequisiteIds'> & { courseCode: string }
export type DemandLearner = {
  identity: string
  schoolId: string
  planId: string
  planKnown: boolean
  historyKnown: boolean
  equivalencesKnown: boolean
  courses: DemandPlanCourse[]
  attempts: DemandAttempt[]
  equivalentCourseCodes: string[]
}
export type DemandRecord = { learner: DemandLearner; recordId: string }
export type DemandSourceData = { metadata: AcademicDemandSource; records: DemandRecord[] }

const cutoff = '2026-1'
const limitationSet = [
  'La base es habilitación académica potencial de una muestra sintética, no intención ni pronóstico de matrícula.',
  'La fuente independiente se construye por fórmula para demostración y no representa la distribución real de estudiantes.',
  'La fuente independiente contiene 132 registros: 120 identidades y 12 copias idénticas para probar deduplicación.',
  'Las equivalencias de la fuente independiente son reconocimientos sintéticos explícitos; la fuente regular usa lista de equivalencias conocida y vacía. No se importa una tabla institucional.',
  'Solo se evalúan cursos del plan sintético de Sistemas; prerequisiteIds expresa una conjunción simple.',
  'No se consideran continuidad futura, cursos en progreso, reglas administrativas, horarios, cupos ni elección conjunta de carga.',
]

function canonicalCodes(actor: ActorProfile): Map<string, string> {
  const mapping = actor.scenarioData?.courseCodes
  if (!mapping) return new Map()
  return new Map(Object.entries(mapping))
}

export function projectActor(actor: ActorProfile): DemandLearner {
  const record = actor.academic as SyntheticAcademicRecord | undefined
  const codes = canonicalCodes(actor)
  return {
    identity: actor.actorId,
    schoolId: actor.scope.schoolId,
    planId: actor.scope.planId,
    planKnown: actor.planKnown,
    historyKnown: actor.historyKnown,
    equivalencesKnown: actor.equivalencesKnown,
    courses: (record?.catalog ?? []).map((course) => ({
      courseCode: codes.get(course.courseId) ?? '',
      name: course.name,
      prerequisiteIds: course.prerequisiteIds.map((id) => codes.get(id) ?? ''),
    })),
    attempts: (record?.attempts ?? []).map((attempt) => ({
      courseCode: codes.get(attempt.courseId) ?? '', period: attempt.period, result: attempt.result,
    })),
    equivalentCourseCodes: [],
  }
}

function metadata(id: AcademicDemandSourceId, populationSize: number, recordCount: number, reference: string): AcademicDemandSource {
  return {
    id,
    label: id === 'existing-regular-v1' ? 'Escenario regular sintético existente (Sistemas)' : 'Población independiente sintética de 120 perfiles (Sistemas)',
    revision: 'DEMAND-SYN-1',
    kind: 'synthetic',
    targetPeriod: '2027-I',
    cutoffPeriod: cutoff,
    schoolId: 'SISTEMAS',
    planId: 'SYN-SIS-PLAN',
    populationSize,
    recordCount,
    duplicateRecords: recordCount - populationSize,
    reference,
    limitations: [...limitationSet],
  }
}

function makeIndependentLearners(base: DemandLearner): DemandLearner[] {
  const targetCode = '20118104'
  const prerequisiteCode = '20118095'
  const targetCourse = base.courses.find((course) => course.courseCode === targetCode)
  const prerequisiteCourse = base.courses.find((course) => course.courseCode === prerequisiteCode)
  if (!targetCourse?.prerequisiteIds.includes(prerequisiteCode) || !prerequisiteCourse) {
    throw new TypeError('El plan sintético no contiene la relación esperada para la demostración ERP')
  }

  return Array.from({ length: 120 }, (_, index) => {
    const group = index % 10
    const learner: DemandLearner = {
      ...structuredClone(base),
      identity: `SYN-DEMAND-${String(index + 1).padStart(3, '0')}`,
      attempts: [],
      equivalentCourseCodes: [],
      historyKnown: true,
      equivalencesKnown: true,
      planKnown: true,
    }
    // Histories are newly generated and share only prior-cycle progress, not A/B attempts.
    for (const course of base.courses.filter((item) => item.courseCode !== targetCode && item.courseCode !== prerequisiteCode)) {
      const original = course
      if (original.prerequisiteIds.every((prerequisiteId) => !prerequisiteId || learner.attempts.some((attempt) => attempt.courseCode === prerequisiteId && attempt.result === 'approved'))
        && prerequisiteCourse.courseCode !== original.courseCode && !original.prerequisiteIds.includes(targetCode)) {
        learner.attempts.push({ courseCode: course.courseCode, result: 'approved', period: '2024-1' })
      }
    }

    if (group <= 2) {
      learner.attempts.push({ courseCode: prerequisiteCode, result: 'approved', period: '2024-2' })
    } else if (group === 3 || group === 4) {
      learner.attempts.push({ courseCode: prerequisiteCode, result: 'approved', period: '2024-2' })
      learner.attempts.push({ courseCode: targetCode, result: 'failed', period: '2025-1' })
      learner.attempts.push({ courseCode: targetCode, result: 'failed', period: '2025-2' })
    } else if (group === 5) {
      learner.attempts.push({ courseCode: prerequisiteCode, result: 'approved', period: '2024-2' })
      learner.attempts.push({ courseCode: targetCode, result: 'approved', period: '2026-1' })
    } else if (group === 6) {
      // Missing prerequisite is known because its complete synthetic history omits the approval.
    } else if (group === 7) {
      learner.equivalentCourseCodes.push(targetCode)
      learner.attempts.push({ courseCode: prerequisiteCode, result: 'approved', period: '2024-2' })
    } else if (group === 8) {
      learner.historyKnown = false
      learner.attempts.push({ courseCode: prerequisiteCode, result: 'approved', period: '2024-2' })
    } else {
      learner.equivalencesKnown = false
      learner.attempts.push({ courseCode: prerequisiteCode, result: 'approved', period: '2024-2' })
    }
    return learner
  })
}

export function createDemandSources(catalog: AcademicCatalog): Map<AcademicDemandSourceId, DemandSourceData> {
  const bundle = buildBuiltInEnrollmentScenarioBundles().find((item) => item.scenarioId === 'regular')
  const fixture = bundle?.fixtures.find((item) => item.profile.scope.schoolId === 'SISTEMAS')
  if (!fixture || fixture.actors.length !== 2 || fixture.actors.some((actor) => actor.scope.planId !== 'SYN-SIS-PLAN')) {
    throw new TypeError('La fuente regular sintética requiere los dos perfiles de Sistemas del escenario regular')
  }
  const regularLearners = fixture.actors.map(projectActor)
  const independentLearners = makeIndependentLearners(regularLearners[0]!)
  const existing = {
    metadata: metadata('existing-regular-v1', regularLearners.length, regularLearners.length, 'backend/src/matricula-regular/enrollment-scenarios.ts:regular/SISTEMAS'),
    records: regularLearners.map((learner, index) => ({ learner, recordId: `regular-${index + 1}` })),
  }
  const duplicates = independentLearners.filter((_, index) => index % 10 === 0).map((learner) => ({
    learner: structuredClone(learner), recordId: `${learner.identity}-duplicate`,
  }))
  const independent = {
    metadata: metadata('independent-120-v1', independentLearners.length, independentLearners.length + duplicates.length, 'local-only: fórmula independiente sobre el catálogo y plan sintéticos existentes'),
    records: [...independentLearners.map((learner) => ({ learner, recordId: learner.identity })), ...duplicates],
  }
  const catalogCodes = new Set(catalog.courses.map((course) => course.courseId))
  if (!catalogCodes.has('20118104') || !catalogCodes.has('20118095')) throw new TypeError('El catálogo PA-DEMO no contiene los cursos requeridos por la fuente sintética')
  return new Map([[existing.metadata.id, existing], [independent.metadata.id, independent]])
}
