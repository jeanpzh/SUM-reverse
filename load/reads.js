import http from 'k6/http'
import { check, fail } from 'k6'
import { Counter, Rate } from 'k6/metrics'
import { runtimeConfig, loginAndSession } from './common.js'

const unexpected = new Rate('unexpected_read_errors')
const completed = new Counter('read_iterations_completed')
const target = Number(__ENV.RATE || 50)
const duration = __ENV.DURATION || '2m'
const ramp10 = __ENV.RAMP_10_DURATION || '30s'
const ramp25 = __ENV.RAMP_25_DURATION || '30s'
const config = runtimeConfig()

export const options = {
  noCookiesReset: true,
  systemTags: ['status', 'method', 'scenario', 'name', 'group', 'check', 'expected_response'],
  scenarios: {
    reads: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: Math.min(config.manifest.actors.length, Math.max(20, target)),
      maxVUs: Math.min(config.manifest.actors.length, Math.max(100, target * 3)),
      stages: [
        { target: 10, duration: ramp10 },
        { target: 25, duration: ramp25 },
        { target, duration },
      ],
      exec: 'readIteration',
    },
  },
  thresholds: {
    checks: ['rate==1'],
    dropped_iterations: ['count==0'],
    unexpected_read_errors: ['rate<0.01'],
    read_iterations_completed: ['count>0'],
    'http_req_duration{operation:read}': [`p(95)<${Number(__ENV.READ_P95_MS || 2000)}`, `p(99)<${Number(__ENV.READ_P99_MS || 5000)}`],
  },
}

let identity
export function readIteration() {
  try {
  if (!identity) {
    const actor = config.manifest.actors[(__VU - 1) % config.manifest.actors.length]
    identity = loginAndSession(config, actor)
    if (!identity) { unexpected.add(1); return }
  }
  const actor = config.manifest.actors[(__VU - 1) % config.manifest.actors.length]
  const context = http.get(`${config.base}/api/local/matricula-regular/v1/contextos/${encodeURIComponent(actor.actorId)}`, { tags: { operation: 'read', resource: 'context', name: 'context' } })
  const contextOk = check(context, { 'context read succeeds': (r) => r.status === 200 && r.json('data.actorId') === actor.actorId })
  unexpected.add(!contextOk)
  const dashboard = http.get(`${config.base}/api/local/perfiles/v1/consultas/programacion?runId=${encodeURIComponent(config.manifest.runId)}&actorId=${encodeURIComponent(actor.actorId)}&sessionId=${encodeURIComponent(identity.sessionId)}`, { tags: { operation: 'read', resource: 'dashboard', name: 'dashboard' } })
  const dashboardOk = check(dashboard, { 'dashboard read succeeds': (r) => r.status === 200 && r.json('data.key') === 'programacion' && r.json('data.actorId') === actor.actorId })
  unexpected.add(!dashboardOk)
  if (!contextOk || !dashboardOk) fail('Read iteration failed; inspect aggregate HTTP metrics without logging identity data')
  completed.add(1)
  } catch (error) {
    unexpected.add(1)
    throw error
  }
}

export default function () { readIteration() }
