import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Pool } from 'pg'
import type { MatriculaRegularSubmission } from '../../shared/matricula-regular.mjs'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'
import type { EnrollmentProfile } from '../src/matricula-regular/profile.types.js'
import { parseSubmissionRequest } from '../src/matricula-regular/dto/submission.dto.js'
import { PostgresEnrollmentStore } from '../src/persistence/postgres-enrollment.store.js'
import { createSimulatorPool } from '../src/persistence/postgres.js'
import { StoreMetrics } from '../src/persistence/store-metrics.js'
import { applyVariants, replayIndexes } from './bench-variants.js'
import { assertSyntheticDatabase } from './synthetic-database.js'
import { createSyntheticLoadProfile, parseActorCount, resolveScenarioProfile } from './synthetic-load-profile.js'
import type { Choice, ScenarioProfile, SyntheticLoadProfile } from './synthetic-load-profile.js'

export type BenchOptions = { actors: number; profile: ScenarioProfile; budgetMs: number; pools: number; poolMax: number; cohorts: number; catalogSections?: number; replayRatio: number; out?: string }
export type Verdict = { status: 'green' | 'perf-red' | 'integrity-red'; exitCode: 0 | 1 | 2; reasons: string[] }

const SLO_P95_MS = 2000
const SLO_QUANTILE = 0.95
const benchProfiles = ['shared', 'ample', 'multi-uniform', 'multi-hotspot', 'distributed']
const flags = ['--actors', '--profile', '--budget-ms', '--pools', '--pool-max', '--cohorts', '--catalog-sections', '--replay-ratio', '--out']
const usage = 'Usage: bench-submit --actors <int, same range as SIMULATOR_ACTOR_COUNT> --profile <shared|ample|multi-uniform|multi-hotspot|distributed> [--budget-ms <int>] [--pools <1..4>] [--pool-max <int>] [--cohorts <int, shared profile only>] [--catalog-sections <int, distributed profile only>] [--replay-ratio <0..1, ample profile only>] [--out <path>]'

function integerOption(name: string, value: string | undefined, min: number, max: number): number {
  const parsed = value !== undefined && /^\d+$/.test(value) ? Number(value) : NaN
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new Error(`${name} must be an integer from ${min} to ${max}`)
  return parsed
}

function ratioOption(name: string, value: string | undefined): number {
  if (value === undefined || !/^(?:[01]|0?\.\d{1,6}|[01]\.0{1,6})$/.test(value)) throw new Error(`${name} must be a decimal from 0 to 1 (at most 6 decimals)`)
  return Number(value)
}

export function parseBenchArgs(argv: string[]): BenchOptions {
  const values = new Map<string, string>()
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]!
    if (!flags.includes(flag)) throw new Error(`Unknown option ${flag}`)
    const value = argv[index + 1]
    if (value === undefined || value.startsWith('--')) throw new Error(`${flag} requires a value`)
    if (values.has(flag)) throw new Error(`${flag} was given more than once`)
    values.set(flag, value)
  }
  const profile = values.get('--profile') ?? 'shared'
  if (profile === 'last-seat') throw new Error(`Profile last-seat is not supported by bench-submit (it needs auxiliary enrollments); use one of: ${benchProfiles.join(', ')}`)
  if (!benchProfiles.includes(profile)) throw new Error(`--profile must be one of: ${benchProfiles.join(', ')}`)
  const actors = parseActorCount(values.get('--actors'))
  const cohorts = values.has('--cohorts') ? integerOption('--cohorts', values.get('--cohorts'), 1, 2000) : 1
  if (cohorts > 1 && profile !== 'shared') throw new Error('--cohorts above 1 requires --profile shared')
  if (cohorts > actors) throw new Error('--cohorts must not exceed --actors')
  const catalogSections = values.has('--catalog-sections') ? integerOption('--catalog-sections', values.get('--catalog-sections'), 1, 2000) : undefined
  if (catalogSections !== undefined && profile !== 'distributed') throw new Error('--catalog-sections requires --profile distributed')
  const replayRatio = values.has('--replay-ratio') ? ratioOption('--replay-ratio', values.get('--replay-ratio')) : 0
  if (replayRatio > 0 && profile !== 'ample') throw new Error('--replay-ratio above 0 requires --profile ample')
  return {
    actors,
    profile: resolveScenarioProfile(profile, undefined).scenarioProfile,
    budgetMs: values.has('--budget-ms') ? integerOption('--budget-ms', values.get('--budget-ms'), 1, 3_600_000) : 2000,
    pools: values.has('--pools') ? integerOption('--pools', values.get('--pools'), 1, 4) : 2,
    poolMax: values.has('--pool-max') ? integerOption('--pool-max', values.get('--pool-max'), 1, 200) : 12,
    cohorts,
    ...(catalogSections !== undefined ? { catalogSections } : {}),
    replayRatio,
    ...(values.has('--out') ? { out: values.get('--out')! } : {}),
  }
}

