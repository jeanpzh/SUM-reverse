import http from 'k6/http'
import { check, sleep } from 'k6'
import { Counter } from 'k6/metrics'
import { runtimeConfig, loginAndSession, maintainSession, requestTags, safeJson } from './common.js'

const config = runtimeConfig()
const actors = config.manifest.actors
const stageDuration = __ENV.STAGE_DURATION || '30s'
const duration = __ENV.DURATION || '10m'
const minThink = Number(__ENV.THINK_MIN_SECONDS || 1)
const maxThink = Number(__ENV.THINK_MAX_SECONDS || 3)
const mode = __ENV.LOAD_MODE || (__ENV.SCENARIO_QUICK === '1' ? 'quick' : 'soak')
const ready = new Counter('sessions_ready')
const completed = new Counter('sessions_iterations_completed')
const unexpected = new Counter('sessions_unexpected')
const reads = new Counter('sessions_reads')
if (!Number.isFinite(minThink) || !Number.isFinite(maxThink) || minThink < 0 || maxThink < minThink) throw new Error('THINK_MIN_SECONDS and THINK_MAX_SECONDS must be valid nonnegative bounds')

export const options = {
  noCookiesReset: true,
  systemTags: ['status', 'method', 'scenario', 'name', 'group', 'check', 'expected_response'],
  tags: { load_mode: mode },
  scenarios: {
    session_steps: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { target: Math.min(50, actors.length), duration: stageDuration },
        { target: Math.min(100, actors.length), duration: stageDuration },
        { target: Math.min(200, actors.length), duration: stageDuration },
        { target: Math.min(400, actors.length), duration: stageDuration },
        { target: Math.min(400, actors.length), duration },
      ],
      gracefulRampDown: '10s',
      exec: 'sessionIteration',
    },
  },
  thresholds: {
    checks: ['rate==1'],
    dropped_iterations: ['count==0'],
    sessions_ready: [`count==${actors.length}`],
    sessions_iterations_completed: ['count>0'],
    sessions_reads: ['count>0'],
    sessions_unexpected: ['count==0'],
    'http_req_duration{operation:read}': [`p(95)<${Number(__ENV.READ_P95_MS || 2000)}`, `p(99)<${Number(__ENV.READ_P99_MS || 5000)}`],
  },
}

let identity
let announcedReady = false

export function sessionIteration() {
  const actor = actors[__VU - 1]
  if (!actor) { unexpected.add(1); return }
  if (!identity) {
    identity = loginAndSession(config, actor, 'sessions')
    if (!identity) { unexpected.add(1); return }
    if (!announcedReady) { ready.add(1); announcedReady = true }
  }
  if (!maintainSession(config, actor, identity, 'sessions')) { unexpected.add(1); return }
  sleep(minThink + Math.random() * (maxThink - minThink))
  const dashboardUrl = `${config.base}/api/local/perfiles/v1/consultas/programacion?runId=${encodeURIComponent(config.manifest.runId)}&actorId=${encodeURIComponent(actor.actorId)}&sessionId=${encodeURIComponent(identity.sessionId)}`
  const dashboard = http.get(dashboardUrl, { tags: requestTags(config, 'sessions', 'read', 'dashboard') })
  const body = safeJson(dashboard)
  const ok = check(dashboard, { 'session dashboard remains available': () => dashboard.status === 200 && body?.data?.actorId === actor.actorId && body.data.key === 'programacion' })
  if (!ok) { unexpected.add(1); return }
  reads.add(1)
  completed.add(1)
}

export default function () { sessionIteration() }
