// New root-owned stack only. Remote boundaries may be delayed/failed explicitly.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { chatScenarios } from './planning-assistant/chat-scenarios.mjs'
import { advisorScenarios } from './planning-assistant/advisor-scenarios.mjs'

if (process.env.SUM_REDESIGN_SYNTHETIC !== '1') throw new Error('Own synthetic stack required')
const base = new URL(process.env.SUM_REDESIGN_BASE || 'http://127.0.0.1:5746')
if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' || base.pathname !== '/' || base.username || base.password || base.search || base.hash) throw new Error('Dedicated loopback origin required')
const evidence = resolve(process.env.SUM_REDESIGN_EVIDENCE || '../evidence/local/planning-assistant-e2e-2026-11-10')
await mkdir(evidence, { recursive: true })
const browser = await chromium.launch()
const results = []
try {
  const selected = process.env.SUM_ASSISTANT_CASES?.split(',').filter(Boolean)
  for (const [name, scenario] of [...chatScenarios, ...advisorScenarios]) {
    if (selected?.length && !selected.includes(name)) continue
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage()
    const errors = []
    page.setDefaultTimeout(12000)
    page.setDefaultNavigationTimeout(45000)
    page.on('pageerror', error => errors.push(error.message))
    try {
      await page.goto(`${base.origin}/local/programacion-academica`, { waitUntil: 'networkidle' })
      await page.locator('#planning-page-title').waitFor({ timeout: 45000 })
      await scenario({ page, base: base.origin })
      assert.deepEqual(errors, [])
      results.push({ name, passed: true })
      console.log(`PASS ${name}`)
    } catch (error) {
      results.push({ name, passed: false, error: error.message.slice(0, 1800), pageErrors: errors })
      await page.screenshot({ path: resolve(evidence, `${name}.png`), fullPage: false })
      console.log(`FAIL ${name}: ${error.message.slice(0, 300)}`)
    } finally { await context.close() }
  }
} finally {
  await browser.close()
  await writeFile(resolve(evidence, 'acceptance.json'), JSON.stringify({
    source: 'Own synthetic React/NestJS/Python stack, public corpus, LLM disabled; declared transport failure/delay injections',
    base: base.origin, results,
  }, null, 2))
}
if (!results.length) throw new Error('No E2E scenarios selected')
console.log(`${results.filter(result => result.passed).length}/${results.length} passed`)
if (results.some(result => !result.passed)) process.exitCode = 1
