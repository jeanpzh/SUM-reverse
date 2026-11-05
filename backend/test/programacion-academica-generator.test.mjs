import { registerHooks } from 'node:module'
import { test } from 'node:test'

// Test-only resolver: preserve backend .js ESM imports while running local TS sources.
const sourceDirectory = new URL('../src/programacion-academica/', import.meta.url).href
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.startsWith(sourceDirectory) && specifier.startsWith('./') && specifier.endsWith('.js')) {
      return nextResolve(`${specifier.slice(0, -3)}.ts`, context)
    }
    return nextResolve(specifier, context)
  },
})
const { registerGeneratorTests } = await import('./programacion-academica-generator.cases.mjs')
registerGeneratorTests(test)
