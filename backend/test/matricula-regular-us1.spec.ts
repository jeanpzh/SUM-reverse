import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { request as httpRequest } from 'node:http'
import { validateContext } from '../../shared/matricula-regular.mjs'
import type { MatriculaRegularContext } from '../../shared/matricula-regular.mjs'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'
import type { School, SyntheticFixture } from '../src/matricula-regular/profile.types.js'
import { createMatriculaRegularTestApp, type MatriculaRegularTestApp } from './matricula-regular-test-app.js'

const API_ORIGIN = 'http://127.0.0.1:5742'
const CONTEXT_PATH = '/local/matricula-regular/v1/contextos'

let testApp: MatriculaRegularTestApp

beforeAll(async () => {
  testApp = await createMatriculaRegularTestApp()
  await testApp.listen()
})

afterAll(async () => {
  await testApp.close()
})

async function contextRead(fixture: SyntheticFixture) {
  const runId = testApp.repository.resetForTests([fixture])
  const actor = fixture.actors[0]!
  const before = testApp.repository.readSnapshot()
  const response = await fetch(`${API_ORIGIN}${CONTEXT_PATH}/${actor.actorId}`)
  const body: unknown = await response.json()
  const after = testApp.repository.readSnapshot()

  expect(response.status).toBe(200)
  expect(after).toEqual(before)
  expect(typeof body).toBe('object')
  expect(body).not.toBeNull()
  expect(Object.keys(body as object).sort()).toEqual(['data', 'runId'])
  expect((body as { runId: string }).runId).toBe(runId)
  validateContext((body as { data: MatriculaRegularContext }).data)

  return (body as { data: MatriculaRegularContext }).data
}

async function errorRead(path: string) {
  const response = await fetch(`${API_ORIGIN}${path}`)
  const body: unknown = await response.json()
  return { response, body }
}

function getWithBody(path: string, body: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(`${API_ORIGIN}${path}`, {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
        'content-length': String(Buffer.byteLength(body)),
      },
    }, (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => chunks.push(chunk))
      response.on('end', () => {
        try {
          resolve({ status: response.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString()) as unknown })
        } catch (error) {
          reject(error)
        }
      })
    })
    request.on('error', reject)
    request.end(body)
  })
}

