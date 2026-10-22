import type {
  MatriculaRegularCause,
  MatriculaRegularChoice,
  MatriculaRegularGap,
  MatriculaRegularId,
  MatriculaRegularOutcomeState,
} from '../../../shared/matricula-regular.mjs'
import { createHash } from 'node:crypto'
import { expandScenarioBundle } from './expanded-scenarios.js'
import { scenarioReferenceHashes, scenarioPlanRows } from './scenario-reference.seed.js'
import { createSyntheticAcademicDemoFixture } from './academic-demo.fixtures.js'
import type { Meeting, OfferedCourse, School, SyntheticFixture } from './profile.types.js'

export const enrollmentScenarioIds = [
  'regular', 'repitencia', 'tutoria', 'prerrequisito', 'cruce', 'cupo', 'deuda', 'docente-no-asignado', 'prioridad',
] as const
export type EnrollmentScenarioId = typeof enrollmentScenarioIds[number]
export const ENROLLMENT_SCENARIO_CLOCK = '2026-08-11T14:00:00.000Z' as const
export const ENROLLMENT_SCENARIO_SOURCE = 'PEM-LOCAL-1'
export const ENROLLMENT_SCENARIO_SOURCE_PATH = 'datos-sinteticos/plan-estudios.json' as const
const BUILT_IN_SOURCE_PATH = 'backend/src/matricula-regular/scenario-reference.seed.ts' as const
export const selectedCourseCodes = ['20118041', '20118051', '20118066', '20118084'] as const

export type SelectedPlanCourse = {
  codAsignatura: string
  desAsignatura: string
  creditos: number
  ciclo: number
  tipoAsignatura: string
}
export type ScenarioSource = { path: typeof ENROLLMENT_SCENARIO_SOURCE_PATH | typeof BUILT_IN_SOURCE_PATH; sha256: string; selectedCourseCodes: readonly string[]; referenceFiles?: Record<string, string>; status: 'local-only' }
export type EnrollmentScenarioCase = {
  actorId: string
  selection: MatriculaRegularChoice[]
  expected: { state: MatriculaRegularOutcomeState; causes: MatriculaRegularCause[]; gaps: MatriculaRegularGap[] }
}
export type EnrollmentScenarioBundle = {
  seedRevision: 'PEM-SEED-1'
  scenarioId: EnrollmentScenarioId
  clockBase: typeof ENROLLMENT_SCENARIO_CLOCK
  source: ScenarioSource
  fixtures: SyntheticFixture[]
  cases: EnrollmentScenarioCase[]
}

const selectedPlanValues: Record<string, Omit<SelectedPlanCourse, 'codAsignatura'>> = {
  '20118041': { desAsignatura: 'ALGORÍTMICA Y PROGRAMACIÓN ORIENTADA A OBJETOS', creditos: 4, ciclo: 4, tipoAsignatura: 'O' },
  '20118051': { desAsignatura: 'BASE DE DATOS', creditos: 4, ciclo: 5, tipoAsignatura: 'O' },
  '20118066': { desAsignatura: 'REDES, TRANSMISIÓN Y AUTOMATIZACIÓN Y CONTROL', creditos: 4, ciclo: 6, tipoAsignatura: 'O' },
  '20118084': { desAsignatura: 'INGENIERIA DE LA INFORMACIÓN', creditos: 4, ciclo: 8, tipoAsignatura: 'O' },
}

export function buildBuiltInEnrollmentScenarioBundles(): EnrollmentScenarioBundle[] {
  const rows = selectedCourseCodes.map((codAsignatura) => ({ codAsignatura, ...selectedPlanValues[codAsignatura]! }))
  const sha256 = createHash('sha256').update(JSON.stringify(scenarioReferenceHashes)).digest('hex')
  return buildEnrollmentScenarioBundles(rows, sha256, BUILT_IN_SOURCE_PATH).map((bundle) => {
    bundle.source.selectedCourseCodes = [...new Set(scenarioPlanRows.map((row) => row.codAsignatura))]
    bundle.source.referenceFiles = { ...scenarioReferenceHashes }
    return expandScenarioBundle(bundle)
  })
}

function courseId(school: School, number: number): MatriculaRegularId {
  return `SYN-${school === 'SISTEMAS' ? 'SIS' : 'SOFT'}-C${String(number).padStart(2, '0')}`
}
function choice(school: School, number: number): MatriculaRegularChoice {
  const id = courseId(school, number)
  return { courseId: id, sectionId: `${id}-S1` }
}
function cause(code: MatriculaRegularCause['code'], courseIds: MatriculaRegularId[] = [], sectionIds: MatriculaRegularId[] = []): MatriculaRegularCause {
  return { code, courseIds: [...courseIds].sort(), sectionIds: [...sectionIds].sort(), sourceIds: [ENROLLMENT_SCENARIO_SOURCE] }
}
function expected(state: MatriculaRegularOutcomeState, causes: MatriculaRegularCause[] = [], gaps: MatriculaRegularGap[] = []) {
  return { state, causes, gaps }
}

