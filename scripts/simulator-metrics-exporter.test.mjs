import assert from 'node:assert/strict'
import test from 'node:test'
import { renderMetrics } from '../infra/simulator/metrics-exporter.mjs'

test('exports bounded operational metrics without route or identity labels', () => {
  const output = renderMetrics({ 'api-a': { data: {
    process: { cpuUserMicros: 2e6, cpuSystemMicros: 1e6, rssBytes: 4096, eventLoopP95Ms: 20, droppedMetricSamples: 0 },
    pool: { total: 12, idle: 4, waiting: 3 }, databaseWaitEvents: [{ wait_event_type: 'Lock', count: 5 }],
    routes: [{ actorId: 'DO-NOT-EXPORT', credential: 'DO-NOT-EXPORT' }]
  } }, 'api-b': null })
  assert.match(output, /sum_simulator_cpu_seconds_total\{replica="api-a"\} 3\n/)
  assert.match(output, /sum_simulator_event_loop_p95_seconds\{replica="api-a"\} 0.02\n/)
  assert.match(output, /sum_simulator_pool_waiting\{replica="api-a"\} 3\n/)
  assert.match(output, /sum_simulator_api_up\{replica="api-b"\} 0\n/)
  assert.doesNotMatch(output, /DO-NOT-EXPORT|actorId|credential/)
})

test('rejects arbitrary replica labels and omits malformed metrics', () => {
  assert.throws(() => renderMetrics({ other: {} }), /Unexpected metrics replica/)
  assert.doesNotMatch(renderMetrics({ 'api-a': { data: { process: { rssBytes: NaN }, pool: {} } } }), /NaN|undefined/)
})
