import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { assertRegularPath, buildEnrollmentScenarioBundlesFromBytes } from './enrollment-scenarios.mjs'

const rows = [
  { codAsignatura: '20118041', desAsignatura: 'ALGORÍTMICA Y PROGRAMACIÓN ORIENTADA A OBJETOS', creditos: 4, ciclo: 4, tipoAsignatura: 'O' },
  { codAsignatura: '20118051', desAsignatura: 'BASE DE DATOS', creditos: 4, ciclo: 5, tipoAsignatura: 'O' },
  { codAsignatura: '20118066', desAsignatura: 'REDES, TRANSMISIÓN Y AUTOMATIZACIÓN Y CONTROL', creditos: 4, ciclo: 6, tipoAsignatura: 'O' },
  { codAsignatura: '20118084', desAsignatura: 'INGENIERIA DE LA INFORMACIÓN', creditos: 4, ciclo: 8, tipoAsignatura: 'O' },
]

test('independent temporary plan bytes build the same nine deterministic packages', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pem-plan-'))
  try {
    const file = join(directory, 'plan.json')
    await writeFile(file, JSON.stringify({ data: rows }))
    const first = await buildEnrollmentScenarioBundlesFromBytes(await (await import('node:fs/promises')).readFile(file))
    const second = await buildEnrollmentScenarioBundlesFromBytes(await (await import('node:fs/promises')).readFile(file))
    assert.equal(first.length, 9)
    assert.deepEqual(first, second)
    assert.equal(first[0].source.sha256.length, 64)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('rejects malformed independent inputs and symlinked source paths without printing file contents', async () => {
  await assert.rejects(() => buildEnrollmentScenarioBundlesFromBytes(Buffer.from('{invalid')), /JSON inválido/)
  const directory = await mkdtemp(join(tmpdir(), 'pem-symlink-'))
  try {
    const target = join(directory, 'target.json')
    const link = join(directory, 'linked.json')
    await mkdir(join(directory, 'synthetic'))
    await writeFile(target, JSON.stringify({ data: rows }))
    await symlink(target, link)
    await assert.rejects(() => assertRegularPath(link, 'temporary-source'), /symlink o tipo no permitido/)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
