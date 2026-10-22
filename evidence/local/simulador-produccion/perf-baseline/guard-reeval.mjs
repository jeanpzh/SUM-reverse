// Re-evaluates the per-VU baseline runs offline with the per-vu guard model; testids are replaced, no identities are printed.
// Usage: node guard-reeval.mjs <results-dir> <gitSha-prefix> <path to load/check-generator-guard.mjs> > guard-reeval.json
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
const [dir, sha, guard] = process.argv.slice(2)
const read = f => { try { return JSON.parse(readFileSync(join(dir, f), 'utf8')) } catch { return null } }
const perVu = new Set(['race', 'ample', 'multi-uniform', 'multi-hotspot', 'fisi-franja', 'login'])
const rows = []
for (const file of readdirSync(dir).filter(f => /-result\.json$/.test(f))) {
  const r = read(file)
  if (!r || r.mode !== 'normal' || !perVu.has(r.scenario)) continue
  const meta = read(`run-meta-${r.testid}.json`)
  if (!meta || !String(meta.gitSha ?? '').startsWith(sha)) continue
  const args = [guard, '--resources', join(dir, `resources-${r.testid}.csv`), '--summary', join(dir, `${r.scenario}-${r.testid}-summary.json`), '--connection-model', 'per-vu']
  const log = join(dir, `${r.scenario}-${r.testid}.log`)
  if (existsSync(log)) args.push('--log', log)
  const out = spawnSync(process.execPath, args, { encoding: 'utf8' })
  const g = JSON.parse(out.stdout)
  const s = read(`${r.scenario}-${r.testid}-summary.json`)
  const p95 = n => { const m = s?.metrics?.[n]; return m ? Math.round((m.values ?? m)['p(95)']) : null }
  rows.push({ scenario: r.scenario, rep: meta.rep, startedAtMs: r.startedAtMs, oldValid: r.runValid, oldCodes: (r.generatorGuard?.reasons ?? []).map(x => x.split(':')[0]), newValid: g.valid, newReasons: g.reasons.map(x => x.replace(/sum-load-[0-9a-f-]+/g, 'sum-load-<testid>')), blockedP95: p95('http_req_blocked'), durationP95: p95('http_req_duration'), correctness: r.correctnessPassed, performance: r.performancePassed })
}
rows.sort((a, b) => a.startedAtMs - b.startedAtMs)
for (const r of rows) delete r.startedAtMs
console.log(JSON.stringify({
  source: 'aggregate rows of commit c29b9d5 re-evaluated offline with load/check-generator-guard.mjs --connection-model per-vu (PR #20, commit d4b4a7f); same resources CSV, summary-export and k6 log as the original guard',
  status: 'local-only',
  evaluatedAt: '2026-10-22',
  rule: 'per-vu: http_req_connecting ignored; http_req_blocked p95 must not exceed max(50 ms, 10% of the http_req_duration p95); other rules unchanged',
  runs: rows,
}, null, 2))
