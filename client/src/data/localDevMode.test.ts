import assert from 'node:assert/strict'
import test from 'node:test'
import { createLocalModeController, LOCAL_MODE_KEY, readLocalDevMode } from './localDevMode.ts'

function kit(initial: Array<[string, string]> = []) {
  const values = new Map(initial)
  const paths: string[] = []
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
  return { values, paths, controller: createLocalModeController(storage, (path) => paths.push(path)) }
}

test('MODE switches automatically, survives reload and preserves enrollment recovery records', () => {
  const { values, paths, controller } = kit([[LOCAL_MODE_KEY, 'DEV'], ['lp:session', 'old identity'], ['mr:intent:run:actor', 'pending']])
  assert.equal(controller.get(), 'DEV')
  controller.set('SIM')
  assert.equal(values.get(LOCAL_MODE_KEY), 'SIM')
  assert.equal(values.has('lp:session'), false)
  assert.equal(values.get('mr:intent:run:actor'), 'pending')
  assert.deepEqual(paths, ['/local/login'])
  controller.set('SIM')
  assert.equal(paths.length, 1)
  controller.set('DEV')
  assert.deepEqual(paths, ['/local/login', '/'])
  assert.equal(controller.get(), 'DEV')
})

test('invalid commands have no effects; fresh, unavailable or invalid stored mode opens simulation', () => {
  const { controller, paths, values } = kit()
  assert.equal(controller.get(), 'SIM')
  assert.throws(() => controller.set('PROD'), /MODE debe ser DEV o SIM/)
  assert.equal(values.size, 0)
  assert.deepEqual(paths, [])
  assert.equal(readLocalDevMode(null), 'SIM')
  assert.equal(readLocalDevMode({ getItem: () => { throw new Error('unavailable') } }), 'SIM')
  assert.equal(readLocalDevMode({ getItem: () => 'invalid' }), 'SIM')
})
