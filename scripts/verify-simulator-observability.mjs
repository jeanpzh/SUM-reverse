// Root acceptance: query the owned Grafana proxy and verify its real dashboard.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '../client/node_modules/playwright/index.mjs'

const base = process.env.OBSERVABILITY_URL ?? 'http://127.0.0.1:5190'
assert.equal(new URL(base).origin, 'http://127.0.0.1:5190', 'Only the dedicated loopback Grafana is authorized')
const testid = process.env.OBSERVABILITY_TEST_ID
assert.match(testid ?? '', /^[A-Za-z0-9_-]{1,120}$/)
const output = resolve(process.env.OBSERVABILITY_TEST_OUTPUT ?? 'evidence/local/simulador-produccion/observability')
await mkdir(output, { recursive: true })
const proxy = `${base}/api/datasources/proxy/uid/simulator-prometheus`
async function json(path) {
  const response = await fetch(path, { signal: AbortSignal.timeout(10000) })
  assert.equal(response.status, 200, new URL(path).pathname)
  return response.json()
}
async function query(expression) {
  const result = await json(`${proxy}/api/v1/query?query=${encodeURIComponent(expression)}`)
  assert.equal(result.status, 'success')
  return result.data.result
}
const provisioned = await json(`${base}/api/dashboards/uid/sum-simulator-k6`)
const dashboard = provisioned.dashboard
assert.equal(provisioned.meta.canEdit, false, 'Anonymous dashboard access must be Viewer')
assert.equal(provisioned.meta.provisioned, true)
assert.equal(dashboard.uid, 'sum-simulator-k6')
assert.ok(dashboard.templating.list.some((variable) => variable.name === 'testid'))
assert.ok(dashboard.panels.length >= 8)
const expected = { accepted: Number(process.env.EXPECTED_ACCEPTED ?? 10), sectionFull: Number(process.env.EXPECTED_SECTION_FULL ?? 90), completed: 100 }
const expressions = {
  accepted: `sum(max_over_time(k6_enrollments_accepted_total{testid="${testid}"}[24h]))`,
  sectionFull: `sum(max_over_time(k6_enrollments_section_full_total{testid="${testid}"}[24h]))`,
  completed: `sum(max_over_time(k6_enrollment_iterations_completed_total{testid="${testid}"}[24h]))`,
  unexpected: `sum(max_over_time(k6_enrollments_unexpected_total{testid="${testid}"}[24h])) or vector(0)`,
}
const values = {}
for (const [key, expression] of Object.entries(expressions)) {
  const result = await query(expression)
  assert.equal(result.length, 1, key)
  values[key] = Number(result[0].value[1])
  assert.equal(values[key], key === 'unexpected' ? 0 : expected[key], key)
}
const series = await json(`${proxy}/api/v1/series?match[]=${encodeURIComponent(`{testid="${testid}"}`)}`)
assert.ok(series.data.length > 0)
const latency = await query(`1000 * last_over_time(k6_http_req_duration_p95{testid="${testid}",operation="submit"}[24h])`)
assert.ok(latency.length > 0, 'Submission latency series must actually exist')
const submissionP95Ms = Number(latency[0].value[1])
assert.ok(submissionP95Ms > 0 && submissionP95Ms < 10000)
const deniedLabels = ['actorId', 'actor_id', 'sessionId', 'credential', 'campaignId', 'url']
for (const labels of series.data) {
  for (const key of deniedLabels) assert.equal(Object.hasOwn(labels, key), false, `Unexpected identity label: ${key}`)
  assert.ok(!/SYN-|credential=|sessionId=|actorId=/.test(labels.name ?? ''), 'HTTP names must be static')
}
let panelQueriesChecked = 0
for (const panel of dashboard.panels) {
  for (const target of panel.targets ?? []) {
    if (!target.expr) continue
    const expression = target.expr
      .replace(/\$\{testid(?::regex)?\}|\$testid\b/g, testid)
      .replace(/\$__rate_interval\b/g, '1m')
      .replace(/\$__range\b/g, '24h')
      .replace(/\$__interval\b/g, '5s')
    assert.ok(!expression.includes('$'), 'Panel query still contains an unresolved variable')
    await query(expression)
    panelQueriesChecked++
  }
}
assert.ok(panelQueriesChecked >= 8)
if (process.env.OBSERVABILITY_SKIP_BROWSER !== '1') {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1536, height: 1000 } })
  const forbidden = []
  const errors = []
  const dataErrors = []
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== base) {
      forbidden.push(url.origin)
      await route.abort()
    } else await route.continue()
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('response', async (response) => {
    if (response.url().includes('/api/ds/query')) {
      if (!response.ok()) dataErrors.push(`datasource HTTP${response.status()}`)
      else {
        const payload = await response.json().catch(() => ({}))
        for (const item of Object.values(payload.results ?? {})) if (item.error) dataErrors.push(item.error)
      }
    }
  })
  try {
    await page.goto(`${base}/d/sum-simulator-k6?orgId=1&var-testid=${encodeURIComponent(testid)}&from=now-1h&to=now&refresh=5s`)
    await page.getByRole('main').waitFor({ timeout: 30000 })
    await page.waitForFunction(() => document.querySelectorAll('canvas').length > 0, { timeout: 30000 })
    // Allow panel datasource responses to finish before checking or capturing them.
    await page.waitForTimeout(2000)
    assert.deepEqual(forbidden, [])
    assert.deepEqual(errors, [])
    assert.deepEqual(dataErrors, [])
    const visibleText = await page.locator('body').innerText()
    assert.ok(!visibleText.includes('Dashboard not found'))
    assert.match(visibleText, /Accepted/)
    assert.match(visibleText, /Section full/)
    assert.match(visibleText, /\b10\b/)
    assert.match(visibleText, /\b90\b/)
    await page.screenshot({ path: resolve(output, 'grafana-dashboard.png'), fullPage: true })
    await writeFile(resolve(output, 'browser-result.json'), JSON.stringify({ passed: true, testid, externalRequests: 0, pageErrors: errors, datasourceErrors: dataErrors, viewport: { width: 1536, height: 1000 } }, null, 2))
  } finally {
    await context.close()
    await browser.close()
  }
}
await writeFile(resolve(output, process.env.OBSERVABILITY_SKIP_BROWSER === '1' ? 'persistence-result.json' : 'metrics-result.json'), JSON.stringify({ passed: true, testid, values, submissionP95Ms, seriesCount: series.data.length, noIdentityLabels: true, dashboardUid: dashboard.uid, panelQueriesChecked }, null, 2))
console.log('PASS: Grafana → Prometheus → actual k6 metrics; exact100 completed10 accepted90 full0 unexpected; no identity labels')
