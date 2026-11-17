// Explicit paid E2E: real browser -> own NestJS -> own Python -> real Bedrock.
// Own stack only; public normative corpus and independently synthetic catalog.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { generate, response, json, api } from './planning-audit/helpers.mjs'
import { validateAcademicAdvisorResponse } from '../../shared/programacion-academica-api.mjs'

if (process.env.SUM_REDESIGN_SYNTHETIC !== '1' || process.env.SUM_REDESIGN_LIVE_LLM !== '1') throw new Error('Explicit owned synthetic stack and live LLM opt-in required')
const base = new URL(process.env.SUM_REDESIGN_BASE)
if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' || base.pathname !== '/' || base.search || base.hash || base.username || base.password) throw new Error('Dedicated loopback origin required')
const evidence = resolve(process.env.SUM_REDESIGN_EVIDENCE)
await mkdir(evidence, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
page.setDefaultTimeout(15000)
page.setDefaultNavigationTimeout(45000)
const errors = []
const requests = []
const checks = []
const observations = []
const generationInputs = []
const metrics = proposal => {
  const pendingSections = new Set(proposal.pending.map(item => item.sectionId))
  const assignedSections = new Set(proposal.assignments.map(item => item.sectionId))
  let resourceConflicts = 0
  for (let i = 0; i < proposal.assignments.length; i++) {
    for (let j = i + 1; j < proposal.assignments.length; j++) {
      const a = proposal.assignments[i], b = proposal.assignments[j]
      if (a.day === b.day && a.startMinute < b.endMinute && b.startMinute < a.endMinute
        && (a.teacherId === b.teacherId || a.roomId === b.roomId)) resourceConflicts++
    }
  }
  return { status: proposal.status, requiredSessions: proposal.counts.requiredSessions,
    scheduledSessions: proposal.counts.scheduledSessions, pendingSessions: proposal.pending.length,
    totalSections: proposal.counts.sections,
    completeSections: proposal.sections.filter(s => assignedSections.has(s.sectionId) && !pendingSections.has(s.sectionId)).length,
    resourceConflicts }
}
page.on('pageerror', () => errors.push('uncaught browser exception'))
page.on('request', request => {
  if (request.method() !== 'POST') return
  const path = new URL(request.url()).pathname
  if (path.endsWith('/consejero')) requests.push({ kind: 'advisor', ids: request.postDataJSON().selectedRecommendationIds })
  if (path.endsWith('/propuestas')) {
    requests.push({ kind: 'generate' })
    generationInputs.push(request.postDataJSON())
  }
})
const check = (name, assertion) => { assertion(); checks.push({ name, passed: true }); console.log(`PASS ${name}`) }
const summary = body => ({ mode: body.source.mode, provider: body.source.providerLabel, fallbackReason: body.source.fallbackReason,
  recommendations: body.recommendations.length, narrativeCharacters: body.summary.length, simulated: Boolean(body.verifiedImpact) })
let failed = false
try {
  await page.goto(`${base.origin}/local/programacion-academica`, { waitUntil: 'networkidle' })
  await page.locator('#planning-page-title').waitFor()
  const original = await generate(page, true)
  const before = metrics(original)
  observations.push({ phase: 'initial-generation', metrics: before, courses: generationInputs[0].demands.length,
    period: generationInputs[0].planningPolicy?.period, revision: generationInputs[0].revision })
  check('initial-schedule-is-a-real-partial-proposal', () => {
    assert.ok(before.pendingSessions > 0)
    assert.equal(before.resourceConflicts, 0)
    assert.equal(original.assignments.length, before.scheduledSessions)
  })
  check('mount-does-not-consult', () => assert.equal(requests.filter(r => r.kind === 'advisor').length, 0))
  const pending = response(page, '/consejero')
  const started = performance.now()
  await page.getByRole('button', { name: 'Consultar consejero', exact: true }).click()
  const initial = await json(await pending)
  validateAcademicAdvisorResponse(initial)
  observations.push({ phase: 'consultation', ...summary(initial), latencyMs: Math.round(performance.now() - started) })
  check('initial-response-is-real-llm-assisted', () => assert.equal(initial.source.mode, 'llm-assisted', `Actual mode: ${initial.source.mode}; reason: ${initial.source.fallbackReason ?? 'none'}`))
  check('consultation-does-not-simulate', () => {
    assert.equal(initial.verifiedImpact, undefined)
    assert.equal(initial.reasoningSteps?.some(step => step.toolName === 'simulate_patches_cpsat') ?? false, false)
    assert.equal(requests.find(r => r.kind === 'advisor').ids, undefined)
  })
  const panel = page.getByRole('tabpanel', { name: 'Consejero', exact: true })
  await panel.locator('[data-advisor-impact=pending]').waitFor()
  const text = await panel.locator('.planning-chat__introduction').innerText()
  check('model-narrative-renders-in-ui', () => {
    assert.ok(text.length > 30)
    assert.ok(initial.summary.replace(/[#*_`]/g, '').split(/\s+/).filter(word => word.length > 5).some(word => text.includes(word)))
    assert.ok(!text.includes('Sin redacción del modelo'))
  })
  await page.screenshot({ path: resolve(evidence, 'llm-assisted-analysis.png') })
  const apply = panel.getByRole('button', { name: /^Aplicar \d+ seleccionad[ao]s? y regenerar$/ })
  const disabledBeforeSimulation = await apply.isDisabled()
  check('apply-disabled-before-simulation', () => {
    assert.ok(initial.recommendations.length)
    assert.equal(disabledBeforeSimulation, true)
  })
  const selectedIds = initial.recommendations.filter(r => r.recommendedByDefault && r.patch.kind !== 'increase_teacher_load').map(r => r.id)
  assert.ok(selectedIds.length > 0)
  const simulation = response(page, '/consejero')
  await panel.getByRole('button', { name: 'Simular selección actual', exact: true }).click()
  const simulated = await json(await simulation)
  validateAcademicAdvisorResponse(simulated)
  observations.push({ phase: 'simulation', ...summary(simulated), impact: simulated.verifiedImpact })
  check('simulation-is-llm-assisted-with-exact-selection', () => {
    assert.equal(simulated.source.mode, 'llm-assisted', `Actual mode: ${simulated.source.mode}; reason: ${simulated.source.fallbackReason ?? 'none'}`)
    assert.ok(simulated.verifiedImpact)
    assert.deepEqual([...simulated.verifiedImpact.recommendationIds].sort(), [...selectedIds].sort())
    assert.deepEqual(requests.filter(r => r.kind === 'advisor').at(-1).ids.sort(), [...selectedIds].sort())
  })
  await panel.locator('[data-advisor-impact=verified]').waitFor()
  assert.equal(await apply.isEnabled(), true)
  await page.screenshot({ path: resolve(evidence, 'llm-assisted-simulated.png') })
  const regeneration = response(page, '/propuestas')
  await apply.click()
  const regenerated = await json(await regeneration)
  await page.locator('#planning-chat-body').waitFor({ state: 'hidden' })
  const drafts = await json(await page.request.get(`${base.origin}${api}/borradores`))
  check('apply-regenerates-once-without-saving', () => {
    assert.equal(requests.filter(r => r.kind === 'generate').length, 2)
    assert.equal(drafts.items.length, 0)
    assert.notEqual(regenerated.proposalId, initial.proposalId)
  })
  const after = metrics(regenerated)
  const gains = { scheduledSessions: after.scheduledSessions - before.scheduledSessions,
    completeSections: after.completeSections - before.completeSections }
  observations.push({ phase: 'actual-regeneration', metrics: after, gains,
    policy: generationInputs[1].planningPolicy })
  check('actual-regeneration-improves-coverage-without-resource-conflicts', () => {
    assert.equal(after.requiredSessions, before.requiredSessions)
    assert.equal(after.resourceConflicts, 0)
    assert.equal(regenerated.assignments.length, after.scheduledSessions)
    assert.ok(gains.scheduledSessions > 0, 'The fixed synthetic window scenario must improve actual assigned sessions')
    assert.ok(gains.completeSections > 0, 'The fixed synthetic window scenario must improve actual complete sections')
    assert.equal(generationInputs[1].planningPolicy.allowAfternoon, true)
    assert.equal(generationInputs[1].planningPolicy.allowSaturday, true)
  })
  await page.screenshot({ path: resolve(evidence, 'llm-assisted-regenerated.png') })
  check('no-browser-exceptions', () => assert.deepEqual(errors, []))
} catch (error) {
  failed = true
  // Assertion text contains only our fixed labels, modes and safe reason enums.
  checks.push({ name: 'e2e-completion', passed: false, reason: error instanceof assert.AssertionError ? error.message.slice(0, 600) : 'Browser or HTTP scenario failed; inspect synthetic screenshot' })
  await page.screenshot({ path: resolve(evidence, 'llm-assisted-failed.png') }).catch(() => {})
  console.error(checks.at(-1).reason)
} finally {
  await browser.close()
  await writeFile(resolve(evidence, 'acceptance.json'), JSON.stringify({ source: 'Own synthetic React/NestJS/Python, public corpus, real Bedrock; no mocked provider or private snapshots', checks, observations, passed: !failed }, null, 2))
}
if (failed) process.exitCode = 1
