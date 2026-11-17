// Dedicated synthetic LLM-free completion E2E: real browser -> own NestJS -> own Python (no API key).
// Measures 332-session target completion (`targetMet`) separately from safety/integration invariants (`passed`).
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { api, generate, json, response } from './planning-audit/helpers.mjs'
import { statusBar } from './planning-v2-helpers.mjs'
import { validateAcademicAdvisorResponse, validateAcademicProposal } from '../../shared/programacion-academica-api.mjs'

if (process.env.SUM_REDESIGN_SYNTHETIC !== '1') throw new Error('Explicit owned synthetic stack required')
if (process.env.SUM_REDESIGN_LIVE_LLM === '1') throw new Error('LLM-free completion E2E must run with SUM_REDESIGN_LIVE_LLM disabled')
const base = new URL(process.env.SUM_REDESIGN_BASE)
if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' || base.pathname !== '/' || base.search || base.hash || base.username || base.password) {
  throw new Error('Dedicated loopback origin required')
}
const evidence = resolve(process.env.SUM_REDESIGN_EVIDENCE)
await mkdir(evidence, { recursive: true })

const TARGET_REQUIRED_SESSIONS = 332
const EXPECTED_COURSES = 56
const includeLoad = process.env.SUM_ASSISTANT_CASES === 'completion-with-explicit-load'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
page.setDefaultTimeout(15000)
page.setDefaultNavigationTimeout(60000)

const errors = []
const requests = []
const checks = []
const observations = []
const generationInputs = []

const inspectProposal = (proposal) => {
  validateAcademicProposal(proposal)
  const pendingSections = new Set(proposal.pending.map((item) => item.sectionId))
  const assignedSections = new Set(proposal.assignments.map((item) => item.sectionId))
  let resourceConflicts = 0
  let sectionOverlaps = 0
  for (let i = 0; i < proposal.assignments.length; i++) {
    for (let j = i + 1; j < proposal.assignments.length; j++) {
      const a = proposal.assignments[i]
      const b = proposal.assignments[j]
      if (a.day === b.day && a.startMinute < b.endMinute && b.startMinute < a.endMinute) {
        if (a.teacherId === b.teacherId || a.roomId === b.roomId) resourceConflicts++
        if (a.sectionId === b.sectionId) sectionOverlaps++
      }
    }
  }
  return {
    status: proposal.status,
    requiredSessions: proposal.counts.requiredSessions,
    scheduledSessions: proposal.counts.scheduledSessions,
    pendingSessions: proposal.pending.length,
    totalSections: proposal.counts.sections,
    completeSections: proposal.sections.filter((s) => assignedSections.has(s.sectionId) && !pendingSections.has(s.sectionId)).length,
    resourceConflicts,
    sectionOverlaps,
  }
}

page.on('pageerror', () => errors.push('uncaught browser exception'))
page.on('request', (request) => {
  if (request.method() !== 'POST') return
  const path = new URL(request.url()).pathname
  if (path.endsWith('/consejero')) requests.push({ kind: 'advisor', ids: request.postDataJSON().selectedRecommendationIds })
  if (path.endsWith('/propuestas')) {
    requests.push({ kind: 'generate' })
    generationInputs.push(request.postDataJSON())
  }
})

const check = (name, assertion) => {
  assertion()
  checks.push({ name, passed: true })
  console.log(`PASS ${name}`)
}

let failed = false
let targetMet = false
let completion = null

