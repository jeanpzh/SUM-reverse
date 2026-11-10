import assert from 'node:assert/strict'

if (process.env.SUM_PLANNING_DOCKER_SYNTHETIC !== '1') throw new Error('Own synthetic Compose project required')
const base = new URL(process.env.SUM_PLANNING_DOCKER_BASE || 'http://127.0.0.1:5680')
if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' || base.pathname !== '/' || base.search || base.hash || base.username || base.password) throw new Error('Dedicated loopback origin required')
const api = `${base.origin}/api/local/programacion-academica/v1`
const page = await fetch(`${base.origin}/local/programacion-academica`)
assert.equal(page.status, 200)
assert.match(await page.text(), /<html/)
const catalog = await fetch(`${api}/catalogo`).then(response => response.json())
assert.ok(catalog.courses.length > 0)
const query = { question: '¿Cuál es la carga lectiva máxima?', facultyId: 'FISI', academicPeriod: '2027-I', asOf: '2026-11-10', teacherType: 'ordinario' }
const response = await fetch(`${api}/normativa/consultas`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base.origin }, body: JSON.stringify(query),
})
assert.equal(response.status, 200)
const advice = await response.json()
assert.equal(advice.revision, 'PA-NORMATIVE-1')
assert.equal(advice.retrievalMode, 'lexical-only')
assert.equal(advice.status, 'not-determined')
assert.ok(advice.citations.length > 0)
assert.equal(advice.generation.mode, 'extractive')
const invalid = await fetch(`${api}/normativa/consultas`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base.origin }, body: JSON.stringify({ ...query, question: '' }),
})
assert.equal(invalid.status, 400)
console.log('PASS Docker web → NestJS → Python, reviewed corpus, honest fallback and invalid input')