const baseA = [9, 10, 11]
const baseB = [7, 8, 9, 10]
const scenarioDefinitions: Record<EnrollmentScenarioId, (school: School, suffix: 'A' | 'B') => EnrollmentScenarioCase> = {
  regular: (school, suffix) => ({ actorId: `SYN-${school === 'SISTEMAS' ? 'SIS' : 'SOFT'}-${suffix}`, selection: (suffix === 'A' ? baseA : baseB).map((n) => choice(school, n)), expected: expected('accepted') }),
  repitencia: (school, suffix) => ({ actorId: `SYN-${school === 'SISTEMAS' ? 'SIS' : 'SOFT'}-${suffix}`, selection: (suffix === 'A' ? baseA : baseB).map((n) => choice(school, n)), expected: expected('accepted') }),
  tutoria: (school, suffix) => ({ actorId: `SYN-${school === 'SISTEMAS' ? 'SIS' : 'SOFT'}-${suffix}`, selection: (suffix === 'A' ? baseA : baseB).map((n) => choice(school, n)), expected: suffix === 'A' ? expected('accepted') : expected('rejected', [cause('TUTORSHIP_REQUIREMENT_UNMET', [courseId(school, 8)])]) }),
  // Negative HTTP case: C13 is excluded from validated pre-enrollment and cannot be picked in the UI.
  prerrequisito: (school, suffix) => ({ actorId: `SYN-${school === 'SISTEMAS' ? 'SIS' : 'SOFT'}-${suffix}`, selection: (suffix === 'A' ? [10, 11, 13] : baseB).map((n) => choice(school, n)), expected: suffix === 'A' ? expected('rejected', [
    { ...cause('COURSE_NOT_IN_PRE_ENROLLMENT', [courseId(school, 13)], [choice(school, 13).sectionId]), sourceIds: ['L-05'] },
    cause('PREREQUISITE_UNMET', [courseId(school, 9), courseId(school, 13)]),
  ]) : expected('accepted') }),
  cruce: (school, suffix) => ({ actorId: `SYN-${school === 'SISTEMAS' ? 'SIS' : 'SOFT'}-${suffix}`, selection: (suffix === 'A' ? baseA : baseB).map((n) => choice(school, n)), expected: expected('rejected', [cause('SCHEDULE_CONFLICT', [courseId(school, 9), courseId(school, 10)])]) }),
  cupo: (school, suffix) => ({ actorId: `SYN-${school === 'SISTEMAS' ? 'SIS' : 'SOFT'}-${suffix}`, selection: (suffix === 'A' ? baseA : baseB).map((n) => choice(school, n)), expected: expected('rejected', [cause('SECTION_FULL', [courseId(school, 9)], [`${courseId(school, 9)}-S1`])]) }),
  deuda: (school, suffix) => ({ actorId: `SYN-${school === 'SISTEMAS' ? 'SIS' : 'SOFT'}-${suffix}`, selection: (suffix === 'A' ? baseA : baseB).map((n) => choice(school, n)), expected: suffix === 'A' ? expected('accepted') : expected('rejected', [cause('DEBT_REQUIREMENT_UNMET')]) }),
  // Testimony 2026-10-22: sections are published with a schedule before a teacher is assigned.
  'docente-no-asignado': (school, suffix) => ({ actorId: `SYN-${school === 'SISTEMAS' ? 'SIS' : 'SOFT'}-${suffix}`, selection: (suffix === 'A' ? baseA : baseB).map((n) => choice(school, n)), expected: expected('accepted') }),
  prioridad: (school, suffix) => ({ actorId: `SYN-${school === 'SISTEMAS' ? 'SIS' : 'SOFT'}-${suffix}`, selection: (suffix === 'A' ? baseA : [8, 9, 10]).map((n) => choice(school, n)), expected: suffix === 'A' ? expected('accepted') : expected('rejected', [
    cause('RETAKE_PRIORITY', [courseId(school, 7)]),
  ]) }),
}

