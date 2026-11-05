import { it } from 'vitest'
import { registerSectionSizingTests } from './programacion-academica-section-sizing.cases.mjs'

registerSectionSizingTests((name, run) => { it(name, run) })