export function percentile(sorted: number[], quantile: number): number {
  if (sorted.length === 0) return 0
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(quantile * sorted.length) - 1))]!
}

const round = (value: number) => Math.round(value * 100) / 100

export function latencyStats(latencies: number[]) {
  const sorted = [...latencies].sort((a, b) => a - b)
  return { p50: round(percentile(sorted, 0.5)), p95: round(percentile(sorted, 0.95)), p99: round(percentile(sorted, 0.99)), max: round(sorted.at(-1) ?? 0) }
}

const selectionKey = (selection: Choice[]) => selection.map((choice) => `${choice.courseId}:${choice.sectionId}`).sort().join('|')

export function hotCohortSize(selections: Choice[][]): number {
  const counts = new Map<string, number>()
  for (const selection of selections) counts.set(selectionKey(selection), (counts.get(selectionKey(selection)) ?? 0) + 1)
  return Math.max(0, ...counts.values())
}

export const budgetCriticalSectionMs = (hotCohort: number) => hotCohort > 0 ? SLO_P95_MS / (SLO_QUANTILE * hotCohort) : 0

export function decideVerdict(input: { p95Ms: number; budgetMs: number; estimatedCriticalSectionMs: number; budgetCriticalSectionMs: number; auditPassed: boolean; errors?: number }): Verdict {
  if (!input.auditPassed) return { status: 'integrity-red', exitCode: 2, reasons: ['audit failed or did not run'] }
  const reasons: string[] = []
  if (input.errors) reasons.push(`${input.errors} submits failed with storage errors`)
  if (input.p95Ms > input.budgetMs) reasons.push(`p95 ${input.p95Ms}ms > budget ${input.budgetMs}ms`)
  if (input.estimatedCriticalSectionMs > input.budgetCriticalSectionMs) reasons.push(`estimated critical section ${round(input.estimatedCriticalSectionMs)}ms > budget ${round(input.budgetCriticalSectionMs)}ms`)
  return reasons.length ? { status: 'perf-red', exitCode: 1, reasons } : { status: 'green', exitCode: 0, reasons }
}

function selectionFor(load: SyntheticLoadProfile, actorId: string): Choice[] {
  const selection = load.actorSelections.get(actorId) ?? load.selection
  if (!selection) throw new Error(`No selection for actor ${actorId}`)
  return selection
}