try {
  await page.goto(`${base.origin}/local/programacion-academica`, { waitUntil: 'networkidle' })
  await page.locator('#planning-page-title').waitFor()

  const original = await generate(page, true)
  const before = inspectProposal(original)
  observations.push({
    phase: 'initial-generation',
    metrics: before,
    courses: generationInputs[0].demands.length,
    period: generationInputs[0].planningPolicy?.period ?? null,
    revision: generationInputs[0].revision,
  })
  check('initial-56-courses-generated', () => {
    assert.equal(generationInputs[0].demands.length, EXPECTED_COURSES)
    assert.equal(before.resourceConflicts, 0)
    assert.equal(before.sectionOverlaps, 0)
    assert.equal(original.assignments.length, before.scheduledSessions)
    assert.ok(before.pendingSessions > 0, 'Expected partial initial proposal before advisor recommendations')
  })
  check('mount-does-not-consult', () => assert.equal(requests.filter((r) => r.kind === 'advisor').length, 0))

  const pendingConsultation = response(page, '/consejero')
  await page.getByRole('button', { name: 'Consultar consejero', exact: true }).click()
  const initial = await json(await pendingConsultation)
  validateAcademicAdvisorResponse(initial)
  observations.push({
    phase: 'consultation',
    mode: initial.source.mode,
    recommendations: initial.recommendations.length,
    patchKinds: initial.recommendations.map((r) => r.patch.kind),
    simulated: Boolean(initial.verifiedImpact),
  })
  check('consultation-without-simulation-or-llm', () => {
    assert.notEqual(initial.source.mode, 'llm-assisted')
    assert.equal(initial.verifiedImpact, undefined)
    assert.equal(initial.reasoningSteps?.some((step) => step.toolName === 'simulate_patches_cpsat') ?? false, false)
    assert.equal(requests.find((r) => r.kind === 'advisor')?.ids, undefined)
  })

  const panel = page.getByRole('tabpanel', { name: 'Consejero', exact: true })
  await panel.locator('[data-advisor-impact=pending]').waitFor()
  const apply = panel.getByRole('button', { name: /^Aplicar \d+ seleccionad[ao]s? y regenerar$/ })
  const disabledBeforeSimulation = await apply.isDisabled()
  check('apply-disabled-before-simulation', () => {
    assert.ok(initial.recommendations.length > 0)
    assert.equal(disabledBeforeSimulation, true)
  })

  const cards = panel.locator('.planning-rec')
  assert.equal(await cards.count(), initial.recommendations.length)
  const selectedIds = []
  const excludedLoadIds = []
  for (let i = 0; i < initial.recommendations.length; i++) {
    const rec = initial.recommendations[i]
    const checkbox = cards.nth(i).getByRole('checkbox')
    const checkedNow = (await checkbox.getAttribute('aria-checked')) === 'true'
    if (rec.patch.kind === 'increase_teacher_load') {
      assert.equal(checkedNow, false, `Load recommendation ${rec.id} must not be selected by default`)
      if (!includeLoad) { excludedLoadIds.push(rec.id); continue }
    }
    if (!checkedNow) {
      await checkbox.click()
      await checkbox.and(page.locator('[aria-checked="true"]')).waitFor()
    }
    selectedIds.push(rec.id)
  }
  const selectedRecommendations = initial.recommendations.filter((rec) => selectedIds.includes(rec.id))
  check('select-new-options-without-silent-load-increase', () => {
    assert.ok(selectedIds.length > 0)
    assert.equal(selectedRecommendations.some((rec) => rec.patch.kind === 'increase_teacher_load'), includeLoad)
    assert.ok(selectedRecommendations.some((rec) => rec.patch.kind === 'change_delivery_mode' && rec.patch.teacherAssignmentMode))
  })
  await page.screenshot({ path: resolve(evidence, 'completion-selection.png') })

  const simulationPending = response(page, '/consejero')
  await panel.getByRole('button', { name: 'Simular selección actual', exact: true }).click()
  const simulated = await json(await simulationPending)
  validateAcademicAdvisorResponse(simulated)
  observations.push({
    phase: 'simulation',
    mode: simulated.source.mode,
    selectedIds,
    excludedLoadIds,
    impact: simulated.verifiedImpact,
  })
  check('simulate-exact-selection', () => {
    assert.ok(simulated.verifiedImpact)
    assert.deepEqual([...simulated.verifiedImpact.recommendationIds].sort(), [...selectedIds].sort())
    assert.deepEqual([...requests.filter((r) => r.kind === 'advisor').at(-1).ids].sort(), [...selectedIds].sort())
  })
  await panel.locator('[data-advisor-impact=verified]').waitFor()
  assert.equal(await apply.isEnabled(), true)
  await page.screenshot({ path: resolve(evidence, 'completion-simulated.png') })

  const regenerationPending = response(page, '/propuestas')
  await apply.click()
  const regenerated = await json(await regenerationPending)
  await page.locator('#planning-chat-body').waitFor({ state: 'hidden' })
  const drafts = await json(await page.request.get(`${base.origin}${api}/borradores`))
  check('apply-regenerates-once-without-implicit-save', () => {
    assert.equal(requests.filter((r) => r.kind === 'generate').length, 2)
    assert.equal(drafts.items.length, 0)
    assert.notEqual(regenerated.proposalId, original.proposalId)
  })

  const after = inspectProposal(regenerated)
  const initialTeachers = new Map(generationInputs[0].resources.teachers.map((t) => [t.id, t.maxWeeklyMinutes]))
  const teacherLoadDeltas = generationInputs[1].resources.teachers
    .map((teacher) => {
      const previous = initialTeachers.get(teacher.id) ?? null
      return {
        teacherId: teacher.id,
        previousMaxWeeklyMinutes: previous,
        nextMaxWeeklyMinutes: teacher.maxWeeklyMinutes,
        delta: previous === null ? null : teacher.maxWeeklyMinutes - previous,
      }
    })
    .filter((entry) => entry.delta === null || entry.delta !== 0)

  const gains = {
    scheduledSessions: after.scheduledSessions - before.scheduledSessions,
    completeSections: after.completeSections - before.completeSections,
    pendingSessions: after.pendingSessions - before.pendingSessions,
  }
  targetMet = after.status === 'complete'
    && after.requiredSessions === TARGET_REQUIRED_SESSIONS
    && after.scheduledSessions === TARGET_REQUIRED_SESSIONS
    && after.pendingSessions === 0
    && after.completeSections === after.totalSections

  completion = {
    targetRequiredSessions: TARGET_REQUIRED_SESSIONS,
    targetMet,
    status: after.status,
    requiredSessions: after.requiredSessions,
    scheduledSessions: after.scheduledSessions,
    pendingSessions: after.pendingSessions,
    completeSections: after.completeSections,
    totalSections: after.totalSections,
    gains,
  }

  observations.push({
    phase: 'actual-regeneration',
    metrics: after,
    completion,
    teacherLoadDeltas,
    selectedPatchKinds: selectedRecommendations.map((r) => r.patch.kind),
    policy: generationInputs[1].planningPolicy ?? null,
  })

  check('regeneration-preserves-demand-and-applies-exact-patches', () => {
    assert.equal(generationInputs[1].demands.length, generationInputs[0].demands.length)
    assert.equal(after.requiredSessions, before.requiredSessions)
    for (const initialDemand of generationInputs[0].demands) {
      const regeneratedDemand = generationInputs[1].demands.find((item) => item.courseId === initialDemand.courseId)
      assert.ok(regeneratedDemand, `Missing course ${initialDemand.courseId} after regeneration`)
      assert.equal(regeneratedDemand.estimatedDemand, initialDemand.estimatedDemand)
      assert.equal(regeneratedDemand.targetCapacity, initialDemand.targetCapacity)
    }
    const approvedChanges = new Map(selectedRecommendations.flatMap(rec => rec.patch.kind === 'increase_teacher_load' ? rec.patch.adjustments.map(row => [row.teacherId, row]) : []))
    for (const teacher of generationInputs[1].resources.teachers) {
      const previous = initialTeachers.get(teacher.id)
      const explicit = approvedChanges.get(teacher.id)
      if (explicit) {
        assert.equal(previous, explicit.previousMaxWeeklyMinutes)
        assert.equal(teacher.maxWeeklyMinutes, explicit.nextMaxWeeklyMinutes)
      } else if (previous !== undefined) assert.equal(teacher.maxWeeklyMinutes, previous, 'Unselected teacher load changed')
    }
    for (const id of approvedChanges.keys()) assert.ok(generationInputs[1].resources.teachers.some(t => t.id === id))
    for (const rec of selectedRecommendations) {
      const patch = rec.patch
      if (patch.kind === 'enable_planning_window') {
        if (patch.allowAfternoon) assert.equal(generationInputs[1].planningPolicy?.allowAfternoon, true)
        if (patch.allowSaturday) assert.equal(generationInputs[1].planningPolicy?.allowSaturday, true)
      } else if (patch.kind === 'change_delivery_mode') {
        for (const courseId of patch.courseIds) {
          const demand = generationInputs[1].demands.find(item => item.courseId === courseId)
          if (patch.deliveryMode) assert.equal(demand?.deliveryMode, patch.deliveryMode)
          if (patch.teacherAssignmentMode) assert.equal(demand?.teacherAssignmentMode, patch.teacherAssignmentMode)
        }
      } else if (patch.kind === 'incorporate_reference_resource') {
        const teacherIds = new Set(generationInputs[1].resources.teachers.map((t) => t.id))
        const roomIds = new Set(generationInputs[1].resources.rooms.map((r) => r.id))
        for (const id of patch.teacherIds) assert.ok(teacherIds.has(id))
        for (const id of patch.roomIds) assert.ok(roomIds.has(id))
      }
    }
  })

  check('no-resource-or-section-conflicts-after-regeneration', () => {
    assert.equal(after.resourceConflicts, 0)
    assert.equal(after.sectionOverlaps, 0)
    assert.equal(regenerated.assignments.length, after.scheduledSessions)
    assert.ok(gains.scheduledSessions > 0 || after.scheduledSessions === after.requiredSessions)
  })

  check('regeneration-respects-eligibility-availability-capacity-and-selected-loads', () => {
    const input = generationInputs[1]
    const teachers = new Map(input.resources.teachers.map(t => [t.id, t]))
    const rooms = new Map(input.resources.rooms.map(r => [r.id, r]))
    const loads = new Map()
    const sectionsByTeacherCourse = new Map()
    const covers = (windows, assignment) => windows.some(w => w.day === assignment.day
      && w.startMinute <= assignment.startMinute && w.endMinute >= assignment.endMinute)
    for (const a of regenerated.assignments) {
      const teacher = teachers.get(a.teacherId), room = rooms.get(a.roomId)
      assert.ok(teacher && room)
      assert.ok(teacher.courseIds.includes(a.courseId))
      assert.ok(covers(teacher.availability, a), 'Teacher availability violated')
      assert.ok(covers(room.availability, a), 'Room availability violated')
      const section = regenerated.sections.find(s => s.sectionId === a.sectionId)
      assert.ok(room.capacity >= section.capacity)
      if (input.planningPolicy && a.sessionType === 'L') assert.equal(room.kind, 'laboratory')
      loads.set(a.teacherId, (loads.get(a.teacherId) ?? 0) + a.endMinute - a.startMinute)
      const key = `${a.teacherId}:${a.courseId}`
      if (!sectionsByTeacherCourse.has(key)) sectionsByTeacherCourse.set(key, new Set())
      sectionsByTeacherCourse.get(key).add(a.sectionId)
    }
    for (const [id, teacher] of teachers) {
      assert.ok((loads.get(id) ?? 0) <= teacher.maxWeeklyMinutes, 'Selected weekly load exceeded')
      for (const limit of teacher.sectionLimits ?? []) {
        assert.ok((sectionsByTeacherCourse.get(`${id}:${limit.courseId}`)?.size ?? 0) <= limit.maxSections)
      }
    }
  })

  if (includeLoad) check('complete-target-with-explicit-selected-load', () => {
    assert.equal(targetMet, true, 'Explicit synthetic scenario must regenerate all 332 sessions')
    assert.equal(after.totalSections, 166)
  })

  await statusBar(page).waitFor()
  const uiStatus = await statusBar(page).getAttribute('data-status')
  check('partial-result-never-claims-complete-in-ui', () => {
    if (!targetMet) assert.notEqual(uiStatus, 'complete')
    else assert.equal(uiStatus, 'complete')
  })

  await page.screenshot({ path: resolve(evidence, 'completion-regenerated.png') })
  check('no-browser-exceptions', () => assert.deepEqual(errors, []))
} catch (error) {
  failed = true
  checks.push({
    name: 'e2e-completion',
    passed: false,
    reason: error instanceof assert.AssertionError ? error.message.slice(0, 600) : 'Browser or HTTP scenario failed; inspect synthetic screenshot',
  })
  await page.screenshot({ path: resolve(evidence, 'completion-failed.png') }).catch(() => {})
  console.error(checks.at(-1).reason)
} finally {
  await browser.close()
  await writeFile(resolve(evidence, 'acceptance.json'), JSON.stringify({
    source: 'Own synthetic React/NestJS/Python, LLM-free, no API key required',
    includeLoad,
    targetMet,
    completion,
    checks,
    observations,
    passed: !failed,
  }, null, 2))
}
if (failed) process.exitCode = 1