describe.each(['SISTEMAS', 'SOFTWARE'] as const)('T013 MR-CTX synthetic HTTP: %s', (school: School) => {
  it('MAT-01-V01 / AC-01, AC-02, AC-20 keeps known documents and permits access without a download write', async () => {
    const fixture = createSyntheticFixture(school)
    const context = await contextRead(fixture)

    expect(context.scope.schoolId).toBe(school)
    expect(context.preEnrollmentEnabled).toBe(true)
    expect(context.preEnrollmentComplete).toBe(true)
    expect(context.preEnrollment).toEqual(fixture.actors[0]!.preEnrollment)
    expect(context.eligibility.state).toBe('eligible')
  })

  it('MAT-01-V02 / AC-20 reports the disabled pre-enrollment flag without creating state', async () => {
    const fixture = createSyntheticFixture(school)
    fixture.actors[0]!.preEnrollmentEnabled = false
    const context = await contextRead(fixture)

    expect(context.preEnrollmentEnabled).toBe(false)
    expect(context.eligibility.state).toBe('ineligible')
    expect(context.eligibility.causes.map((cause) => cause.code)).toContain('PRE_ENROLLMENT_NOT_ENABLED')
  })

  it('MAT-01-V03 / AC-03 keeps unknown enablement pending and explicit', async () => {
    const fixture = createSyntheticFixture(school)
    fixture.actors[0]!.preEnrollmentEnabled = null
    const context = await contextRead(fixture)

    expect(context.preEnrollmentEnabled).toBeNull()
    expect(context.eligibility.state).toBe('configuration-pending')
    expect(context.eligibility.gaps.map((gap) => gap.code)).toContain('PRE_ENROLLMENT_UNKNOWN')
  })

  it('MAT-01-V04 / AC-03 represents an empty complete document without inventing courses', async () => {
    const fixture = createSyntheticFixture(school)
    fixture.actors[0]!.preEnrollment = []
    const context = await contextRead(fixture)

    expect(context.preEnrollmentComplete).toBe(true)
    expect(context.preEnrollment).toEqual([])
    expect(context.offer).toHaveLength(fixture.offer.length)
    expect(context.eligibility.state).toBe('eligible')
  })

  it('MAT-01-V05 / AC-03 keeps an incomplete document readable with a plan-or-offer gap', async () => {
    const fixture = createSyntheticFixture(school)
    fixture.actors[0]!.preEnrollmentComplete = false
    const context = await contextRead(fixture)

    expect(context.preEnrollmentComplete).toBe(false)
    expect(context.preEnrollment).toEqual(fixture.actors[0]!.preEnrollment)
    expect(context.eligibility.state).toBe('configuration-pending')
    expect(context.eligibility.gaps.map((gap) => gap.code)).toContain('PLAN_OR_OFFER_UNKNOWN')
  })

  it('MAT-02-V03 / AC-09 preserves a known non-offered document without inventing a section', async () => {
    const fixture = createSyntheticFixture(school)
    const actor = fixture.actors[0]!
    const document = {
      ...actor.preEnrollment[0]!,
      courseId: school === 'SISTEMAS' ? 'SYN-SIS-DOCUMENT-ONLY' : 'SYN-SOFT-DOCUMENT-ONLY',
      name: 'Asignatura documental sintética no ofertada',
    }
    actor.preEnrollment = [...actor.preEnrollment, document]
    const context = await contextRead(fixture)

    expect(context.preEnrollment).toContainEqual(document)
    expect(context.offer.some((course) => course.courseId === document.courseId)).toBe(false)
    expect(context.offer.flatMap((course) => course.sections).some((section) => section.sectionId === document.courseId)).toBe(false)
  })

  it('rejects extra or repeated query parameters without returning their values', async () => {
    const fixture = createSyntheticFixture(school)
    const runId = testApp.repository.resetForTests([fixture])
    const before = testApp.repository.readSnapshot()
    const { response, body } = await errorRead(`${CONTEXT_PATH}/${fixture.actors[0]!.actorId}?trace=SAFE&trace=PRIVATE-SENTINEL`)
    const after = testApp.repository.readSnapshot()

    expect(response.status).toBe(400)
    expect(body).toEqual({ runId, error: { code: 'INVALID_REQUEST', fields: ['query.trace'] } })
    expect(JSON.stringify(body)).not.toContain('PRIVATE-SENTINEL')
    expect(after).toEqual(before)
  })

  it('rejects a GET body and malformed or unknown actor paths with sanitized envelopes', async () => {
    const fixture = createSyntheticFixture(school)
    const runId = testApp.repository.resetForTests([fixture])
    const withBody = await getWithBody(`${CONTEXT_PATH}/${fixture.actors[0]!.actorId}`, '{"unexpected":"PRIVATE-SENTINEL"}')
    const malformed = await errorRead(`${CONTEXT_PATH}/INVALID-ACTOR-SENTINEL`)
    const missing = await errorRead(`${CONTEXT_PATH}/SYN-MISSING-ACTOR`)

    expect(withBody.status).toBe(400)
    expect(withBody.body).toEqual({ runId, error: { code: 'INVALID_REQUEST', fields: ['body'] } })
    expect(JSON.stringify(withBody.body)).not.toContain('PRIVATE-SENTINEL')
    expect(malformed.response.status).toBe(400)
    expect(malformed.body).toEqual({ runId, error: { code: 'INVALID_REQUEST', fields: ['actorId'] } })
    expect(JSON.stringify(malformed.body)).not.toContain('INVALID-ACTOR-SENTINEL')
    expect(missing.response.status).toBe(404)
    expect(missing.body).toEqual({ runId, error: { code: 'ACTOR_NOT_FOUND', fields: [] } })
  })
})
