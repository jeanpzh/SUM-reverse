import { it } from 'vitest'
import { registerGeneratorTests } from './programacion-academica-generator.cases.mjs'

registerGeneratorTests((name, run) => { it(name, run) })
