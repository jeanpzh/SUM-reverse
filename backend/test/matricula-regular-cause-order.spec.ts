import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import {
  matriculaRegularCauseCodes,
  validateOutcome,
} from '../../shared/matricula-regular.mjs'
import type { MatriculaRegularCause, MatriculaRegularOutcome } from '../../shared/matricula-regular.mjs'
import { createSyntheticClock } from '../src/matricula-regular/clock.js'
import { canonicalizeCauses } from '../src/matricula-regular/canonical-causes.js'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'
import { MatriculaRegularRepository } from '../src/matricula-regular/matricula-regular.repository.js'
import {
  MATRICULA_REGULAR_CLOCK,
  MatriculaRegularModule,
} from '../src/matricula-regular/matricula-regular.module.js'
import type { School } from '../src/matricula-regular/profile.types.js'

const openApps: INestApplication[] = []
const schools: School[] = ['SISTEMAS', 'SOFTWARE']
const now = '2026-08-11T15:00:00.000Z'
const requestId = '00000000-0000-4000-8000-000000000001'

async function createApp(): Promise<{ app: INestApplication; repository: MatriculaRegularRepository }> {
  const testingModule = await Test.createTestingModule({ imports: [MatriculaRegularModule] })
    .overrideProvider(MATRICULA_REGULAR_CLOCK)
    .useValue(createSyntheticClock())
    .compile()
  const app = testingModule.createNestApplication({ logger: false })
  await app.init()
  await new Promise<void>((resolve) => app.getHttpServer().listen(0, '127.0.0.1', resolve))
  openApps.push(app)
  return { app, repository: app.get(MatriculaRegularRepository) }
}

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()))
})

function cause(
  code: MatriculaRegularCause['code'],
  courseIds: string[],
  sectionIds: string[],
  sourceIds: string[] = ['SYN-FIXTURE'],
): MatriculaRegularCause {
  return { code, courseIds, sectionIds, sourceIds }
}

function outcome(causes: MatriculaRegularCause[]): MatriculaRegularOutcome {
  return {
    requestId,
    actorId: 'SYN-SIS-A',
    profileRevision: 'MR-SYN-SIS-1',
    state: 'rejected',
    evaluatedAt: now,
    windowOrigin: 'synthetic',
    selection: [{ courseId: 'SYN-OUTCOME-COURSE', sectionId: 'SYN-OUTCOME-SECTION' }],
    causes: canonicalizeCauses(causes),
    gaps: [],
    enrollmentId: null,
    reportPath: null,
  }
}

describe('MR-CONTRACT-2 cause ordering', () => {
  it.each(schools)('simultaneous causes produce a valid HTTP rejection for %s', async (school) => {
    const fixture = createSyntheticFixture(school)
    const actor = fixture.actors[0]!
    actor.preEnrollmentEnabled = false
    actor.institutional.debt = 'unmet'
    actor.institutional.eligibility = 'unmet'
    actor.failedCourses = [{ courseId: fixture.offer[0]!.courseId, failures: 4 }]
    const { app, repository } = await createApp()
    const runId = repository.resetForTests([fixture])
    const base = '/local/matricula-regular/v1'
    const sessionResponse = await request(app.getHttpServer())
      .post(`${base}/sesiones`)
      .send({ runId, actorId: actor.actorId })
      .expect(200)
    const selection = [{
      courseId: fixture.offer[0]!.courseId,
      sectionId: fixture.offer[0]!.sections[0]!.sectionId,
    }]

    const response = await request(app.getHttpServer())
      .post(`${base}/solicitudes`)
      .send({
        runId,
        actorId: actor.actorId,
        sessionId: sessionResponse.body.data.sessionId,
        requestId,
        profileRevision: actor.profileRevision,
        selection,
      })
      .expect(200)

    expect(response.body.data.state).toBe('rejected')
    expect(response.body.data.causes.map((item: MatriculaRegularCause) =>
      `${item.code}|${item.courseIds.join(',')}|${item.sectionIds.join(',')}`,
    )).toEqual([
      `ACADEMIC_INELIGIBILITY|${fixture.offer[0]!.courseId}|`,
      'ACADEMIC_INELIGIBILITY||',
      `CREDIT_LOAD_INVALID|${fixture.offer[0]!.courseId}|${fixture.offer[0]!.sections[0]!.sectionId}`,
      'DEBT_REQUIREMENT_UNMET||',
      'PRE_ENROLLMENT_NOT_ENABLED||',
    ])
    expect(response.body.data.causes.every(({ sourceIds }: MatriculaRegularCause) => sourceIds.length > 0)).toBe(true)
    expect(response.body.data.gaps).toEqual([])
    expect(response.body.data.enrollmentId).toBeNull()
    expect(() => validateOutcome(response.body.data)).not.toThrow()
    expect(response.body.data.selection).toEqual(selection)
    expect(repository.readSnapshot().enrollments).toEqual([])
    expect(repository.readSnapshot().offer.find(({ courseId }) => courseId === selection[0]!.courseId)?.sections[0]?.occupied)
      .toBe(0)
  })

  it('sorts complete raw keys across prefixes and separators', () => {
    const causes = [
      cause('CREDIT_LOAD_INVALID', ['SYN-A'], []),
      cause('CREDIT_LOAD_INVALID', ['SYN-A', 'SYN-A-A'], []),
      cause('CREDIT_LOAD_INVALID', [], []),
    ]

    const ordered = canonicalizeCauses(causes)

    expect(ordered.map((item) => `${item.code}|${item.courseIds.join(',')}|${item.sectionIds.join(',')}`)).toEqual([
      'CREDIT_LOAD_INVALID|SYN-A,SYN-A-A|',
      'CREDIT_LOAD_INVALID|SYN-A|',
      'CREDIT_LOAD_INVALID||',
    ])
    expect(() => validateOutcome(outcome(causes))).not.toThrow()
  })

  it('deduplicates exact cause identities while preserving all source IDs', () => {
    const causes = [
      cause('DEBT_REQUIREMENT_UNMET', [], [], ['SYN-SOURCE-B']),
      cause('DEBT_REQUIREMENT_UNMET', [], [], ['SYN-SOURCE-A', 'SYN-SOURCE-B']),
    ]

    expect(canonicalizeCauses(causes)).toEqual([
      cause('DEBT_REQUIREMENT_UNMET', [], [], ['SYN-SOURCE-A', 'SYN-SOURCE-B']),
    ])
  })

  it('validates every supported code with empty, course, section, and combined identities', () => {
    const causes = matriculaRegularCauseCodes.flatMap((code) => [
      cause(code, [], []),
      cause(code, ['SYN-A'], []),
      cause(code, [], ['SYN-SEC-A']),
      cause(code, ['SYN-A'], ['SYN-SEC-A']),
    ])
    const result = outcome(causes)

    expect(() => validateOutcome(result)).not.toThrow()
    expect(result.causes).toHaveLength(matriculaRegularCauseCodes.length * 4)
    expect(result.causes.map((item) => `${item.code}|${item.courseIds.join(',')}|${item.sectionIds.join(',')}`))
      .toEqual([...result.causes]
        .map((item) => `${item.code}|${item.courseIds.join(',')}|${item.sectionIds.join(',')}`)
        .sort())
  })
})
