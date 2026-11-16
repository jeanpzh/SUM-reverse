// Build backend first. No servers, external providers, snapshots, or browser.
import test from 'node:test'
import assert from 'node:assert/strict'
import { DemoProposalService } from '../backend/dist/programacion-academica/demo-proposal.service.js'
import { createDemoCatalog } from '../backend/dist/programacion-academica/demo-catalog.js'
import { validateAcademicAdvisorResponse } from './programacion-academica-api.mjs'

test('synthetic advisor selection propagation, unknown IDs, stale version and outage', async () => {
  const oldFetch = globalThis.fetch
  const oldUrl = process.env.SUM_PLANNING_ENGINE_URL
  process.env.SUM_PLANNING_ENGINE_URL = 'off'
  try {
    const catalog = createDemoCatalog()
    const course = catalog.courses.find((c) => catalog.teachers.some((t) => t.courseIds.includes(c.courseId)))
    const service = new DemoProposalService()
    const proposal = service.createProposal({ revision: catalog.revision, demands: [{ courseId: course.courseId, estimatedDemand: 1 }] })
    const request = { expectedEditVersion: proposal.editVersion ?? 0, selectedRecommendationIds: [] }
    const fallback = await service.adviseProposal(proposal.proposalId, request)
    validateAcademicAdvisorResponse(fallback)
    assert.equal(fallback.source.mode, 'deterministic-fallback')
    assert.equal(fallback.verifiedImpact, undefined)
    await assert.rejects(service.adviseProposal(proposal.proposalId, { ...request, selectedRecommendationIds: ['unknown'] }), (e) => e.getStatus() === 400)
    await assert.rejects(service.adviseProposal(proposal.proposalId, { ...request, expectedEditVersion: 99 }), (e) => e.getStatus() === 409)
    process.env.SUM_PLANNING_ENGINE_URL = 'http://127.0.0.1:3220'
    let captured
    globalThis.fetch = async (_url, options) => {
      captured = JSON.parse(options.body)
      return new Response(JSON.stringify(fallback), { status: 200 })
    }
    await service.adviseProposal(proposal.proposalId, request)
    assert.deepEqual(captured.selectedRecommendationIds, [])
    assert.deepEqual(captured.windows, catalog.windows)
    assert.equal(captured.editVersion, request.expectedEditVersion)
    assert.deepEqual(service.getProposal(proposal.proposalId), proposal)
    globalThis.fetch = async () => { throw new Error('synthetic outage') }
    const outage = await service.adviseProposal(proposal.proposalId, request)
    assert.equal(outage.source.mode, 'deterministic-fallback')
    assert.equal(outage.verifiedImpact, undefined)
    // Simulate a concurrent manual edit while the remote advisor is pending.
    let release
    let entered
    const requested = new Promise((resolve) => { entered = resolve })
    globalThis.fetch = async () => {
      entered()
      await new Promise((resolve) => { release = resolve })
      return new Response(JSON.stringify(fallback), { status: 200 })
    }
    const pending = service.adviseProposal(proposal.proposalId, request)
    await requested
    const assignments = [...proposal.assignments].sort((a, b) => a.startMinute - b.startMinute)
    const first = assignments[0]
    const changed = service.adjustProposal(proposal.proposalId, {
      expectedVersion: request.expectedEditVersion, sectionId: first.sectionId,
      sessionIds: assignments.map((a) => a.sessionId), roomIds: assignments.map((a) => a.roomId),
      teacherId: first.teacherId, day: first.day === 1 ? 2 : 1, startMinute: 480,
    })
    assert.equal(changed.editVersion, request.expectedEditVersion + 1)
    release()
    await assert.rejects(pending, (e) => e.getStatus() === 409)

    // Verify backend pass-through preserves additive normativeContrast and managementActions.
    const proposal2 = service.createProposal({ revision: catalog.revision, demands: [{ courseId: course.courseId, estimatedDemand: 1 }] })
    const enrichedPayload = {
      ...fallback,
      proposalId: proposal2.proposalId,
      editVersion: proposal2.editVersion ?? 0,
      recommendations: fallback.recommendations.map((rec, index) => index === 0 ? {
        ...rec,
        normativeContrast: {
          topic: 'planning_window',
          status: 'not-determined',
          citations: [],
          gaps: ['Verificar franja con autoridad académica.'],
          requiresExternalAuthorization: true,
          authorizationNote: 'Requiere autorización académica externa.',
        },
      } : rec),
      managementActions: [{
        id: 'mgmt-request-external-room',
        kind: 'request_external_room',
        title: 'Solicitar aulas adicionales',
        detail: 'Gestionar disponibilidad adicional con dirección.',
        relatedCategory: 'missing_resource',
        affectedSessionCount: 2,
        citations: [],
        executable: false,
      }],
    }
    globalThis.fetch = async () => new Response(JSON.stringify(enrichedPayload), { status: 200 })
    const forwarded = await service.adviseProposal(proposal2.proposalId, { expectedEditVersion: proposal2.editVersion ?? 0, selectedRecommendationIds: [] })
    assert.equal(forwarded.managementActions?.length, 1)
    assert.equal(forwarded.managementActions?.[0].executable, false)
    if (forwarded.recommendations.length > 0) {
      assert.equal(forwarded.recommendations[0].normativeContrast?.topic, 'planning_window')
    }
  } finally {
    globalThis.fetch = oldFetch
    if (oldUrl === undefined) delete process.env.SUM_PLANNING_ENGINE_URL
    else process.env.SUM_PLANNING_ENGINE_URL = oldUrl
  }
})