async function seedCampaign(pool: Pool, campaignId: string, runId: string, profiles: EnrollmentProfile[], load: SyntheticLoadProfile) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("INSERT INTO simulator_campaigns(campaign_id,run_id,status,config) VALUES($1,$2,'open',$3)", [campaignId, runId, JSON.stringify({ profiles, offer: load.offer })])
    for (const profile of profiles) await client.query('INSERT INTO simulator_profiles(campaign_id,profile_revision,profile) VALUES($1,$2,$3)', [campaignId, profile.profileRevision, JSON.stringify(profile)])
    for (const actor of load.actors) await client.query('INSERT INTO simulator_actors(campaign_id,actor_id,profile) VALUES($1,$2,$3)', [campaignId, actor.actorId, JSON.stringify(actor)])
    for (const course of load.offer) for (const section of course.sections) {
      const { sections: _sections, ...courseData } = course
      await client.query('INSERT INTO simulator_sections(campaign_id,course_id,section_id,capacity,occupied,course,section) VALUES($1,$2,$3,$4,$5,$6,$7)', [campaignId, course.courseId, section.sectionId, section.capacity, section.occupied, JSON.stringify(courseData), JSON.stringify({ schedule: section.schedule, label: section.label, teacher: section.teacher, room: section.room })])
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

function runAudit(env: NodeJS.ProcessEnv): Promise<{ passed: boolean; report: unknown }> {
  const script = fileURLToPath(new URL('./audit-simulator.js', import.meta.url))
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script], { env, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    child.on('error', (error) => resolve({ passed: false, report: { error: error.message } }))
    child.on('close', (code) => {
      try {
        const report = JSON.parse(stdout) as { passed?: boolean }
        resolve({ passed: code === 0 && report.passed === true, report })
      } catch {
        resolve({ passed: false, report: { exitCode: code, error: stderr.trim().split('\n').slice(-3).join(' | ') || 'audit produced no JSON' } })
      }
    })
  })
}

