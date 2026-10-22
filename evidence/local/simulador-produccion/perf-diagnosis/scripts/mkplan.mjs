// Builds the P1-06 plan: blocks with a sentinel race-400 (pool 12, default config) and cyclic variant order per repetition.
const lines = []
const rot = (arr, r) => arr.map((_, i) => arr[(i + r) % arr.length])
const sentinel = (block) => lines.push(`sent-${block} k6 race 400`)
const PIN = 'PERF_CPUSET_K6=0 PERF_CPUSET_POSTGRES=1 PERF_CPUSET_API_A=1 PERF_CPUSET_API_B=1 PERF_CPUSET_WEB=1'
const E14 = 'PERF_COMPOSE_FILE=compose.simulator.yaml:compose.perf.yaml:' + process.argv[2]
// A: E1 (race 100/200/400), attribution (ample 400), E6 (multi-uniform 400); E3/H11 are by-products.
sentinel('a')
const a = [['e1-race-100', 'race 100'], ['e1-race-200', 'race 200'], ['e1-race-400', 'race 400'], ['attr-ample-400', 'ample 400'], ['e6-multiuniform-400', 'multi-uniform 400']]
for (let r = 0; r < 3; r++) for (const [l, s] of rot(a, r)) lines.push(`${l}-r${r + 1} k6 ${s}`)
// B: E4 pinned vs unpinned, ABBA.
sentinel('b')
for (const [l, env] of [['e4-pin-r1', PIN], ['e4-base-r1', ''], ['e4-base-r2', ''], ['e4-pin-r2', PIN], ['e4-pin-r3', PIN], ['e4-base-r3', '']]) lines.push(`${l} k6 race 400 ${env}`.trim())
// C: E5 pool 6/12/24/40 x race and multi-hotspot (max_connections 100 rules out 48 with two replicas).
sentinel('c')
const pools = [6, 12, 24, 40]
for (let r = 0; r < 3; r++) for (const p of rot(pools, r)) {
  lines.push(`e5-race-p${p}-r${r + 1} k6 race 400 SIMULATOR_DB_POOL_MAX=${p}`)
  lines.push(`e5-hotspot-p${p}-r${r + 1} k6 multi-hotspot 400 SIMULATOR_DB_POOL_MAX=${p}`)
}
// D: E8 reads open sweep (ENV-H, marked), fixed rate after 5 s ramps.
sentinel('d')
const rates = [25, 50, 100, 150, 200, 300]
for (let r = 0; r < 3; r++) for (const q of rot(rates, r * 2)) lines.push(`e8-reads-${q}-r${r + 1} reads ${q} 60s`)
// E: E12 login 400, E13 exporter stopped vs on (ABBA), E14 race 1 vs 2 APIs (ABBA).
sentinel('e')
for (let r = 1; r <= 3; r++) lines.push(`e12-login-400-r${r} k6 login 400`)
for (const [l, env] of [['e13-off-r1', 'EXPORTER=stopped'], ['e13-on-r1', ''], ['e13-on-r2', ''], ['e13-off-r2', 'EXPORTER=stopped'], ['e13-off-r3', 'EXPORTER=stopped'], ['e13-on-r3', '']]) lines.push(`${l} k6 race 400 ${env}`.trim())
for (const [l, env] of [['e14-race-1api-r1', E14], ['e14-race-2api-r1', ''], ['e14-race-2api-r2', ''], ['e14-race-1api-r2', E14], ['e14-race-1api-r3', E14], ['e14-race-2api-r3', '']]) lines.push(`${l} k6 race 400 ${env}`.trim())
// F: bench loop (APIs stopped): E2 cohorts, E5b pool, E7 catalog, E11 replay.
for (let r = 1; r <= 3; r++) {
  for (const c of rot([1, 5, 20], r)) lines.push(`e2-cohorts-${c}-r${r} bench --actors 400 --profile shared --cohorts ${c} --budget-ms 60000`)
  for (const p of rot([6, 12, 24, 48], r)) lines.push(`e5b-pool-${p}-r${r} bench --actors 400 --profile shared --pool-max ${p} --budget-ms 60000`)
  for (const k of rot([3, 15, 300], r)) lines.push(`e7-catalog-${k}-r${r} bench --actors 100 --profile distributed --catalog-sections ${k} --budget-ms 60000`)
  for (const q of rot(['0', '0.5'], r)) lines.push(`e11-replay-${q}-r${r} bench --actors 400 --profile ample --replay-ratio ${q} --budget-ms 60000`)
}
// G: long runs last: mixed normal pool 12 vs 40 (E5/H8, ABBA), mixed quick (E10), stress 1 vs 2 APIs (E14).
sentinel('g')
for (const [l, env] of [['e5-mixed-p12-r1', ''], ['e5-mixed-p40-r1', 'SIMULATOR_DB_POOL_MAX=40'], ['e5-mixed-p40-r2', 'SIMULATOR_DB_POOL_MAX=40'], ['e5-mixed-p12-r2', ''], ['e5-mixed-p12-r3', ''], ['e5-mixed-p40-r3', 'SIMULATOR_DB_POOL_MAX=40']]) lines.push(`${l} k6 mixed 400 ${env}`.trim())
for (let r = 1; r <= 3; r++) lines.push(`e10-mixed-quick-r${r} k6 mixed 400 SCENARIO_QUICK=1`)
for (const [l, env] of [['e14-stress-1api-r1', E14], ['e14-stress-2api-r1', ''], ['e14-stress-2api-r2', ''], ['e14-stress-1api-r2', E14], ['e14-stress-1api-r3', E14], ['e14-stress-2api-r3', '']]) lines.push(`${l} k6 stress 400 ${env}`.trim())
console.log(lines.join('\n'))