function assertSelectedPlanCourses(rows: readonly SelectedPlanCourse[]): Map<string, SelectedPlanCourse> {
  const selected = new Map<string, SelectedPlanCourse>()
  for (const code of selectedCourseCodes) {
    const matches = rows.filter((row) => String(row.codAsignatura) === code)
    if (matches.length === 0) throw new Error(`${ENROLLMENT_SCENARIO_SOURCE_PATH}:data.codAsignatura(${code}) ausente`)
    const values = matches.map(({ desAsignatura, creditos, ciclo, tipoAsignatura }) => ({ desAsignatura, creditos, ciclo, tipoAsignatura }))
    if (values.some((value) => JSON.stringify(value) !== JSON.stringify(values[0]))) {
      throw new Error(`${ENROLLMENT_SCENARIO_SOURCE_PATH}:data.codAsignatura(${code}) duplicada con campos contradictorios`)
    }
    const row = matches[0]!
    if (typeof row.desAsignatura !== 'string' || row.desAsignatura.trim() === '') throw new Error(`${ENROLLMENT_SCENARIO_SOURCE_PATH}:data.desAsignatura(${code}) inválido`)
    if (typeof row.creditos !== 'number' || !Number.isFinite(row.creditos) || row.creditos <= 0) throw new Error(`${ENROLLMENT_SCENARIO_SOURCE_PATH}:data.creditos(${code}) inválido`)
    if (!Number.isInteger(row.ciclo) || row.ciclo < 1 || row.ciclo > 14) throw new Error(`${ENROLLMENT_SCENARIO_SOURCE_PATH}:data.ciclo(${code}) inválido`)
    if (row.tipoAsignatura !== 'O' && row.tipoAsignatura !== 'E') throw new Error(`${ENROLLMENT_SCENARIO_SOURCE_PATH}:data.tipoAsignatura(${code}) inválido`)
    const expected = selectedPlanValues[code]!
    if (row.desAsignatura.trim() !== expected.desAsignatura || row.creditos !== expected.creditos || row.ciclo !== expected.ciclo || row.tipoAsignatura !== expected.tipoAsignatura) {
      throw new Error(`${ENROLLMENT_SCENARIO_SOURCE_PATH}:data(${code}) no coincide en desAsignatura/creditos/ciclo/tipoAsignatura`)
    }
    selected.set(code, { ...row, desAsignatura: row.desAsignatura.trim() })
  }
  return selected
}

function withAcademicHistory(fixture: SyntheticFixture): SyntheticFixture {
  const result = structuredClone(fixture)
  for (const actor of result.actors) {
    const ledger = actor.academic!
    actor.approvedCourseIds = [...new Set(ledger.attempts.filter((attempt) => attempt.result === 'approved').map((attempt) => attempt.courseId))].sort()
    const failures = new Map<string, number>()
    const approved = new Set<string>()
    for (const attempt of ledger.attempts) {
      if (attempt.result === 'approved') approved.add(attempt.courseId)
      else if (!approved.has(attempt.courseId)) failures.set(attempt.courseId, (failures.get(attempt.courseId) ?? 0) + 1)
    }
    actor.failedCourses = [...failures].map(([id, count]) => ({ courseId: id, failures: count as 0 | 1 | 2 | 3 | 4 })).sort((a, b) => a.courseId.localeCompare(b.courseId))
    const credits = new Map(ledger.catalog.map((course) => [course.courseId, course.credits]))
    const totalCredits = ledger.attempts.reduce((sum, attempt) => sum + credits.get(attempt.courseId)!, 0)
    actor.ponderado = totalCredits === 0 ? null : Math.round(ledger.attempts.reduce((sum, attempt) => sum + attempt.grade * credits.get(attempt.courseId)!, 0) / totalCredits * 100) / 100
    actor.rules = actor.rules.map((rule) => ({ ...rule, sourceIds: [ENROLLMENT_SCENARIO_SOURCE] }))
    for (const ruleId of ['EQUIVALENCES', 'CREDIT-LOAD', 'SCHEDULE', 'SECTION-CAPACITY']) {
      if (!actor.rules.some((rule) => rule.ruleId === ruleId)) actor.rules.push({ ruleId, sourceIds: [ENROLLMENT_SCENARIO_SOURCE], knowledge: 'known' })
    }
    actor.creditException = { kind: 'none', applicability: 'not-applicable', sourceIds: [ENROLLMENT_SCENARIO_SOURCE] }
    if (actor.actorId.endsWith('-B')) actor.tutorship = [{ courseId: actor.scope.schoolId === 'SISTEMAS' ? 'SYN-SIS-C08' : 'SYN-SOFT-C08', condition: 'met' }]
  }
  result.profile.sources.push({ id: ENROLLMENT_SCENARIO_SOURCE, origin: 'local-decision', class: null, reference: 'docs/reverse-engineering/plans/perfiles-escenarios-matricula.md', date: '2026-10-16', status: 'local-only' })
  result.profile.rules = result.profile.rules.map((rule) => ({ ...rule, sourceIds: rule.sourceIds.includes(ENROLLMENT_SCENARIO_SOURCE) ? rule.sourceIds : [...rule.sourceIds, ENROLLMENT_SCENARIO_SOURCE] }))
  return result
}

