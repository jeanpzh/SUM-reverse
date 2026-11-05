import { it } from 'vitest'
import { registerScheduleTests } from './programacion-academica-schedule.cases.mjs'

registerScheduleTests((name, run) => { it(name, run) })
