import http from 'k6/http'
import { check } from 'k6'
import { Counter, Trend } from 'k6/metrics'
import { runtimeConfig, loginAndSession, requestTags, safeJson } from './common.js'

const config = runtimeConfig()
const actors = config.manifest.actors
const completed = new Counter('login_iterations_completed')
const unexpected = new Counter('login_unexpected')
const startOffset = new Trend('login_start_offset_ms')
const startWindowMs = Number(__ENV.LOGIN_WINDOW_MS || 5000)

export const options = {
  noCookiesReset: true,
  systemTags: ['status', 'method', 'scenario', 'name', 'group', 'check', 'expected_response'],
  scenarios: { login_wave: { executor: 'per-vu-iterations', vus: actors.length, iterations: 1, maxDuration: __ENV.MAX_DURATION || '30s', exec: 'loginOnce' } },
  thresholds: {
    checks: ['rate==1'],
    dropped_iterations: ['count==0'],
    login_iterations_completed: [`count==${actors.length}`],
    login_unexpected: ['count==0'],
    login_start_offset_ms: [`max<${startWindowMs}`],
    'http_req_duration{name:auth-login}': [`p(95)<${Number(__ENV.LOGIN_P95_MS || 2000)}`, `p(99)<${Number(__ENV.LOGIN_P99_MS || 5000)}`],
  },
}

export function setup() {
  return { startedAt: Date.now() }
}

export function loginOnce(start) {
  const actor = actors[__VU - 1]
  if (!actor) { unexpected.add(1); return }
  startOffset.add(Date.now() - start.startedAt)
  const identity = loginAndSession(config, actor, 'login')
  if (!identity) { unexpected.add(1); return }
  const context = http.get(`${config.base}/api/local/matricula-regular/v1/contextos/${encodeURIComponent(actor.actorId)}`, { tags: requestTags(config, 'login', 'read', 'context') })
  const body = safeJson(context)
  const contextOk = check(context, { 'login actor context is available': () => context.status === 200 && body?.data?.actorId === actor.actorId })
  if (!contextOk) { unexpected.add(1); return }
  completed.add(1)
}

export default function (start) { loginOnce(start) }