async function run(options: BenchOptions): Promise<Verdict> {
  assertSyntheticDatabase(process.env.DATABASE_URL)
  process.env.SIMULATOR_DB_POOL_MAX = String(options.poolMax)
  const pools = Array.from({ length: options.pools }, () => createSimulatorPool())
  // Session creation and replay warm-up use private collectors so that `phases` only reflects the measured submits.
  const prepStores = pools.map((pool) => new PostgresEnrollmentStore(pool, new StoreMetrics()))
  const metrics = new StoreMetrics()
  const stores = pools.map((pool) => new PostgresEnrollmentStore(pool, metrics))
  let seeded: string | undefined
  let finished = false
  try {
    const campaignId = randomUUID()
    const runId = randomUUID()
    const fixture = createSyntheticFixture('SISTEMAS')
    const now = Date.now()
    const profiles: EnrollmentProfile[] = [structuredClone(fixture.profile)]
    profiles[0]!.calendar.effectiveWindows = [{
      id: 'SYN-CAMPAIGN-WINDOW',
      startsAt: new Date(now - 60_000).toISOString(),
      endsAt: new Date(now + 4 * 60 * 60_000).toISOString(),
      minPp: 0,
      origin: 'synthetic',
      sourceIds: ['SYN-FIXTURE'],
    }]
    const load = applyVariants(createSyntheticLoadProfile(options.actors, options.profile, fixture.actors, fixture.offer), options)
    await seedCampaign(pools[0]!, campaignId, runId, profiles, load)
    seeded = campaignId

    const prepared: { store: PostgresEnrollmentStore; prepStore: PostgresEnrollmentStore; principal: { campaignId: string; runId: string; actorId: string }; request: MatriculaRegularSubmission }[] = []
    for (let start = 0; start < load.actors.length; start += 50) {
      prepared.push(...await Promise.all(load.actors.slice(start, start + 50).map(async (actor, offset) => {
        const store = stores[(start + offset) % stores.length]!
        const prepStore = prepStores[(start + offset) % stores.length]!
        const principal = { campaignId, runId, actorId: actor.actorId }
        const session = await prepStore.createAcademicSession(principal) as { data: { sessionId: string } }
        const request = parseSubmissionRequest({
          actorId: actor.actorId,
          runId,
          sessionId: session.data.sessionId,
          requestId: randomUUID(),
          profileRevision: profiles[0]!.profileRevision,
          selection: [...selectionFor(load, actor.actorId)].sort((a, b) => a.courseId.localeCompare(b.courseId) || a.sectionId.localeCompare(b.sectionId)),
        })
        return { store, prepStore, principal, request }
      })))
    }

    // E11: process the replay candidates once before the barrier; the measured submit repeats the same (actorId, requestId) and payload.
    const replaySet = replayIndexes(prepared.length, options.replayRatio)
    for (let start = 0; start < prepared.length; start += 50) {
      await Promise.all(prepared.slice(start, start + 50).map(async ({ prepStore, principal, request }, offset) => {
        if (!replaySet.has(start + offset)) return
        const outcome = await prepStore.submit(principal, request)
        if (outcome.data.state !== 'accepted') throw new Error('Replay warm-up submit was not accepted')
      }))
    }

    const startedAt = performance.now()
    const results = await Promise.all(prepared.map(async ({ store, principal, request }) => {
      const begin = performance.now()
      try {
        const outcome = await store.submit(principal, request)
        return { ms: performance.now() - begin, end: performance.now(), state: outcome.data.state as string, error: undefined as string | undefined }
      } catch (error) {
        return { ms: performance.now() - begin, end: performance.now(), state: 'error', error: (error as { code?: string }).code ?? (error as Error).message }
      }
    }))
    const drainMs = Math.max(...results.map((result) => result.end)) - startedAt
    const accepted = results.filter((result) => result.state === 'accepted').length
    const errors = new Map<string, number>()
    for (const result of results) if (result.error) errors.set(result.error, (errors.get(result.error) ?? 0) + 1)
    const errorCount = [...errors.values()].reduce((total, count) => total + count, 0)
    const hotCohort = hotCohortSize(load.actors.map((actor) => selectionFor(load, actor.actorId)))
    const stats = latencyStats(results.map((result) => result.ms))

    const audit = await runAudit({
      ...process.env,
      SIMULATOR_CAMPAIGN_ID: campaignId,
      SIMULATOR_CLOSE_CAMPAIGN: '1',
      EXPECTED_ENROLLMENTS: String(load.expectedAccepted + load.initialEnrollments),
      EXPECTED_REQUESTS: String(load.actorCount + load.initialRequests),
    })
    // A failed audit leaves the campaign open; close it without deleting evidence.
    if (!audit.passed) await stores[0]!.closeCampaign(campaignId).catch(() => undefined)

    const estimated = drainMs / hotCohort
    const budget = budgetCriticalSectionMs(hotCohort)
    const verdict = decideVerdict({ p95Ms: stats.p95, budgetMs: options.budgetMs, estimatedCriticalSectionMs: estimated, budgetCriticalSectionMs: budget, auditPassed: audit.passed, errors: errorCount })
    const json = `${JSON.stringify({
      profile: options.profile,
      actors: options.actors,
      pools: options.pools,
      poolMax: options.poolMax,
      cohorts: options.cohorts,
      catalogSections: options.catalogSections ?? null,
      replayRatio: options.replayRatio,
      replays: replaySet.size,
      budgetMs: options.budgetMs,
      campaignId,
      latencyMs: stats,
      drainMs: round(drainMs),
      submitsPerSecond: round(options.actors / (drainMs / 1000)),
      accepted,
      rejected: results.length - accepted - errorCount,
      errors: errorCount,
      errorCodes: Object.fromEntries(errors),
      expectedAccepted: load.expectedAccepted,
      hotCohortSize: hotCohort,
      estimatedCriticalSectionMs: round(estimated),
      budgetCriticalSectionMs: round(budget),
      audit: audit.report,
      verdict,
      phases: metrics.snapshot(),
    }, null, 2)}\n`
    process.stdout.write(json)
    if (options.out) await writeFile(options.out, json)
    finished = true
    return verdict
  } finally {
    if (seeded && !finished) await stores[0]!.closeCampaign(seeded).catch(() => undefined)
    await Promise.all(pools.map((pool) => pool.end().catch(() => undefined)))
  }
}

async function main() {
  let options: BenchOptions
  try { options = parseBenchArgs(process.argv.slice(2)) } catch (error) {
    process.stderr.write(`${(error as Error).message}\n${usage}\n`)
    process.exitCode = 2
    return
  }
  try { process.exitCode = (await run(options)).exitCode } catch (error) {
    process.stderr.write(`bench-submit failed: ${(error as Error).message}\n`)
    process.exitCode = 2
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