function applyAcademicSource(fixture: SyntheticFixture, selected: Map<string, SelectedPlanCourse>): void {
  for (const [index, code] of selectedCourseCodes.entries()) {
    const row = selected.get(code)!
    for (const actor of fixture.actors) {
      const course = actor.academic!.catalog.find((item) => item.courseId === `SYN-SIS-C${String(index + 9).padStart(2, '0')}`)!
      Object.assign(course, { name: row.desAsignatura, credits: row.creditos, cycle: row.ciclo, courseType: row.tipoAsignatura === 'O' ? 'mandatory' : 'elective' })
    }
  }
}

function buildFixture(school: School, scenarioId: EnrollmentScenarioId, selected: Map<string, SelectedPlanCourse>): SyntheticFixture {
  const fixture = withAcademicHistory(createSyntheticAcademicDemoFixture(school))
  if (school === 'SISTEMAS') applyAcademicSource(fixture, selected)
  const offered = new Set([7, 8, 9, 10, 11, 12, 13])
  fixture.offer = fixture.actors[0]!.academic!.catalog.filter((course) => offered.has(Number(course.courseId.slice(-2)))).map((course): OfferedCourse => ({
    ...structuredClone(course),
    prerequisiteIds: Number(course.courseId.slice(-2)) < 5 ? [] : [courseId(school, Number(course.courseId.slice(-2)) - 4)],
    sections: [{ sectionId: `${course.courseId}-S1` as MatriculaRegularId, capacity: 10, occupied: scenarioId === 'cupo' && course.courseId.endsWith('C09') ? 10 : 2,
      schedule: [{ day: (scenarioId === 'cruce' && ['C09', 'C10'].some((suffix) => course.courseId.endsWith(suffix)) ? 3 : Number(course.courseId.slice(-2)) - 6) as Meeting['day'], startMinute: 480, endMinute: 540 }],
      label: '1', teacher: scenarioId === 'docente-no-asignado' && course.courseId.endsWith('C09') ? null : 'DOCENTE SINTÉTICO', room: null }],
  }))
  for (const actor of fixture.actors) {
    const suffix = actor.actorId.endsWith('-A') ? 'A' : 'B'
    const approved = new Set(actor.approvedCourseIds)
    // PEM-1b: both the pre-enrollment report and enrollment picker consume this validated seed.
    // These fixtures have known history and no equivalences; prerequisites use explicit approvals.
    actor.preEnrollment = fixture.offer
      .filter((course) => course.planId === actor.scope.planId
        && !approved.has(course.courseId)
        && course.prerequisiteIds.every((id) => approved.has(id)))
      .map(({ courseId, name, credits }) => ({ courseId, planId: actor.scope.planId, name, credits }))
    if (scenarioId === 'deuda' && suffix === 'B') actor.institutional.debt = 'unmet'
    if (scenarioId === 'tutoria' && suffix === 'B') actor.tutorship = [{ courseId: courseId(school, 8), condition: 'unmet' }]
  }
  return fixture
}

export function buildEnrollmentScenarioBundles(
  rows: readonly SelectedPlanCourse[], sha256: string, sourcePath: ScenarioSource['path'] = ENROLLMENT_SCENARIO_SOURCE_PATH,
): EnrollmentScenarioBundle[] {
  if (!/^[a-f\d]{64}$/.test(sha256)) throw new TypeError('source.sha256 debe contener 64 caracteres hexadecimales')
  const selected = assertSelectedPlanCourses(rows)
  return enrollmentScenarioIds.map((scenarioId) => {
    const fixtures = (['SISTEMAS', 'SOFTWARE'] as const).map((school) => buildFixture(school, scenarioId, selected))
    const cases = (['SISTEMAS', 'SOFTWARE'] as const).flatMap((school) => (['A', 'B'] as const).map((suffix) => scenarioDefinitions[scenarioId](school, suffix)))
    return { seedRevision: 'PEM-SEED-1', scenarioId, clockBase: ENROLLMENT_SCENARIO_CLOCK,
      source: { path: sourcePath, sha256, selectedCourseCodes: [...selectedCourseCodes], status: 'local-only' }, fixtures, cases }
  })
}
